const { pool } = require("../config/db");
const {
  enqueueAppointmentSyncMutation,
  resolveActiveGoogleSyncConnection,
} = require("./appointment-google-sync-enqueue.service");
const { parsePositiveInt } = require("../validation/input");

function normalizeIsoDate(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const candidate = new Date(Date.UTC(year, month - 1, day));

  if (
    candidate.getUTCFullYear() !== year
    || candidate.getUTCMonth() !== month - 1
    || candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return normalized;
}

function createResyncError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function listAppointmentsForFullResync({
  studioId,
  includePast = false,
  includeCancelled = false,
  dateFrom = null,
  dateTo = null,
  limit = 1000,
}) {
  const result = await pool.query(
    `SELECT a.id,
            TO_CHAR(a.data, 'YYYY-MM-DD') AS data_iso,
            TO_CHAR(a.ora, 'HH24:MI:SS') AS ora_iso,
            a.stato,
            a.medico,
            a.durata_minuti,
            a.updated_at
     FROM appuntamenti a
     WHERE a.studio_id = $1
       AND ($2::date IS NULL OR a.data >= $2::date)
       AND ($3::date IS NULL OR a.data <= $3::date)
       AND ($4::boolean OR a.data >= CURRENT_DATE)
       AND ($5::boolean OR a.stato <> 'annullato')
     ORDER BY a.data ASC, a.ora ASC, a.id ASC
     LIMIT $6`,
    [studioId, dateFrom, dateTo, includePast, includeCancelled, limit],
  );

  return result.rows.map((row) => ({
    id: Number(row.id),
    data_iso: row.data_iso,
    ora_iso: row.ora_iso,
    stato: row.stato,
    medico: row.medico,
    durata_minuti: row.durata_minuti,
    updated_at: row.updated_at || null,
  }));
}

async function enqueueFullAppointmentResync({
  studioId,
  actorUserId = null,
  requestId = null,
  includePast = false,
  includeCancelled = false,
  dateFrom = null,
  dateTo = null,
  limit = 1000,
} = {}) {
  const normalizedStudioId = parsePositiveInt(studioId);
  if (!normalizedStudioId) {
    throw createResyncError(400, "studioId non valido.");
  }

  const normalizedLimit = parsePositiveInt(limit, { max: 10000 }) || 1000;
  const normalizedDateFrom = dateFrom ? normalizeIsoDate(String(dateFrom)) : null;
  const normalizedDateTo = dateTo ? normalizeIsoDate(String(dateTo)) : null;
  if (dateFrom && !normalizedDateFrom) {
    throw createResyncError(400, "date_from non valida (formato YYYY-MM-DD).");
  }
  if (dateTo && !normalizedDateTo) {
    throw createResyncError(400, "date_to non valida (formato YYYY-MM-DD).");
  }
  if (
    normalizedDateFrom
    && normalizedDateTo
    && normalizedDateFrom > normalizedDateTo
  ) {
    throw createResyncError(400, "Range date non valido: date_from > date_to.");
  }

  const connection = await resolveActiveGoogleSyncConnection(normalizedStudioId);
  if (!connection.enabled || !connection.connectionId) {
    return {
      triggered: false,
      reason: connection.reason || "sync_not_available",
      total_candidates: 0,
      enqueued: 0,
      skipped: 0,
      failed: 0,
      failed_appointment_ids: [],
    };
  }

  const appointments = await listAppointmentsForFullResync({
    studioId: normalizedStudioId,
    includePast: Boolean(includePast),
    includeCancelled: Boolean(includeCancelled),
    dateFrom: normalizedDateFrom,
    dateTo: normalizedDateTo,
    limit: normalizedLimit,
  });

  const failedIds = [];
  let enqueued = 0;
  let skipped = 0;

  for (let index = 0; index < appointments.length; index += 1) {
    const appointment = appointments[index];
    const syntheticRequestId = `${
      typeof requestId === "string" && requestId.trim().length > 0
        ? requestId.trim()
        : `full-resync-${Date.now()}`
    }-${index + 1}`;

    try {
      const enqueueResult = await enqueueAppointmentSyncMutation({
        studioId: normalizedStudioId,
        appointmentId: appointment.id,
        operation: "upsert",
        requestId: syntheticRequestId,
        actorUserId,
        snapshot: {
          id: appointment.id,
          data: appointment.data_iso,
          ora: appointment.ora_iso,
          stato: appointment.stato,
          medico: appointment.medico,
          durata_minuti: appointment.durata_minuti,
          updated_at: appointment.updated_at,
          source: "full_resync",
        },
        connectionId: connection.connectionId,
      });

      if (enqueueResult.enqueued) {
        enqueued += 1;
      } else {
        skipped += 1;
      }
    } catch {
      failedIds.push(appointment.id);
    }
  }

  return {
    triggered: true,
    reason: "enqueued",
    total_candidates: appointments.length,
    enqueued,
    skipped,
    failed: failedIds.length,
    failed_appointment_ids: failedIds.slice(0, 50),
    params: {
      include_past: Boolean(includePast),
      include_cancelled: Boolean(includeCancelled),
      date_from: normalizedDateFrom,
      date_to: normalizedDateTo,
      limit: normalizedLimit,
    },
  };
}

module.exports = {
  enqueueFullAppointmentResync,
  normalizeIsoDate,
};
