const test = require("node:test");
const assert = require("node:assert/strict");

const {
  NEW_ACTIVITY_DEFAULT_SYSTEM_ROLES,
  VERTICALS,
  getRoleDisplayAlias,
} = require("../src/config/multi-sector");

test("all static verticals expose the new default system roles", () => {
  for (const vertical of Object.values(VERTICALS)) {
    assert.deepEqual(vertical.roles, [...NEW_ACTIVITY_DEFAULT_SYSTEM_ROLES]);
  }
});

test("practitioner role alias is vertical-aware", () => {
  assert.equal(getRoleDisplayAlias("DIPENDENTE", { verticalKey: "dental" }), "Dentista");
  assert.equal(getRoleDisplayAlias("DIPENDENTE", { verticalKey: "medical" }), "Medico");
  assert.equal(getRoleDisplayAlias("DIPENDENTE", { verticalKey: "physiotherapy" }), "Terapista");
  assert.equal(getRoleDisplayAlias("DIPENDENTE", { verticalKey: "services" }), "Operatore");
});
