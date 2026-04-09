const crypto = require("crypto");
const { pool } = require("../config/db");
const { getTenantConfigById } = require("./tenant-config.service");
const { getResolvedFeatureFlags } = require("./feature-flags.service");
const { getActiveGoogleConnection } = require("./google-calendar-auth.service");
const {
  buildAppointmentSyncDedupeKey,
  enqueueAppointmentSyncOutbox,
} = require("./appointment-sync-outbox.service");
const { parsePositiveInt } = require("../validation/input");

const googleCalendarFeatureKey = "calendar.google.enabled";

function createSyncEnqueueError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function sanitizeSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return {};
  }
  return snapshot;
}

function buildSyncFingerprint({
  studioId,
  appointmentId,
  operation,
  requestId = null,
  snapshot = {},
}) {
  const snapshotHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(sanitizeSnapshot(snapshot)))
    .digest("hex")
    .slice(0, 16);
  const requestToken =
    typeof requestId === "string" && requestId.trim().length > 0
      ? requestId.trim()
      : `${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
  return `${studioId}:${appointmentId}:${operation}:${requestToken}:${snapshotHash}`;
}

async function resolveActiveGoogleSyncConnection(studioId) {
  const normalizedStudioId = parsePositiveInt(studioId);
  if (!normalizedStudioId) {
    throw createSyncEnqueueError(400, "studio_id non valido per sync enqueue.");
  }

  const tenant = await getTenantConfigById(normalizedStudioId);
  if (!tenant || !tenant.is_active) {
    return {
      enabled: false,
      reason: "tenant_not_active",
      connectionId: null,
    };
  }

  const resolvedFlags = await getResolvedFeatureFlags(normalizedStudioId, tenant.vertical_key);
  if (!resolvedFlags?.[googleCalendarFeatureKey]) {
    return {
      enabled: false,
      reason: "feature_disabled",
      connectionId: null,
    };
  }

  const connection = await getActiveGoogleConnection(normalizedStudioId);
  if (!connection) {
    return {
      enabled: false,
      reason: "connection_not_active",
      connectionId: null,
    };
  }

  const connectionId = parsePositiveInt(connection.id);
  if (!connectionId) {
    return {
      enabled: false,
      reason: "connection_invalid",
      connectionId: null,
    };
  }

  const calendarId =
    typeof connection.calendar_id === "string" ? connection.calendar_id.trim() : "";
  if (!calendarId) {
    return {
      enabled: false,
      reason: "calendar_not_configured",
      connectionId: null,
    };
  }

  return {
    enabled: true,
    reason: "enabled",
    connectionId,
  };
}

async function resolveDeleteAppointmentSyncHint({
  studioId,
  appointmentId,
}) {
  const normalizedStudioId = parsePositiveInt(studioId);
  const normalizedAppointmentId = parsePositiveInt(appointmentId);
  if (!normalizedStudioId || !normalizedAppointmentId) {
    return {
      enabled: false,
      reason: "invalid_context",
      connectionId: null,
      googleEventId: null,
    };
  }

  const connection = await resolveActiveGoogleSyncConnection(normalizedStudioId);
  if (!connection.enabled || !connection.connectionId) {
    return {
      ...connection,
      googleEventId: null,
    };
  }

  const linkResult = await pool.query(
    `SELECT google_event_id
     FROM appointment_google_event_links
     WHERE connection_id = $1
       AND appointment_id = $2
     LIMIT 1`,
    [connection.connectionId, normalizedAppointmentId],
  );

  const googleEventId =
    typeof linkResult.rows[0]?.google_event_id === "string"
      ? linkResult.rows[0].google_event_id.trim()
      : null;

  return {
    enabled: true,
    reason: "enabled",
    connectionId: connection.connectionId,
    googleEventId: googleEventId || null,
  };
}

async function enqueueAppointmentSyncMutation({
  studioId,
  appointmentId,
  operation,
  requestId = null,
  actorUserId = null,
  snapshot = {},
  connectionId = null,
  googleEventId = null,
}) {
  const normalizedStudioId = parsePositiveInt(studioId);
  const normalizedAppointmentId = parsePositiveInt(appointmentId);
  const normalizedOperation =
    typeof operation === "string" ? operation.trim().toLowerCase() : "";
  if (
    !normalizedStudioId
    || !normalizedAppointmentId
    || !["create", "update", "delete", "upsert"].includes(normalizedOperation)
  ) {
    throw createSyncEnqueueError(400, "Payload enqueue sync non valido.");
  }

  let resolvedConnectionId = parsePositiveInt(connectionId);
  let resolution = null;

  if (!resolvedConnectionId) {
    resolution = await resolveActiveGoogleSyncConnection(normalizedStudioId);
    if (!resolution.enabled || !resolution.connectionId) {
      return {
        enqueued: false,
        reason: resolution?.reason || "sync_not_enabled",
      };
    }
    resolvedConnectionId = resolution.connectionId;
  }

  const normalizedSnapshot = sanitizeSnapshot(snapshot);
  const fingerprint = buildSyncFingerprint({
    studioId: normalizedStudioId,
    appointmentId: normalizedAppointmentId,
    operation: normalizedOperation,
    requestId,
    snapshot: normalizedSnapshot,
  });

  const payload = {
    request_id:
      typeof requestId === "string" && requestId.trim().length > 0
        ? requestId.trim()
        : null,
    actor_user_id: parsePositiveInt(actorUserId) || null,
    fingerprint,
    appointment_snapshot: normalizedSnapshot,
  };

  if (
    normalizedOperation === "delete"
    && typeof googleEventId === "string"
    && googleEventId.trim().length > 0
  ) {
    payload.google_event_id = googleEventId.trim();
  }

  const dedupeKey = buildAppointmentSyncDedupeKey({
    studioId: normalizedStudioId,
    connectionId: resolvedConnectionId,
    appointmentId: normalizedAppointmentId,
    operation: normalizedOperation,
    fingerprint,
  });

  const outboxJob = await enqueueAppointmentSyncOutbox({
    studioId: normalizedStudioId,
    connectionId: resolvedConnectionId,
    appointmentId: normalizedAppointmentId,
    operation: normalizedOperation,
    payload,
    dedupeKey,
  });

  return {
    enqueued: true,
    reason: "enqueued",
    outboxJob,
  };
}

module.exports = {
  enqueueAppointmentSyncMutation,
  resolveActiveGoogleSyncConnection,
  resolveDeleteAppointmentSyncHint,
};
