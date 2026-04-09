const { pool } = require("../config/db");
const { parsePositiveInt } = require("../validation/input");

function normalizeWindowHours(value) {
  return parsePositiveInt(value, { max: 24 * 30 }) || 24;
}

function normalizeLimit(value) {
  return parsePositiveInt(value, { max: 200 }) || 20;
}

function rowsToStatusMap(rows) {
  const output = {
    pending: 0,
    retry: 0,
    processing: 0,
    done: 0,
    failed: 0,
    total: 0,
  };

  for (const row of rows || []) {
    const key = typeof row?.status === "string" ? row.status.trim() : "";
    const count = Number.parseInt(row?.total, 10) || 0;
    if (Object.prototype.hasOwnProperty.call(output, key)) {
      output[key] = count;
    }
  }

  output.total = output.pending + output.retry + output.processing + output.done + output.failed;
  return output;
}

async function loadQueueStatus(studioId) {
  const result = await pool.query(
    `SELECT status, COUNT(*)::int AS total
     FROM appointment_sync_outbox
     WHERE studio_id = $1
     GROUP BY status`,
    [studioId],
  );

  return rowsToStatusMap(result.rows);
}

async function loadQueueDueAndOldest(studioId) {
  const [dueResult, oldestResult] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS total
       FROM appointment_sync_outbox
       WHERE studio_id = $1
         AND status IN ('pending', 'retry')
         AND (next_retry_at IS NULL OR next_retry_at <= NOW())`,
      [studioId],
    ),
    pool.query(
      `SELECT created_at
       FROM appointment_sync_outbox
       WHERE studio_id = $1
         AND status IN ('pending', 'retry')
       ORDER BY created_at ASC
       LIMIT 1`,
      [studioId],
    ),
  ]);

  return {
    due_now: Number.parseInt(dueResult.rows[0]?.total, 10) || 0,
    oldest_pending_at: oldestResult.rows[0]?.created_at || null,
  };
}

async function loadWindowStatus(studioId, windowHours) {
  const result = await pool.query(
    `SELECT status, COUNT(*)::int AS total
     FROM appointment_sync_outbox
     WHERE studio_id = $1
       AND created_at >= NOW() - ($2::int * INTERVAL '1 hour')
     GROUP BY status`,
    [studioId, windowHours],
  );

  return rowsToStatusMap(result.rows);
}

async function loadRecentFailures(studioId, limit) {
  const result = await pool.query(
    `SELECT id,
            appointment_id,
            operation,
            attempts,
            last_error,
            created_at,
            processed_at
     FROM appointment_sync_outbox
     WHERE studio_id = $1
       AND status = 'failed'
     ORDER BY processed_at DESC NULLS LAST, id DESC
     LIMIT $2`,
    [studioId, limit],
  );

  return result.rows.map((row) => ({
    id: Number(row.id),
    appointment_id: Number(row.appointment_id),
    operation: row.operation,
    attempts: Number.parseInt(row.attempts, 10) || 0,
    last_error: row.last_error || null,
    created_at: row.created_at || null,
    processed_at: row.processed_at || null,
  }));
}

async function loadLinkErrorSummary(studioId) {
  const [totalResult, recentErrorsResult] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS total
       FROM appointment_google_event_links
       WHERE studio_id = $1
         AND sync_state = 'error'`,
      [studioId],
    ),
    pool.query(
      `SELECT appointment_id,
              google_event_id,
              last_error,
              updated_at
       FROM appointment_google_event_links
       WHERE studio_id = $1
         AND sync_state = 'error'
       ORDER BY updated_at DESC, id DESC
       LIMIT 10`,
      [studioId],
    ),
  ]);

  return {
    total: Number.parseInt(totalResult.rows[0]?.total, 10) || 0,
    recent: recentErrorsResult.rows.map((row) => ({
      appointment_id: Number(row.appointment_id),
      google_event_id: row.google_event_id || null,
      last_error: row.last_error || null,
      updated_at: row.updated_at || null,
    })),
  };
}

async function getAppointmentSyncMetrics({
  studioId,
  windowHours = 24,
  failedLimit = 20,
} = {}) {
  const normalizedStudioId = parsePositiveInt(studioId);
  if (!normalizedStudioId) {
    throw new Error("studioId non valido.");
  }

  const normalizedWindowHours = normalizeWindowHours(windowHours);
  const normalizedFailedLimit = normalizeLimit(failedLimit);

  const [queue, queueMeta, windowStatus, failures, linkErrors] = await Promise.all([
    loadQueueStatus(normalizedStudioId),
    loadQueueDueAndOldest(normalizedStudioId),
    loadWindowStatus(normalizedStudioId, normalizedWindowHours),
    loadRecentFailures(normalizedStudioId, normalizedFailedLimit),
    loadLinkErrorSummary(normalizedStudioId),
  ]);

  return {
    studio_id: normalizedStudioId,
    generated_at: new Date().toISOString(),
    window_hours: normalizedWindowHours,
    queue: {
      ...queue,
      due_now: queueMeta.due_now,
      oldest_pending_at: queueMeta.oldest_pending_at,
    },
    recent_window: {
      pending: windowStatus.pending,
      retry: windowStatus.retry,
      processing: windowStatus.processing,
      done: windowStatus.done,
      failed: windowStatus.failed,
      total_created: windowStatus.total,
    },
    failures,
    link_errors: linkErrors,
  };
}

module.exports = {
  getAppointmentSyncMetrics,
};
