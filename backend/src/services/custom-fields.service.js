const { pool } = require("../config/db");

const CUSTOM_FIELDS_ALLOWED_ENTITY_KEYS = Object.freeze([
  "clients",
  "appointments",
  "billing",
  "inventory",
  "users",
]);
const ALLOWED_ENTITY_KEYS = new Set(CUSTOM_FIELDS_ALLOWED_ENTITY_KEYS);
const ALLOWED_FIELD_TYPES = new Set([
  "text",
  "textarea",
  "number",
  "date",
  "boolean",
  "select",
  "multiselect",
]);
const CORE_ENTITY_FIELD_DEFINITIONS = Object.freeze({
  clients: Object.freeze([
    { field_key: "first_name", label: "Nome", type: "text", required: true, sort_order: -500 },
    { field_key: "last_name", label: "Cognome", type: "text", required: true, sort_order: -490 },
    { field_key: "owner_user_id", label: "Responsabile", type: "number", required: true, sort_order: -480 },
    { field_key: "phone", label: "Telefono", type: "text", required: false, sort_order: -470 },
    { field_key: "email", label: "Email", type: "text", required: false, sort_order: -460 },
    { field_key: "notes", label: "Note", type: "textarea", required: false, sort_order: -450 },
  ]),
  appointments: Object.freeze([
    { field_key: "client_id", label: "Cliente", type: "number", required: true, sort_order: -500 },
    { field_key: "appointment_date", label: "Data", type: "date", required: true, sort_order: -490 },
    { field_key: "appointment_time", label: "Ora", type: "text", required: true, sort_order: -480 },
    { field_key: "owner_display_name", label: "Operatore", type: "text", required: true, sort_order: -470 },
    {
      field_key: "appointment_status",
      label: "Stato",
      type: "select",
      required: true,
      sort_order: -460,
      options: ["in_attesa", "confermato", "completato", "annullato"],
    },
  ]),
  billing: Object.freeze([
    { field_key: "client_id", label: "Cliente", type: "number", required: true, sort_order: -500 },
    { field_key: "amount", label: "Importo", type: "number", required: true, sort_order: -490 },
    { field_key: "date", label: "Data", type: "date", required: true, sort_order: -480 },
    { field_key: "status", label: "Stato", type: "text", required: true, sort_order: -470 },
  ]),
  inventory: Object.freeze([
    { field_key: "name", label: "Nome", type: "text", required: true, sort_order: -500 },
    { field_key: "stock_quantity", label: "Quantita", type: "number", required: true, sort_order: -490 },
    { field_key: "reorder_threshold", label: "Soglia minima", type: "number", required: true, sort_order: -480 },
  ]),
  users: Object.freeze([
    { field_key: "name", label: "Nome", type: "text", required: true, sort_order: -500 },
    { field_key: "email", label: "Email", type: "text", required: true, sort_order: -490 },
    { field_key: "role_key", label: "Ruolo", type: "text", required: true, sort_order: -480 },
  ]),
});

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeEntityKey(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeFieldKey(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function normalizeFieldType(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function parseOptions(optionsJson) {
  if (!Array.isArray(optionsJson)) {
    return [];
  }

  const uniqueOptions = [];
  const seen = new Set();
  for (const rawEntry of optionsJson) {
    const entry = typeof rawEntry === "string" ? rawEntry.trim() : "";
    if (!entry) {
      continue;
    }

    const lowered = entry.toLowerCase();
    if (seen.has(lowered)) {
      continue;
    }

    seen.add(lowered);
    uniqueOptions.push(entry);

    if (uniqueOptions.length >= 100) {
      break;
    }
  }

  return uniqueOptions;
}

function isValidEntityKey(entityKey) {
  return ALLOWED_ENTITY_KEYS.has(entityKey);
}

function isValidFieldType(fieldType) {
  return ALLOWED_FIELD_TYPES.has(fieldType);
}

function getCoreFieldDefinitions(entityKey) {
  const normalizedEntityKey = normalizeEntityKey(entityKey);
  const definitions = CORE_ENTITY_FIELD_DEFINITIONS[normalizedEntityKey];
  if (!Array.isArray(definitions)) {
    return [];
  }

  return definitions.map((definition) => ({
    ...definition,
    options: parseOptions(definition.options),
    active: true,
    is_core: true,
  }));
}

function isReservedCoreFieldKey(entityKey, fieldKey) {
  const normalizedFieldKey = normalizeFieldKey(fieldKey);
  if (!normalizedFieldKey) {
    return false;
  }

  return getCoreFieldDefinitions(entityKey).some(
    (definition) => definition.field_key === normalizedFieldKey,
  );
}

function isDateOnlyString(value) {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return false;
  }

  const date = new Date(`${normalized}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().startsWith(`${normalized}T`);
}

function hasMeaningfulCustomFieldValue(type, value) {
  if (value === null || value === undefined) {
    return false;
  }

  if (type === "multiselect") {
    return Array.isArray(value) && value.length > 0;
  }

  if (type === "boolean") {
    return typeof value === "boolean";
  }

  if (type === "number") {
    return typeof value === "number" && Number.isFinite(value);
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return true;
}

function normalizeCustomFieldValue(definition, rawValue) {
  const fieldType = normalizeFieldType(definition?.type);
  const options = parseOptions(definition?.options_json ?? definition?.options);

  if (rawValue === undefined || rawValue === null) {
    return null;
  }

  if (fieldType === "text" || fieldType === "textarea") {
    if (typeof rawValue !== "string") {
      throw new Error(`Valore non valido per ${definition.field_key}: attesa stringa.`);
    }

    const normalized = rawValue.trim();
    return normalized.length > 0 ? normalized : null;
  }

  if (fieldType === "number") {
    const value =
      typeof rawValue === "number"
        ? rawValue
        : typeof rawValue === "string" && rawValue.trim().length > 0
          ? Number(rawValue)
          : NaN;
    if (!Number.isFinite(value)) {
      throw new Error(`Valore non valido per ${definition.field_key}: atteso numero.`);
    }
    return value;
  }

  if (fieldType === "date") {
    if (!isDateOnlyString(rawValue)) {
      throw new Error(`Valore non valido per ${definition.field_key}: attesa data YYYY-MM-DD.`);
    }
    return rawValue.trim();
  }

  if (fieldType === "boolean") {
    if (typeof rawValue !== "boolean") {
      throw new Error(`Valore non valido per ${definition.field_key}: atteso boolean.`);
    }
    return rawValue;
  }

  if (fieldType === "select") {
    if (typeof rawValue !== "string") {
      throw new Error(`Valore non valido per ${definition.field_key}: attesa opzione stringa.`);
    }
    const normalized = rawValue.trim();
    if (!normalized) {
      return null;
    }
    if (options.length > 0 && !options.includes(normalized)) {
      throw new Error(`Valore non valido per ${definition.field_key}: opzione non supportata.`);
    }
    return normalized;
  }

  if (fieldType === "multiselect") {
    if (!Array.isArray(rawValue)) {
      throw new Error(`Valore non valido per ${definition.field_key}: atteso array di opzioni.`);
    }
    const normalized = parseOptions(rawValue);
    if (normalized.length === 0) {
      return null;
    }
    if (options.length > 0 && normalized.some((entry) => !options.includes(entry))) {
      throw new Error(`Valore non valido per ${definition.field_key}: opzioni non supportate.`);
    }
    return normalized;
  }

  throw new Error(`Tipo non supportato per ${definition.field_key}.`);
}

async function listCustomFieldDefinitions(studioId, entityKey) {
  const result = await pool.query(
    `SELECT id,
            entity_key,
            field_key,
            label,
            type,
            required,
            options_json,
            sort_order,
            active
     FROM custom_field_definitions
     WHERE studio_id = $1
       AND entity_key = $2
     ORDER BY sort_order ASC, id ASC`,
    [studioId, entityKey],
  );

  return result.rows.map((row) => ({
    ...row,
    options: parseOptions(row.options_json),
  }));
}

async function upsertCustomFieldDefinition(studioId, payload) {
  const entityKey = normalizeEntityKey(payload?.entity_key);
  const fieldKey = normalizeFieldKey(payload?.field_key);
  const fieldType = normalizeFieldType(payload?.type);
  const label = typeof payload?.label === "string" ? payload.label.trim().slice(0, 120) : "";
  const required = Boolean(payload?.required);
  const active = payload?.active !== undefined ? Boolean(payload.active) : true;
  const sortOrderRaw =
    Number.isInteger(payload?.sort_order) || typeof payload?.sort_order === "string"
      ? Number(payload?.sort_order)
      : 0;
  const sortOrder = Number.isInteger(sortOrderRaw) ? sortOrderRaw : 0;
  const options = parseOptions(payload?.options);

  if (!isValidEntityKey(entityKey)) {
    throw new Error("entity_key non valido.");
  }
  if (!fieldKey) {
    throw new Error("field_key non valido.");
  }
  if (!label) {
    throw new Error("label non valida.");
  }
  if (!isValidFieldType(fieldType)) {
    throw new Error("type non valido.");
  }
  if (isReservedCoreFieldKey(entityKey, fieldKey)) {
    throw new Error("field_key riservato al modello core.");
  }
  if ((fieldType === "select" || fieldType === "multiselect") && options.length === 0) {
    throw new Error("Le opzioni sono obbligatorie per select/multiselect.");
  }

  const result = await pool.query(
    `INSERT INTO custom_field_definitions (
       studio_id,
       entity_key,
       field_key,
       label,
       type,
       required,
       options_json,
       sort_order,
       active
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
     ON CONFLICT (studio_id, entity_key, field_key) DO UPDATE
     SET label = EXCLUDED.label,
         type = EXCLUDED.type,
         required = EXCLUDED.required,
         options_json = EXCLUDED.options_json,
         sort_order = EXCLUDED.sort_order,
         active = EXCLUDED.active,
         updated_at = NOW()
     RETURNING id,
               entity_key,
               field_key,
               label,
               type,
               required,
               options_json,
               sort_order,
               active`,
    [studioId, entityKey, fieldKey, label, fieldType, required, JSON.stringify(options), sortOrder, active],
  );

  const row = result.rows[0];
  return {
    ...row,
    options: parseOptions(row.options_json),
  };
}

async function deleteCustomFieldDefinition(studioId, entityKey, fieldKey) {
  const result = await pool.query(
    `DELETE FROM custom_field_definitions
     WHERE studio_id = $1
       AND entity_key = $2
       AND field_key = $3
     RETURNING id`,
    [studioId, entityKey, fieldKey],
  );

  return result.rowCount > 0;
}

async function listCustomFieldValues(studioId, entityKey, recordId) {
  const result = await pool.query(
    `SELECT field_key, value_json
     FROM custom_field_values
     WHERE studio_id = $1
       AND entity_key = $2
       AND record_id = $3`,
    [studioId, entityKey, recordId],
  );

  return result.rows.reduce((accumulator, row) => {
    accumulator[row.field_key] = row.value_json;
    return accumulator;
  }, {});
}

async function saveCustomFieldValues(studioId, entityKey, recordId, values) {
  if (!isValidEntityKey(entityKey)) {
    throw new Error("entity_key non valido.");
  }
  if (!isPlainObject(values)) {
    throw new Error("Payload valori custom fields non valido.");
  }

  const definitions = await listCustomFieldDefinitions(studioId, entityKey);
  const activeDefinitions = definitions.filter((field) => field.active);
  const definitionByFieldKey = new Map(
    activeDefinitions.map((definition) => [definition.field_key, definition]),
  );
  const currentValues = await listCustomFieldValues(studioId, entityKey, recordId);
  const nextValues = { ...currentValues };
  const valuesToUpsert = [];
  const fieldKeysToDelete = [];

  for (const [fieldKey, rawValue] of Object.entries(values)) {
    const definition = definitionByFieldKey.get(fieldKey);
    if (!definition) {
      throw new Error(`field_key non valido o inattivo: ${fieldKey}.`);
    }

    const normalizedValue = normalizeCustomFieldValue(definition, rawValue);
    if (!hasMeaningfulCustomFieldValue(definition.type, normalizedValue)) {
      if (definition.required) {
        throw new Error(`Campo obbligatorio non valorizzato: ${fieldKey}.`);
      }
      delete nextValues[fieldKey];
      fieldKeysToDelete.push(fieldKey);
      continue;
    }

    nextValues[fieldKey] = normalizedValue;
    valuesToUpsert.push([fieldKey, normalizedValue]);
  }

  for (const definition of activeDefinitions) {
    if (!definition.required) {
      continue;
    }
    const value = nextValues[definition.field_key];
    if (!hasMeaningfulCustomFieldValue(definition.type, value)) {
      throw new Error(`Campo obbligatorio non valorizzato: ${definition.field_key}.`);
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const fieldKey of fieldKeysToDelete) {
      await client.query(
        `DELETE FROM custom_field_values
         WHERE studio_id = $1
           AND entity_key = $2
           AND record_id = $3
           AND field_key = $4`,
        [studioId, entityKey, recordId, fieldKey],
      );
    }

    for (const [fieldKey, value] of valuesToUpsert) {
      await client.query(
        `INSERT INTO custom_field_values (
           studio_id,
           entity_key,
           record_id,
           field_key,
           value_json
         )
         VALUES ($1, $2, $3, $4, $5::jsonb)
         ON CONFLICT (studio_id, entity_key, record_id, field_key) DO UPDATE
         SET value_json = EXCLUDED.value_json,
             updated_at = NOW()`,
        [studioId, entityKey, recordId, fieldKey, JSON.stringify(value)],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return listCustomFieldValues(studioId, entityKey, recordId);
}

module.exports = {
  CUSTOM_FIELDS_ALLOWED_ENTITY_KEYS,
  getCoreFieldDefinitions,
  hasMeaningfulCustomFieldValue,
  isReservedCoreFieldKey,
  deleteCustomFieldDefinition,
  isValidEntityKey,
  listCustomFieldDefinitions,
  listCustomFieldValues,
  normalizeCustomFieldValue,
  saveCustomFieldValues,
  upsertCustomFieldDefinition,
};
