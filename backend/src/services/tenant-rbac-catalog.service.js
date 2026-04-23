const { pool } = require("../config/db");
const {
  PERMISSION_CATALOG,
  SYSTEM_ROLE_TEMPLATES,
  getSupportedSystemRoleKeys,
} = require("../config/multi-sector");
const {
  ensureSystemRolesForTenant,
  listTenantAssignableSystemRoleKeys,
} = require("./platform-rbac-tools.service");

const permissionCatalogSet = new Set(PERMISSION_CATALOG);
const supportedSystemRoleKeySet = new Set(getSupportedSystemRoleKeys());

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
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!/^[A-Z][A-Z0-9_]{1,79}$/.test(normalized)) {
    return null;
  }

  return normalized;
}

function normalizeRoleDisplayName(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length < 2 || normalized.length > 120) {
    return null;
  }

  return normalized;
}

function normalizePermissionKeys(value) {
  if (!Array.isArray(value)) {
    return {
      valid: false,
      invalidPermissionKeys: [],
      normalizedPermissionKeys: [],
    };
  }

  const normalizedPermissionKeys = Array.from(
    new Set(
      value
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter((entry) => entry.length > 0),
    ),
  ).sort();

  const invalidPermissionKeys = normalizedPermissionKeys.filter(
    (permissionKey) => !permissionCatalogSet.has(permissionKey),
  );

  return {
    valid: invalidPermissionKeys.length === 0,
    invalidPermissionKeys,
    normalizedPermissionKeys,
  };
}

function buildPermissionCatalog() {
  return PERMISSION_CATALOG.map((permissionKey) => ({
    key: permissionKey,
    group: permissionKey.split(".")[0] || "misc",
  }));
}

function buildSystemRoleTemplatesPayload() {
  const result = [];
  for (const roleKey of getSupportedSystemRoleKeys()) {
    const template = SYSTEM_ROLE_TEMPLATES[roleKey];
    result.push({
      role_key: roleKey,
      display_name: template?.display_name || roleKey,
      description: template?.description || null,
    });
  }
  return result;
}

async function listTenantRolesWithPermissions(studioId, client = pool) {
  const normalizedStudioId = parsePositiveInt(studioId);
  if (!normalizedStudioId) {
    return [];
  }

  const result = await client.query(
    `SELECT r.id,
            r.role_key,
            r.display_name,
            r.is_system,
            COALESCE(
              array_agg(rp.permission_key ORDER BY rp.permission_key)
              FILTER (WHERE rp.permission_key IS NOT NULL),
              ARRAY[]::text[]
            ) AS permission_keys
     FROM roles r
     LEFT JOIN role_permissions rp ON rp.role_id = r.id
     WHERE r.studio_id = $1
     GROUP BY r.id, r.role_key, r.display_name, r.is_system
     ORDER BY r.is_system DESC, r.role_key ASC`,
    [normalizedStudioId],
  );

  return result.rows.map((row) => ({
    id: Number(row.id),
    role_key: row.role_key,
    display_name: row.display_name,
    is_system: Boolean(row.is_system),
    permission_keys: Array.isArray(row.permission_keys) ? row.permission_keys : [],
  }));
}

async function getTenantRbacCatalog(studioId, client = pool) {
  const normalizedStudioId = parsePositiveInt(studioId);
  if (!normalizedStudioId) {
    return null;
  }

  await ensureSystemRolesForTenant(client, normalizedStudioId);
  const roles = await listTenantRolesWithPermissions(normalizedStudioId, client);
  const assignableSystemRoleKeys = await listTenantAssignableSystemRoleKeys(normalizedStudioId, client);

  return {
    permission_catalog: buildPermissionCatalog(),
    system_role_templates: buildSystemRoleTemplatesPayload(),
    assignable_system_role_keys: assignableSystemRoleKeys,
    roles,
  };
}

async function createTenantCustomRole(
  client,
  studioId,
  { roleKey, displayName, permissionKeys },
) {
  const normalizedStudioId = parsePositiveInt(studioId);
  const normalizedRoleKey = normalizeRoleKey(roleKey);
  const normalizedDisplayName = normalizeRoleDisplayName(displayName);
  const permissionValidation = normalizePermissionKeys(permissionKeys);

  if (!normalizedStudioId || !normalizedRoleKey || !normalizedDisplayName) {
    const error = new Error("Parametri ruolo tenant non validi.");
    error.code = "TENANT_ROLE_INVALID_INPUT";
    throw error;
  }

  if (!permissionValidation.valid) {
    const error = new Error("Permission key non valida.");
    error.code = "TENANT_ROLE_PERMISSION_INVALID";
    error.invalid_permission_keys = permissionValidation.invalidPermissionKeys;
    throw error;
  }

  if (supportedSystemRoleKeySet.has(normalizedRoleKey)) {
    const error = new Error("Role key riservata ai ruoli di sistema.");
    error.code = "TENANT_ROLE_SYSTEM_RESERVED";
    throw error;
  }

  const existingRoleResult = await client.query(
    `SELECT id
     FROM roles
     WHERE studio_id = $1
       AND role_key = $2
     LIMIT 1`,
    [normalizedStudioId, normalizedRoleKey],
  );

  if (existingRoleResult.rowCount > 0) {
    const error = new Error("Role key gia presente nel tenant.");
    error.code = "TENANT_ROLE_KEY_CONFLICT";
    throw error;
  }

  const createdRoleResult = await client.query(
    `INSERT INTO roles (studio_id, role_key, display_name, is_system, created_at, updated_at)
     VALUES ($1, $2, $3, FALSE, NOW(), NOW())
     RETURNING id, role_key, display_name, is_system`,
    [normalizedStudioId, normalizedRoleKey, normalizedDisplayName],
  );

  const role = createdRoleResult.rows[0];
  const roleId = Number(role.id);

  for (const permissionKey of permissionValidation.normalizedPermissionKeys) {
    await client.query(
      `INSERT INTO role_permissions (role_id, permission_key)
       VALUES ($1, $2)
       ON CONFLICT (role_id, permission_key) DO NOTHING`,
      [roleId, permissionKey],
    );
  }

  return {
    id: roleId,
    role_key: role.role_key,
    display_name: role.display_name,
    is_system: Boolean(role.is_system),
    permission_keys: permissionValidation.normalizedPermissionKeys,
  };
}

async function updateTenantCustomRole(
  client,
  studioId,
  roleId,
  { displayName, permissionKeys },
) {
  const normalizedStudioId = parsePositiveInt(studioId);
  const normalizedRoleId = parsePositiveInt(roleId);
  const hasDisplayName = displayName !== undefined;
  const hasPermissionKeys = permissionKeys !== undefined;
  const normalizedDisplayName = hasDisplayName ? normalizeRoleDisplayName(displayName) : undefined;
  const permissionValidation = hasPermissionKeys
    ? normalizePermissionKeys(permissionKeys)
    : {
        valid: true,
        invalidPermissionKeys: [],
        normalizedPermissionKeys: [],
      };

  if (!normalizedStudioId || !normalizedRoleId || (!hasDisplayName && !hasPermissionKeys)) {
    const error = new Error("Parametri aggiornamento ruolo non validi.");
    error.code = "TENANT_ROLE_INVALID_INPUT";
    throw error;
  }

  if (hasDisplayName && !normalizedDisplayName) {
    const error = new Error("Display name non valido.");
    error.code = "TENANT_ROLE_INVALID_INPUT";
    throw error;
  }

  if (!permissionValidation.valid) {
    const error = new Error("Permission key non valida.");
    error.code = "TENANT_ROLE_PERMISSION_INVALID";
    error.invalid_permission_keys = permissionValidation.invalidPermissionKeys;
    throw error;
  }

  const roleResult = await client.query(
    `SELECT id, role_key, display_name, is_system
     FROM roles
     WHERE id = $1
       AND studio_id = $2
     LIMIT 1`,
    [normalizedRoleId, normalizedStudioId],
  );

  if (roleResult.rowCount === 0) {
    const error = new Error("Ruolo tenant non trovato.");
    error.code = "TENANT_ROLE_NOT_FOUND";
    throw error;
  }

  const role = roleResult.rows[0];
  if (role.is_system) {
    const error = new Error("I ruoli di sistema non sono modificabili da questa API.");
    error.code = "TENANT_ROLE_SYSTEM_IMMUTABLE";
    throw error;
  }

  if (hasDisplayName) {
    await client.query(
      `UPDATE roles
       SET display_name = $1,
           updated_at = NOW()
       WHERE id = $2
         AND studio_id = $3`,
      [normalizedDisplayName, normalizedRoleId, normalizedStudioId],
    );
  }

  if (hasPermissionKeys) {
    await client.query(`DELETE FROM role_permissions WHERE role_id = $1`, [normalizedRoleId]);
    for (const permissionKey of permissionValidation.normalizedPermissionKeys) {
      await client.query(
        `INSERT INTO role_permissions (role_id, permission_key)
         VALUES ($1, $2)
         ON CONFLICT (role_id, permission_key) DO NOTHING`,
        [normalizedRoleId, permissionKey],
      );
    }
  }

  const updatedRoles = await listTenantRolesWithPermissions(normalizedStudioId, client);
  const updated = updatedRoles.find((entry) => entry.id === normalizedRoleId);
  return updated || null;
}

async function deleteTenantCustomRole(client, studioId, roleId) {
  const normalizedStudioId = parsePositiveInt(studioId);
  const normalizedRoleId = parsePositiveInt(roleId);

  if (!normalizedStudioId || !normalizedRoleId) {
    const error = new Error("Parametri eliminazione ruolo non validi.");
    error.code = "TENANT_ROLE_INVALID_INPUT";
    throw error;
  }

  const roleResult = await client.query(
    `SELECT id, role_key, display_name, is_system
     FROM roles
     WHERE id = $1
       AND studio_id = $2
     LIMIT 1`,
    [normalizedRoleId, normalizedStudioId],
  );

  if (roleResult.rowCount === 0) {
    const error = new Error("Ruolo tenant non trovato.");
    error.code = "TENANT_ROLE_NOT_FOUND";
    throw error;
  }

  const role = roleResult.rows[0];
  if (role.is_system) {
    const error = new Error("I ruoli di sistema non sono eliminabili.");
    error.code = "TENANT_ROLE_SYSTEM_IMMUTABLE";
    throw error;
  }

  const assignmentResult = await client.query(
    `SELECT COUNT(*)::int AS total
     FROM user_roles
     WHERE role_id = $1`,
    [normalizedRoleId],
  );

  if (Number(assignmentResult.rows[0]?.total || 0) > 0) {
    const error = new Error("Ruolo assegnato a utenti tenant.");
    error.code = "TENANT_ROLE_ASSIGNED";
    throw error;
  }

  await client.query(`DELETE FROM role_permissions WHERE role_id = $1`, [normalizedRoleId]);
  await client.query(
    `DELETE FROM roles
     WHERE id = $1
       AND studio_id = $2`,
    [normalizedRoleId, normalizedStudioId],
  );

  return {
    id: Number(role.id),
    role_key: role.role_key,
    display_name: role.display_name,
    is_system: Boolean(role.is_system),
  };
}

module.exports = {
  createTenantCustomRole,
  deleteTenantCustomRole,
  getTenantRbacCatalog,
  listTenantRolesWithPermissions,
  normalizePermissionKeys,
  updateTenantCustomRole,
};
