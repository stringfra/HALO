const { pool } = require("../config/db");
const { FEATURE_CATALOG, VERTICALS, getVerticalConfig } = require("../config/multi-sector");

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

function staticVerticalToTemplate(verticalKey) {
  const vertical = getVerticalConfig(verticalKey);
  const featureFlags = {};

  for (const featureKey of FEATURE_CATALOG) {
    featureFlags[featureKey] = false;
  }

  for (const [moduleKey, enabled] of Object.entries(vertical.modules || {})) {
    const featureKey =
      moduleKey === "payments_stripe" ? "payments.stripe.enabled" : `${moduleKey}.enabled`;
    featureFlags[featureKey] = Boolean(enabled);
  }

  return {
    key: vertical.key,
    name: vertical.name,
    default_settings: {},
    default_labels: normalizeObject(vertical.labels),
    default_features: featureFlags,
    default_roles: normalizeRoles(vertical.roles),
  };
}

async function getVerticalTemplateByKey(verticalKey) {
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

  const row = result.rows[0];

  return {
    key: row.key,
    name: row.name,
    default_settings: normalizeObject(row.default_settings_json),
    default_labels: normalizeObject(row.default_labels_json),
    default_features: normalizeObject(row.default_features_json),
    default_roles: normalizeRoles(row.default_roles_json),
  };
}

async function resolveVerticalTemplateStrict(verticalKey) {
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
    const row = result.rows[0];

    return {
      key: row.key,
      name: row.name,
      default_settings: normalizeObject(row.default_settings_json),
      default_labels: normalizeObject(row.default_labels_json),
      default_features: normalizeObject(row.default_features_json),
      default_roles: normalizeRoles(row.default_roles_json),
    };
  }

  if (!Object.prototype.hasOwnProperty.call(VERTICALS, normalizedKey)) {
    return null;
  }

  return staticVerticalToTemplate(normalizedKey);
}

module.exports = {
  getVerticalTemplateByKey,
  resolveVerticalTemplateStrict,
  staticVerticalToTemplate,
};
