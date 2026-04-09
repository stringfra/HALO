const crypto = require("crypto");
const { pool } = require("../config/db");
const { parsePositiveInt } = require("../validation/input");

const allowedOutboxOperations = new Set(["create", "update", "delete", "upsert"]);
const retryableStatusCodes = new Set([408, 409, 425, 429]);
const retryableNodeErrorCodes = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "EPIPE",
]);

function createOutboxError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeOperation(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return allowedOutboxOperations.has(normalized) ? normalized : null;
}

function sanitizePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }
  return payload;
}

function buildAppointmentSyncDedupeKey({
  studioId,
  connectionId,
  appointmentId,
  operation,
  fingerprint = "",
}) {
  const normalizedOperation = normalizeOperation(operation);
  if (!normalizedOperation) {
    throw createOutboxError(400, "operation non valida per dedupe key.");
  }

  const normalizedStudioId = parsePositiveInt(studioId);
  const normalizedConnectionId = parsePositiveInt(connectionId);
  const normalizedAppointmentId = parsePositiveInt(appointmentId);
  if (!normalizedStudioId || !normalizedConnectionId || !normalizedAppointmentId) {
    throw createOutboxError(400, "Contesto dedupe key non valido.");
  }

  const normalizedFingerprint =
    typeof fingerprint === "string" && fingerprint.trim().length > 0
      ? fingerprint.trim()
      : `${normalizedOperation}:${normalizedAppointmentId}`;

  const hash = crypto
    .createHash("sha256")
    .update(
      [
        normalizedStudioId,
        normalizedConnectionId,
        normalizedAppointmentId,
        normalizedOperation,
        normalizedFingerprint,
      ].join("|"),
    )
    .digest("hex")
    .slice(0, 40);

  return `gcal:${normalizedOperation}:${normalizedAppointmentId}:${hash}`;
}

async function enqueueAppointmentSyncOutbox({
  studioId,
  connectionId,
  appointmentId,
  operation,
  payload = {},
  dedupeKey = null,
}) {
  const normalizedStudioId = parsePositiveInt(studioId);
  const normalizedConnectionId = parsePositiveInt(connectionId);
  const normalizedAppointmentId = parsePositiveInt(appointmentId);
  const normalizedOperation = normalizeOperation(operation);
  if (!normalizedStudioId || !normalizedConnectionId || !normalizedAppointmentId || !normalizedOperation) {
    throw createOutboxError(400, "Payload enqueue outbox non valido.");
  }

  const payloadObject = sanitizePayload(payload);
  const resolvedDedupeKey =
    typeof dedupeKey === "string" && dedupeKey.trim().length > 0
      ? dedupeKey.trim()
      : buildAppointmentSyncDedupeKey({
          studioId: normalizedStudioId,
          connectionId: normalizedConnectionId,
          appointmentId: normalizedAppointmentId,
          operation: normalizedOperation,
          fingerprint: payloadObject.fingerprint || "",
        });

  const upsertResult = await pool.query(
    `INSERT INTO appointment_sync_outbox (
       studio_id,
       connection_id,
       appointment_id,
       operation,
       payload_json,
       dedupe_key,
       status,
       attempts,
       next_retry_at,
       locked_at,
       processed_at,
       last_error,
       created_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, 'pending', 0, NULL, NULL, NULL, NULL, NOW())
     ON CONFLICT (studio_id, dedupe_key)
     DO UPDATE
       SET connection_id = EXCLUDED.connection_id,
           appointment_id = EXCLUDED.appointment_id,
           operation = EXCLUDED.operation,
           payload_json = EXCLUDED.payload_json,
           status = CASE
             WHEN appointment_sync_outbox.status = 'done' THEN appointment_sync_outbox.status
             WHEN appointment_sync_outbox.status = 'processing' THEN appointment_sync_outbox.status
             ELSE 'pending'
           END,
           attempts = CASE
             WHEN appointment_sync_outbox.status = 'done' THEN appointment_sync_outbox.attempts
             WHEN appointment_sync_outbox.status = 'processing' THEN appointment_sync_outbox.attempts
             ELSE 0
           END,
           next_retry_at = CASE
             WHEN appointment_sync_outbox.status IN ('done', 'processing') THEN appointment_sync_outbox.next_retry_at
             ELSE NULL
           END,
           locked_at = CASE
             WHEN appointment_sync_outbox.status = 'processing' THEN appointment_sync_outbox.locked_at
             ELSE NULL
           END,
           processed_at = CASE
             WHEN appointment_sync_outbox.status = 'done' THEN appointment_sync_outbox.processed_at
             ELSE NULL
           END,
           last_error = CASE
             WHEN appointment_sync_outbox.status IN ('done', 'processing') THEN appointment_sync_outbox.last_error
             ELSE NULL
           END
     RETURNING id,
               studio_id,
               connection_id,
               appointment_id,
               operation,
               payload_json,
               dedupe_key,
               status,
               attempts,
               next_retry_at,
               created_at`,
    [
      normalizedStudioId,
      normalizedConnectionId,
      normalizedAppointmentId,
      normalizedOperation,
      payloadObject,
      resolvedDedupeKey,
    ],
  );

  return upsertResult.rows[0];
}

async function claimAppointmentSyncOutboxBatch(limit = 20) {
  const normalizedLimit = parsePositiveInt(limit, { max: 500 }) || 20;
  const result = await pool.query(
    `WITH candidates AS (
       SELECT id
       FROM appointment_sync_outbox
       WHERE status IN ('pending', 'retry')
         AND (next_retry_at IS NULL OR next_retry_at <= NOW())
       ORDER BY created_at ASC, id ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     UPDATE appointment_sync_outbox outbox
     SET status = 'processing',
         locked_at = NOW()
     FROM candidates
     WHERE outbox.id = candidates.id
     RETURNING outbox.id,
               outbox.studio_id,
               outbox.connection_id,
               outbox.appointment_id,
               outbox.operation,
               outbox.payload_json,
               outbox.dedupe_key,
               outbox.status,
               outbox.attempts,
               outbox.next_retry_at,
               outbox.created_at,
               outbox.locked_at`,
    [normalizedLimit],
  );

  return result.rows;
}

async function markOutboxJobDone(jobId) {
  const normalizedJobId = parsePositiveInt(jobId);
  if (!normalizedJobId) {
    return null;
  }

  const result = await pool.query(
    `UPDATE appointment_sync_outbox
     SET status = 'done',
         processed_at = NOW(),
         next_retry_at = NULL,
         locked_at = NULL,
         last_error = NULL
     WHERE id = $1
     RETURNING id, status, attempts, processed_at`,
    [normalizedJobId],
  );

  return result.rows[0] || null;
}

async function scheduleOutboxJobRetry({
  jobId,
  attempts,
  retryAt,
  errorMessage,
}) {
  const normalizedJobId = parsePositiveInt(jobId);
  const normalizedAttempts = parsePositiveInt(attempts, { max: 100 }) || 1;
  if (!normalizedJobId) {
    return null;
  }

  const result = await pool.query(
    `UPDATE appointment_sync_outbox
     SET status = 'retry',
         attempts = $2,
         next_retry_at = $3,
         locked_at = NULL,
         last_error = $4
     WHERE id = $1
     RETURNING id, status, attempts, next_retry_at, last_error`,
    [
      normalizedJobId,
      normalizedAttempts,
      retryAt instanceof Date ? retryAt.toISOString() : retryAt,
      typeof errorMessage === "string" ? errorMessage.slice(0, 2000) : "retry_scheduled",
    ],
  );

  return result.rows[0] || null;
}

async function markOutboxJobFailed({
  jobId,
  attempts,
  errorMessage,
}) {
  const normalizedJobId = parsePositiveInt(jobId);
  const normalizedAttempts = parsePositiveInt(attempts, { max: 100 }) || 1;
  if (!normalizedJobId) {
    return null;
  }

  const result = await pool.query(
    `UPDATE appointment_sync_outbox
     SET status = 'failed',
         attempts = $2,
         processed_at = NOW(),
         next_retry_at = NULL,
         locked_at = NULL,
         last_error = $3
     WHERE id = $1
     RETURNING id, status, attempts, processed_at, last_error`,
    [
      normalizedJobId,
      normalizedAttempts,
      typeof errorMessage === "string" ? errorMessage.slice(0, 2000) : "failed_without_detail",
    ],
  );

  return result.rows[0] || null;
}

function computeRetryDelayMs(attemptNumber, { baseMs = 30000, maxMs = 15 * 60 * 1000 } = {}) {
  const normalizedAttempt = parsePositiveInt(attemptNumber, { max: 100 }) || 1;
  const exponent = Math.min(normalizedAttempt - 1, 8);
  const deterministicDelay = Math.min(maxMs, baseMs * (2 ** exponent));
  const jitter = Math.floor(Math.random() * 5000);
  return deterministicDelay + jitter;
}

function isRetryableSyncError(error) {
  if (error?.retryable === true) {
    return true;
  }

  const statusCode = Number(error?.statusCode);
  if (Number.isInteger(statusCode)) {
    if (retryableStatusCodes.has(statusCode)) {
      return true;
    }
    if (statusCode >= 500 && statusCode <= 599) {
      return true;
    }
  }

  const code = typeof error?.code === "string" ? error.code.trim().toUpperCase() : "";
  if (code && retryableNodeErrorCodes.has(code)) {
    return true;
  }

  return false;
}

module.exports = {
  buildAppointmentSyncDedupeKey,
  claimAppointmentSyncOutboxBatch,
  computeRetryDelayMs,
  enqueueAppointmentSyncOutbox,
  isRetryableSyncError,
  markOutboxJobDone,
  markOutboxJobFailed,
  scheduleOutboxJobRetry,
};
