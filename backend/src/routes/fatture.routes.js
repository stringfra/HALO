const express = require("express");
const { pool } = require("../config/db");
const { logFatturaPagamentoEvent } = require("../services/fatture-pagamenti.service");
const { verifyToken, authorize, requirePermission } = require("../../middlewares/authMiddleware");
const { requireFeature } = require("../middleware/feature-flags");
const { serializeInvoice } = require("../services/domain-aliases.service");
const {
  hasOnlyKeys,
  parseDateDmyOrIso,
  parseEnum,
  parsePositiveAmount,
  parsePositiveInt,
} = require("../validation/input");

const router = express.Router();

const allowedStates = new Set(["da_pagare", "pagata"]);
const createKeys = [
  "paziente_id",
  "importo",
  "stato",
  "data",
  "client_id",
  "amount",
  "invoice_status",
  "invoice_date",
];
const reconcileKeys = ["session_id", "fattura_id", "invoice_id"];
const adminSegretarioRoles = ["ADMIN", "SEGRETARIO"];
const stripeApiBase = "https://api.stripe.com/v1";

function resolveInvoicePayload(body) {
  return {
    paziente_id: body?.paziente_id ?? body?.client_id,
    importo: body?.importo ?? body?.amount,
    stato: body?.stato ?? body?.invoice_status,
    data: body?.data ?? body?.invoice_date,
  };
}

function normalizeStripeStatus(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase();
}

function resolveStripeCurrency() {
  const value =
    typeof process.env.STRIPE_CURRENCY === "string"
      ? process.env.STRIPE_CURRENCY.trim().toLowerCase()
      : "";

  if (/^[a-z]{3}$/.test(value)) {
    return value;
  }

  return "eur";
}

function computeStripeAmountCents(value) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value)
        : Number.NaN;

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  const cents = Math.round(parsed * 100);
  if (!Number.isInteger(cents) || cents <= 0) {
    return null;
  }

  return cents;
}

function resolveCheckoutUrls(invoiceId) {
  const configuredSuccess = process.env.STRIPE_CHECKOUT_SUCCESS_URL?.trim();
  const configuredCancel = process.env.STRIPE_CHECKOUT_CANCEL_URL?.trim();

  if (configuredSuccess && configuredCancel) {
    return {
      successUrl: configuredSuccess,
      cancelUrl: configuredCancel,
    };
  }

  const clientUrl = (process.env.CLIENT_URL || "http://localhost:3000").replace(/\/+$/, "");
  return {
    successUrl: `${clientUrl}/fatture?stripe=success&session_id={CHECKOUT_SESSION_ID}&fattura_id=${invoiceId}`,
    cancelUrl: `${clientUrl}/fatture?stripe=cancel&fattura_id=${invoiceId}`,
  };
}

router.use(verifyToken);
router.use(requireFeature("billing.enabled"));

router.get("/", requirePermission("billing.read"), async (req, res) => {
  const requestedStatus = req.query?.stato ?? req.query?.invoice_status;
  const stato = parseEnum(requestedStatus, allowedStates, { allowUndefined: true });
  if (stato === null) {
    return res.status(400).json({
      message: "Filtro stato non valido. Usa 'da_pagare' o 'pagata'.",
    });
  }

  try {
    const studioId = Number(req.user?.studio_id);
    const params = [studioId];
    let query = `SELECT f.id,
                        f.paziente_id,
                        p.nome,
                        p.cognome,
                        f.importo,
                        f.stato,
                        TO_CHAR(f.data, 'DD MM YYYY') AS data,
                        f.stripe_session_id,
                        f.stripe_payment_link,
                        f.stripe_status,
                        f.stripe_generated_at
                 FROM fatture f
                 LEFT JOIN pazienti p ON p.id = f.paziente_id
                                     AND p.studio_id = f.studio_id
                 WHERE f.studio_id = $1`;

    if (stato) {
      params.push(stato);
      query += " AND f.stato = $2";
    }

    query += " ORDER BY f.data DESC, f.id DESC";

    const result = await pool.query(query, params);

    return res.status(200).json(result.rows.map(serializeInvoice));
  } catch (error) {
    return res.status(500).json({
      message: "Errore nel recupero fatture.",
      detail: error.message,
    });
  }
});

router.post("/", requirePermission("billing.write"), async (req, res) => {
  if (!hasOnlyKeys(req.body, createKeys)) {
    return res.status(400).json({ message: "Payload non valido." });
  }

  const payload = resolveInvoicePayload(req.body);
  const pazienteId = parsePositiveInt(payload?.paziente_id);
  const importo = parsePositiveAmount(payload?.importo, { max: 99999999 });
  const stato = parseEnum(payload?.stato, allowedStates, { allowUndefined: true });
  const data = parseDateDmyOrIso(payload?.data, { allowIso: true });

  if (!pazienteId || !importo || !data) {
    return res.status(400).json({
      message: "Campi richiesti: paziente_id/client_id, importo/amount > 0, data DD MM YYYY o YYYY-MM-DD.",
    });
  }
  if (stato === null) {
    return res.status(400).json({
      message: "Stato non valido. Usa 'da_pagare' o 'pagata'.",
    });
  }

  try {
    const studioId = Number(req.user?.studio_id);

    const result = await pool.query(
      `INSERT INTO fatture (studio_id, paziente_id, importo, stato, data, stripe_status)
       SELECT $1,
              p.id,
              $3,
              COALESCE($4, 'da_pagare'),
              $5,
              CASE
                WHEN COALESCE($4, 'da_pagare') = 'pagata' THEN 'manual'
                ELSE NULL
              END
       FROM pazienti p
       WHERE p.id = $2
         AND p.studio_id = $1
       RETURNING id,
                 paziente_id,
                 importo,
                 stato,
                 TO_CHAR(data, 'DD MM YYYY') AS data`,
      [studioId, pazienteId, importo, stato, data],
    );

    if (result.rowCount === 0) {
      return res.status(400).json({
        message: "Il paziente selezionato non esiste.",
      });
    }

    return res.status(201).json(serializeInvoice(result.rows[0]));
  } catch (error) {
    return res.status(500).json({
      message: "Errore nel salvataggio fattura.",
      detail: error.message,
    });
  }
});

router.post("/:id/mark-paid", requirePermission("billing.write"), async (req, res) => {
  const fatturaId = parsePositiveInt(req.params?.id);
  if (!fatturaId) {
    return res.status(400).json({ message: "ID fattura non valido." });
  }

  try {
    const studioId = Number(req.user?.studio_id);
    const invoiceResult = await pool.query(
      `SELECT id,
              stato,
              stripe_session_id,
              stripe_payment_link,
              stripe_status
       FROM fatture
       WHERE id = $1
         AND studio_id = $2`,
      [fatturaId, studioId],
    );

    if (invoiceResult.rowCount === 0) {
      return res.status(404).json({
        message: "Fattura non trovata.",
      });
    }

    const invoice = invoiceResult.rows[0];
    if (invoice.stato === "pagata") {
      return res.status(200).json(serializeInvoice({
        id: invoice.id,
        stato: "pagata",
        already_paid: true,
      }));
    }

    const stripeStatus = normalizeStripeStatus(invoice.stripe_status);
    const hasActiveStripeLink =
      typeof invoice.stripe_session_id === "string" &&
      invoice.stripe_session_id.trim().length > 0 &&
      typeof invoice.stripe_payment_link === "string" &&
      invoice.stripe_payment_link.trim().length > 0 &&
      stripeStatus !== "failed" &&
      stripeStatus !== "expired";

    if (hasActiveStripeLink) {
      return res.status(409).json({
        message:
          "Questa fattura ha un link Stripe attivo. Non puo essere segnata manualmente come pagata.",
      });
    }

    const updateResult = await pool.query(
      `UPDATE fatture
       SET stato = 'pagata',
           stripe_status = 'manual'
       WHERE id = $1
         AND studio_id = $2
       RETURNING id, stato`,
      [fatturaId, studioId],
    );

    return res.status(200).json(serializeInvoice(updateResult.rows[0]));
  } catch (error) {
    return res.status(500).json({
      message: "Errore nell'aggiornamento stato fattura.",
      detail: error.message,
    });
  }
});

router.post(
  "/:id/stripe-link",
  requireFeature("payments.stripe.enabled"),
  requirePermission("billing.write"),
  async (req, res) => {
  const fatturaId = parsePositiveInt(req.params?.id);
  if (!fatturaId) {
    return res.status(400).json({ message: "ID fattura non valido." });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!stripeSecretKey) {
    return res.status(500).json({
      message: "Stripe non configurato. Definisci STRIPE_SECRET_KEY.",
    });
  }

  try {
    const studioId = Number(req.user?.studio_id);
    const invoiceResult = await pool.query(
      `SELECT id,
              paziente_id,
              importo,
              stato,
              stripe_session_id,
              stripe_payment_link,
              stripe_status,
              stripe_generated_at
       FROM fatture
       WHERE id = $1
         AND studio_id = $2`,
      [fatturaId, studioId],
    );

    if (invoiceResult.rowCount === 0) {
      return res.status(404).json({
        message: "Fattura non trovata.",
      });
    }

    const invoice = invoiceResult.rows[0];
    if (invoice.stato !== "da_pagare") {
      return res.status(409).json({
        message: "Link Stripe generabile solo per fatture in stato 'da_pagare'.",
      });
    }

    const existingStripeStatus =
      typeof invoice.stripe_status === "string"
        ? invoice.stripe_status.toLowerCase()
        : "";
    const hasReusableStripeLink =
      typeof invoice.stripe_session_id === "string" &&
      invoice.stripe_session_id.length > 0 &&
      typeof invoice.stripe_payment_link === "string" &&
      invoice.stripe_payment_link.length > 0 &&
      existingStripeStatus !== "expired" &&
      existingStripeStatus !== "failed";

    if (hasReusableStripeLink) {
      return res.status(200).json(serializeInvoice({
        fattura_id: invoice.id,
        stripe_session_id: invoice.stripe_session_id,
        stripe_checkout_url: invoice.stripe_payment_link,
        stripe_status: invoice.stripe_status || "open",
        stripe_expires_at: null,
        stripe_generated_at: invoice.stripe_generated_at || null,
        reused: true,
      }));
    }

    const amountCents = computeStripeAmountCents(invoice.importo);
    if (!amountCents) {
      return res.status(500).json({
        message: "Importo fattura non valido per Stripe.",
      });
    }

    const currency = resolveStripeCurrency();
    const { successUrl, cancelUrl } = resolveCheckoutUrls(invoice.id);

    const payload = new URLSearchParams();
    payload.append("mode", "payment");
    payload.append("success_url", successUrl);
    payload.append("cancel_url", cancelUrl);
    payload.append("client_reference_id", `fattura_${invoice.id}`);
    payload.append("line_items[0][quantity]", "1");
    payload.append("line_items[0][price_data][currency]", currency);
    payload.append("line_items[0][price_data][unit_amount]", String(amountCents));
    payload.append("line_items[0][price_data][product_data][name]", `Fattura HALO #${invoice.id}`);
    payload.append(
      "line_items[0][price_data][product_data][description]",
      `Pagamento fattura gestionale #${invoice.id}`,
    );
    payload.append("metadata[fattura_id]", String(invoice.id));
    payload.append("metadata[paziente_id]", String(invoice.paziente_id));
    payload.append("metadata[studio_id]", String(studioId));
    payload.append("payment_intent_data[metadata][fattura_id]", String(invoice.id));
    payload.append("payment_intent_data[metadata][paziente_id]", String(invoice.paziente_id));
    payload.append("payment_intent_data[metadata][studio_id]", String(studioId));

    const idempotencyKey = `fattura-${studioId}-${invoice.id}`;
    const stripeResponse = await fetch(`${stripeApiBase}/checkout/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": idempotencyKey,
      },
      body: payload.toString(),
    });

    let stripeData = null;
    try {
      stripeData = await stripeResponse.json();
    } catch {
      stripeData = null;
    }

    if (!stripeResponse.ok) {
      const stripeMessage =
        typeof stripeData?.error?.message === "string"
          ? stripeData.error.message
          : `Errore Stripe HTTP ${stripeResponse.status}`;

      await pool.query(
        `UPDATE fatture
         SET stripe_status = 'failed'
         WHERE id = $1
           AND studio_id = $2`,
        [invoice.id, studioId],
      );
      await logFatturaPagamentoEvent({
        studioId,
        fatturaId: invoice.id,
        eventType: "failed",
        stripeStatus: "failed",
        payload: {
          source: "stripe.checkout.sessions.create",
          stripe_status_code: stripeResponse.status,
          stripe_error: stripeMessage,
        },
      });

      return res.status(502).json({
        message: `Creazione link Stripe fallita: ${stripeMessage}`,
      });
    }

    if (typeof stripeData?.id !== "string" || typeof stripeData?.url !== "string") {
      await pool.query(
        `UPDATE fatture
         SET stripe_status = 'failed'
         WHERE id = $1
           AND studio_id = $2`,
        [invoice.id, studioId],
      );
      await logFatturaPagamentoEvent({
        studioId,
        fatturaId: invoice.id,
        eventType: "failed",
        stripeStatus: "failed",
        payload: {
          source: "stripe.checkout.sessions.create",
          reason: "invalid_stripe_response",
        },
      });

      return res.status(502).json({
        message: "Risposta Stripe non valida durante la creazione sessione.",
      });
    }

    const stripeStatus =
      typeof stripeData.status === "string" && stripeData.status.trim().length > 0
        ? stripeData.status.trim().toLowerCase()
        : "open";

    const saveResult = await pool.query(
      `UPDATE fatture
       SET stripe_session_id = $3,
           stripe_payment_link = $4,
           stripe_status = $5,
           stripe_generated_at = NOW()
       WHERE id = $1
         AND studio_id = $2
       RETURNING id AS fattura_id,
                 stripe_session_id,
                 stripe_payment_link AS stripe_checkout_url,
                 stripe_status,
                 stripe_generated_at`,
      [invoice.id, studioId, stripeData.id, stripeData.url, stripeStatus],
    );

    if (saveResult.rowCount === 0) {
      return res.status(500).json({
        message: "Impossibile salvare riferimento Stripe su fattura.",
      });
    }

    await logFatturaPagamentoEvent({
      studioId,
      fatturaId: invoice.id,
      stripeSessionId: stripeData.id,
      eventType: "generated",
      stripeStatus,
      payload: {
        source: "stripe.checkout.sessions.create",
        stripe_expires_at:
          typeof stripeData.expires_at === "number" ? stripeData.expires_at : null,
      },
    });

    return res.status(201).json(serializeInvoice({
      ...saveResult.rows[0],
      stripe_expires_at:
        typeof stripeData.expires_at === "number" ? stripeData.expires_at : null,
      reused: false,
    }));
  } catch (error) {
    if (error?.code === "42703" || error?.code === "42P01") {
      return res.status(500).json({
        message:
          "Schema DB non aggiornato: applica le modifiche SQL Stripe e storico eventi.",
        detail: error.message,
      });
    }

    return res.status(500).json({
      message: "Errore durante la creazione della sessione Stripe.",
      detail: error.message,
    });
  }
  },
);

router.post(
  "/stripe/reconcile-success",
  requireFeature("payments.stripe.enabled"),
  requirePermission("billing.write"),
  async (req, res) => {
  if (!hasOnlyKeys(req.body, reconcileKeys)) {
    return res.status(400).json({ message: "Payload non valido." });
  }

  const rawSessionId =
    typeof req.body?.session_id === "string" ? req.body.session_id.trim() : "";
  if (!rawSessionId || !rawSessionId.startsWith("cs_")) {
    return res.status(400).json({ message: "session_id Stripe non valido." });
  }

  const requestedFatturaId = parsePositiveInt(req.body?.fattura_id ?? req.body?.invoice_id);
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!stripeSecretKey) {
    return res.status(500).json({
      message: "Stripe non configurato. Definisci STRIPE_SECRET_KEY.",
    });
  }

  try {
    const studioId = Number(req.user?.studio_id);
    const stripeResponse = await fetch(
      `${stripeApiBase}/checkout/sessions/${encodeURIComponent(rawSessionId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${stripeSecretKey}`,
        },
      },
    );

    let stripeData = null;
    try {
      stripeData = await stripeResponse.json();
    } catch {
      stripeData = null;
    }

    if (!stripeResponse.ok) {
      const stripeMessage =
        typeof stripeData?.error?.message === "string"
          ? stripeData.error.message
          : `Errore Stripe HTTP ${stripeResponse.status}`;
      return res.status(502).json({
        message: `Impossibile verificare stato pagamento Stripe: ${stripeMessage}`,
      });
    }

    const paymentStatus =
      typeof stripeData?.payment_status === "string"
        ? stripeData.payment_status.trim().toLowerCase()
        : null;
    const sessionStatus =
      typeof stripeData?.status === "string" ? stripeData.status.trim().toLowerCase() : null;
    const metadataFatturaId = parsePositiveInt(stripeData?.metadata?.fattura_id);
    const targetFatturaId = requestedFatturaId || metadataFatturaId || null;

    if (paymentStatus !== "paid") {
      if (sessionStatus) {
        await pool.query(
          `UPDATE fatture
           SET stripe_status = $3
           WHERE studio_id = $1
             AND (stripe_session_id = $2 OR ($4::bigint IS NOT NULL AND id = $4::bigint))`,
          [studioId, rawSessionId, sessionStatus, targetFatturaId],
        );
      }

      return res.status(200).json(serializeInvoice({
        reconciled: false,
        payment_status: paymentStatus,
        stripe_status: sessionStatus,
      }));
    }

    const updateResult = await pool.query(
      `WITH target AS (
         SELECT id
         FROM fatture
         WHERE studio_id = $1
           AND (stripe_session_id = $2 OR ($3::bigint IS NOT NULL AND id = $3::bigint))
         ORDER BY CASE WHEN stripe_session_id = $2 THEN 0 ELSE 1 END, id DESC
         LIMIT 1
       )
       UPDATE fatture f
       SET stato = 'pagata',
           stripe_status = 'paid',
           stripe_session_id = COALESCE(f.stripe_session_id, $2)
       FROM target t
       WHERE f.id = t.id
       RETURNING f.id, f.studio_id, f.stato, f.stripe_status, f.stripe_session_id`,
      [studioId, rawSessionId, targetFatturaId],
    );

    if (updateResult.rowCount === 0) {
      return res.status(404).json({
        message:
          "Nessuna fattura trovata per questa sessione Stripe nello studio corrente.",
      });
    }

    const updated = updateResult.rows[0];
    await logFatturaPagamentoEvent({
      studioId: Number(updated.studio_id),
      fatturaId: Number(updated.id),
      stripeSessionId: updated.stripe_session_id,
      eventType: "paid",
      stripeStatus: "paid",
      payload: {
        source: "stripe.reconcile.success_url",
        stripe_checkout_session_id: rawSessionId,
        stripe_payment_status: paymentStatus,
        stripe_session_status: sessionStatus,
        requested_fattura_id: requestedFatturaId,
        metadata_fattura_id: metadataFatturaId,
      },
    });

    return res.status(200).json(serializeInvoice({
      reconciled: true,
      fattura_id: Number(updated.id),
      payment_status: paymentStatus,
      stripe_status: "paid",
    }));
  } catch (error) {
    if (error?.code === "42703" || error?.code === "42P01") {
      return res.status(500).json({
        message:
          "Schema DB non aggiornato: applica le modifiche SQL Stripe e storico eventi.",
      });
    }

    return res.status(500).json({
      message: "Errore durante la riconciliazione pagamento Stripe.",
      detail: error.message,
    });
  }
  },
);

module.exports = router;
