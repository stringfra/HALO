const express = require("express");
const { pool } = require("../config/db");
const { verifyToken, requirePermission } = require("../../middlewares/authMiddleware");
const { requireFeature } = require("../middleware/feature-flags");
const {
  buildGoogleOAuthUrl,
  createHttpError,
  decryptGoogleToken,
  getActiveGoogleConnection,
  listGoogleCalendars,
  processOAuthCallback,
  revokeGoogleToken,
  verifyOAuthState,
} = require("../services/google-calendar-auth.service");
const { getTenantConfigById } = require("../services/tenant-config.service");
const {
  getResolvedFeatureFlags,
  upsertTenantFeatureOverride,
} = require("../services/feature-flags.service");
const { hasOnlyKeys, normalizeRequiredText, parsePositiveInt } = require("../validation/input");
const { processAppointmentSyncOutboxBatch } = require("../services/appointment-sync-worker.service");
const { getAppointmentSyncMetrics } = require("../services/appointment-sync-monitoring.service");
const { enqueueFullAppointmentResync } = require("../services/appointment-sync-full-resync.service");
const { logTenantAuditEvent } = require("../services/tenant-audit-logs.service");

const router = express.Router();
const featureKey = "calendar.google.enabled";

function normalizeClientUrl() {
  const raw = typeof process.env.CLIENT_URL === "string" ? process.env.CLIENT_URL.trim() : "";
  return raw || "http://localhost:3000";
}

function buildFallbackSuccessRedirect() {
  const base = normalizeClientUrl().replace(/\/+$/, "");
  return `${base}/impostazioni?google_calendar=connected`;
}

function sanitizeRedirectUrl(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const trimmed = value.trim();

  let candidateUrl = null;
  let allowedOrigin = null;
  try {
    candidateUrl = new URL(trimmed);
    allowedOrigin = new URL(normalizeClientUrl()).origin;
  } catch {
    return null;
  }

  if (candidateUrl.origin !== allowedOrigin) {
    return null;
  }

  return candidateUrl.toString();
}

function parseOptionalBoolean(value) {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "boolean") {
    return null;
  }
  return value;
}

async function safeLogTenantAuditEvent(payload) {
  try {
    await logTenantAuditEvent(payload);
  } catch (error) {
    console.warn("[google-calendar.routes] audit log skipped:", error.message);
  }
}

async function getFeatureOverride(studioId) {
  const result = await pool.query(
    `SELECT enabled, config_json
     FROM tenant_features
     WHERE studio_id = $1
       AND feature_key = $2
     LIMIT 1`,
    [studioId, featureKey],
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    enabled: Boolean(row.enabled),
    config: row.config_json && typeof row.config_json === "object" ? row.config_json : {},
  };
}

async function upsertFeatureConfig(studioId, patchConfig) {
  const tenant = await getTenantConfigById(studioId);
  if (!tenant) {
    throw createHttpError(404, "Tenant non trovato.");
  }

  const resolved = await getResolvedFeatureFlags(studioId, tenant.vertical_key);
  const currentEnabled = Boolean(resolved?.[featureKey]);
  const currentOverride = await getFeatureOverride(studioId);
  const currentConfig = currentOverride?.config || {};
  const nextConfig = {
    ...currentConfig,
    ...patchConfig,
  };

  return upsertTenantFeatureOverride(studioId, featureKey, currentEnabled, nextConfig);
}

async function buildStatusPayload(studioId) {
  const activeConnection = await getActiveGoogleConnection(studioId);
  const featureOverride = await getFeatureOverride(studioId);

  return {
    connected: Boolean(activeConnection),
    connection: activeConnection
      ? {
          id: Number(activeConnection.id),
          studio_id: Number(activeConnection.studio_id),
          connected_by_user_id: activeConnection.connected_by_user_id
            ? Number(activeConnection.connected_by_user_id)
            : null,
          google_account_email: activeConnection.google_account_email || null,
          calendar_id: activeConnection.calendar_id || null,
          token_expires_at: activeConnection.token_expires_at || null,
          status: activeConnection.status || "active",
          last_sync_at: activeConnection.last_sync_at || null,
          last_error: activeConnection.last_error || null,
          created_at: activeConnection.created_at || null,
          updated_at: activeConnection.updated_at || null,
        }
      : null,
    config: featureOverride?.config || {},
  };
}

router.post(
  "/oauth/start",
  verifyToken,
  requireFeature(featureKey),
  requirePermission("calendar.google.manage"),
  async (req, res) => {
    try {
      const studioId = Number(req.user?.studio_id);
      const userId = Number(req.user?.id);
      const requestedRedirect = req.body?.redirect_to;
      const redirectTo =
        requestedRedirect === undefined
          ? null
          : sanitizeRedirectUrl(requestedRedirect);

      if (requestedRedirect !== undefined && !redirectTo) {
        return res.status(400).json({
          message:
            "redirect_to non valido: deve usare lo stesso origin di CLIENT_URL.",
        });
      }

      const oauth = buildGoogleOAuthUrl({
        studioId,
        userId,
        redirectTo,
      });

      return res.status(200).json({
        auth_url: oauth.authUrl,
        state_expires_at: oauth.stateExpiresAt,
      });
    } catch (error) {
      const statusCode =
        Number.isInteger(error?.statusCode) && error.statusCode >= 400
          ? error.statusCode
          : 500;

      return res.status(statusCode).json({
        message:
          statusCode >= 500
            ? "Errore nella creazione URL OAuth Google."
            : error.message,
        detail: error?.detail,
      });
    }
  },
);

router.get("/oauth/callback", async (req, res) => {
  const googleError = typeof req.query?.error === "string" ? req.query.error.trim() : "";
  if (googleError) {
    return res.status(400).json({
      message: "Autorizzazione Google rifiutata o non completata.",
      error: googleError,
    });
  }

  const code = typeof req.query?.code === "string" ? req.query.code.trim() : "";
  const state = typeof req.query?.state === "string" ? req.query.state.trim() : "";

  if (!code || !state) {
    return res.status(400).json({
      message: "Query OAuth incompleta: code/state mancanti.",
    });
  }

  try {
    const statePayload = verifyOAuthState(state);
    const tenant = await getTenantConfigById(statePayload.studioId);
    if (!tenant || !tenant.is_active) {
      return res.status(403).json({
        message: "Tenant non attivo o non configurato.",
      });
    }

    const resolved = await getResolvedFeatureFlags(statePayload.studioId, tenant.vertical_key);
    if (!resolved?.[featureKey]) {
      return res.status(403).json({
        message: `Feature disattivata per tenant: ${featureKey}.`,
      });
    }

    const callbackResult = await processOAuthCallback({
      code,
      state,
    });

    const redirectTo = sanitizeRedirectUrl(callbackResult.state.redirectTo);
    if (redirectTo) {
      const url = new URL(redirectTo);
      url.searchParams.set("google_calendar", "connected");
      return res.redirect(302, url.toString());
    }

    const fallback = buildFallbackSuccessRedirect();
    return res.redirect(302, fallback);
  } catch (error) {
    const statusCode =
      Number.isInteger(error?.statusCode) && error.statusCode >= 400
        ? error.statusCode
        : 500;

    return res.status(statusCode).json({
      message:
        statusCode >= 500
          ? "Errore completando callback OAuth Google."
          : error.message,
      detail: error?.detail,
    });
  }
});

router.get(
  "/status",
  verifyToken,
  requireFeature(featureKey),
  requirePermission("calendar.google.read"),
  async (req, res) => {
    try {
      const studioId = Number(req.user?.studio_id);
      const status = await buildStatusPayload(studioId);
      return res.status(200).json(status);
    } catch (error) {
      return res.status(500).json({
        message: "Errore nel recupero stato integrazione Google Calendar.",
        detail: error.message,
      });
    }
  },
);

router.get(
  "/calendars",
  verifyToken,
  requireFeature(featureKey),
  requirePermission("calendar.google.read"),
  async (req, res) => {
    try {
      const studioId = Number(req.user?.studio_id);
      const calendars = await listGoogleCalendars(studioId);
      return res.status(200).json({
        total: calendars.length,
        calendars,
      });
    } catch (error) {
      const statusCode =
        Number.isInteger(error?.statusCode) && error.statusCode >= 400
          ? error.statusCode
          : 500;

      return res.status(statusCode).json({
        message:
          statusCode >= 500
            ? "Errore nel recupero calendari Google."
            : error.message,
        detail: error?.detail,
      });
    }
  },
);

router.put(
  "/config",
  verifyToken,
  requireFeature(featureKey),
  requirePermission("calendar.google.manage"),
  async (req, res) => {
    if (!hasOnlyKeys(req.body, ["calendar_id", "default_duration_minutes"])) {
      return res.status(400).json({
        message: "Payload non valido.",
      });
    }

    try {
      const studioId = Number(req.user?.studio_id);
      const calendarId = normalizeRequiredText(req.body?.calendar_id, { min: 1, max: 255 });
      const defaultDurationMinutes =
        req.body?.default_duration_minutes === undefined
          ? undefined
          : parsePositiveInt(req.body?.default_duration_minutes, { max: 1440 });

      if (req.body?.calendar_id !== undefined && !calendarId) {
        return res.status(400).json({
          message: "calendar_id non valido.",
        });
      }

      if (
        req.body?.default_duration_minutes !== undefined &&
        !defaultDurationMinutes
      ) {
        return res.status(400).json({
          message: "default_duration_minutes non valido (1-1440).",
        });
      }

      const connection = await getActiveGoogleConnection(studioId);
      if (!connection) {
        return res.status(404).json({
          message: "Connessione Google Calendar attiva non trovata.",
        });
      }

      if (calendarId) {
        await pool.query(
          `UPDATE google_calendar_connections
           SET calendar_id = $2,
               updated_at = NOW()
           WHERE id = $1`,
          [connection.id, calendarId],
        );
      }

      if (defaultDurationMinutes !== undefined) {
        await upsertFeatureConfig(studioId, {
          default_duration_minutes: defaultDurationMinutes,
        });
      }

      const status = await buildStatusPayload(studioId);
      await safeLogTenantAuditEvent({
        studioId,
        actorUserId: Number(req.user?.id),
        actionKey: "google_calendar.config.updated",
        entityKey: "google_calendar_connection",
        changes: {
          calendar_id_updated: Boolean(calendarId),
          default_duration_minutes: defaultDurationMinutes,
        },
      });

      return res.status(200).json({
        message: "Configurazione Google Calendar aggiornata.",
        ...status,
      });
    } catch (error) {
      const statusCode =
        Number.isInteger(error?.statusCode) && error.statusCode >= 400
          ? error.statusCode
          : 500;

      return res.status(statusCode).json({
        message:
          statusCode >= 500
            ? "Errore aggiornando configurazione Google Calendar."
            : error.message,
        detail: error?.detail,
      });
    }
  },
);

router.post(
  "/disconnect",
  verifyToken,
  requireFeature(featureKey),
  requirePermission("calendar.google.manage"),
  async (req, res) => {
    try {
      const studioId = Number(req.user?.studio_id);
      const activeConnection = await getActiveGoogleConnection(studioId);
      if (!activeConnection) {
        return res.status(200).json({
          message: "Nessuna connessione Google Calendar attiva.",
          disconnected: false,
        });
      }

      const refreshToken = decryptGoogleToken(activeConnection.refresh_token_encrypted);
      const accessToken = decryptGoogleToken(activeConnection.access_token_encrypted);
      const [refreshRevoked, accessRevoked] = await Promise.all([
        revokeGoogleToken(refreshToken),
        revokeGoogleToken(accessToken),
      ]);

      await pool.query(
        `UPDATE google_calendar_connections
         SET status = 'revoked',
             last_error = NULL,
             updated_at = NOW()
         WHERE studio_id = $1
           AND status = 'active'`,
        [studioId],
      );

      await safeLogTenantAuditEvent({
        studioId,
        actorUserId: Number(req.user?.id),
        actionKey: "google_calendar.connection.disconnected",
        entityKey: "google_calendar_connection",
        changes: {
          connection_id: Number(activeConnection.id),
          google_account_email: activeConnection.google_account_email || null,
          refresh_token_revoked: Boolean(refreshRevoked),
          access_token_revoked: Boolean(accessRevoked),
        },
      });

      return res.status(200).json({
        message: "Connessione Google Calendar disconnessa.",
        disconnected: true,
        revoke: {
          refresh_token_revoked: Boolean(refreshRevoked),
          access_token_revoked: Boolean(accessRevoked),
        },
      });
    } catch (error) {
      const statusCode =
        Number.isInteger(error?.statusCode) && error.statusCode >= 400
          ? error.statusCode
          : 500;

      return res.status(statusCode).json({
        message:
          statusCode >= 500
            ? "Errore disconnettendo Google Calendar."
            : error.message,
        detail: error?.detail,
      });
    }
  },
);

router.get(
  "/sync/metrics",
  verifyToken,
  requireFeature(featureKey),
  requirePermission("calendar.google.read"),
  async (req, res) => {
    const windowHours =
      req.query?.window_hours === undefined
        ? undefined
        : parsePositiveInt(req.query.window_hours, { max: 24 * 30 });
    const failedLimit =
      req.query?.failed_limit === undefined
        ? undefined
        : parsePositiveInt(req.query.failed_limit, { max: 200 });

    if (req.query?.window_hours !== undefined && !windowHours) {
      return res.status(400).json({
        message: "window_hours non valido (1-720).",
      });
    }
    if (req.query?.failed_limit !== undefined && !failedLimit) {
      return res.status(400).json({
        message: "failed_limit non valido (1-200).",
      });
    }

    try {
      const studioId = Number(req.user?.studio_id);
      const metrics = await getAppointmentSyncMetrics({
        studioId,
        windowHours,
        failedLimit,
      });

      return res.status(200).json(metrics);
    } catch (error) {
      return res.status(500).json({
        message: "Errore nel recupero metriche sync Google Calendar.",
        detail: error.message,
      });
    }
  },
);

router.post(
  "/sync/full",
  verifyToken,
  requireFeature(featureKey),
  requirePermission("calendar.google.manage"),
  async (req, res) => {
    if (
      !hasOnlyKeys(req.body || {}, [
        "include_past",
        "include_cancelled",
        "date_from",
        "date_to",
        "limit",
      ])
    ) {
      return res.status(400).json({
        message: "Payload non valido.",
      });
    }

    const includePast = parseOptionalBoolean(req.body?.include_past);
    const includeCancelled = parseOptionalBoolean(req.body?.include_cancelled);
    const dateFrom =
      req.body?.date_from === undefined ? undefined : String(req.body?.date_from);
    const dateTo = req.body?.date_to === undefined ? undefined : String(req.body?.date_to);
    const limit =
      req.body?.limit === undefined
        ? undefined
        : parsePositiveInt(req.body?.limit, { max: 10000 });

    if (req.body?.include_past !== undefined && includePast === null) {
      return res.status(400).json({
        message: "include_past deve essere boolean.",
      });
    }
    if (req.body?.include_cancelled !== undefined && includeCancelled === null) {
      return res.status(400).json({
        message: "include_cancelled deve essere boolean.",
      });
    }
    if (
      req.body?.date_from !== undefined
      && (typeof req.body?.date_from !== "string" || dateFrom.trim().length === 0)
    ) {
      return res.status(400).json({
        message: "date_from non valida (formato YYYY-MM-DD).",
      });
    }
    if (
      req.body?.date_to !== undefined
      && (typeof req.body?.date_to !== "string" || dateTo.trim().length === 0)
    ) {
      return res.status(400).json({
        message: "date_to non valida (formato YYYY-MM-DD).",
      });
    }
    if (req.body?.limit !== undefined && !limit) {
      return res.status(400).json({
        message: "limit non valido (1-10000).",
      });
    }

    try {
      const studioId = Number(req.user?.studio_id);
      const actorUserId = Number(req.user?.id);
      const requestId = typeof req.headers["x-request-id"] === "string"
        ? req.headers["x-request-id"].trim()
        : null;

      const result = await enqueueFullAppointmentResync({
        studioId,
        actorUserId,
        requestId,
        includePast,
        includeCancelled,
        dateFrom: dateFrom?.trim() || null,
        dateTo: dateTo?.trim() || null,
        limit,
      });

      await safeLogTenantAuditEvent({
        studioId,
        actorUserId,
        actionKey: "google_calendar.sync.full_resync.triggered",
        entityKey: "appointment_sync_outbox",
        changes: result,
      });

      return res.status(200).json({
        message: result.triggered
          ? "Full resync schedulato in outbox."
          : "Full resync non avviato (sync non disponibile).",
        ...result,
      });
    } catch (error) {
      const statusCode =
        Number.isInteger(error?.statusCode) && error.statusCode >= 400
          ? error.statusCode
          : 500;

      return res.status(statusCode).json({
        message:
          statusCode >= 500
            ? "Errore avviando full resync Google Calendar."
            : error.message,
        detail: error?.detail,
      });
    }
  },
);

router.post(
  "/sync/worker/run-once",
  verifyToken,
  requireFeature(featureKey),
  requirePermission("calendar.google.manage"),
  async (req, res) => {
    if (!hasOnlyKeys(req.body || {}, ["batch_size", "max_attempts"])) {
      return res.status(400).json({
        message: "Payload non valido.",
      });
    }

    const batchSize =
      req.body?.batch_size === undefined
        ? undefined
        : parsePositiveInt(req.body?.batch_size, { max: 200 });
    const maxAttempts =
      req.body?.max_attempts === undefined
        ? undefined
        : parsePositiveInt(req.body?.max_attempts, { max: 50 });

    if (req.body?.batch_size !== undefined && !batchSize) {
      return res.status(400).json({
        message: "batch_size non valido (1-200).",
      });
    }
    if (req.body?.max_attempts !== undefined && !maxAttempts) {
      return res.status(400).json({
        message: "max_attempts non valido (1-50).",
      });
    }

    try {
      const studioId = Number(req.user?.studio_id);
      const actorUserId = Number(req.user?.id);
      const summary = await processAppointmentSyncOutboxBatch({
        batchSize,
        maxAttempts,
      });

      await safeLogTenantAuditEvent({
        studioId,
        actorUserId,
        actionKey: "google_calendar.sync.worker_run_once",
        entityKey: "appointment_sync_outbox",
        changes: {
          batch_size: batchSize || null,
          max_attempts: maxAttempts || null,
          summary,
        },
      });

      return res.status(200).json({
        message: "Worker sync eseguito una volta.",
        summary,
      });
    } catch (error) {
      return res.status(500).json({
        message: "Errore eseguendo worker sync.",
        detail: error.message,
      });
    }
  },
);

module.exports = router;
