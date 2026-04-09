const express = require("express");
const { pool } = require("../config/db");
const { verifyToken, requirePermission } = require("../../middlewares/authMiddleware");
const { FEATURE_CATALOG } = require("../config/multi-sector");
const { getTenantConfigById } = require("../services/tenant-config.service");
const {
  mergeTenantSettingsPatch,
  normalizeTenantSettings,
} = require("../services/tenant-settings.service");
const { validateTenantSettings } = require("../services/tenant-settings-validation.service");
const { logTenantAuditEvent } = require("../services/tenant-audit-logs.service");
const {
  getResolvedFeatureFlags,
  listTenantFeatureOverrides,
  upsertTenantFeatureOverride,
} = require("../services/feature-flags.service");

const router = express.Router();

function normalizeOptionalString(value, { max = 160 } = {}) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > max) {
    return null;
  }

  return normalized;
}

function normalizeFeatureConfig(value) {
  if (value === undefined) {
    return {};
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value;
}

router.use(verifyToken);
router.use(requirePermission("settings.manage"));

router.get("/tenant-config", async (req, res) => {
  try {
    const studioId = Number(req.user?.studio_id);
    const tenant = await getTenantConfigById(studioId);

    if (!tenant) {
      return res.status(404).json({
        message: "Configurazione tenant non trovata.",
      });
    }

    const rawResult = await pool.query(
      `SELECT settings_json, settings_version
       FROM studi
       WHERE id = $1
       LIMIT 1`,
      [studioId],
    );

    return res.status(200).json({
      tenant,
      settings_version: rawResult.rows[0]?.settings_version ?? 1,
      raw_settings: rawResult.rows[0]?.settings_json ?? {},
    });
  } catch (error) {
    return res.status(500).json({
      message: "Errore nel recupero configurazione tenant.",
      detail: error.message,
    });
  }
});

router.put("/tenant-config", async (req, res) => {
  try {
    const studioId = Number(req.user?.studio_id);
    const actorUserId = Number(req.user?.id);
    const existingResult = await pool.query(
      `SELECT display_name,
              business_name,
              brand_primary_color,
              brand_secondary_color,
              default_locale,
              default_timezone,
              settings_json,
              settings_version
       FROM studi
       WHERE id = $1
       LIMIT 1`,
      [studioId],
    );

    if (existingResult.rowCount === 0) {
      return res.status(404).json({
        message: "Tenant non trovato.",
      });
    }

    const existing = existingResult.rows[0];
    const nextSettings =
      req.body?.settings === undefined
        ? normalizeTenantSettings(existing.settings_json)
        : mergeTenantSettingsPatch(existing.settings_json, req.body.settings);
    const validation = validateTenantSettings(nextSettings);

    if (!validation.valid) {
      return res.status(400).json({
        message: "Configurazione tenant non valida.",
        validation_errors: validation.errors,
      });
    }

    const displayName = normalizeOptionalString(req.body?.display_name, { max: 120 });
    const businessName = normalizeOptionalString(req.body?.business_name, { max: 160 });
    const primaryColor = normalizeOptionalString(req.body?.brand_primary_color, { max: 32 });
    const secondaryColor = normalizeOptionalString(req.body?.brand_secondary_color, { max: 32 });
    const locale = normalizeOptionalString(req.body?.default_locale, { max: 16 });
    const timezone = normalizeOptionalString(req.body?.default_timezone, { max: 64 });

    if (
      displayName === null ||
      businessName === null ||
      primaryColor === null ||
      secondaryColor === null ||
      locale === null ||
      timezone === null
    ) {
      return res.status(400).json({
        message: "Campi tenant non validi.",
      });
    }

    const nextVersion = Number(existing.settings_version || 1) + 1;

    await pool.query(
      `UPDATE studi
       SET display_name = COALESCE($2, display_name),
           business_name = COALESCE($3, business_name),
           brand_primary_color = COALESCE($4, brand_primary_color),
           brand_secondary_color = COALESCE($5, brand_secondary_color),
           default_locale = COALESCE($6, default_locale),
           default_timezone = COALESCE($7, default_timezone),
           settings_json = $8,
           settings_version = $9
       WHERE id = $1`,
      [
        studioId,
        displayName,
        businessName,
        primaryColor,
        secondaryColor,
        locale,
        timezone,
        nextSettings,
        nextVersion,
      ],
    );

    await logTenantAuditEvent({
      studioId,
      actorUserId,
      actionKey: "tenant.config.updated",
      entityKey: "tenant_config",
      changes: {
        previous_settings_version: Number(existing.settings_version || 1),
        next_settings_version: nextVersion,
        changed_fields: Object.keys(req.body || {}),
      },
    });

    const tenant = await getTenantConfigById(studioId);

    return res.status(200).json({
      message: "Configurazione tenant aggiornata.",
      settings_version: nextVersion,
      tenant,
      raw_settings: nextSettings,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Errore nell'aggiornamento configurazione tenant.",
      detail: error.message,
    });
  }
});

router.get("/tenant-audit-logs", async (req, res) => {
  try {
    const studioId = Number(req.user?.studio_id);
    const result = await pool.query(
      `SELECT id,
              actor_user_id,
              action_key,
              entity_key,
              changes_json,
              created_at
       FROM tenant_audit_logs
       WHERE studio_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT 100`,
      [studioId],
    );

    return res.status(200).json(result.rows);
  } catch (error) {
    return res.status(500).json({
      message: "Errore nel recupero audit log tenant.",
      detail: error.message,
    });
  }
});

router.get("/tenant-features", async (req, res) => {
  try {
    const studioId = Number(req.user?.studio_id);
    const tenant = await getTenantConfigById(studioId);

    if (!tenant) {
      return res.status(404).json({
        message: "Tenant non trovato.",
      });
    }

    const resolved = await getResolvedFeatureFlags(studioId, tenant.vertical_key);
    const overrides = await listTenantFeatureOverrides(studioId);

    return res.status(200).json({
      feature_catalog: FEATURE_CATALOG,
      resolved_feature_flags: resolved,
      overrides,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Errore nel recupero feature flags tenant.",
      detail: error.message,
    });
  }
});

router.put("/tenant-features/:featureKey", async (req, res) => {
  try {
    const studioId = Number(req.user?.studio_id);
    const actorUserId = Number(req.user?.id);
    const featureKey = String(req.params?.featureKey || "").trim();
    const enabled = req.body?.enabled;
    const configJson = normalizeFeatureConfig(req.body?.config);

    if (!FEATURE_CATALOG.includes(featureKey)) {
      return res.status(400).json({
        message: "Feature key non supportata.",
      });
    }

    if (typeof enabled !== "boolean") {
      return res.status(400).json({
        message: "Il campo enabled deve essere boolean.",
      });
    }

    if (configJson === null) {
      return res.status(400).json({
        message: "Il campo config deve essere un oggetto JSON.",
      });
    }

    const updated = await upsertTenantFeatureOverride(studioId, featureKey, enabled, configJson);

    await logTenantAuditEvent({
      studioId,
      actorUserId,
      actionKey: "tenant.feature.updated",
      entityKey: "tenant_feature",
      changes: {
        feature_key: featureKey,
        enabled,
        config: configJson,
      },
    });

    return res.status(200).json({
      message: "Feature flag tenant aggiornata.",
      feature: updated,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Errore nell'aggiornamento feature flag tenant.",
      detail: error.message,
    });
  }
});

module.exports = router;
