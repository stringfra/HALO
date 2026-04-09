const test = require("node:test");
const assert = require("node:assert/strict");

const {
  assignSystemRoleToUser,
  getTenantSystemRoleRecordByKey,
  hasMatchingSystemRoleAssignment,
} = require("../src/services/tenant-user-rbac.service");

function createMockClient({ systemRoleRecord } = {}) {
  const calls = [];

  return {
    calls,
    async query(sql, params) {
      calls.push({
        sql: String(sql).replace(/\s+/g, " ").trim(),
        params,
      });

      if (String(sql).includes("SELECT id, role_key") && String(sql).includes("FROM roles")) {
        if (!systemRoleRecord) {
          return { rowCount: 0, rows: [] };
        }

        return {
          rowCount: 1,
          rows: [
            {
              id: systemRoleRecord.id,
              role_key: systemRoleRecord.role_key,
            },
          ],
        };
      }

      return {
        rowCount: 1,
        rows: [],
      };
    },
  };
}

test("getTenantSystemRoleRecordByKey returns null when the tenant system role is missing", async () => {
  const client = createMockClient();

  const result = await getTenantSystemRoleRecordByKey(client, 12, "DIPENDENTE");

  assert.equal(result, null);
  assert.equal(client.calls.length, 1);
});

test("assignSystemRoleToUser replaces existing system roles with the requested tenant system role", async () => {
  const client = createMockClient({
    systemRoleRecord: { id: 77, role_key: "DIPENDENTE" },
  });

  const result = await assignSystemRoleToUser(client, 18, 45, "DIPENDENTE");

  assert.deepEqual(result, {
    id: 77,
    role_key: "DIPENDENTE",
  });
  assert.equal(client.calls.length, 3);
  assert.match(client.calls[1].sql, /DELETE FROM user_roles/);
  assert.deepEqual(client.calls[1].params, [45, 18]);
  assert.match(client.calls[2].sql, /INSERT INTO user_roles/);
  assert.deepEqual(client.calls[2].params, [45, 77]);
});

test("assignSystemRoleToUser does not mutate assignments when the requested tenant system role does not exist", async () => {
  const client = createMockClient();

  const result = await assignSystemRoleToUser(client, 18, 45, "DIPENDENTE");

  assert.equal(result, null);
  assert.equal(client.calls.length, 1);
});

test("hasMatchingSystemRoleAssignment returns true when the expected system role is assigned", async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      calls.push({
        sql: String(sql).replace(/\s+/g, " ").trim(),
        params,
      });

      return {
        rowCount: 1,
        rows: [{ exists: 1 }],
      };
    },
  };

  const result = await hasMatchingSystemRoleAssignment(client, 18, 45, "DIPENDENTE");

  assert.equal(result, true);
  assert.equal(calls.length, 1);
});
