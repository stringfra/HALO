const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createTenantCustomRole,
  normalizePermissionKeys,
} = require("../src/services/tenant-rbac-catalog.service");

test("normalizePermissionKeys validates catalog membership and deduplicates keys", () => {
  const validation = normalizePermissionKeys([
    "users.read",
    "users.write",
    "users.read",
    "unknown.permission",
  ]);

  assert.equal(validation.valid, false);
  assert.deepEqual(validation.normalizedPermissionKeys, [
    "unknown.permission",
    "users.read",
    "users.write",
  ]);
  assert.deepEqual(validation.invalidPermissionKeys, ["unknown.permission"]);
});

test("createTenantCustomRole rejects reserved system role keys", async () => {
  const fakeClient = {
    async query() {
      throw new Error("query should not be executed for reserved role keys");
    },
  };

  await assert.rejects(
    () =>
      createTenantCustomRole(fakeClient, 4, {
        roleKey: "ADMIN",
        displayName: "Admin Clone",
        permissionKeys: ["users.read"],
      }),
    (error) => error?.code === "TENANT_ROLE_SYSTEM_RESERVED",
  );
});
