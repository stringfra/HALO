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
  applyFeatureDependencies,
  getMissingDependencies,
  getResolvedFeatureFlags,
  listFeatureCatalogEntries,
  listTenantFeatureOverrides,
  upsertTenantFeatureOverride,
} = require("../services/feature-flags.service");
const {
  createTenantCustomRole,
  deleteTenantCustomRole,
  getTenantRbacCatalog,
  updateTenantCustomRole,
} = require("../services/tenant-rbac-catalog.service");
const {
  listVerticalTemplates,
  resolveVerticalTemplateStrict,
} = require("../services/vertical-templates.service");
const { parsePositiveInt } = require("../validation/input");

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

function hasOnlyKeys(body, allowedKeys = []) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return false;
  }

  const allowed = new Set(allowedKeys);
  return Object.keys(body).every((key) => allowed.has(key));
}

function normalizeOptionalBoolean(value) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    return null;
  }

  return value;
}

function normalizeRole(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function buildResolvedFeatureFlagsFromTemplateAndOverrides(template, overrides = []) {
  const featureFlags = {};
  for (const featureKey of FEATURE_CATALOG) {
    featureFlags[featureKey] = Boolean(template?.default_features?.[featureKey]);
  }

  for (const override of overrides) {
    if (!FEATURE_CATALOG.includes(override?.feature_key)) {
      continue;
    }
    featureFlags[override.feature_key] = Boolean(override.enabled);
  }

  return applyFeatureDependencies(featureFlags);
}

function computeFeatureDiff(before = {}, after = {}) {
  const enabledNow = [];
  const disabledNow = [];

  for (const featureKey of FEATURE_CATALOG) {
    const beforeEnabled = Boolean(before[featureKey]);
    const afterEnabled = Boolean(after[featureKey]);

    if (!beforeEnabled && afterEnabled) {
      enabledNow.push(featureKey);
    } else if (beforeEnabled && !afterEnabled) {
      disabledNow.push(featureKey);
    }
  }

  return {
    enabled_now: enabledNow,
    disabled_now: disabledNow,
  };
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

router.get("/vertical-templates", async (_req, res) => {
  try {
    const templates = await listVerticalTemplates();
    return res.status(200).json({
      templates,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Errore nel recupero vertical templates.",
      detail: error.message,
    });
  }
});

router.get("/vertical-templates/:verticalKey", async (req, res) => {
  try {
    const verticalKey = String(req.params?.verticalKey || "").trim();
    const template = await resolveVerticalTemplateStrict(verticalKey);
    if (!template) {
      return res.status(404).json({
        message: "Vertical template non trovato.",
      });
    }

    return res.status(200).json(template);
  } catch (error) {
    return res.status(500).json({
      message: "Errore nel recupero vertical template.",
      detail: error.message,
    });
  }
});

router.put("/tenant-config/vertical", async (req, res) => {
  if (!hasOnlyKeys(req.body, ["vertical_key", "reset_feature_overrides", "dry_run"])) {
    return res.status(400).json({
      message: "Payload non valido.",
    });
  }

  const studioId = Number(req.user?.studio_id);
  const actorUserId = Number(req.user?.id);
  const actorRole = normalizeRole(req.user?.ruolo);
  const verticalKey =
    typeof req.body?.vertical_key === "string" ? req.body.vertical_key.trim() : "";
  const resetFeatureOverrides = normalizeOptionalBoolean(req.body?.reset_feature_overrides);
  const dryRun = normalizeOptionalBoolean(req.body?.dry_run);

  if (!verticalKey) {
    return res.status(400).json({
      message: "vertical_key obbligatorio.",
    });
  }
  if (resetFeatureOverrides === null) {
    return res.status(400).json({
      message: "reset_feature_overrides deve essere boolean.",
    });
  }
  if (dryRun === null) {
    return res.status(400).json({
      message: "dry_run deve essere boolean.",
    });
  }
  if (actorRole !== "ADMIN") {
    return res.status(403).json({
      message: "Solo ADMIN puo modificare la tipologia attivita del tenant.",
    });
  }

  try {
    const template = await resolveVerticalTemplateStrict(verticalKey);
    if (!template) {
      return res.status(400).json({
        message: "vertical_key non supportato.",
      });
    }

    const existingResult = await pool.query(
      `SELECT vertical_key
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

    const previousVerticalKey = String(existingResult.rows[0]?.vertical_key || "").trim() || "dental";
    const resolvedBefore = await getResolvedFeatureFlags(studioId, previousVerticalKey);
    const existingOverrides =
      resetFeatureOverrides === true ? [] : await listTenantFeatureOverrides(studioId);
    const resolvedAfterPreview = buildResolvedFeatureFlagsFromTemplateAndOverrides(
      template,
      existingOverrides,
    );
    const featureDiff = computeFeatureDiff(resolvedBefore, resolvedAfterPreview);

    if (dryRun === true) {
      return res.status(200).json({
        message: "Preview cambio tipologia attivita generata.",
        dry_run: true,
        preview: {
          previous_vertical_key: previousVerticalKey,
          next_vertical_key: template.key,
          reset_feature_overrides: resetFeatureOverrides === true,
          feature_diff: featureDiff,
          effective_feature_flags_before: resolvedBefore,
          effective_feature_flags_after: resolvedAfterPreview,
        },
      });
    }

    await pool.query(
      `UPDATE studi
       SET vertical_key = $2
       WHERE id = $1`,
      [studioId, template.key],
    );

    let deletedOverrides = 0;
    if (resetFeatureOverrides === true) {
      const deleteResult = await pool.query(
        `DELETE FROM tenant_features
         WHERE studio_id = $1`,
        [studioId],
      );
      deletedOverrides = Number(deleteResult.rowCount || 0);
    }

    await logTenantAuditEvent({
      studioId,
      actorUserId,
      actionKey: "tenant.vertical.updated",
      entityKey: "tenant_config",
      changes: {
        previous_vertical_key: previousVerticalKey,
        next_vertical_key: template.key,
        reset_feature_overrides: resetFeatureOverrides === true,
        deleted_feature_overrides_total: deletedOverrides,
      },
    });

    const tenant = await getTenantConfigById(studioId);
    const resolvedFeatureFlags = tenant
      ? await getResolvedFeatureFlags(studioId, tenant.vertical_key)
      : {};

    return res.status(200).json({
      message: "Vertical tenant aggiornato.",
      tenant,
      resolved_feature_flags: resolvedFeatureFlags,
      preview: {
        previous_vertical_key: previousVerticalKey,
        next_vertical_key: template.key,
        reset_feature_overrides: resetFeatureOverrides === true,
        feature_diff: featureDiff,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Errore nell'aggiornamento vertical tenant.",
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

router.get("/auth-events", async (req, res) => {
  try {
    const studioId = Number(req.user?.studio_id);
    const result = await pool.query(
      `SELECT id,
              studio_id,
              user_id,
              event_key,
              outcome,
              email,
              metadata_json,
              created_at
       FROM auth_events
       WHERE studio_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT 200`,
      [studioId],
    );

    return res.status(200).json(result.rows);
  } catch (error) {
    return res.status(500).json({
      message: "Errore nel recupero eventi autenticazione.",
      detail: error.message,
    });
  }
});

router.get("/tenant-features", requirePermission("features.manage"), async (req, res) => {
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
    const featureCatalogEntries = listFeatureCatalogEntries();

    return res.status(200).json({
      feature_catalog: FEATURE_CATALOG,
      feature_catalog_entries: featureCatalogEntries,
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

router.put("/tenant-features/:featureKey", requirePermission("features.manage"), async (req, res) => {
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

    const tenant = await getTenantConfigById(studioId);
    if (!tenant) {
      return res.status(404).json({
        message: "Tenant non trovato.",
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

    const resolvedBefore = await getResolvedFeatureFlags(studioId, tenant.vertical_key);
    if (enabled === true) {
      const missingDependencies = getMissingDependencies(
        {
          ...resolvedBefore,
          [featureKey]: true,
        },
        featureKey,
      );

      if (missingDependencies.length > 0) {
        return res.status(409).json({
          message: "Impossibile abilitare la feature senza dipendenze attive.",
          feature_key: featureKey,
          missing_dependencies: missingDependencies,
        });
      }
    }

    const updated = await upsertTenantFeatureOverride(studioId, featureKey, enabled, configJson);
    const resolvedAfter = await getResolvedFeatureFlags(studioId, tenant.vertical_key);
    const impactedDisabledFeatures = FEATURE_CATALOG.filter(
      (key) => key !== featureKey && resolvedBefore[key] === true && resolvedAfter[key] === false,
    );

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
      effective_feature_flags: resolvedAfter,
      impacted_disabled_features: impactedDisabledFeatures,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Errore nell'aggiornamento feature flag tenant.",
      detail: error.message,
    });
  }
});

router.get("/tenant-rbac/catalog", requirePermission("roles.manage"), async (req, res) => {
  try {
    const studioId = Number(req.user?.studio_id);
    const catalog = await getTenantRbacCatalog(studioId);
    if (!catalog) {
      return res.status(404).json({
        message: "Catalogo RBAC tenant non disponibile.",
      });
    }

    return res.status(200).json(catalog);
  } catch (error) {
    return res.status(500).json({
      message: "Errore nel recupero catalogo RBAC tenant.",
      detail: error.message,
    });
  }
});

router.post("/tenant-rbac/roles", requirePermission("roles.manage"), async (req, res) => {
  if (!hasOnlyKeys(req.body, ["role_key", "display_name", "permission_keys"])) {
    return res.status(400).json({
      message: "Payload non valido.",
    });
  }

  const studioId = Number(req.user?.studio_id);
  const actorUserId = Number(req.user?.id);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const created = await createTenantCustomRole(client, studioId, {
      roleKey: req.body?.role_key,
      displayName: req.body?.display_name,
      permissionKeys: req.body?.permission_keys,
    });

    await logTenantAuditEvent({
      studioId,
      actorUserId,
      actionKey: "tenant.role.created",
      entityKey: "tenant_role",
      changes: {
        role_id: created.id,
        role_key: created.role_key,
        is_system: created.is_system,
        permission_keys: created.permission_keys,
      },
    });

    await client.query("COMMIT");
    return res.status(201).json(created);
  } catch (error) {
    await client.query("ROLLBACK");
    if (error?.code === "TENANT_ROLE_INVALID_INPUT") {
      return res.status(400).json({ message: "Dati ruolo non validi." });
    }
    if (error?.code === "TENANT_ROLE_PERMISSION_INVALID") {
      return res.status(400).json({
        message: "Permission key non valida.",
        invalid_permission_keys: error.invalid_permission_keys || [],
      });
    }
    if (error?.code === "TENANT_ROLE_SYSTEM_RESERVED") {
      return res.status(409).json({
        message: "Role key riservata ai ruoli di sistema.",
      });
    }
    if (error?.code === "TENANT_ROLE_KEY_CONFLICT") {
      return res.status(409).json({
        message: "Role key gia presente nel tenant.",
      });
    }

    return res.status(500).json({
      message: "Errore nella creazione ruolo tenant.",
      detail: error.message,
    });
  } finally {
    client.release();
  }
});

router.put("/tenant-rbac/roles/:roleId", requirePermission("roles.manage"), async (req, res) => {
  if (!hasOnlyKeys(req.body, ["display_name", "permission_keys"])) {
    return res.status(400).json({
      message: "Payload non valido.",
    });
  }

  const studioId = Number(req.user?.studio_id);
  const actorUserId = Number(req.user?.id);
  const roleId = parsePositiveInt(req.params?.roleId);
  if (!roleId) {
    return res.status(400).json({
      message: "ID ruolo non valido.",
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const updated = await updateTenantCustomRole(client, studioId, roleId, {
      displayName: req.body?.display_name,
      permissionKeys: req.body?.permission_keys,
    });

    await logTenantAuditEvent({
      studioId,
      actorUserId,
      actionKey: "tenant.role.updated",
      entityKey: "tenant_role",
      changes: {
        role_id: roleId,
        changed_fields: Object.keys(req.body || {}),
        permission_keys: updated?.permission_keys || null,
      },
    });

    await client.query("COMMIT");
    return res.status(200).json(updated);
  } catch (error) {
    await client.query("ROLLBACK");
    if (error?.code === "TENANT_ROLE_INVALID_INPUT") {
      return res.status(400).json({ message: "Dati ruolo non validi." });
    }
    if (error?.code === "TENANT_ROLE_PERMISSION_INVALID") {
      return res.status(400).json({
        message: "Permission key non valida.",
        invalid_permission_keys: error.invalid_permission_keys || [],
      });
    }
    if (error?.code === "TENANT_ROLE_NOT_FOUND") {
      return res.status(404).json({
        message: "Ruolo tenant non trovato.",
      });
    }
    if (error?.code === "TENANT_ROLE_SYSTEM_IMMUTABLE") {
      return res.status(409).json({
        message: "Ruolo di sistema non modificabile.",
      });
    }

    return res.status(500).json({
      message: "Errore nell'aggiornamento ruolo tenant.",
      detail: error.message,
    });
  } finally {
    client.release();
  }
});

router.delete("/tenant-rbac/roles/:roleId", requirePermission("roles.manage"), async (req, res) => {
  const studioId = Number(req.user?.studio_id);
  const actorUserId = Number(req.user?.id);
  const roleId = parsePositiveInt(req.params?.roleId);
  if (!roleId) {
    return res.status(400).json({
      message: "ID ruolo non valido.",
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const deleted = await deleteTenantCustomRole(client, studioId, roleId);

    await logTenantAuditEvent({
      studioId,
      actorUserId,
      actionKey: "tenant.role.deleted",
      entityKey: "tenant_role",
      changes: {
        role_id: roleId,
        role_key: deleted.role_key,
      },
    });

    await client.query("COMMIT");
    return res.status(200).json({
      message: "Ruolo tenant eliminato.",
      role: deleted,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error?.code === "TENANT_ROLE_INVALID_INPUT") {
      return res.status(400).json({ message: "Dati ruolo non validi." });
    }
    if (error?.code === "TENANT_ROLE_NOT_FOUND") {
      return res.status(404).json({
        message: "Ruolo tenant non trovato.",
      });
    }
    if (error?.code === "TENANT_ROLE_SYSTEM_IMMUTABLE") {
      return res.status(409).json({
        message: "Ruolo di sistema non eliminabile.",
      });
    }
    if (error?.code === "TENANT_ROLE_ASSIGNED") {
      return res.status(409).json({
        message: "Ruolo assegnato a utenti tenant.",
      });
    }

    return res.status(500).json({
      message: "Errore nell'eliminazione ruolo tenant.",
      detail: error.message,
    });
  } finally {
    client.release();
  }
});

module.exports = router;
