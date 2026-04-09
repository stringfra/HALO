const { ensureSystemRolesForTenant } = require("./platform-rbac-tools.service");
const {
  assignSystemRoleToUser,
  getTenantSystemRoleRecordByKey,
} = require("./tenant-user-rbac.service");

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

async function countTenantAdmins(client, studioId) {
  const normalizedStudioId = parsePositiveInt(studioId);
  if (!normalizedStudioId) {
    return 0;
  }

  const result = await client.query(
    `SELECT COUNT(*)::int AS total
     FROM users
     WHERE studio_id = $1
       AND ruolo = 'ADMIN'`,
    [normalizedStudioId],
  );

  return Number(result.rows[0]?.total || 0);
}

async function listTenantRoleRecordsByIds(client, studioId, roleIds) {
  if (!Array.isArray(roleIds) || roleIds.length === 0) {
    return [];
  }

  const normalizedStudioId = parsePositiveInt(studioId);
  const normalizedRoleIds = roleIds
    .map((value) => parsePositiveInt(value))
    .filter((value) => Number.isInteger(value));

  if (!normalizedStudioId || normalizedRoleIds.length === 0) {
    return [];
  }

  const result = await client.query(
    `SELECT id, role_key, display_name, is_system
     FROM roles
     WHERE studio_id = $1
       AND id = ANY($2::bigint[])
     ORDER BY role_key ASC`,
    [normalizedStudioId, normalizedRoleIds],
  );

  return result.rows.map((row) => ({
    id: Number(row.id),
    role_key: row.role_key,
    display_name: row.display_name,
    is_system: Boolean(row.is_system),
  }));
}

async function resolveTenantUserAssignmentIds(client, studioId, roleKey, requestedRoleIds = []) {
  await ensureSystemRolesForTenant(client, studioId);

  const systemRoleRecord = await getTenantSystemRoleRecordByKey(client, studioId, roleKey);
  if (!systemRoleRecord) {
    const error = new Error("Ruolo di sistema tenant non disponibile.");
    error.code = "TENANT_SYSTEM_ROLE_NOT_AVAILABLE";
    throw error;
  }

  if (!Array.isArray(requestedRoleIds) || requestedRoleIds.length === 0) {
    return [systemRoleRecord.id];
  }

  const requestedRoles = await listTenantRoleRecordsByIds(client, studioId, requestedRoleIds);
  if (requestedRoles.length !== requestedRoleIds.length) {
    const error = new Error("Uno o piu ruoli iniziali non esistono per il tenant selezionato.");
    error.code = "TENANT_ROLE_NOT_FOUND";
    throw error;
  }

  const requestedSystemRoles = requestedRoles.filter((role) => role.is_system);
  if (
    requestedSystemRoles.length > 1 ||
    (requestedSystemRoles.length === 1 && requestedSystemRoles[0].role_key !== roleKey)
  ) {
    const error = new Error(
      "I ruoli iniziali devono mantenere un solo ruolo di sistema coerente con il ruolo base dell'utente.",
    );
    error.code = "TENANT_SYSTEM_ROLE_CONFLICT";
    throw error;
  }

  const customRoleIds = requestedRoles.filter((role) => !role.is_system).map((role) => role.id);
  return [systemRoleRecord.id, ...customRoleIds].sort((left, right) => left - right);
}

async function createTenantUser(client, { studioId, nome, email, passwordHash, ruolo, requestedRoleIds = [] }) {
  const assignmentIds = await resolveTenantUserAssignmentIds(
    client,
    studioId,
    ruolo,
    requestedRoleIds,
  );

  const result = await client.query(
    `INSERT INTO users (studio_id, nome, email, password_hash, ruolo)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [studioId, nome, email, passwordHash, ruolo],
  );

  const userId = Number(result.rows[0]?.id);
  for (const roleId of assignmentIds) {
    await client.query(
      `INSERT INTO user_roles (user_id, role_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, role_id) DO NOTHING`,
      [userId, roleId],
    );
  }

  return {
    userId,
    assignedRoleIds: assignmentIds,
  };
}

async function updateTenantUserProfile(
  client,
  { studioId, userId, updates },
) {
  const currentUserResult = await client.query(
    `SELECT id, ruolo
     FROM users
     WHERE id = $1
       AND studio_id = $2
     LIMIT 1`,
    [userId, studioId],
  );

  if (currentUserResult.rowCount === 0) {
    const error = new Error("Utente tenant non trovato.");
    error.code = "TENANT_USER_NOT_FOUND";
    throw error;
  }

  const currentUser = currentUserResult.rows[0];
  const fields = [];
  const values = [];
  let index = 1;

  if (updates.nome !== undefined) {
    fields.push(`nome = $${index++}`);
    values.push(updates.nome);
  }

  if (updates.email !== undefined) {
    fields.push(`email = $${index++}`);
    values.push(updates.email);
  }

  if (updates.nextRole !== undefined) {
    fields.push(`ruolo = $${index++}`);
    values.push(updates.nextRole);
  }

  if (updates.passwordHash !== undefined) {
    fields.push(`password_hash = $${index++}`);
    values.push(updates.passwordHash);
  }

  if (fields.length === 0) {
    const error = new Error("Nessun campo valido da aggiornare.");
    error.code = "TENANT_USER_NO_FIELDS";
    throw error;
  }

  if (currentUser.ruolo === "ADMIN" && updates.nextRole && updates.nextRole !== "ADMIN") {
    const adminCount = await countTenantAdmins(client, studioId);
    if (adminCount <= 1) {
      const error = new Error("Non puoi rimuovere l'ultimo ADMIN del tenant.");
      error.code = "TENANT_LAST_ADMIN_CONFLICT";
      throw error;
    }
  }

  values.push(userId);
  values.push(studioId);

  const result = await client.query(
    `UPDATE users
     SET ${fields.join(", ")}
     WHERE id = $${index}
       AND studio_id = $${index + 1}
     RETURNING id`,
    values,
  );

  if (updates.nextRole) {
    await ensureSystemRolesForTenant(client, studioId);
    const assignedRole = await assignSystemRoleToUser(client, studioId, userId, updates.nextRole);
    if (!assignedRole) {
      const error = new Error("Ruolo di sistema tenant non disponibile.");
      error.code = "TENANT_SYSTEM_ROLE_NOT_AVAILABLE";
      throw error;
    }
  }

  return {
    currentUser: {
      id: Number(currentUser.id),
      ruolo: currentUser.ruolo,
    },
    updatedUserId: Number(result.rows[0]?.id),
  };
}

module.exports = {
  countTenantAdmins,
  createTenantUser,
  listTenantRoleRecordsByIds,
  resolveTenantUserAssignmentIds,
  updateTenantUserProfile,
};
