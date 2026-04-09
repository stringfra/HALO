const NEW_ACTIVITY_DEFAULT_SYSTEM_ROLES = Object.freeze(["ADMIN", "SEGRETARIO", "DIPENDENTE"]);

const CORE_ENTITY_KEYS = Object.freeze([
  "clients",
  "appointments",
  "billing",
  "payments",
  "inventory",
  "users",
  "automations",
]);

const FEATURE_CATALOG = Object.freeze([
  "dashboard.enabled",
  "agenda.enabled",
  "calendar.google.enabled",
  "clients.enabled",
  "billing.enabled",
  "payments.stripe.enabled",
  "inventory.enabled",
  "automation.enabled",
  "reports.enabled",
  "advanced_notes.enabled",
  "custom_fields.enabled",
]);

const CORE_DOMAIN_LABELS = Object.freeze({
  client_singular: "Cliente",
  client_plural: "Clienti",
  owner_singular: "Responsabile",
  owner_plural: "Responsabili",
  appointment_singular: "Appuntamento",
  appointment_plural: "Appuntamenti",
  invoice_singular: "Fattura",
  invoice_plural: "Fatture",
  inventory_singular: "Prodotto",
  inventory_plural: "Magazzino",
});

const CORE_NAVIGATION = Object.freeze([
  {
    key: "dashboard",
    href: "/dashboard",
    featureKey: "dashboard.enabled",
    requiredPermissions: ["dashboard.read"],
  },
  {
    key: "agenda",
    href: "/agenda",
    featureKey: "agenda.enabled",
    requiredPermissions: ["appointments.read"],
  },
  {
    key: "clients",
    href: "/pazienti",
    featureKey: "clients.enabled",
    requiredPermissions: ["clients.read"],
  },
  {
    key: "billing",
    href: "/fatture",
    featureKey: "billing.enabled",
    requiredPermissions: ["billing.read"],
  },
  {
    key: "inventory",
    href: "/magazzino",
    featureKey: "inventory.enabled",
    requiredPermissions: ["inventory.read"],
  },
  {
    key: "settings",
    href: "/impostazioni",
    featureKey: null,
    requiredPermissions: ["settings.manage"],
  },
]);

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

const DEFAULT_ROLE_DISPLAY_ALIASES = Object.freeze({
  ADMIN: "Admin",
  SEGRETARIO: "Segretario",
  DENTISTA: "Responsabile",
  DIPENDENTE: "Responsabile",
});

const VERTICALS = Object.freeze({
  dental: {
    key: "dental",
    name: "Studio dentistico",
    labels: {
      client_singular: "Paziente",
      client_plural: "Pazienti",
      owner_singular: "Dentista",
      owner_plural: "Dentisti",
    },
    modules: {
      dashboard: true,
      agenda: true,
      clients: true,
      billing: true,
      payments_stripe: true,
      inventory: true,
      automation: true,
      reports: true,
      advanced_notes: true,
      custom_fields: true,
    },
    roles: [...NEW_ACTIVITY_DEFAULT_SYSTEM_ROLES],
  },
  medical: {
    key: "medical",
    name: "Studio medico",
    labels: {
      client_singular: "Paziente",
      client_plural: "Pazienti",
      owner_singular: "Medico",
      owner_plural: "Medici",
    },
    modules: {
      dashboard: true,
      agenda: true,
      clients: true,
      billing: true,
      payments_stripe: true,
      inventory: false,
      automation: true,
      reports: true,
      advanced_notes: true,
      custom_fields: true,
    },
    roles: [...NEW_ACTIVITY_DEFAULT_SYSTEM_ROLES],
  },
  physiotherapy: {
    key: "physiotherapy",
    name: "Studio fisioterapico",
    labels: {
      client_singular: "Paziente",
      client_plural: "Pazienti",
      owner_singular: "Terapista",
      owner_plural: "Terapisti",
    },
    modules: {
      dashboard: true,
      agenda: true,
      clients: true,
      billing: true,
      payments_stripe: true,
      inventory: false,
      automation: true,
      reports: true,
      advanced_notes: false,
      custom_fields: true,
    },
    roles: [...NEW_ACTIVITY_DEFAULT_SYSTEM_ROLES],
  },
  aesthetics: {
    key: "aesthetics",
    name: "Centro estetico",
    labels: {
      client_singular: "Cliente",
      client_plural: "Clienti",
      owner_singular: "Operatore",
      owner_plural: "Operatori",
    },
    modules: {
      dashboard: true,
      agenda: true,
      clients: true,
      billing: true,
      payments_stripe: true,
      inventory: true,
      automation: true,
      reports: true,
      advanced_notes: false,
      custom_fields: true,
    },
    roles: [...NEW_ACTIVITY_DEFAULT_SYSTEM_ROLES],
  },
  consulting: {
    key: "consulting",
    name: "Studio consulenza",
    labels: {
      client_singular: "Cliente",
      client_plural: "Clienti",
      owner_singular: "Consulente",
      owner_plural: "Consulenti",
    },
    modules: {
      dashboard: true,
      agenda: true,
      clients: true,
      billing: true,
      payments_stripe: true,
      inventory: false,
      automation: true,
      reports: true,
      advanced_notes: true,
      custom_fields: true,
    },
    roles: [...NEW_ACTIVITY_DEFAULT_SYSTEM_ROLES],
  },
  services: {
    key: "services",
    name: "Attivita di servizi",
    labels: {
      client_singular: "Cliente",
      client_plural: "Clienti",
      owner_singular: "Operatore",
      owner_plural: "Operatori",
    },
    modules: {
      dashboard: true,
      agenda: true,
      clients: true,
      billing: true,
      payments_stripe: true,
      inventory: true,
      automation: true,
      reports: true,
      advanced_notes: false,
      custom_fields: true,
    },
    roles: [...NEW_ACTIVITY_DEFAULT_SYSTEM_ROLES],
  },
});

const ENTITY_DOMAIN_MAP = Object.freeze([
  {
    entityKey: "clients",
    legacyTable: "pazienti",
    legacyFields: ["medico_id"],
    notes: "Entita core per anagrafiche e contatti del tenant.",
  },
  {
    entityKey: "appointments",
    legacyTable: "appuntamenti",
    legacyFields: ["medico"],
    notes: "Slot agenda e appuntamenti associati a clients.",
  },
  {
    entityKey: "billing",
    legacyTable: "fatture",
    legacyFields: [],
    notes: "Documenti gestionali e stato incasso.",
  },
  {
    entityKey: "payments",
    legacyTable: "fatture_pagamenti",
    legacyFields: ["stripe_*"],
    notes: "Storico pagamenti e provider esterni.",
  },
  {
    entityKey: "inventory",
    legacyTable: "prodotti",
    legacyFields: [],
    notes: "Magazzino e giacenze.",
  },
  {
    entityKey: "users",
    legacyTable: "users",
    legacyFields: ["ruolo"],
    notes: "Utenti, ruoli legacy e futuro mapping permessi.",
  },
]);

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

  return DEFAULT_ROLE_DISPLAY_ALIASES[normalizedRole] || LEGACY_ROLE_ALIASES[normalizedRole] || normalizedRole;
}

module.exports = {
  CORE_DOMAIN_LABELS,
  CORE_ENTITY_KEYS,
  CORE_NAVIGATION,
  DEFAULT_ROLE_DISPLAY_ALIASES,
  ENTITY_DOMAIN_MAP,
  FEATURE_CATALOG,
  LEGACY_ROLE_ALIASES,
  LEGACY_ROLE_PERMISSIONS,
  NEW_ACTIVITY_DEFAULT_SYSTEM_ROLES,
  VERTICALS,
  getLegacyPermissions,
  getRoleDisplayAlias,
  getVerticalConfig,
};
