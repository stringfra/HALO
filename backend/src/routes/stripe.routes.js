const crypto = require("crypto");
const express = require("express");
const { pool } = require("../config/db");
const { logFatturaPagamentoEvent } = require("../services/fatture-pagamenti.service");
const { parsePositiveInt } = require("../validation/input");

const router = express.Router();
const webhookPayloadLimit = "1mb";
const defaultToleranceSeconds = 300;
const paidEventTypes = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "payment_intent.succeeded",
]);
const expiredEventTypes = new Set(["checkout.session.expired"]);
const failedEventTypes = new Set([
  "checkout.session.async_payment_failed",
  "payment_intent.payment_failed",
]);

function extractFatturaIdFromEvent(event) {
  const object = event?.data?.object;
  const metadataFatturaId = parsePositiveInt(object?.metadata?.fattura_id);
  if (metadataFatturaId) {
    return metadataFatturaId;
  }

  if (typeof object?.client_reference_id === "string") {
    const match = object.client_reference_id.trim().match(/^fattura_(\d+)$/);
    if (match) {
      return parsePositiveInt(match[1]);
    }
  }

  return null;
}

function extractStripeSessionIdFromEvent(event) {
  const object = event?.data?.object;
  if (typeof object?.id === "string" && object.id.startsWith("cs_")) {
    return object.id;
  }
  if (typeof object?.metadata?.checkout_session_id === "string") {
    const sessionId = object.metadata.checkout_session_id.trim();
    return sessionId.length > 0 ? sessionId : null;
  }
  return null;
}

async function resolveFatturaIdByStripeSessionId(stripeSessionId) {
  if (typeof stripeSessionId !== "string" || stripeSessionId.trim().length === 0) {
    return null;
  }

  const result = await pool.query(
    `SELECT id
     FROM fatture
     WHERE stripe_session_id = $1
     ORDER BY id DESC
     LIMIT 1`,
    [stripeSessionId.trim()],
  );

  if (result.rowCount === 0) {
    return null;
  }

  return parsePositiveInt(result.rows[0]?.id);
}

function hasValidStripeSignature(req, secret) {
  const signatureHeader = req.headers["stripe-signature"];
  if (typeof signatureHeader !== "string" || signatureHeader.trim().length === 0) {
    return false;
  }
  if (!Buffer.isBuffer(req.body)) {
    return false;
  }

  const entries = signatureHeader
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const timestampEntry = entries.find((entry) => entry.startsWith("t="));
  const v1Signatures = entries
    .filter((entry) => entry.startsWith("v1="))
    .map((entry) => entry.slice(3))
    .filter((signature) => /^[0-9a-f]{64}$/i.test(signature));

  if (!timestampEntry || v1Signatures.length === 0) {
    return false;
  }

  const timestamp = Number.parseInt(timestampEntry.slice(2), 10);
  if (!Number.isInteger(timestamp)) {
    return false;
  }

  const toleranceSeconds =
    parsePositiveInt(process.env.STRIPE_WEBHOOK_TOLERANCE_SEC, { max: 86400 }) ||
    defaultToleranceSeconds;
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
    return false;
  }

  const rawBody = req.body.toString("utf8");
  const signedPayload = `${timestamp}.${rawBody}`;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  return v1Signatures.some((signature) => {
    const candidateBuffer = Buffer.from(signature, "hex");
    if (candidateBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(candidateBuffer, expectedBuffer);
  });
}

router.post(
  "/webhook",
  express.raw({ type: "application/json", limit: webhookPayloadLimit }),
  async (req, res) => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
    if (!webhookSecret) {
      return res.status(500).json({
        message: "Stripe webhook non configurato. Definisci STRIPE_WEBHOOK_SECRET.",
      });
    }

    if (!hasValidStripeSignature(req, webhookSecret)) {
      return res.status(400).json({
        message: "Firma webhook Stripe non valida.",
      });
    }

    let event = null;
    try {
      event = JSON.parse(req.body.toString("utf8"));
    } catch {
      return res.status(400).json({
        message: "Payload webhook Stripe non valido.",
      });
    }

    const eventType = typeof event?.type === "string" ? event.type : "";
    const isPaidEvent = paidEventTypes.has(eventType);
    const isExpiredEvent = expiredEventTypes.has(eventType);
    const isFailedEvent = failedEventTypes.has(eventType);
    const isHandledEvent = isPaidEvent || isExpiredEvent || isFailedEvent;
    if (!isHandledEvent) {
      return res.status(200).json({ received: true, ignored: true });
    }

    const stripeSessionId = extractStripeSessionIdFromEvent(event);
    let fatturaId = extractFatturaIdFromEvent(event);
    if (!fatturaId && stripeSessionId) {
      fatturaId = await resolveFatturaIdByStripeSessionId(stripeSessionId);
    }
    if (!fatturaId) {
      return res.status(200).json({ received: true, ignored: true });
    }
    const nextStripeStatus = isPaidEvent ? "paid" : isExpiredEvent ? "expired" : "failed";
    const shouldMarkInvoicePaid = isPaidEvent;

    try {
      const updateResult = await pool.query(
        `UPDATE fatture
         SET stato = CASE WHEN $2::boolean THEN 'pagata' ELSE stato END,
             stripe_status = $3,
             stripe_session_id = COALESCE(stripe_session_id, $4)
         WHERE id = $1
         RETURNING id, studio_id`,
        [fatturaId, shouldMarkInvoicePaid, nextStripeStatus, stripeSessionId],
      );

      if (updateResult.rowCount === 0) {
        return res.status(200).json({ received: true, ignored: true });
      }

      const updatedInvoice = updateResult.rows[0];
      await logFatturaPagamentoEvent({
        studioId: Number(updatedInvoice.studio_id),
        fatturaId: Number(updatedInvoice.id),
        stripeSessionId,
        eventType: shouldMarkInvoicePaid
          ? "paid"
          : isExpiredEvent
            ? "expired"
            : "failed",
        stripeStatus: nextStripeStatus,
        payload: {
          source: "stripe.webhook",
          stripe_event_id: event?.id || null,
          stripe_event_type: eventType,
        },
      });

      console.log(
        `[STRIPE_WEBHOOK] requestId=${req.requestId || "n/a"} eventId=${event?.id || "n/a"} type=${eventType} fatturaId=${fatturaId} stripeStatus=${nextStripeStatus}`,
      );

      return res.status(200).json({ received: true, updated: true });
    } catch (error) {
      if (error?.code === "42703" || error?.code === "42P01") {
        return res.status(500).json({
          message:
            "Schema DB non aggiornato: applica le modifiche SQL Stripe e storico eventi.",
        });
      }

      return res.status(500).json({
        message: "Errore aggiornando stato fattura da webhook Stripe.",
      });
    }
  },
);

module.exports = router;
