const { pool } = require("../config/db");
const { LEGACY_ROLE_PERMISSIONS, NEW_ACTIVITY_DEFAULT_SYSTEM_ROLES } = require("../config/multi-sector");
const { getTenantConfigById } = require("./tenant-config.service");

function normalizeSystemRoleKeys(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((entry) => (typeof entry === "string" ? entry.trim().toUpperCase() : ""))
        .filter((entry) => entry.length > 0),
    ),
  );
}

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

function getSystemRoleDisplayName(roleKey) {
  if (roleKey === "ADMIN") {
    return "Administrator";
  }
  if (roleKey === "DENTISTA") {
    return "Practitioner";
  }
  if (roleKey === "DIPENDENTE") {
    return "Staff";
  }
  return "Coordinator";
}

async function ensureDipendenteEnumValue(client) {
  await client.query(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ruolo_utente')
         AND NOT EXISTS (
           SELECT 1
           FROM pg_enum
           WHERE enumtypid = 'ruolo_utente'::regtype
             AND enumlabel = 'DIPENDENTE'
         ) THEN
        ALTER TYPE ruolo_utente ADD VALUE 'DIPENDENTE';
      END IF;
    END $$;
  `);
}

async function getTenantSystemRoleEntries(tenantId, client = pool) {
  const result = await client.query(
    `SELECT settings_json
     FROM studi
     WHERE id = $1
     LIMIT 1`,
    [Number(tenantId)],
  );

  const rawRoles = result.rows[0]?.settings_json?.roles;
  const normalizedRoleKeys = normalizeSystemRoleKeys(rawRoles);
  const effectiveRoleKeys =
    normalizedRoleKeys.length > 0 ? normalizedRoleKeys : [...NEW_ACTIVITY_DEFAULT_SYSTEM_ROLES];

  return effectiveRoleKeys.map((roleKey) => [roleKey, LEGACY_ROLE_PERMISSIONS[roleKey] || []]);
}

async function ensureSystemRolesForTenant(client, tenantId) {
  const createdOrUpdated = [];
  const systemRoleEntries = await getTenantSystemRoleEntries(tenantId, client);

  for (const [roleKey, permissions] of systemRoleEntries) {
    const roleResult = await client.query(
      `INSERT INTO roles (studio_id, role_key, display_name, is_system, updated_at)
       VALUES ($1, $2, $3, TRUE, NOW())
       ON CONFLICT (studio_id, role_key) DO UPDATE
       SET display_name = EXCLUDED.display_name,
           is_system = TRUE,
           updated_at = NOW()
       RETURNING id, role_key`,
      [Number(tenantId), roleKey, getSystemRoleDisplayName(roleKey)],
    );

    const roleId = Number(roleResult.rows[0]?.id);
    if (!roleId) {
      continue;
    }

    await client.query(`DELETE FROM role_permissions WHERE role_id = $1`, [roleId]);
    for (const permissionKey of permissions) {
      await client.query(
        `INSERT INTO role_permissions (role_id, permission_key)
         VALUES ($1, $2)
         ON CONFLICT (role_id, permission_key) DO NOTHING`,
        [roleId, permissionKey],
      );
    }

    createdOrUpdated.push({
      id: roleId,
      role_key: roleResult.rows[0].role_key,
    });
  }

  return createdOrUpdated;
}

async function getTenantRbacConsistencySnapshot(tenantId, client = pool) {
  const normalizedTenantId = parsePositiveInt(tenantId);
  if (!normalizedTenantId) {
    return null;
  }

  const tenant = await getTenantConfigById(normalizedTenantId);
  if (!tenant) {
    return null;
  }

  const [rolesResult, usersResult, crossTenantAssignmentsResult] = await Promise.all([
    client.query(
      `SELECT id, role_key, display_name, is_system
       FROM roles
       WHERE studio_id = $1
       ORDER BY role_key ASC`,
      [normalizedTenantId],
    ),
    client.query(
      `SELECT u.id,
              u.nome,
              u.email,
              u.ruolo,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id', r.id,
                    'role_key', r.role_key,
                    'display_name', r.display_name,
                    'is_system', r.is_system
                  )
                  ORDER BY r.role_key
                ) FILTER (WHERE r.id IS NOT NULL),
                '[]'::json
              ) AS assigned_roles
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id AND r.studio_id = u.studio_id
       WHERE u.studio_id = $1
       GROUP BY u.id, u.nome, u.email, u.ruolo
       ORDER BY u.id ASC`,
      [normalizedTenantId],
    ),
    client.query(
      `SELECT u.id,
              COUNT(*)::int AS cross_tenant_role_assignments_count
       FROM users u
       INNER JOIN user_roles ur ON ur.user_id = u.id
       INNER JOIN roles r ON r.id = ur.role_id
       WHERE u.studio_id = $1
         AND r.studio_id <> u.studio_id
       GROUP BY u.id
       ORDER BY u.id ASC`,
      [normalizedTenantId],
    ),
  ]);

  const roles = rolesResult.rows.map((row) => ({
    id: Number(row.id),
    role_key: row.role_key,
    display_name: row.display_name,
    is_system: Boolean(row.is_system),
  }));

  const existingSystemRoleKeys = new Set(
    roles.filter((role) => role.is_system).map((role) => role.role_key),
  );
  const expectedSystemRoleEntries = await getTenantSystemRoleEntries(normalizedTenantId, client);
  const missingSystemRoles = expectedSystemRoleEntries
    .map(([roleKey]) => roleKey)
    .filter(
    (roleKey) => !existingSystemRoleKeys.has(roleKey),
  );

  const crossTenantAssignmentsByUserId = new Map(
    crossTenantAssignmentsResult.rows.map((row) => [
      Number(row.id),
      Number(row.cross_tenant_role_assignments_count || 0),
    ]),
  );

  const users = usersResult.rows.map((row) => {
    const userId = Number(row.id);
    const assignedRoles = Array.isArray(row.assigned_roles) ? row.assigned_roles : [];
    const systemRoles = assignedRoles.filter((role) => role?.is_system);
    const expectedSystemRole = String(row.ruolo || "").toUpperCase();
    const hasExpectedSystemRole = systemRoles.some((role) => role.role_key === expectedSystemRole);
    const crossTenantRoleAssignmentsCount = crossTenantAssignmentsByUserId.get(userId) || 0;

    return {
      id: userId,
      nome: row.nome,
      email: row.email,
      ruolo: expectedSystemRole,
      assigned_roles: assignedRoles,
      cross_tenant_role_assignments_count: crossTenantRoleAssignmentsCount,
      issues: [
        ...(systemRoles.length === 0 ? ["missing_system_role"] : []),
        ...(systemRoles.length > 1 ? ["multiple_system_roles"] : []),
        ...(systemRoles.length > 0 && !hasExpectedSystemRole ? ["legacy_role_mismatch"] : []),
        ...(crossTenantRoleAssignmentsCount > 0 ? ["cross_tenant_role_assignment"] : []),
      ],
    };
  });

  const inconsistentUsers = users.filter((user) => user.issues.length > 0);

  return {
    tenant,
    summary: {
      users_total: users.length,
      roles_total: roles.length,
      missing_system_roles_total: missingSystemRoles.length,
      inconsistent_users_total: inconsistentUsers.length,
      users_missing_system_role_total: users.filter((user) => user.issues.includes("missing_system_role")).length,
      users_multiple_system_roles_total: users.filter((user) => user.issues.includes("multiple_system_roles")).length,
      users_role_mismatch_total: users.filter((user) => user.issues.includes("legacy_role_mismatch")).length,
      users_cross_tenant_role_assignment_total: users.filter((user) =>
        user.issues.includes("cross_tenant_role_assignment"),
      ).length,
    },
    missing_system_roles: missingSystemRoles,
    inconsistent_users: inconsistentUsers,
  };
}

async function getPlatformRbacHealthSnapshot() {
  const tenantsResult = await pool.query(
    `SELECT id
     FROM studi
     ORDER BY id ASC`,
  );

  const tenantIds = tenantsResult.rows.map((row) => Number(row.id)).filter((value) => Number.isInteger(value));
  const reports = [];

  for (const tenantId of tenantIds) {
    const snapshot = await getTenantRbacConsistencySnapshot(tenantId);
    if (!snapshot) {
      continue;
    }

    reports.push({
      tenant_id: snapshot.tenant.id,
      tenant_code: snapshot.tenant.code,
      tenant_display_name: snapshot.tenant.display_name,
      missing_system_roles_total: snapshot.summary.missing_system_roles_total,
      inconsistent_users_total: snapshot.summary.inconsistent_users_total,
      users_cross_tenant_role_assignment_total:
        snapshot.summary.users_cross_tenant_role_assignment_total,
      healthy:
        snapshot.summary.missing_system_roles_total === 0 &&
        snapshot.summary.inconsistent_users_total === 0,
    });
  }

  return {
    tenants_total: reports.length,
    unhealthy_tenants_total: reports.filter((item) => !item.healthy).length,
    tenants: reports,
  };
}

async function repairTenantRbacConsistencyWithClient(client, normalizedTenantId, tenant) {
  const ensuredSystemRoles = await ensureSystemRolesForTenant(client, normalizedTenantId);
  const snapshotBefore = await getTenantRbacConsistencySnapshot(normalizedTenantId, client);

  const removedCrossTenantAssignmentsResult = await client.query(
    `DELETE FROM user_roles ur
     USING users u, roles r
     WHERE ur.user_id = u.id
       AND ur.role_id = r.id
       AND u.studio_id = $1
       AND r.studio_id <> u.studio_id`,
    [normalizedTenantId],
  );

  const systemRolesResult = await client.query(
    `SELECT id, role_key
     FROM roles
     WHERE studio_id = $1
       AND is_system = TRUE`,
    [normalizedTenantId],
  );

  const systemRoleMap = new Map(
    systemRolesResult.rows.map((row) => [row.role_key, Number(row.id)]),
  );

  const usersResult = await client.query(
    `SELECT u.id,
            u.ruolo,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', r.id,
                  'role_key', r.role_key,
                  'is_system', r.is_system
                )
                ORDER BY r.role_key
              ) FILTER (WHERE r.id IS NOT NULL),
              '[]'::json
            ) AS assigned_roles
     FROM users u
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     LEFT JOIN roles r ON r.id = ur.role_id AND r.studio_id = u.studio_id
     WHERE u.studio_id = $1
     GROUP BY u.id, u.ruolo
     ORDER BY u.id ASC`,
    [normalizedTenantId],
  );

  let repairedUsers = 0;

  for (const row of usersResult.rows) {
    const userId = Number(row.id);
    const legacyRole = String(row.ruolo || "").toUpperCase();
    const assignedRoles = Array.isArray(row.assigned_roles) ? row.assigned_roles : [];
    const systemRoles = assignedRoles.filter((role) => role?.is_system);
    const preferredSystemRoleKey =
      systemRoleMap.has(legacyRole) ? legacyRole : systemRoles[0]?.role_key || "SEGRETARIO";
    const preferredSystemRoleId = systemRoleMap.get(preferredSystemRoleKey);

    let touched = false;

    if (systemRoles.length !== 1 || !systemRoles.some((role) => role.role_key === preferredSystemRoleKey)) {
      await client.query(
        `DELETE FROM user_roles ur
         USING roles r
         WHERE ur.role_id = r.id
           AND ur.user_id = $1
           AND r.studio_id = $2
           AND r.is_system = TRUE`,
        [userId, normalizedTenantId],
      );

      if (preferredSystemRoleId) {
        await client.query(
          `INSERT INTO user_roles (user_id, role_id)
           VALUES ($1, $2)
           ON CONFLICT (user_id, role_id) DO NOTHING`,
          [userId, preferredSystemRoleId],
        );
      }
      touched = true;
    }

    if (legacyRole !== preferredSystemRoleKey) {
      await client.query(
        `UPDATE users
         SET ruolo = $1
         WHERE id = $2
           AND studio_id = $3`,
        [preferredSystemRoleKey, userId, normalizedTenantId],
      );
      touched = true;
    }

    if (touched) {
      repairedUsers += 1;
    }
  }

  const snapshotAfter = await getTenantRbacConsistencySnapshot(normalizedTenantId, client);

  return {
    tenant,
    repair_summary: {
      ensured_system_roles_total: ensuredSystemRoles.length,
      removed_cross_tenant_role_assignments_total: Number(
        removedCrossTenantAssignmentsResult.rowCount || 0,
      ),
      repaired_users_total: repairedUsers,
    },
    before: snapshotBefore?.summary || null,
    after: snapshotAfter?.summary || null,
    inconsistent_users_after: snapshotAfter?.inconsistent_users || [],
  };
}

async function repairTenantRbacConsistency(tenantId) {
  const normalizedTenantId = parsePositiveInt(tenantId);
  if (!normalizedTenantId) {
    return null;
  }

  const tenant = await getTenantConfigById(normalizedTenantId);
  if (!tenant) {
    return null;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await repairTenantRbacConsistencyWithClient(client, normalizedTenantId, tenant);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function migrateTenantLegacyPractitionerRole(tenantId) {
  const normalizedTenantId = parsePositiveInt(tenantId);
  if (!normalizedTenantId) {
    return null;
  }

  const tenant = await getTenantConfigById(normalizedTenantId);
  if (!tenant) {
    return null;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await ensureDipendenteEnumValue(client);

    const snapshotBefore = await getTenantRbacConsistencySnapshot(normalizedTenantId, client);

    const settingsUpdateResult = await client.query(
      `UPDATE studi
       SET settings_json = jsonb_set(
         COALESCE(settings_json, '{}'::jsonb),
         '{roles}',
         to_jsonb($2::text[]),
         true
       )
       WHERE id = $1`,
      [normalizedTenantId, [...NEW_ACTIVITY_DEFAULT_SYSTEM_ROLES]],
    );

    const dentistRoleResult = await client.query(
      `SELECT id
       FROM roles
       WHERE studio_id = $1
         AND role_key = 'DENTISTA'
         AND is_system = TRUE
       LIMIT 1`,
      [normalizedTenantId],
    );

    const dipendenteRoleResult = await client.query(
      `SELECT id
       FROM roles
       WHERE studio_id = $1
         AND role_key = 'DIPENDENTE'
         AND is_system = TRUE
       LIMIT 1`,
      [normalizedTenantId],
    );

    const dentistRoleId = Number(dentistRoleResult.rows[0]?.id || 0) || null;
    const dipendenteRoleId = Number(dipendenteRoleResult.rows[0]?.id || 0) || null;

    let renamedLegacySystemRole = false;
    let mergedLegacySystemRole = false;
    let removedLegacySystemRolesTotal = 0;

    if (dentistRoleId && !dipendenteRoleId) {
      await client.query(
        `UPDATE roles
         SET role_key = 'DIPENDENTE',
             display_name = 'Staff',
             updated_at = NOW()
         WHERE id = $1`,
        [dentistRoleId],
      );
      renamedLegacySystemRole = true;
    } else if (dentistRoleId && dipendenteRoleId) {
      await client.query(
        `INSERT INTO user_roles (user_id, role_id)
         SELECT ur.user_id, $2
         FROM user_roles ur
         WHERE ur.role_id = $1
         ON CONFLICT (user_id, role_id) DO NOTHING`,
        [dentistRoleId, dipendenteRoleId],
      );
      await client.query(`DELETE FROM user_roles WHERE role_id = $1`, [dentistRoleId]);
      await client.query(`DELETE FROM role_permissions WHERE role_id = $1`, [dentistRoleId]);
      const deleteLegacyRoleResult = await client.query(`DELETE FROM roles WHERE id = $1`, [dentistRoleId]);
      removedLegacySystemRolesTotal = Number(deleteLegacyRoleResult.rowCount || 0);
      mergedLegacySystemRole = true;
    }

    const updatedUsersResult = await client.query(
      `UPDATE users
       SET ruolo = 'DIPENDENTE'
       WHERE studio_id = $1
         AND ruolo = 'DENTISTA'`,
      [normalizedTenantId],
    );

    const repairResult = await repairTenantRbacConsistencyWithClient(client, normalizedTenantId, tenant);
    await client.query("COMMIT");

    return {
      tenant,
      migration_summary: {
        updated_settings_roles_total: Number(settingsUpdateResult.rowCount || 0),
        updated_users_total: Number(updatedUsersResult.rowCount || 0),
        renamed_legacy_system_role: renamedLegacySystemRole,
        merged_legacy_system_role: mergedLegacySystemRole,
        removed_legacy_system_roles_total: removedLegacySystemRolesTotal,
      },
      before: snapshotBefore?.summary || null,
      after: repairResult.after || null,
      inconsistent_users_after: repairResult.inconsistent_users_after || [],
      repair_summary: repairResult.repair_summary || null,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  ensureSystemRolesForTenant,
  getPlatformRbacHealthSnapshot,
  getTenantRbacConsistencySnapshot,
  migrateTenantLegacyPractitionerRole,
  repairTenantRbacConsistency,
};
