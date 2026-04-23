const {
  CUSTOM_FIELDS_ALLOWED_ENTITY_KEYS,
  getCoreFieldDefinitions,
  isValidEntityKey,
  listCustomFieldDefinitions,
} = require("./custom-fields.service");

function toRenderComponent(type) {
  const normalizedType = typeof type === "string" ? type.trim().toLowerCase() : "";
  const map = {
    text: "text-input",
    textarea: "text-area",
    number: "number-input",
    date: "date-input",
    boolean: "switch",
    select: "select",
    multiselect: "multi-select",
  };

  return map[normalizedType] || "text-input";
}

function normalizeSchemaField(definition, { isCore }) {
  const options = Array.isArray(definition?.options)
    ? definition.options
    : Array.isArray(definition?.options_json)
      ? definition.options_json
      : [];

  return {
    field_key: definition.field_key,
    label: definition.label,
    type: definition.type,
    required: Boolean(definition.required),
    active: definition.active !== false,
    options: options.filter((entry) => typeof entry === "string" && entry.trim().length > 0),
    sort_order: Number.isInteger(definition.sort_order) ? definition.sort_order : 0,
    render_component: toRenderComponent(definition.type),
    is_core: Boolean(isCore),
    is_custom: !isCore,
  };
}

function sortSchemaFields(left, right) {
  const leftSort = Number.isInteger(left?.sort_order) ? left.sort_order : 0;
  const rightSort = Number.isInteger(right?.sort_order) ? right.sort_order : 0;
  if (leftSort !== rightSort) {
    return leftSort - rightSort;
  }

  return String(left?.field_key || "").localeCompare(String(right?.field_key || ""));
}

async function getEntityDynamicFormSchema(studioId, entityKey) {
  const normalizedEntityKey = String(entityKey || "").trim().toLowerCase();
  if (!isValidEntityKey(normalizedEntityKey)) {
    throw new Error("entity_key non valido.");
  }

  const coreFields = getCoreFieldDefinitions(normalizedEntityKey).map((definition) =>
    normalizeSchemaField(definition, { isCore: true }),
  );
  const customFields = (await listCustomFieldDefinitions(studioId, normalizedEntityKey))
    .filter((definition) => definition.active)
    .map((definition) => normalizeSchemaField(definition, { isCore: false }))
    .sort(sortSchemaFields);
  const fields = [...coreFields, ...customFields].sort(sortSchemaFields);

  return {
    entity_key: normalizedEntityKey,
    core_fields: coreFields.sort(sortSchemaFields),
    custom_fields: customFields,
    fields,
  };
}

async function listTenantDynamicFormSchemas(studioId, entityKeys = CUSTOM_FIELDS_ALLOWED_ENTITY_KEYS) {
  const schemas = {};
  for (const entityKey of entityKeys) {
    const normalizedEntityKey = String(entityKey || "").trim().toLowerCase();
    if (!isValidEntityKey(normalizedEntityKey)) {
      continue;
    }

    schemas[normalizedEntityKey] = await getEntityDynamicFormSchema(studioId, normalizedEntityKey);
  }

  return schemas;
}

module.exports = {
  getEntityDynamicFormSchema,
  listTenantDynamicFormSchemas,
  normalizeSchemaField,
  sortSchemaFields,
};
