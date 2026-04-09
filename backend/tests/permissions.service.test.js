const test = require("node:test");
const assert = require("node:assert/strict");

const { pool } = require("../src/config/db");
const { getUserPermissions } = require("../src/services/permissions.service");

test("getUserPermissions falls back to legacy role permissions when user_roles has no assignments", async () => {
  const originalQuery = pool.query;
  const originalConnect = pool.connect;

  const queryCalls = [];

  pool.connect = async () => ({
    async query(sql, params) {
      const normalized = String(sql);
      queryCalls.push(normalized);

      if (normalized.includes("SELECT 1") && normalized.includes("FROM user_roles ur")) {
        return { rowCount: 0, rows: [] };
      }

      if (
        normalized.includes("SELECT id, role_key") &&
        normalized.includes("FROM roles") &&
        Array.isArray(params) &&
        params[1] === "DIPENDENTE"
      ) {
        return {
          rowCount: 1,
          rows: [{ id: 99, role_key: "DIPENDENTE" }],
        };
      }

      return { rowCount: 1, rows: [] };
    },
    release() {},
  });

  pool.query = async () => ({
    rowCount: 0,
    rows: [],
  });

  try {
    const permissions = await getUserPermissions({
      id: 10,
      studio_id: 3,
      ruolo: "DIPENDENTE",
    });

    assert.deepEqual(permissions, [
      "appointments.read",
      "appointments.write",
      "billing.read",
      "clients.read",
      "dashboard.read",
    ]);
    assert.ok(queryCalls.some((entry) => entry.includes("SELECT 1")));
  } finally {
    pool.query = originalQuery;
    pool.connect = originalConnect;
  }
});

test("getUserPermissions returns role_permissions from RBAC tables after repairing a missing system assignment", async () => {
  const originalQuery = pool.query;
  const originalConnect = pool.connect;
  const connectCalls = [];

  pool.connect = async () => ({
    async query(sql, params) {
      const normalized = String(sql);
      connectCalls.push(normalized);

      if (normalized.includes("SELECT 1") && normalized.includes("FROM user_roles ur")) {
        return { rowCount: 0, rows: [] };
      }

      if (
        normalized.includes("SELECT id, role_key") &&
        normalized.includes("FROM roles") &&
        Array.isArray(params) &&
        params[1] === "SEGRETARIO"
      ) {
        return {
          rowCount: 1,
          rows: [{ id: 55, role_key: "SEGRETARIO" }],
        };
      }

      return { rowCount: 1, rows: [] };
    },
    release() {},
  });

  pool.query = async (sql) => {
    const normalized = String(sql);

    if (normalized.includes("SELECT DISTINCT rp.permission_key")) {
      return {
        rowCount: 2,
        rows: [
          { permission_key: "appointments.read" },
          { permission_key: "appointments.write" },
        ],
      };
    }

    return { rowCount: 0, rows: [] };
  };

  try {
    const permissions = await getUserPermissions({
      id: 11,
      studio_id: 7,
      ruolo: "SEGRETARIO",
    });

    assert.deepEqual(permissions, ["appointments.read", "appointments.write"]);
    assert.ok(connectCalls.some((entry) => entry.includes("DELETE FROM user_roles")));
    assert.ok(connectCalls.some((entry) => entry.includes("INSERT INTO user_roles")));
  } finally {
    pool.query = originalQuery;
    pool.connect = originalConnect;
  }
});

test("getUserPermissions does not rewrite user_roles when the matching system role is already assigned", async () => {
  const originalQuery = pool.query;
  const originalConnect = pool.connect;
  const connectCalls = [];

  pool.connect = async () => ({
    async query(sql) {
      const normalized = String(sql);
      connectCalls.push(normalized);

      if (normalized.includes("SELECT 1") && normalized.includes("FROM user_roles ur")) {
        return { rowCount: 1, rows: [{ exists: 1 }] };
      }

      return { rowCount: 1, rows: [] };
    },
    release() {},
  });

  pool.query = async (sql) => {
    const normalized = String(sql);

    if (normalized.includes("SELECT DISTINCT rp.permission_key")) {
      return {
        rowCount: 1,
        rows: [{ permission_key: "users.read" }],
      };
    }

    return { rowCount: 0, rows: [] };
  };

  try {
    const permissions = await getUserPermissions({
      id: 5,
      studio_id: 9,
      ruolo: "ADMIN",
    });

    assert.deepEqual(permissions, ["users.read"]);
    assert.equal(connectCalls.some((entry) => entry.includes("DELETE FROM user_roles")), false);
    assert.equal(connectCalls.some((entry) => entry.includes("INSERT INTO user_roles")), false);
  } finally {
    pool.query = originalQuery;
    pool.connect = originalConnect;
  }
});
