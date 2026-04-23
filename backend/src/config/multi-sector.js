const {
  CORE_DOMAIN_LABELS,
  CORE_ENTITY_CATALOG,
  CORE_ENTITY_KEYS,
  CORE_NAVIGATION,
  FEATURE_CATALOG,
  FEATURE_REGISTRY,
  NEW_ACTIVITY_DEFAULT_SYSTEM_ROLES,
  PERMISSION_CATALOG,
  VERTICALS,
  resolveFeatureKeyFromModuleKey,
} = require("./platform-registry");

const LEGACY_ROLE_PERMISSIONS = Object.freeze({
  ADMIN: [
    "dashboard.read",
    "clients.read",
    "clients.write",
    "appointments.read",
    "appointments.write",
    "billing.read",
    "billing.write",
    "inventory.read",
    "inventory.write",
    "users.read",
    "users.write",
    "automations.read",
    "automations.write",
    "reports.read",
    "settings.manage",
    "features.manage",
    "roles.manage",
    "custom_fields.manage",
    "integrations.manage",
    "audit.read",
    "calendar.google.read",
    "calendar.google.manage",
  ],
  SEGRETARIO: [
    "dashboard.read",
    "clients.read",
    "clients.write",
    "appointments.read",
    "appointments.write",
    "billing.read",
    "billing.write",
    "automations.read",
    "calendar.google.read",
    "calendar.google.manage",
  ],
  DENTISTA: [
    "dashboard.read",
    "clients.read",
    "appointments.read",
    "appointments.write",
    "billing.read",
  ],
  DIPENDENTE: [
    "dashboard.read",
    "clients.read",
    "appointments.read",
    "appointments.write",
    "billing.read",
  ],
});

const LEGACY_ROLE_ALIASES = Object.freeze({
  ADMIN: "Administrator",
  SEGRETARIO: "Coordinator",
  DENTISTA: "Practitioner",
  DIPENDENTE: "Staff",
});

const SYSTEM_ROLE_TEMPLATES = Object.freeze({
  ADMIN: Object.freeze({
    role_key: "ADMIN",
    display_name: "Administrator",
    description: "Can manage tenant settings, users, and role governance.",
  }),
  SEGRETARIO: Object.freeze({
    role_key: "SEGRETARIO",
    display_name: "Coordinator",
    description: "Can manage daily operations for clients, agenda, and billing.",
  }),
  DENTISTA: Object.freeze({
    role_key: "DENTISTA",
    display_name: "Practitioner",
    description: "Can access assigned operational workflows and clinical activities.",
  }),
  DIPENDENTE: Object.freeze({
    role_key: "DIPENDENTE",
    display_name: "Staff",
    description: "Can execute assigned operational workflows with limited governance scope.",
  }),
});

const DEFAULT_ROLE_DISPLAY_ALIASES = Object.freeze({
  ADMIN: "Admin",
  SEGRETARIO: "Segretario",
  DENTISTA: "Responsabile",
  DIPENDENTE: "Responsabile",
});

const ENTITY_DOMAIN_MAP = CORE_ENTITY_CATALOG;

function getVerticalConfig(verticalKey = "dental") {
  return VERTICALS[verticalKey] || VERTICALS.dental;
}

function getLegacyPermissions(role) {
  const normalizedRole = String(role || "").toUpperCase();
  return LEGACY_ROLE_PERMISSIONS[normalizedRole] || [];
}

function getRoleDisplayAlias(role, { verticalKey = "dental", labels = {} } = {}) {
  const normalizedRole = String(role || "").trim().toUpperCase();
  const vertical = getVerticalConfig(verticalKey);
  const mergedLabels =
    labels && typeof labels === "object" && !Array.isArray(labels)
      ? {
          ...(vertical.labels || {}),
          ...labels,
        }
      : vertical.labels || {};

  if (normalizedRole === "DIPENDENTE" || normalizedRole === "DENTISTA") {
    return mergedLabels.owner_singular || DEFAULT_ROLE_DISPLAY_ALIASES[normalizedRole];
  }

  return (
    DEFAULT_ROLE_DISPLAY_ALIASES[normalizedRole] ||
    LEGACY_ROLE_ALIASES[normalizedRole] ||
    normalizedRole
  );
}

function getSystemRoleTemplate(roleKey) {
  const normalizedRoleKey = String(roleKey || "").trim().toUpperCase();
  return SYSTEM_ROLE_TEMPLATES[normalizedRoleKey] || null;
}

function getSupportedSystemRoleKeys() {
  return Object.keys(LEGACY_ROLE_PERMISSIONS);
}

module.exports = {
  CORE_DOMAIN_LABELS,
  CORE_ENTITY_KEYS,
  CORE_NAVIGATION,
  DEFAULT_ROLE_DISPLAY_ALIASES,
  ENTITY_DOMAIN_MAP,
  FEATURE_CATALOG,
  FEATURE_REGISTRY,
  LEGACY_ROLE_ALIASES,
  LEGACY_ROLE_PERMISSIONS,
  NEW_ACTIVITY_DEFAULT_SYSTEM_ROLES,
  PERMISSION_CATALOG,
  SYSTEM_ROLE_TEMPLATES,
  VERTICALS,
  getLegacyPermissions,
  getRoleDisplayAlias,
  getSupportedSystemRoleKeys,
  getSystemRoleTemplate,
  getVerticalConfig,
  resolveFeatureKeyFromModuleKey,
};
