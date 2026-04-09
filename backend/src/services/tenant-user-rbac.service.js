function parsePositiveInt(value) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

function normalizeRoleKey(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

async function getTenantSystemRoleRecordByKey(client, studioId, roleKey) {
  const normalizedStudioId = parsePositiveInt(studioId);
  const normalizedRoleKey = normalizeRoleKey(roleKey);

  if (!normalizedStudioId || !normalizedRoleKey) {
    return null;
  }

  const result = await client.query(
    `SELECT id, role_key
     FROM roles
     WHERE studio_id = $1
       AND role_key = $2
       AND is_system = TRUE
     LIMIT 1`,
    [normalizedStudioId, normalizedRoleKey],
  );

  if (result.rowCount === 0) {
    return null;
  }

  return {
    id: Number(result.rows[0].id),
    role_key: result.rows[0].role_key,
  };
}

async function hasMatchingSystemRoleAssignment(client, studioId, userId, roleKey) {
  const normalizedStudioId = parsePositiveInt(studioId);
  const normalizedUserId = parsePositiveInt(userId);
  const normalizedRoleKey = normalizeRoleKey(roleKey);

  if (!normalizedStudioId || !normalizedUserId || !normalizedRoleKey) {
    return false;
  }

  const result = await client.query(
    `SELECT 1
     FROM user_roles ur
     INNER JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1
       AND r.studio_id = $2
       AND r.is_system = TRUE
       AND r.role_key = $3
     LIMIT 1`,
    [normalizedUserId, normalizedStudioId, normalizedRoleKey],
  );

  return result.rowCount > 0;
}

async function assignSystemRoleToUser(client, studioId, userId, roleKey) {
  const normalizedStudioId = parsePositiveInt(studioId);
  const normalizedUserId = parsePositiveInt(userId);
  const normalizedRoleKey = normalizeRoleKey(roleKey);

  if (!normalizedStudioId || !normalizedUserId || !normalizedRoleKey) {
    throw new Error("Parametri RBAC utente non validi.");
  }

  const systemRole = await getTenantSystemRoleRecordByKey(client, normalizedStudioId, normalizedRoleKey);
  if (!systemRole) {
    return null;
  }

  await client.query(
    `DELETE FROM user_roles ur
     USING roles r
     WHERE ur.role_id = r.id
       AND ur.user_id = $1
       AND r.studio_id = $2
       AND r.is_system = TRUE`,
    [normalizedUserId, normalizedStudioId],
  );

  await client.query(
    `INSERT INTO user_roles (user_id, role_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, role_id) DO NOTHING`,
    [normalizedUserId, systemRole.id],
  );

  return systemRole;
}

module.exports = {
  assignSystemRoleToUser,
  getTenantSystemRoleRecordByKey,
  hasMatchingSystemRoleAssignment,
};
