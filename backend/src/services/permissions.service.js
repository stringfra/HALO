const { pool } = require("../config/db");
const { getLegacyPermissions } = require("../config/multi-sector");
const { ensureSystemRolesForTenant } = require("./platform-rbac-tools.service");
const {
  assignSystemRoleToUser,
  hasMatchingSystemRoleAssignment,
} = require("./tenant-user-rbac.service");

async function ensureUserRbacConsistency(user) {
  const userId = Number(user?.id);
  const studioId = Number(user?.studio_id);
  const roleKey = String(user?.ruolo || "").toUpperCase();

  if (!userId || !studioId || !roleKey) {
    return;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await ensureSystemRolesForTenant(client, studioId);
    const hasMatchingAssignment = await hasMatchingSystemRoleAssignment(
      client,
      studioId,
      userId,
      roleKey,
    );

    if (!hasMatchingAssignment) {
      await assignSystemRoleToUser(client, studioId, userId, roleKey);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getUserPermissions(user) {
  const userId = Number(user?.id);
  const studioId = Number(user?.studio_id);
  const roleKey = String(user?.ruolo || "").toUpperCase();

  if (!userId || !studioId || !roleKey) {
    return [];
  }

  try {
    await ensureUserRbacConsistency(user);

    const result = await pool.query(
      `SELECT DISTINCT rp.permission_key
       FROM user_roles ur
       JOIN roles r
         ON r.id = ur.role_id
        AND r.studio_id = $2
       JOIN role_permissions rp
         ON rp.role_id = r.id
       WHERE ur.user_id = $1`,
      [userId, studioId],
    );

    if (result.rowCount > 0) {
      return result.rows
        .map((row) => (typeof row.permission_key === "string" ? row.permission_key.trim() : ""))
        .filter((value) => value.length > 0)
        .sort();
    }
  } catch (error) {
    if (!["42P01", "42703"].includes(error?.code)) {
      throw error;
    }
  }

  // Compatibility guard for tenants or users not yet repaired:
  // if RBAC tables exist but the user has no system-role assignment,
  // fall back to the legacy permission profile derived from users.ruolo.
  return [...getLegacyPermissions(roleKey)].sort();
}

async function userHasPermission(user, permissionKey) {
  const permissions = await getUserPermissions(user);
  return permissions.includes(permissionKey);
}

module.exports = {
  getUserPermissions,
  userHasPermission,
};
