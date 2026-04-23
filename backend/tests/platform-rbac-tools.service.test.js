const test = require("node:test");
const assert = require("node:assert/strict");

const { pool } = require("../src/config/db");
const { listTenantAssignableSystemRoleKeys } = require("../src/services/platform-rbac-tools.service");

test("listTenantAssignableSystemRoleKeys filters unsupported role keys from tenant settings", async () => {
  const originalQuery = pool.query;
  pool.query = async () => ({
    rowCount: 1,
    rows: [
      {
        settings_json: {
          roles: ["ADMIN", "UNKNOWN_ROLE", "DIPENDENTE"],
        },
      },
    ],
  });

  try {
    const roleKeys = await listTenantAssignableSystemRoleKeys(7);
    assert.deepEqual(roleKeys, ["ADMIN", "DIPENDENTE"]);
  } finally {
    pool.query = originalQuery;
  }
});

test("listTenantAssignableSystemRoleKeys falls back to default system roles when settings are missing", async () => {
  const originalQuery = pool.query;
  pool.query = async () => ({
    rowCount: 1,
    rows: [
      {
        settings_json: {},
      },
    ],
  });

  try {
    const roleKeys = await listTenantAssignableSystemRoleKeys(12);
    assert.deepEqual(roleKeys, ["ADMIN", "SEGRETARIO", "DIPENDENTE"]);
  } finally {
    pool.query = originalQuery;
  }
});

test("listTenantAssignableSystemRoleKeys always includes ADMIN even when tenant settings omit it", async () => {
  const originalQuery = pool.query;
  pool.query = async () => ({
    rowCount: 1,
    rows: [
      {
        settings_json: {
          roles: ["SEGRETARIO", "DIPENDENTE"],
        },
      },
    ],
  });

  try {
    const roleKeys = await listTenantAssignableSystemRoleKeys(21);
    assert.deepEqual(roleKeys, ["SEGRETARIO", "DIPENDENTE", "ADMIN"]);
  } finally {
    pool.query = originalQuery;
  }
});
