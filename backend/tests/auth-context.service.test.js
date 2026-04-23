const test = require("node:test");
const assert = require("node:assert/strict");

const {
  TENANT_IDENTITY_TYPE,
  buildTenantUserAuthContext,
  issueAccessTokenForContext,
  verifyJwtToken,
} = require("../src/services/auth-context.service");

test("buildTenantUserAuthContext accepts tenant_code and normalizes permissions", () => {
  const context = buildTenantUserAuthContext(
    {
      id: "11",
      studio_id: "4",
      ruolo: "admin",
      tenant_code: "  TENANT-4  ",
    },
    ["users.write", " users.read ", "", "users.read"],
  );

  assert.equal(context.identityType, TENANT_IDENTITY_TYPE);
  assert.equal(context.userId, 11);
  assert.equal(context.studioId, 4);
  assert.equal(context.role, "ADMIN");
  assert.equal(context.tenantCode, "TENANT-4");
  assert.deepEqual(context.permissions, ["users.read", "users.read", "users.write"]);
});

test("issueAccessTokenForContext and verifyJwtToken preserve tenant-scoped auth context", () => {
  const secret = "test-secret-key";
  const issued = issueAccessTokenForContext(
    {
      identityType: TENANT_IDENTITY_TYPE,
      userId: 7,
      studioId: 3,
      role: "SEGRETARIO",
      tenantCode: "DEFAULT",
      permissions: ["dashboard.read", "clients.read"],
    },
    secret,
    "10m",
  );

  const parsed = verifyJwtToken(issued.token, secret);
  assert.equal(parsed.identityType, TENANT_IDENTITY_TYPE);
  assert.equal(parsed.userId, 7);
  assert.equal(parsed.studioId, 3);
  assert.equal(parsed.role, "SEGRETARIO");
  assert.equal(parsed.tenantCode, "DEFAULT");
  assert.deepEqual(parsed.permissions, ["clients.read", "dashboard.read"]);
});
