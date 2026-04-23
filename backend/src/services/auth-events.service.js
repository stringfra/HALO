const { pool } = require("../config/db");

let ensureAuthEventsTablePromise = null;

function normalizeEventKey(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized.length < 3 || normalized.length > 80) {
    return null;
  }

  return normalized;
}

function normalizeOutcome(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized !== "success" && normalized !== "failure") {
    return null;
  }

  return normalized;
}

function normalizeEmail(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 && normalized.length <= 255 ? normalized : null;
}

function normalizeMetadata(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value;
}

async function ensureAuthEventsTable() {
  if (!ensureAuthEventsTablePromise) {
    ensureAuthEventsTablePromise = (async () => {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS auth_events (
          id BIGSERIAL PRIMARY KEY,
          studio_id BIGINT NULL REFERENCES studi(id) ON DELETE SET NULL,
          user_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
          event_key VARCHAR(80) NOT NULL,
          outcome VARCHAR(20) NOT NULL,
          email VARCHAR(255) NULL,
          metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`,
      );

      await pool.query(
        `CREATE INDEX IF NOT EXISTS idx_auth_events_studio_id_created_at
         ON auth_events (studio_id, created_at DESC)`,
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS idx_auth_events_user_id_created_at
         ON auth_events (user_id, created_at DESC)`,
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS idx_auth_events_event_key_created_at
         ON auth_events (event_key, created_at DESC)`,
      );
    })().catch((error) => {
      ensureAuthEventsTablePromise = null;
      throw error;
    });
  }

  return ensureAuthEventsTablePromise;
}

async function logAuthEvent({
  studioId = null,
  userId = null,
  eventKey,
  outcome,
  email = null,
  metadata = {},
  client = pool,
}) {
  const normalizedEventKey = normalizeEventKey(eventKey);
  const normalizedOutcome = normalizeOutcome(outcome);
  const normalizedEmail = normalizeEmail(email);
  const normalizedMetadata = normalizeMetadata(metadata);

  if (!normalizedEventKey || !normalizedOutcome) {
    return;
  }

  await ensureAuthEventsTable();
  await client.query(
    `INSERT INTO auth_events (studio_id, user_id, event_key, outcome, email, metadata_json)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      Number.isInteger(Number(studioId)) && Number(studioId) > 0 ? Number(studioId) : null,
      Number.isInteger(Number(userId)) && Number(userId) > 0 ? Number(userId) : null,
      normalizedEventKey,
      normalizedOutcome,
      normalizedEmail,
      normalizedMetadata,
    ],
  );
}

module.exports = {
  ensureAuthEventsTable,
  logAuthEvent,
};

