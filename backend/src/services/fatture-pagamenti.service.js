const { pool } = require("../config/db");
const { parsePositiveInt } = require("../validation/input");

async function logFatturaPagamentoEvent({
  studioId,
  fatturaId,
  stripeSessionId = null,
  eventType,
  stripeStatus = null,
  payload = null,
}) {
  const normalizedStudioId = parsePositiveInt(studioId);
  if (!normalizedStudioId) {
    return;
  }
  const normalizedFatturaId = parsePositiveInt(fatturaId);
  if (!normalizedFatturaId) {
    return;
  }
  if (typeof eventType !== "string" || eventType.trim().length === 0) {
    return;
  }

  const safeEventType = eventType.trim().slice(0, 80);
  const safeStripeStatus =
    typeof stripeStatus === "string" && stripeStatus.trim().length > 0
      ? stripeStatus.trim().toLowerCase().slice(0, 50)
      : null;
  const safeStripeSessionId =
    typeof stripeSessionId === "string" && stripeSessionId.trim().length > 0
      ? stripeSessionId.trim().slice(0, 255)
      : null;
  const payloadJson = payload ? JSON.stringify(payload) : null;

  await pool.query(
    `INSERT INTO fatture_pagamenti (
      studio_id,
      fattura_id,
      stripe_session_id,
      event_type,
      stripe_status,
      payload
    )
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [
      normalizedStudioId,
      normalizedFatturaId,
      safeStripeSessionId,
      safeEventType,
      safeStripeStatus,
      payloadJson,
    ],
  );
}

module.exports = {
  logFatturaPagamentoEvent,
};
