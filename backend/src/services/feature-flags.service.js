const { pool } = require("../config/db");
const {
  CORE_NAVIGATION,
  FEATURE_CATALOG,
  FEATURE_REGISTRY,
  LEGACY_ROLE_ALIASES,
  getRoleDisplayAlias,
} = require("../config/multi-sector");
const { getTenantConfigById } = require("./tenant-config.service");
const { getVerticalTemplateByKey } = require("./vertical-templates.service");
const { getUserPermissions } = require("./permissions.service");
const { listTenantDynamicFormSchemas } = require("./dynamic-form-schema.service");

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

function getFeatureMetadata(featureKey) {
  return FEATURE_REGISTRY[featureKey] || null;
}

function getFeatureDependencies(featureKey) {
  const dependencies = getFeatureMetadata(featureKey)?.dependencies;
  if (!Array.isArray(dependencies)) {
    return [];
  }

  return dependencies.filter((dependencyKey) => FEATURE_CATALOG.includes(dependencyKey));
}

function getMissingDependencies(featureFlags, featureKey) {
  const dependencies = getFeatureDependencies(featureKey);
  const missingDependencies = [];

  for (const dependencyKey of dependencies) {
    if (!featureFlags?.[dependencyKey]) {
      missingDependencies.push(dependencyKey);
    }
  }

  return missingDependencies;
}

function normalizeFeatureFlags(featureFlags = {}) {
  const normalized = {};
  for (const featureKey of FEATURE_CATALOG) {
    normalized[featureKey] = Boolean(featureFlags?.[featureKey]);
  }
  return normalized;
}

function applyFeatureDependencies(inputFeatureFlags = {}) {
  const resolved = normalizeFeatureFlags(inputFeatureFlags);
  let changed = true;
  let guard = 0;

  // Resolve transitive dependencies with a deterministic bounded loop.
  while (changed && guard < FEATURE_CATALOG.length + 1) {
    changed = false;
    guard += 1;

    for (const featureKey of FEATURE_CATALOG) {
      if (!resolved[featureKey]) {
        continue;
      }

      const missingDependencies = getMissingDependencies(resolved, featureKey);
      if (missingDependencies.length > 0) {
        resolved[featureKey] = false;
        changed = true;
      }
    }
  }

  return resolved;
}

function listFeatureCatalogEntries() {
  return FEATURE_CATALOG.map((featureKey) => {
    const metadata = getFeatureMetadata(featureKey) || {};
    return {
      key: featureKey,
      module_key: metadata.moduleKey || null,
      category: metadata.category || "core",
      description: metadata.description || null,
      dependencies: getFeatureDependencies(featureKey),
    };
  });
}

function toPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value;
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
  if (!FEATURE_CATALOG.includes(featureKey)) {
    const error = new Error("Feature key non supportata.");
    error.code = "TENANT_FEATURE_KEY_UNSUPPORTED";
    throw error;
  }

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

  return applyFeatureDependencies(featureFlags);
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
    section: item.section || "altro",
  }));
  const defaultRoute = navigation[0]?.href || "/dashboard";
  const featureCatalogEntries = listFeatureCatalogEntries();
  const limits = toPlainObject(tenant.settings?.limits);
  const customFieldSchemas = featureFlags["custom_fields.enabled"]
    ? await listTenantDynamicFormSchemas(studioId)
    : {};

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
      vertical_template: tenant.vertical_template,
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
    feature_catalog: featureCatalogEntries,
    labels: tenant.labels,
    custom_fields: {
      schemas: customFieldSchemas,
    },
    limits,
    workspace: {
      default_route: defaultRoute,
      allowed_routes: navigation.map((item) => item.href),
      search_placeholder: `Ricerca rapida moduli e ${tenant.labels.client_plural || "clienti"}...`,
      workspace_label: `${tenant.branding.product_name || "HALO"} Workspace`,
    },
    roles: tenant.settings.roles || tenant.vertical_template?.default_roles || [],
    workflow: tenant.settings.workflow || tenant.vertical_template?.default_settings?.workflow || {},
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
  applyFeatureDependencies,
  getFeatureDependencies,
  getMissingDependencies,
  getResolvedFeatureFlags,
  getTenantBootstrap,
  isFeatureEnabled,
  listFeatureCatalogEntries,
  listTenantFeatureOverrides,
  normalizeFeatureFlags,
  upsertTenantFeatureOverride,
};
