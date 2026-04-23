const { pool } = require("../config/db");
const { normalizeEmailIdentity } = require("../validation/input");

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

function normalizeTenantCode(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function toTenantScopedUser(row) {
  if (!row) {
    return null;
  }

  const userId = parsePositiveInt(row.id);
  const studioId = parsePositiveInt(row.studio_id);
  if (!userId || !studioId) {
    return null;
  }

  return {
    id: userId,
    email: normalizeEmailIdentity(row.email) || row.email,
    password_hash: row.password_hash,
    ruolo: row.ruolo,
    account_status: typeof row.account_status === "string" ? row.account_status : "active",
    studio_id: studioId,
    tenant_code: normalizeTenantCode(row.tenant_code),
    tenant_name: typeof row.tenant_name === "string" ? row.tenant_name : null,
    vertical_key: typeof row.vertical_key === "string" ? row.vertical_key : null,
  };
}

async function resolveActiveTenantUserByEmail(email, client = pool) {
  const normalizedEmail = normalizeEmailIdentity(email);
  if (!normalizedEmail) {
    return null;
  }

  const result = await client.query(
    `SELECT u.id,
            u.email,
            u.password_hash,
            u.ruolo,
            u.account_status,
            u.studio_id,
            s.codice AS tenant_code,
            s.nome AS tenant_name,
            s.vertical_key
     FROM users u
     INNER JOIN studi s
       ON s.id = u.studio_id
      AND s.is_active = TRUE
     WHERE LOWER(u.email) = LOWER($1)
       AND COALESCE(u.account_status, 'active') = 'active'
     LIMIT 1`,
    [normalizedEmail],
  );

  if (result.rowCount === 0) {
    return null;
  }

  return toTenantScopedUser(result.rows[0]);
}

async function resolveActiveTenantUserById(userId, client = pool) {
  const normalizedUserId = parsePositiveInt(userId);
  if (!normalizedUserId) {
    return null;
  }

  const result = await client.query(
    `SELECT u.id,
            u.email,
            u.password_hash,
            u.ruolo,
            u.account_status,
            u.studio_id,
            s.codice AS tenant_code,
            s.nome AS tenant_name,
            s.vertical_key
     FROM users u
     INNER JOIN studi s
       ON s.id = u.studio_id
      AND s.is_active = TRUE
     WHERE u.id = $1
       AND COALESCE(u.account_status, 'active') = 'active'
     LIMIT 1`,
    [normalizedUserId],
  );

  if (result.rowCount === 0) {
    return null;
  }

  return toTenantScopedUser(result.rows[0]);
}

module.exports = {
  resolveActiveTenantUserByEmail,
  resolveActiveTenantUserById,
  toTenantScopedUser,
};
