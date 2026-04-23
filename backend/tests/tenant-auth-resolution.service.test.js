const test = require("node:test");
const assert = require("node:assert/strict");

const { pool } = require("../src/config/db");
const {
  resolveActiveTenantUserByEmail,
  resolveActiveTenantUserById,
  toTenantScopedUser,
} = require("../src/services/tenant-auth-resolution.service");

test("toTenantScopedUser normalizes tenant metadata and ids", () => {
  const normalized = toTenantScopedUser({
    id: "15",
    email: "admin@example.com",
    password_hash: "hash",
    ruolo: "ADMIN",
    studio_id: "9",
    tenant_code: "  DEFAULT  ",
    tenant_name: "Studio Principale",
    vertical_key: "dental",
  });

  assert.deepEqual(normalized, {
    id: 15,
    email: "admin@example.com",
    password_hash: "hash",
    ruolo: "ADMIN",
    account_status: "active",
    studio_id: 9,
    tenant_code: "DEFAULT",
    tenant_name: "Studio Principale",
    vertical_key: "dental",
  });
});

test("resolveActiveTenantUserByEmail returns null when no active tenant match is found", async () => {
  const originalQuery = pool.query;
  pool.query = async () => ({ rowCount: 0, rows: [] });

  try {
    const user = await resolveActiveTenantUserByEmail("missing@example.com");
    assert.equal(user, null);
  } finally {
    pool.query = originalQuery;
  }
});

test("resolveActiveTenantUserById returns normalized tenant-scoped identity", async () => {
  const originalQuery = pool.query;
  pool.query = async () => ({
    rowCount: 1,
    rows: [
      {
        id: 22,
        email: "ops@halo.local",
        password_hash: "hash2",
        ruolo: "SEGRETARIO",
        account_status: "active",
        studio_id: 5,
        tenant_code: "TENANT-5",
        tenant_name: "Tenant 5",
        vertical_key: "services",
      },
    ],
  });

  try {
    const user = await resolveActiveTenantUserById(22);
    assert.deepEqual(user, {
      id: 22,
      email: "ops@halo.local",
      password_hash: "hash2",
      ruolo: "SEGRETARIO",
      account_status: "active",
      studio_id: 5,
      tenant_code: "TENANT-5",
      tenant_name: "Tenant 5",
      vertical_key: "services",
    });
  } finally {
    pool.query = originalQuery;
  }
});
