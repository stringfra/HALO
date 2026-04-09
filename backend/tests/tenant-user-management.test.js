const test = require("node:test");
const assert = require("node:assert/strict");

const {
  resolveTenantUserAssignmentIds,
  updateTenantUserProfile,
} = require("../src/services/tenant-user-management.service");

test("resolveTenantUserAssignmentIds keeps exactly one matching system role and preserves custom role ids", async () => {
  const calls = [];
  const client = {
    async query(sql, params) {
      const normalized = String(sql).replace(/\s+/g, " ").trim();
      calls.push({ sql: normalized, params });

      if (normalized.includes("SELECT settings_json FROM studi")) {
        return {
          rowCount: 1,
          rows: [{ settings_json: { roles: ["ADMIN", "SEGRETARIO", "DIPENDENTE"] } }],
        };
      }

      if (normalized.includes("INSERT INTO roles")) {
        const roleKey = params[1];
        const roleIdByKey = {
          ADMIN: 1,
          SEGRETARIO: 2,
          DIPENDENTE: 3,
        };
        return {
          rowCount: 1,
          rows: [{ id: roleIdByKey[roleKey] }],
        };
      }

      if (normalized.includes("SELECT id, role_key FROM roles")) {
        return {
          rowCount: 1,
          rows: [{ id: 3, role_key: "DIPENDENTE" }],
        };
      }

      if (normalized.includes("SELECT id, role_key, display_name, is_system FROM roles")) {
        return {
          rowCount: 2,
          rows: [
            { id: 3, role_key: "DIPENDENTE", display_name: "Staff", is_system: true },
            { id: 9, role_key: "CUSTOM_HELPER", display_name: "Helper", is_system: false },
          ],
        };
      }

      return { rowCount: 1, rows: [] };
    },
  };

  const assignmentIds = await resolveTenantUserAssignmentIds(client, 15, "DIPENDENTE", [3, 9]);

  assert.deepEqual(assignmentIds, [3, 9]);
  assert.ok(calls.some((entry) => entry.sql.includes("SELECT id, role_key, display_name, is_system FROM roles")));
});

test("updateTenantUserProfile blocks role change when trying to demote the last admin", async () => {
  const client = {
    async query(sql) {
      const normalized = String(sql).replace(/\s+/g, " ").trim();

      if (normalized.includes("SELECT id, ruolo FROM users")) {
        return {
          rowCount: 1,
          rows: [{ id: 7, ruolo: "ADMIN" }],
        };
      }

      if (normalized.includes("SELECT COUNT(*)::int AS total FROM users")) {
        return {
          rowCount: 1,
          rows: [{ total: 1 }],
        };
      }

      return { rowCount: 1, rows: [] };
    },
  };

  await assert.rejects(
    () =>
      updateTenantUserProfile(client, {
        studioId: 5,
        userId: 7,
        updates: { nextRole: "SEGRETARIO" },
      }),
    (error) => error?.code === "TENANT_LAST_ADMIN_CONFLICT",
  );
});
