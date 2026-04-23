const test = require("node:test");
const assert = require("node:assert/strict");

const { validateTenantSettings } = require("../src/services/tenant-settings-validation.service");

test("validateTenantSettings accepts supported workflow keys", () => {
  const result = validateTenantSettings({
    workflow: {
      client_assignment_mode: "required_owner",
      appointment_owner_source: "client_owner",
      billing_mode: "manual_or_appointment",
    },
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("validateTenantSettings rejects unsupported workflow keys", () => {
  const result = validateTenantSettings({
    workflow: {
      unknown_key: "value",
    },
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((entry) => entry.path === "settings.workflow.unknown_key"));
});

test("validateTenantSettings rejects roles payload without ADMIN", () => {
  const result = validateTenantSettings({
    roles: ["SEGRETARIO", "DIPENDENTE"],
  });

  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some(
      (entry) => entry.path === "settings.roles" && entry.message.includes("ADMIN"),
    ),
  );
});
