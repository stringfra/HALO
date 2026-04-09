const { pool } = require("../config/db");
const {
  CORE_NAVIGATION,
  FEATURE_CATALOG,
  LEGACY_ROLE_ALIASES,
  getRoleDisplayAlias,
} = require("../config/multi-sector");
const { getTenantConfigById } = require("./tenant-config.service");
const { getVerticalTemplateByKey } = require("./vertical-templates.service");
const { getUserPermissions } = require("./permissions.service");

function toEnabledModules(featureFlags) {
  return {
    dashboard: Boolean(featureFlags["dashboard.enabled"]),
    agenda: Boolean(featureFlags["agenda.enabled"]),
    google_calendar: Boolean(featureFlags["calendar.google.enabled"]),
    clients: Boolean(featureFlags["clients.enabled"]),
    billing: Boolean(featureFlags["billing.enabled"]),
    payments: {
      stripe: Boolean(featureFlags["payments.stripe.enabled"]),
    },
    inventory: Boolean(featureFlags["inventory.enabled"]),
    automation: Boolean(featureFlags["automation.enabled"]),
    reports: Boolean(featureFlags["reports.enabled"]),
    advanced_notes: Boolean(featureFlags["advanced_notes.enabled"]),
    custom_fields: Boolean(featureFlags["custom_fields.enabled"]),
  };
}

function canAccessNavigationItem(item, permissions, featureFlags) {
  const hasPermissions =
    !Array.isArray(item.requiredPermissions) ||
    item.requiredPermissions.every((permission) => permissions.includes(permission));

  if (!hasPermissions) {
    return false;
  }

  if (!item.featureKey) {
    return true;
  }

  return Boolean(featureFlags[item.featureKey]);
}

function getNavigationLabel(key, labels = {}) {
  const fallbackLabels = {
    dashboard: "Dashboard",
    agenda: labels.appointment_plural || "Agenda",
    clients: labels.client_plural || "Clienti",
    billing: labels.invoice_plural || "Fatture",
    inventory: labels.inventory_plural || "Magazzino",
    settings: "Impostazioni",
  };

  return fallbackLabels[key] || key;
}

async function listTenantFeatureOverrides(studioId) {
  const result = await pool.query(
    `SELECT feature_key, enabled, config_json
     FROM tenant_features
     WHERE studio_id = $1`,
    [studioId],
  );

  return result.rows;
}

async function upsertTenantFeatureOverride(studioId, featureKey, enabled, config = {}) {
  const result = await pool.query(
    `INSERT INTO tenant_features (studio_id, feature_key, enabled, config_json, created_at, updated_at)
     VALUES ($1, $2, $3, $4, NOW(), NOW())
     ON CONFLICT (studio_id, feature_key)
     DO UPDATE SET enabled = EXCLUDED.enabled,
                   config_json = EXCLUDED.config_json,
                   updated_at = NOW()
     RETURNING id, studio_id, feature_key, enabled, config_json, updated_at`,
    [studioId, featureKey, Boolean(enabled), config && typeof config === "object" ? config : {}],
  );

  return result.rows[0] || null;
}

async function getResolvedFeatureFlags(studioId, verticalKey) {
  const verticalTemplate = await getVerticalTemplateByKey(verticalKey);
  const featureFlags = {};

  for (const featureKey of FEATURE_CATALOG) {
    featureFlags[featureKey] = Boolean(verticalTemplate.default_features?.[featureKey]);
  }

  const overrides = await listTenantFeatureOverrides(studioId);

  for (const override of overrides) {
    if (typeof override.feature_key !== "string" || !FEATURE_CATALOG.includes(override.feature_key)) {
      continue;
    }

    featureFlags[override.feature_key] = Boolean(override.enabled);
  }

  return featureFlags;
}

async function isFeatureEnabled(studioId, featureKey, verticalKey) {
  const featureFlags = await getResolvedFeatureFlags(studioId, verticalKey);
  return Boolean(featureFlags[featureKey]);
}

async function getTenantBootstrap(user) {
  const studioId = Number(user?.studio_id);
  const role = String(user?.ruolo || "").toUpperCase();
  const tenant = await getTenantConfigById(studioId);

  if (!tenant) {
    return null;
  }

  const featureFlags = await getResolvedFeatureFlags(studioId, tenant.vertical_key);
  const permissions = await getUserPermissions(user);
  const enabledModules = toEnabledModules(featureFlags);
  const navigation = CORE_NAVIGATION.filter((item) =>
    canAccessNavigationItem(item, permissions, featureFlags),
  ).map((item) => ({
    key: item.key,
    label: getNavigationLabel(item.key, tenant.labels),
    href: item.href,
  }));

  return {
    tenant: {
      id: tenant.id,
      code: tenant.code,
      tenant_name: tenant.tenant_name,
      display_name: tenant.display_name,
      business_name: tenant.business_name,
      vertical_key: tenant.vertical_key,
      vertical_name: tenant.vertical_name,
      locale: tenant.locale,
      timezone: tenant.timezone,
      branding: tenant.branding,
      is_active: tenant.is_active,
    },
    current_user: {
      id: Number(user.id),
      studio_id: studioId,
      role,
      role_alias: getRoleDisplayAlias(role, {
        verticalKey: tenant.vertical_key,
        labels: tenant.labels,
      }),
      permissions,
    },
    enabled_modules: enabledModules,
    feature_flags: featureFlags,
    labels: tenant.labels,
    roles: tenant.settings.roles || tenant.vertical_template?.default_roles || [],
    role_catalog: (tenant.settings.roles || tenant.vertical_template?.default_roles || []).map((roleKey) => ({
      role_key: roleKey,
      role_alias: getRoleDisplayAlias(roleKey, {
        verticalKey: tenant.vertical_key,
        labels: tenant.labels,
      }),
      legacy_role_alias: LEGACY_ROLE_ALIASES[roleKey] || roleKey,
    })),
    navigation,
  };
}

module.exports = {
  getResolvedFeatureFlags,
  getTenantBootstrap,
  isFeatureEnabled,
  listTenantFeatureOverrides,
  upsertTenantFeatureOverride,
};
