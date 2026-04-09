const crypto = require("crypto");
const { pool } = require("../config/db");
const {
  createHttpError,
  getUsableGoogleAccessToken,
} = require("./google-calendar-auth.service");
const { parsePositiveInt } = require("../validation/input");

const GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";
const syncRetryableStatusCodes = new Set([408, 409, 425, 429]);

function createSyncError(statusCode, message, detail, retryable = false) {
  const error = createHttpError(statusCode, message, detail);
  error.retryable = Boolean(retryable);
  return error;
}

function normalizeClockTime(value) {
  if (typeof value !== "string") {
    return "00:00:00";
  }

  const normalized = value.trim();
  if (/^\d{2}:\d{2}$/.test(normalized)) {
    return `${normalized}:00`;
  }
  if (/^\d{2}:\d{2}:\d{2}$/.test(normalized)) {
    return normalized;
  }
  return "00:00:00";
}

function toIsoLocalDateTime(dateIso, timeIso) {
  return `${dateIso}T${normalizeClockTime(timeIso)}`;
}

function addMinutesToIsoLocalDateTime(dateIso, timeIso, minutesToAdd) {
  const [year, month, day] = String(dateIso)
    .split("-")
    .map((part) => Number.parseInt(part, 10));
  const [hours, minutes, seconds] = normalizeClockTime(timeIso)
    .split(":")
    .map((part) => Number.parseInt(part, 10));
  const duration = Number.isInteger(minutesToAdd) && minutesToAdd > 0 ? minutesToAdd : 30;

  const date = new Date(
    Date.UTC(
      Number.isInteger(year) ? year : 1970,
      Number.isInteger(month) ? month - 1 : 0,
      Number.isInteger(day) ? day : 1,
      Number.isInteger(hours) ? hours : 0,
      Number.isInteger(minutes) ? minutes : 0,
      Number.isInteger(seconds) ? seconds : 0,
      0,
    ),
  );
  date.setUTCMinutes(date.getUTCMinutes() + duration);

  const yyyy = String(date.getUTCFullYear());
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mi = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
}

function mapAppointmentStatusToGoogle(status) {
  const normalized = typeof status === "string" ? status.trim().toLowerCase() : "";
  if (normalized === "annullato") {
    return "cancelled";
  }
  if (normalized === "in_attesa") {
    return "tentative";
  }
  return "confirmed";
}

function buildPatientDisplayName(appointment) {
  const firstName = typeof appointment?.nome === "string" ? appointment.nome.trim() : "";
  const lastName = typeof appointment?.cognome === "string" ? appointment.cognome.trim() : "";
  const fullName = `${firstName} ${lastName}`.trim();
  if (fullName.length > 0) {
    return fullName;
  }
  return `Paziente #${appointment?.paziente_id || "n/a"}`;
}

function buildGoogleEventPayload({
  appointment,
  tenantTimezone,
  defaultDurationMinutes = null,
}) {
  const durationMinutes = parsePositiveInt(appointment?.durata_minuti, { max: 1440 })
    || parsePositiveInt(defaultDurationMinutes, { max: 1440 })
    || 30;
  const startDateTime = toIsoLocalDateTime(appointment.data_iso, appointment.ora_iso);
  const endDateTime = addMinutesToIsoLocalDateTime(
    appointment.data_iso,
    appointment.ora_iso,
    durationMinutes,
  );

  return {
    summary: buildPatientDisplayName(appointment),
    description: [
      `HALO appointment #${appointment.id}`,
      `Stato: ${appointment.stato}`,
      `Operatore: ${appointment.medico}`,
    ].join("\n"),
    status: mapAppointmentStatusToGoogle(appointment.stato),
    start: {
      dateTime: startDateTime,
      timeZone: tenantTimezone,
    },
    end: {
      dateTime: endDateTime,
      timeZone: tenantTimezone,
    },
    extendedProperties: {
      private: {
        halo_studio_id: String(appointment.studio_id),
        halo_appointment_id: String(appointment.id),
        halo_sync_version: String(appointment.updated_at || appointment.created_at || ""),
      },
    },
  };
}

function sanitizePayloadObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value;
}

function isRetryableStatusCode(statusCode) {
  if (!Number.isInteger(statusCode)) {
    return false;
  }
  if (syncRetryableStatusCodes.has(statusCode)) {
    return true;
  }
  return statusCode >= 500 && statusCode <= 599;
}

async function googleCalendarRequest({
  method,
  calendarId,
  path,
  accessToken,
  body = null,
}) {
  const endpoint = `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}${path}`;
  const response = await fetch(endpoint, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  const parsed = text
    ? (() => {
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      })()
    : null;

  if (!response.ok) {
    const detail =
      parsed?.error?.message
      || parsed?.error_description
      || text
      || "google_calendar_request_failed";
    throw createSyncError(
      response.status,
      "Google Calendar API error.",
      detail,
      isRetryableStatusCode(response.status),
    );
  }

  return parsed;
}

async function getOutboxConnectionConfig(studioId) {
  const featureResult = await pool.query(
    `SELECT config_json
     FROM tenant_features
     WHERE studio_id = $1
       AND feature_key = 'calendar.google.enabled'
     LIMIT 1`,
    [studioId],
  );

  const configJson = featureResult.rows[0]?.config_json;
  return configJson && typeof configJson === "object" && !Array.isArray(configJson)
    ? configJson
    : {};
}

async function loadAppointmentContext(studioId, appointmentId) {
  const result = await pool.query(
    `SELECT a.id,
            a.studio_id,
            a.paziente_id,
            a.medico,
            a.stato,
            a.durata_minuti,
            a.created_at,
            a.updated_at,
            TO_CHAR(a.data, 'YYYY-MM-DD') AS data_iso,
            TO_CHAR(a.ora, 'HH24:MI:SS') AS ora_iso,
            p.nome,
            p.cognome,
            s.default_timezone
     FROM appuntamenti a
     LEFT JOIN pazienti p ON p.id = a.paziente_id
                          AND p.studio_id = a.studio_id
     JOIN studi s ON s.id = a.studio_id
     WHERE a.id = $1
       AND a.studio_id = $2
     LIMIT 1`,
    [appointmentId, studioId],
  );

  return result.rows[0] || null;
}

async function loadExistingEventLink(connectionId, appointmentId) {
  const result = await pool.query(
    `SELECT id,
            studio_id,
            connection_id,
            appointment_id,
            google_event_id,
            google_event_etag,
            last_payload_hash
     FROM appointment_google_event_links
     WHERE connection_id = $1
       AND appointment_id = $2
     LIMIT 1`,
    [connectionId, appointmentId],
  );

  return result.rows[0] || null;
}

async function upsertEventLink({
  studioId,
  connectionId,
  appointmentId,
  googleEventId,
  googleEventEtag = null,
  payloadHash = null,
}) {
  const result = await pool.query(
    `INSERT INTO appointment_google_event_links (
       studio_id,
       connection_id,
       appointment_id,
       google_event_id,
       google_event_etag,
       last_payload_hash,
       last_synced_at,
       sync_state,
       last_error,
       created_at,
       updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), 'synced', NULL, NOW(), NOW())
     ON CONFLICT (connection_id, appointment_id)
     DO UPDATE SET
       studio_id = EXCLUDED.studio_id,
       google_event_id = EXCLUDED.google_event_id,
       google_event_etag = EXCLUDED.google_event_etag,
       last_payload_hash = EXCLUDED.last_payload_hash,
       last_synced_at = NOW(),
       sync_state = 'synced',
       last_error = NULL,
       updated_at = NOW()
     RETURNING id,
               studio_id,
               connection_id,
               appointment_id,
               google_event_id,
               google_event_etag,
               last_payload_hash,
               last_synced_at,
               sync_state,
               updated_at`,
    [studioId, connectionId, appointmentId, googleEventId, googleEventEtag, payloadHash],
  );

  return result.rows[0] || null;
}

async function deleteEventLink(connectionId, appointmentId) {
  await pool.query(
    `DELETE FROM appointment_google_event_links
     WHERE connection_id = $1
       AND appointment_id = $2`,
    [connectionId, appointmentId],
  );
}

function readGoogleEventIdFromPayload(payload) {
  const rawId = typeof payload?.google_event_id === "string" ? payload.google_event_id.trim() : "";
  return rawId || null;
}

async function syncDeleteOperation({
  studioId,
  connectionId,
  appointmentId,
  payload,
  accessToken,
  calendarId,
}) {
  const existingLink = await loadExistingEventLink(connectionId, appointmentId);
  const googleEventId = readGoogleEventIdFromPayload(payload) || existingLink?.google_event_id || null;
  if (!googleEventId) {
    return {
      operation: "delete",
      mode: "noop",
      reason: "event_link_not_found",
    };
  }

  try {
    await googleCalendarRequest({
      method: "DELETE",
      calendarId,
      path: `/events/${encodeURIComponent(googleEventId)}?sendUpdates=none`,
      accessToken,
    });
  } catch (error) {
    if (Number(error?.statusCode) !== 404) {
      throw error;
    }
  }

  await deleteEventLink(connectionId, appointmentId);
  return {
    operation: "delete",
    mode: "deleted",
    google_event_id: googleEventId,
    studio_id: studioId,
  };
}

async function syncUpsertOperation({
  studioId,
  connectionId,
  appointmentId,
  operation,
  accessToken,
  calendarId,
}) {
  const appointment = await loadAppointmentContext(studioId, appointmentId);
  if (!appointment) {
    throw createSyncError(
      409,
      "Appuntamento non disponibile per sincronizzazione.",
      "appointment_not_found",
      false,
    );
  }

  const featureConfig = await getOutboxConnectionConfig(studioId);
  const defaultDurationMinutes = parsePositiveInt(featureConfig?.default_duration_minutes, { max: 1440 });
  const tenantTimezone =
    typeof appointment?.default_timezone === "string" && appointment.default_timezone.trim().length > 0
      ? appointment.default_timezone.trim()
      : "Europe/Rome";
  const eventPayload = buildGoogleEventPayload({
    appointment,
    tenantTimezone,
    defaultDurationMinutes,
  });
  const payloadHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(eventPayload))
    .digest("hex");

  const existingLink = await loadExistingEventLink(connectionId, appointmentId);
  if (existingLink?.google_event_id) {
    try {
      const patched = await googleCalendarRequest({
        method: "PATCH",
        calendarId,
        path: `/events/${encodeURIComponent(existingLink.google_event_id)}?sendUpdates=none`,
        accessToken,
        body: eventPayload,
      });

      await upsertEventLink({
        studioId,
        connectionId,
        appointmentId,
        googleEventId: patched?.id || existingLink.google_event_id,
        googleEventEtag: typeof patched?.etag === "string" ? patched.etag : null,
        payloadHash,
      });

      return {
        operation,
        mode: "patched",
        google_event_id: patched?.id || existingLink.google_event_id,
      };
    } catch (error) {
      if (Number(error?.statusCode) !== 404) {
        throw error;
      }
    }
  }

  const inserted = await googleCalendarRequest({
    method: "POST",
    calendarId,
    path: "/events?sendUpdates=none",
    accessToken,
    body: eventPayload,
  });

  if (typeof inserted?.id !== "string" || inserted.id.trim().length === 0) {
    throw createSyncError(
      502,
      "Google Calendar ha risposto senza event id.",
      "missing_google_event_id",
      true,
    );
  }

  await upsertEventLink({
    studioId,
    connectionId,
    appointmentId,
    googleEventId: inserted.id.trim(),
    googleEventEtag: typeof inserted?.etag === "string" ? inserted.etag : null,
    payloadHash,
  });

  return {
    operation,
    mode: existingLink ? "recreated" : "created",
    google_event_id: inserted.id.trim(),
  };
}

async function syncAppointmentOutboxItem(outboxItem) {
  const studioId = parsePositiveInt(outboxItem?.studio_id);
  const connectionId = parsePositiveInt(outboxItem?.connection_id);
  const appointmentId = parsePositiveInt(outboxItem?.appointment_id);
  const operationRaw = typeof outboxItem?.operation === "string" ? outboxItem.operation.trim().toLowerCase() : "";
  const operation = ["create", "update", "delete", "upsert"].includes(operationRaw)
    ? operationRaw
    : null;

  if (!studioId || !connectionId || !appointmentId || !operation) {
    throw createSyncError(400, "Outbox item non valido.", "invalid_outbox_payload", false);
  }

  const payload = sanitizePayloadObject(outboxItem?.payload_json);
  const usable = await getUsableGoogleAccessToken(studioId);
  const activeConnection = usable?.connection || null;
  if (!activeConnection || Number(activeConnection.id) !== connectionId) {
    throw createSyncError(
      409,
      "Connessione Google non attiva o cambiata per il tenant.",
      "stale_or_inactive_connection",
      false,
    );
  }

  const calendarId = typeof activeConnection.calendar_id === "string"
    ? activeConnection.calendar_id.trim()
    : "";
  if (!calendarId) {
    throw createSyncError(
      400,
      "Calendar ID non configurato sulla connessione Google attiva.",
      "missing_calendar_id",
      false,
    );
  }

  if (operation === "delete") {
    return syncDeleteOperation({
      studioId,
      connectionId,
      appointmentId,
      payload,
      accessToken: usable.accessToken,
      calendarId,
    });
  }

  return syncUpsertOperation({
    studioId,
    connectionId,
    appointmentId,
    operation,
    payload,
    accessToken: usable.accessToken,
    calendarId,
  });
}

module.exports = {
  buildGoogleEventPayload,
  isRetryableStatusCode,
  syncAppointmentOutboxItem,
};
