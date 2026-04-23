const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeSchemaField,
  sortSchemaFields,
} = require("../src/services/dynamic-form-schema.service");

test("normalizeSchemaField exposes render metadata for core and custom fields", () => {
  const coreField = normalizeSchemaField(
    {
      field_key: "first_name",
      label: "Nome",
      type: "text",
      required: true,
      sort_order: -500,
      options: [],
    },
    { isCore: true },
  );

  const customField = normalizeSchemaField(
    {
      field_key: "priorita",
      label: "Priorita",
      type: "select",
      required: false,
      sort_order: 10,
      options_json: ["Bassa", "Alta"],
    },
    { isCore: false },
  );

  assert.equal(coreField.render_component, "text-input");
  assert.equal(coreField.is_core, true);
  assert.equal(coreField.is_custom, false);
  assert.equal(customField.render_component, "select");
  assert.equal(customField.is_core, false);
  assert.equal(customField.is_custom, true);
  assert.deepEqual(customField.options, ["Bassa", "Alta"]);
});

test("sortSchemaFields orders by sort_order then field_key", () => {
  const fields = [
    { field_key: "b_field", sort_order: 10 },
    { field_key: "a_field", sort_order: 10 },
    { field_key: "z_field", sort_order: -1 },
  ];

  const sorted = [...fields].sort(sortSchemaFields);
  assert.deepEqual(sorted.map((entry) => entry.field_key), ["z_field", "a_field", "b_field"]);
});
