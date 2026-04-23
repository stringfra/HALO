const test = require("node:test");
const assert = require("node:assert/strict");

const {
  hasMeaningfulCustomFieldValue,
  isReservedCoreFieldKey,
  normalizeCustomFieldValue,
} = require("../src/services/custom-fields.service");

test("isReservedCoreFieldKey blocks core keys and allows custom keys", () => {
  assert.equal(isReservedCoreFieldKey("clients", "first_name"), true);
  assert.equal(isReservedCoreFieldKey("clients", "custom_note"), false);
});

test("normalizeCustomFieldValue validates select options", () => {
  const definition = {
    field_key: "priority",
    type: "select",
    options: ["Bassa", "Media", "Alta"],
  };

  assert.equal(normalizeCustomFieldValue(definition, "Media"), "Media");
  assert.throws(
    () => normalizeCustomFieldValue(definition, "Urgente"),
    /opzione non supportata/,
  );
});

test("normalizeCustomFieldValue validates multiselect payload", () => {
  const definition = {
    field_key: "tags",
    type: "multiselect",
    options_json: ["A", "B", "C"],
  };

  assert.deepEqual(normalizeCustomFieldValue(definition, ["A", "C"]), ["A", "C"]);
  assert.equal(normalizeCustomFieldValue(definition, []), null);
  assert.throws(
    () => normalizeCustomFieldValue(definition, ["A", "X"]),
    /opzioni non supportate/,
  );
});

test("hasMeaningfulCustomFieldValue handles false boolean and empty values", () => {
  assert.equal(hasMeaningfulCustomFieldValue("boolean", false), true);
  assert.equal(hasMeaningfulCustomFieldValue("text", ""), false);
  assert.equal(hasMeaningfulCustomFieldValue("multiselect", []), false);
  assert.equal(hasMeaningfulCustomFieldValue("number", 0), true);
});
