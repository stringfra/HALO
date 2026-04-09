const { pool } = require("../config/db");

const ALLOWED_ENTITY_KEYS = new Set(["clients", "appointments", "billing", "inventory", "users"]);
const ALLOWED_FIELD_TYPES = new Set([
  "text",
  "textarea",
  "number",
  "date",
  "boolean",
  "select",
  "multiselect",
]);

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

  return optionsJson
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0)
    .slice(0, 100);
}

function isValidEntityKey(entityKey) {
  return ALLOWED_ENTITY_KEYS.has(entityKey);
}

function isValidFieldType(fieldType) {
  return ALLOWED_FIELD_TYPES.has(fieldType);
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
  const sortOrder = Number.isInteger(payload?.sort_order) ? payload.sort_order : 0;
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

  const definitions = await listCustomFieldDefinitions(studioId, entityKey);
  const allowedFieldKeys = new Set(definitions.filter((field) => field.active).map((field) => field.field_key));
  const entries = Object.entries(values || {}).filter(([fieldKey]) => allowedFieldKeys.has(fieldKey));

  for (const [fieldKey, value] of entries) {
    await pool.query(
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

  return listCustomFieldValues(studioId, entityKey, recordId);
}

module.exports = {
  deleteCustomFieldDefinition,
  isValidEntityKey,
  listCustomFieldDefinitions,
  listCustomFieldValues,
  saveCustomFieldValues,
  upsertCustomFieldDefinition,
};
