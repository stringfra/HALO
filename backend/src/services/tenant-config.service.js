const { pool } = require("../config/db");
const { CORE_DOMAIN_LABELS, getVerticalConfig } = require("../config/multi-sector");
const { getVerticalTemplateByKey } = require("./vertical-templates.service");

const DEFAULT_TENANT_BRANDING = Object.freeze({
  product_name: "HALO",
  primary_color: "#0F766E",
  secondary_color: "#0F172A",
  logo_url: null,
});

const DEFAULT_ACTIVITY_STYLE = Object.freeze({
  primary_rgb: {
    r: 15,
    g: 118,
    b: 110,
  },
});

function mergeLabels(verticalLabels = {}, settingsLabels = {}) {
  return {
    ...CORE_DOMAIN_LABELS,
    ...verticalLabels,
    ...settingsLabels,
  };
}

function normalizeSettings(settingsJson) {
  if (!settingsJson || typeof settingsJson !== "object" || Array.isArray(settingsJson)) {
    return {};
  }

  return settingsJson;
}

function normalizeRgbSetting(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_ACTIVITY_STYLE.primary_rgb;
  }

  const r = Number(value.r);
  const g = Number(value.g);
  const b = Number(value.b);

  if (
    !Number.isInteger(r) ||
    !Number.isInteger(g) ||
    !Number.isInteger(b) ||
    r < 0 ||
    r > 255 ||
    g < 0 ||
    g > 255 ||
    b < 0 ||
    b > 255
  ) {
    return DEFAULT_ACTIVITY_STYLE.primary_rgb;
  }

  return { r, g, b };
}

async function getTenantConfigById(studioId) {
  const result = await pool.query(
    `SELECT id,
            codice,
            nome,
            display_name,
            business_name,
            vertical_key,
            brand_logo_url,
            brand_primary_color,
            brand_secondary_color,
            default_locale,
            default_timezone,
            settings_json,
            is_active
     FROM studi
     WHERE id = $1
     LIMIT 1`,
    [studioId],
  );

  if (result.rowCount === 0) {
    return null;
  }

  const row = result.rows[0];
  const vertical = getVerticalConfig(row.vertical_key);
  const verticalTemplate = await getVerticalTemplateByKey(vertical.key);
  const settings = normalizeSettings(row.settings_json);
  const templateSettings = normalizeSettings(verticalTemplate.default_settings);
  const tenantSettings = settings;
  const resolvedSettings = {
    ...templateSettings,
    ...tenantSettings,
  };
  const templateLabels = normalizeSettings(verticalTemplate.default_labels);
  const settingsLabels = normalizeSettings(tenantSettings.labels);

  return {
    id: row.id,
    code: row.codice,
    tenant_name: row.nome,
    display_name: row.display_name,
    business_name: row.business_name || row.nome,
    vertical_key: vertical.key,
    vertical_name: vertical.name,
    is_active: row.is_active,
    locale: row.default_locale,
    timezone: row.default_timezone,
    branding: {
      product_name:
        typeof resolvedSettings.product_name === "string" &&
        resolvedSettings.product_name.trim().length > 0
          ? resolvedSettings.product_name.trim()
          : DEFAULT_TENANT_BRANDING.product_name,
      logo_url: row.brand_logo_url || DEFAULT_TENANT_BRANDING.logo_url,
      primary_color: row.brand_primary_color || DEFAULT_TENANT_BRANDING.primary_color,
      secondary_color: row.brand_secondary_color || DEFAULT_TENANT_BRANDING.secondary_color,
    },
    labels: mergeLabels(
      {
        ...vertical.labels,
        ...templateLabels,
      },
      settingsLabels,
    ),
    settings: resolvedSettings,
    activity_style: {
      primary_rgb: normalizeRgbSetting(resolvedSettings.activities?.primary_rgb),
    },
    vertical_template: {
      key: verticalTemplate.key,
      name: verticalTemplate.name,
      default_settings: verticalTemplate.default_settings,
      default_labels: verticalTemplate.default_labels,
      default_features: verticalTemplate.default_features,
      default_modules: verticalTemplate.default_modules,
      default_roles: verticalTemplate.default_roles,
    },
  };
}

module.exports = {
  DEFAULT_ACTIVITY_STYLE,
  DEFAULT_TENANT_BRANDING,
  getTenantConfigById,
};
