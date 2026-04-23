const { pool } = require("../config/db");
const {
  FEATURE_CATALOG,
  VERTICALS,
  getVerticalConfig,
  resolveFeatureKeyFromModuleKey,
} = require("../config/multi-sector");

const FEATURE_TO_MODULE_KEY = Object.freeze({
  "dashboard.enabled": "dashboard",
  "agenda.enabled": "agenda",
  "calendar.google.enabled": "calendar_google",
  "clients.enabled": "clients",
  "billing.enabled": "billing",
  "payments.stripe.enabled": "payments_stripe",
  "inventory.enabled": "inventory",
  "automation.enabled": "automation",
  "reports.enabled": "reports",
  "advanced_notes.enabled": "advanced_notes",
  "custom_fields.enabled": "custom_fields",
});

let staticVerticalSyncPromise = null;

function normalizeObject(value, fallback = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }

  return value;
}

function normalizeRoles(value, fallback = []) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim().toUpperCase() : ""))
    .filter((entry) => entry.length > 0);
}

function toModuleDefaults(defaultFeatures = {}) {
  const normalizedFeatures = normalizeObject(defaultFeatures);
  const modules = {};

  for (const featureKey of FEATURE_CATALOG) {
    const moduleKey = FEATURE_TO_MODULE_KEY[featureKey];
    if (!moduleKey) {
      continue;
    }

    modules[moduleKey] = Boolean(normalizedFeatures[featureKey]);
  }

  return modules;
}

function buildDefaultFeaturesFromModules(modules = {}) {
  const featureFlags = {};
  const normalizedModules = normalizeObject(modules);

  for (const featureKey of FEATURE_CATALOG) {
    featureFlags[featureKey] = false;
  }

  for (const [moduleKey, enabled] of Object.entries(normalizedModules)) {
    const featureKey = resolveFeatureKeyFromModuleKey(moduleKey);
    if (!featureKey) {
      continue;
    }

    featureFlags[featureKey] = Boolean(enabled);
  }

  return featureFlags;
}

function staticVerticalToTemplate(verticalKey) {
  const vertical = getVerticalConfig(verticalKey);
  const defaultFeatures = buildDefaultFeaturesFromModules(vertical.modules || {});

  return {
    key: vertical.key,
    name: vertical.name,
    default_settings: normalizeObject(vertical.default_settings),
    default_labels: normalizeObject(vertical.labels),
    default_features: defaultFeatures,
    default_roles: normalizeRoles(vertical.roles),
    default_modules: normalizeObject(vertical.modules),
  };
}

function normalizeTemplateRow(row) {
  const defaultSettings = normalizeObject(row.default_settings_json);
  const defaultLabels = normalizeObject(row.default_labels_json);
  const defaultFeatures = normalizeObject(row.default_features_json);
  const defaultRoles = normalizeRoles(row.default_roles_json);

  return {
    key: row.key,
    name: row.name,
    default_settings: defaultSettings,
    default_labels: defaultLabels,
    default_features: defaultFeatures,
    default_roles: defaultRoles,
    default_modules: toModuleDefaults(defaultFeatures),
  };
}

async function syncStaticVerticalTemplates(client = pool) {
  const keys = Object.keys(VERTICALS);
  let upsertedCount = 0;

  for (const verticalKey of keys) {
    const template = staticVerticalToTemplate(verticalKey);
    const result = await client.query(
      `INSERT INTO vertical_templates (
         key,
         name,
         default_settings_json,
         default_labels_json,
         default_features_json,
         default_roles_json,
         created_at,
         updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       ON CONFLICT (key) DO UPDATE
       SET name = EXCLUDED.name,
           default_settings_json = EXCLUDED.default_settings_json,
           default_labels_json = EXCLUDED.default_labels_json,
           default_features_json = EXCLUDED.default_features_json,
           default_roles_json = EXCLUDED.default_roles_json,
           updated_at = NOW()`,
      [
        template.key,
        template.name,
        template.default_settings,
        template.default_labels,
        template.default_features,
        template.default_roles,
      ],
    );

    upsertedCount += Number(result.rowCount || 0);
  }

  return {
    static_verticals_total: keys.length,
    upserted_rows_total: upsertedCount,
  };
}

async function ensureStaticVerticalTemplatesSynced() {
  if (!staticVerticalSyncPromise) {
    staticVerticalSyncPromise = syncStaticVerticalTemplates().catch((error) => {
      staticVerticalSyncPromise = null;
      throw error;
    });
  }

  return staticVerticalSyncPromise;
}

async function attemptEnsureStaticVerticalTemplatesSynced() {
  try {
    await ensureStaticVerticalTemplatesSynced();
  } catch {
    // Keep runtime compatibility: template reads can still fall back to static config.
  }
}

async function getVerticalTemplateByKey(verticalKey) {
  await attemptEnsureStaticVerticalTemplatesSynced();

  const result = await pool.query(
    `SELECT key,
            name,
            default_settings_json,
            default_labels_json,
            default_features_json,
            default_roles_json
     FROM vertical_templates
     WHERE key = $1
     LIMIT 1`,
    [verticalKey],
  );

  if (result.rowCount === 0) {
    return staticVerticalToTemplate(verticalKey);
  }

  return normalizeTemplateRow(result.rows[0]);
}

async function listVerticalTemplates() {
  await attemptEnsureStaticVerticalTemplatesSynced();

  const result = await pool.query(
    `SELECT key,
            name,
            default_settings_json,
            default_labels_json,
            default_features_json,
            default_roles_json
     FROM vertical_templates
     ORDER BY key ASC`,
  );

  const dbTemplates = result.rows.map(normalizeTemplateRow);
  const dbTemplateKeys = new Set(dbTemplates.map((entry) => entry.key));
  const templates = [...dbTemplates];

  for (const verticalKey of Object.keys(VERTICALS)) {
    if (dbTemplateKeys.has(verticalKey)) {
      continue;
    }

    templates.push(staticVerticalToTemplate(verticalKey));
  }

  return templates.sort((left, right) => String(left.key).localeCompare(String(right.key)));
}

async function resolveVerticalTemplateStrict(verticalKey) {
  await attemptEnsureStaticVerticalTemplatesSynced();

  const normalizedKey = typeof verticalKey === "string" ? verticalKey.trim() : "";
  if (!normalizedKey) {
    return null;
  }

  const result = await pool.query(
    `SELECT key,
            name,
            default_settings_json,
            default_labels_json,
            default_features_json,
            default_roles_json
     FROM vertical_templates
     WHERE key = $1
     LIMIT 1`,
    [normalizedKey],
  );

  if (result.rowCount > 0) {
    return normalizeTemplateRow(result.rows[0]);
  }

  if (!Object.prototype.hasOwnProperty.call(VERTICALS, normalizedKey)) {
    return null;
  }

  return staticVerticalToTemplate(normalizedKey);
}

module.exports = {
  getVerticalTemplateByKey,
  listVerticalTemplates,
  resolveVerticalTemplateStrict,
  staticVerticalToTemplate,
  syncStaticVerticalTemplates,
  toModuleDefaults,
};
