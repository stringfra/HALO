const NEW_ACTIVITY_DEFAULT_SYSTEM_ROLES = Object.freeze(["ADMIN", "SEGRETARIO", "DIPENDENTE"]);

const CORE_ENTITY_CATALOG = Object.freeze([
  {
    entityKey: "clients",
    legacyTable: "pazienti",
    legacyFields: ["medico_id"],
    notes: "Core entity for tenant contacts and anagraphic records.",
  },
  {
    entityKey: "appointments",
    legacyTable: "appuntamenti",
    legacyFields: ["medico"],
    notes: "Agenda slots and appointments linked to clients.",
  },
  {
    entityKey: "billing",
    legacyTable: "fatture",
    legacyFields: [],
    notes: "Billing documents and collection status.",
  },
  {
    entityKey: "payments",
    legacyTable: "fatture_pagamenti",
    legacyFields: ["stripe_*"],
    notes: "Payment audit history and external providers.",
  },
  {
    entityKey: "inventory",
    legacyTable: "prodotti",
    legacyFields: [],
    notes: "Inventory and stock quantities.",
  },
  {
    entityKey: "users",
    legacyTable: "users",
    legacyFields: ["ruolo"],
    notes: "Tenant users and role migration bridge.",
  },
  {
    entityKey: "automations",
    legacyTable: "automazioni",
    legacyFields: [],
    notes: "Automation flows and reminder orchestrations.",
  },
]);

const CORE_ENTITY_KEYS = Object.freeze(CORE_ENTITY_CATALOG.map((entry) => entry.entityKey));

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

const FEATURE_REGISTRY = Object.freeze({
  "dashboard.enabled": Object.freeze({
    moduleKey: "dashboard",
    category: "core",
    dependencies: [],
    description: "Enable the analytics dashboard module.",
  }),
  "agenda.enabled": Object.freeze({
    moduleKey: "agenda",
    category: "core",
    dependencies: [],
    description: "Enable agenda and appointment management flows.",
  }),
  "calendar.google.enabled": Object.freeze({
    moduleKey: "calendar_google",
    category: "integration",
    dependencies: ["agenda.enabled"],
    description: "Enable Google Calendar integration surfaces.",
  }),
  "clients.enabled": Object.freeze({
    moduleKey: "clients",
    category: "core",
    dependencies: [],
    description: "Enable clients entity and related operations.",
  }),
  "billing.enabled": Object.freeze({
    moduleKey: "billing",
    category: "core",
    dependencies: [],
    description: "Enable invoice creation and billing management.",
  }),
  "payments.stripe.enabled": Object.freeze({
    moduleKey: "payments_stripe",
    category: "integration",
    dependencies: ["billing.enabled"],
    description: "Enable Stripe checkout link and payment reconciliation.",
  }),
  "inventory.enabled": Object.freeze({
    moduleKey: "inventory",
    category: "core",
    dependencies: [],
    description: "Enable inventory entities and stock management.",
  }),
  "automation.enabled": Object.freeze({
    moduleKey: "automation",
    category: "core",
    dependencies: ["agenda.enabled", "clients.enabled"],
    description: "Enable reminders and automation services.",
  }),
  "reports.enabled": Object.freeze({
    moduleKey: "reports",
    category: "core",
    dependencies: ["billing.enabled"],
    description: "Enable reporting and KPI views.",
  }),
  "advanced_notes.enabled": Object.freeze({
    moduleKey: "advanced_notes",
    category: "optional",
    dependencies: ["clients.enabled"],
    description: "Enable advanced annotation experiences.",
  }),
  "custom_fields.enabled": Object.freeze({
    moduleKey: "custom_fields",
    category: "optional",
    dependencies: ["clients.enabled"],
    description: "Enable tenant-driven custom field definitions.",
  }),
});

const MODULE_FEATURE_KEY_MAP = Object.freeze({
  dashboard: "dashboard.enabled",
  agenda: "agenda.enabled",
  clients: "clients.enabled",
  billing: "billing.enabled",
  payments_stripe: "payments.stripe.enabled",
  inventory: "inventory.enabled",
  automation: "automation.enabled",
  reports: "reports.enabled",
  advanced_notes: "advanced_notes.enabled",
  custom_fields: "custom_fields.enabled",
  calendar_google: "calendar.google.enabled",
});

const PERMISSION_CATALOG = Object.freeze([
  "dashboard.read",
  "clients.read",
  "clients.write",
  "clients.delete",
  "appointments.read",
  "appointments.write",
  "appointments.delete",
  "billing.read",
  "billing.write",
  "billing.manage",
  "inventory.read",
  "inventory.write",
  "inventory.delete",
  "users.read",
  "users.write",
  "users.delete",
  "automations.read",
  "automations.write",
  "reports.read",
  "settings.manage",
  "features.manage",
  "roles.manage",
  "custom_fields.manage",
  "integrations.manage",
  "calendar.google.read",
  "calendar.google.manage",
  "audit.read",
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
    section: "operativo",
    featureKey: "dashboard.enabled",
    requiredPermissions: ["dashboard.read"],
  },
  {
    key: "agenda",
    href: "/agenda",
    section: "operativo",
    featureKey: "agenda.enabled",
    requiredPermissions: ["appointments.read"],
  },
  {
    key: "clients",
    href: "/pazienti",
    section: "operativo",
    featureKey: "clients.enabled",
    requiredPermissions: ["clients.read"],
  },
  {
    key: "billing",
    href: "/fatture",
    section: "amministrazione",
    featureKey: "billing.enabled",
    requiredPermissions: ["billing.read"],
  },
  {
    key: "inventory",
    href: "/magazzino",
    section: "amministrazione",
    featureKey: "inventory.enabled",
    requiredPermissions: ["inventory.read"],
  },
  {
    key: "settings",
    href: "/impostazioni",
    section: "amministrazione",
    featureKey: null,
    requiredPermissions: ["settings.manage"],
  },
]);

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
    default_settings: {
      product_name: "HALO Dental",
      workflow: {
        client_assignment_mode: "required_owner",
        appointment_owner_source: "client_owner",
        billing_mode: "manual_or_appointment",
      },
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
    default_settings: {
      product_name: "HALO Med",
      workflow: {
        client_assignment_mode: "required_owner",
        appointment_owner_source: "client_owner",
        billing_mode: "manual_or_appointment",
      },
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
    default_settings: {
      product_name: "HALO Physio",
      workflow: {
        client_assignment_mode: "required_owner",
        appointment_owner_source: "client_owner",
        billing_mode: "manual_or_appointment",
      },
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
    default_settings: {
      product_name: "HALO Aesthetics",
      workflow: {
        client_assignment_mode: "optional_owner",
        appointment_owner_source: "selected_operator",
        billing_mode: "service_based",
      },
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
    default_settings: {
      product_name: "HALO Consulting",
      workflow: {
        client_assignment_mode: "optional_owner",
        appointment_owner_source: "selected_consultant",
        billing_mode: "project_or_session",
      },
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
    default_settings: {
      product_name: "HALO Services",
      workflow: {
        client_assignment_mode: "optional_owner",
        appointment_owner_source: "selected_operator",
        billing_mode: "service_based",
      },
    },
    roles: [...NEW_ACTIVITY_DEFAULT_SYSTEM_ROLES],
  },
});

function resolveFeatureKeyFromModuleKey(moduleKey) {
  const normalizedModuleKey =
    typeof moduleKey === "string" ? moduleKey.trim().toLowerCase() : "";
  return MODULE_FEATURE_KEY_MAP[normalizedModuleKey] || null;
}

module.exports = {
  CORE_DOMAIN_LABELS,
  CORE_ENTITY_CATALOG,
  CORE_ENTITY_KEYS,
  CORE_NAVIGATION,
  FEATURE_CATALOG,
  FEATURE_REGISTRY,
  MODULE_FEATURE_KEY_MAP,
  NEW_ACTIVITY_DEFAULT_SYSTEM_ROLES,
  PERMISSION_CATALOG,
  VERTICALS,
  resolveFeatureKeyFromModuleKey,
};
