const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { pool } = require("../src/config/db");
const {
  hasOnlyKeys,
  isValidEmail,
  isStrongPassword,
  normalizeEmailIdentity,
  normalizeRequiredText,
} = require("../src/validation/input");
const { getUserPermissions } = require("../src/services/permissions.service");
const { createTenantUser } = require("../src/services/tenant-user-management.service");
const {
  listVerticalTemplates,
  resolveVerticalTemplateStrict,
} = require("../src/services/vertical-templates.service");
const { logAuthEvent } = require("../src/services/auth-events.service");
const {
  TENANT_IDENTITY_TYPE,
  buildTenantUserAuthContext,
  issueAccessTokenForContext,
} = require("../src/services/auth-context.service");
const {
  resolveActiveTenantUserByEmail,
  resolveActiveTenantUserById,
} = require("../src/services/tenant-auth-resolution.service");

const loginKeys = ["email", "password"];
const signupKeys = ["nome", "cognome", "email", "password", "tenant_name", "business_type", "vertical_key"];
const refreshKeys = ["refresh_token"];
const defaultAccessExpiration = "15m";
const defaultRefreshDays = 30;
let ensureRefreshTokensTablePromise = null;

async function ensureRefreshTokensTable() {
  if (!ensureRefreshTokensTablePromise) {
    ensureRefreshTokensTablePromise = (async () => {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS refresh_tokens (
          id BIGSERIAL PRIMARY KEY,
          user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash CHAR(64) NOT NULL UNIQUE,
          expires_at TIMESTAMPTZ NOT NULL,
          revoked_at TIMESTAMPTZ NULL,
          replaced_by_token_id BIGINT NULL REFERENCES refresh_tokens(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by_ip VARCHAR(64) NULL,
          user_agent VARCHAR(255) NULL
        )`,
      );

      await pool.query(
        `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id
         ON refresh_tokens (user_id)`,
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at
         ON refresh_tokens (expires_at)`,
      );
    })().catch((error) => {
      ensureRefreshTokensTablePromise = null;
      throw error;
    });
  }

  return ensureRefreshTokensTablePromise;
}

function getJwtSecret() {
  return process.env.JWT_SECRET || "";
}

function getAccessExpiration() {
  return process.env.JWT_ACCESS_EXPIRATION || process.env.JWT_EXPIRATION || defaultAccessExpiration;
}

function getRefreshExpirationDays() {
  const parsed = Number.parseInt(process.env.JWT_REFRESH_EXPIRATION_DAYS || "", 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 365) {
    return defaultRefreshDays;
  }

  return parsed;
}

async function issueAccessToken(user, jwtSecret) {
  const permissions = await getUserPermissions(user);
  const authContext = buildTenantUserAuthContext(user, permissions);
  return issueAccessTokenForContext(authContext, jwtSecret, getAccessExpiration());
}

function buildTenantPayload(user) {
  return {
    id: Number(user.studio_id),
    code: user.tenant_code || null,
    name: user.tenant_name || null,
    vertical_key: user.vertical_key || null,
  };
}

function hashRefreshToken(refreshToken) {
  return crypto.createHash("sha256").update(refreshToken).digest("hex");
}

function generateRefreshToken() {
  return crypto.randomBytes(64).toString("hex");
}

function normalizeIp(req) {
  const rawIp = req.ip || req.socket?.remoteAddress || "";
  const normalized = typeof rawIp === "string" ? rawIp.trim() : "";
  return normalized.length > 0 ? normalized.slice(0, 64) : null;
}

function normalizeUserAgent(req) {
  const raw = req.headers?.["user-agent"];
  if (typeof raw !== "string") {
    return null;
  }
  const normalized = raw.trim();
  return normalized.length > 0 ? normalized.slice(0, 255) : null;
}

function createRefreshExpiryDate() {
  const days = getRefreshExpirationDays();
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function createRefreshTokenRecord(client, userId, req) {
  const refreshToken = generateRefreshToken();
  const tokenHash = hashRefreshToken(refreshToken);
  const expiresAt = createRefreshExpiryDate();
  const createdByIp = normalizeIp(req);
  const userAgent = normalizeUserAgent(req);

  const result = await client.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_by_ip, user_agent)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, expires_at`,
    [userId, tokenHash, expiresAt, createdByIp, userAgent],
  );

  return {
    id: result.rows[0].id,
    refreshToken,
    expiresAt: result.rows[0].expires_at,
  };
}

function isExpired(expiresAt) {
  const expiresAtMs = new Date(expiresAt).getTime();
  return !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now();
}

async function safeLogAuthEvent(payload) {
  try {
    await logAuthEvent(payload);
  } catch {
    // Audit non bloccante: non deve interrompere il flusso auth.
  }
}

function normalizeBusinessTypeInput(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function buildTenantCodeSeed(tenantName) {
  const normalized = String(tenantName || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!normalized) {
    return "TENANT";
  }

  return normalized.slice(0, 24);
}

async function generateUniqueTenantCode(client, tenantName) {
  const seed = buildTenantCodeSeed(tenantName);

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
    const candidate = `${seed}_${suffix}`.slice(0, 50);
    const exists = await client.query(
      `SELECT 1
       FROM studi
       WHERE codice = $1
       LIMIT 1`,
      [candidate],
    );
    if (exists.rowCount === 0) {
      return candidate;
    }
  }

  throw new Error("Impossibile generare codice tenant univoco.");
}

async function signup(req, res) {
  if (!hasOnlyKeys(req.body, signupKeys)) {
    return res.status(400).json({
      message: "Payload non valido.",
    });
  }

  const firstName = normalizeRequiredText(req.body?.nome, { min: 2, max: 120 });
  const lastName = normalizeRequiredText(req.body?.cognome, { min: 2, max: 120 });
  const fullName = firstName && lastName ? `${firstName} ${lastName}` : null;
  const email = normalizeEmailIdentity(req.body?.email);
  const password = normalizeRequiredText(req.body?.password, { min: 8, max: 255 });
  const tenantName = normalizeRequiredText(req.body?.tenant_name, { min: 2, max: 120 });
  const businessType = normalizeBusinessTypeInput(req.body?.business_type ?? req.body?.vertical_key);

  if (!fullName || !email || !password || !tenantName || !businessType || !isStrongPassword(password)) {
    await safeLogAuthEvent({
      eventKey: "signup",
      outcome: "failure",
      email,
      metadata: {
        reason: "invalid_input",
      },
    });

    return res.status(400).json({
      message:
        "Campi signup non validi. Password richiesta: minimo 8, maiuscola, minuscola, numero e simbolo.",
    });
  }

  const verticalTemplate = await resolveVerticalTemplateStrict(businessType);
  if (!verticalTemplate) {
    await safeLogAuthEvent({
      eventKey: "signup",
      outcome: "failure",
      email,
      metadata: {
        reason: "business_type_not_supported",
        business_type: businessType,
      },
    });

    return res.status(400).json({
      message: "Tipologia attivita non supportata.",
    });
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return res.status(500).json({
      message: "Configurazione autenticazione non valida.",
    });
  }

  const saltRounds = Number.parseInt(process.env.SALT_ROUNDS || "10", 10);
  if (!Number.isInteger(saltRounds) || saltRounds < 4 || saltRounds > 15) {
    return res.status(500).json({
      message: "Configurazione SALT_ROUNDS non valida.",
    });
  }

  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await ensureRefreshTokensTable();
    await client.query("BEGIN");
    transactionStarted = true;

    const existingEmail = await client.query(
      `SELECT 1
       FROM users
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [email],
    );
    if (existingEmail.rowCount > 0) {
      await client.query("ROLLBACK");
      await safeLogAuthEvent({
        eventKey: "signup",
        outcome: "failure",
        email,
        metadata: {
          reason: "email_conflict",
        },
      });

      return res.status(409).json({
        message: "Email gia in uso.",
      });
    }

    const tenantCode = await generateUniqueTenantCode(client, tenantName);
    const tenantInsertResult = await client.query(
      `INSERT INTO studi (codice, nome, display_name, business_name, vertical_key, settings_json, settings_version, is_active)
       VALUES ($1, $2, $2, $2, $3, '{}'::jsonb, 1, TRUE)
       RETURNING id, codice, nome, vertical_key`,
      [tenantCode, tenantName, verticalTemplate.key],
    );

    const tenant = tenantInsertResult.rows[0];
    const passwordHash = await bcrypt.hash(password, saltRounds);
    const created = await createTenantUser(client, {
      studioId: Number(tenant.id),
      nome: fullName,
      email,
      passwordHash,
      ruolo: "ADMIN",
    });

    const user = await resolveActiveTenantUserById(created.userId, client);
    if (!user) {
      throw new Error("Impossibile risolvere utente owner tenant creato.");
    }

    const { token: accessToken, expiresIn } = await issueAccessToken(user, jwtSecret);
    const { refreshToken } = await createRefreshTokenRecord(client, user.id, req);

    await logAuthEvent({
      studioId: Number(tenant.id),
      userId: user.id,
      eventKey: "signup",
      outcome: "success",
      email,
      metadata: {
        business_type: verticalTemplate.key,
      },
      client,
    });

    await client.query("COMMIT");
    return res.status(201).json({
      token: accessToken,
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: "Bearer",
      identity_type: TENANT_IDENTITY_TYPE,
      expires_in: expiresIn,
      tenant: {
        id: Number(tenant.id),
        code: tenant.codice,
        name: tenant.nome,
        vertical_key: tenant.vertical_key,
      },
    });
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }
    await safeLogAuthEvent({
      eventKey: "signup",
      outcome: "failure",
      email,
      metadata: {
        reason: "unexpected_error",
      },
    });

    return res.status(500).json({
      message: "Errore durante il signup.",
      detail: error.message,
    });
  } finally {
    client.release();
  }
}

async function login(req, res) {
  if (!hasOnlyKeys(req.body, loginKeys)) {
    return res.status(400).json({
      message: "Payload non valido.",
    });
  }

  const email = normalizeEmailIdentity(req.body?.email);
  const password = normalizeRequiredText(req.body?.password, { min: 8, max: 255 });

  if (!email || !isValidEmail(email) || !password) {
    await safeLogAuthEvent({
      eventKey: "login",
      outcome: "failure",
      email,
      metadata: {
        reason: "invalid_input",
      },
    });

    return res.status(400).json({
      message: "Email o password non validi.",
    });
  }

  try {
    await ensureRefreshTokensTable();

    const user = await resolveActiveTenantUserByEmail(email);
    if (!user) {
      await safeLogAuthEvent({
        eventKey: "login",
        outcome: "failure",
        email,
        metadata: {
          reason: "invalid_credentials",
        },
      });
      return res.status(401).json({
        message: "Credenziali non valide.",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      await safeLogAuthEvent({
        eventKey: "login",
        outcome: "failure",
        email,
        metadata: {
          reason: "invalid_credentials",
        },
      });
      return res.status(401).json({
        message: "Credenziali non valide.",
      });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(500).json({
        message: "Configurazione autenticazione non valida.",
      });
    }

    const { token: accessToken, expiresIn } = await issueAccessToken(user, jwtSecret);
    const { refreshToken } = await createRefreshTokenRecord(pool, user.id, req);
    await safeLogAuthEvent({
      studioId: Number(user.studio_id),
      userId: Number(user.id),
      eventKey: "login",
      outcome: "success",
      email,
    });

    return res.status(200).json({
      token: accessToken,
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: "Bearer",
      identity_type: TENANT_IDENTITY_TYPE,
      expires_in: expiresIn,
      tenant: buildTenantPayload(user),
    });
  } catch (error) {
    await safeLogAuthEvent({
      eventKey: "login",
      outcome: "failure",
      email,
      metadata: {
        reason: "unexpected_error",
      },
    });
    return res.status(500).json({
      message: "Errore durante il login.",
      detail: error.message,
    });
  }
}

async function refreshSession(req, res) {
  if (!hasOnlyKeys(req.body, refreshKeys)) {
    return res.status(400).json({
      message: "Payload non valido.",
    });
  }

  const refreshToken = normalizeRequiredText(req.body?.refresh_token, { min: 32, max: 1024 });
  if (!refreshToken) {
    return res.status(400).json({
      message: "Refresh token non valido.",
    });
  }

  const jwtSecret = getJwtSecret();
  if (!jwtSecret) {
    return res.status(500).json({
      message: "Configurazione autenticazione non valida.",
    });
  }

  const tokenHash = hashRefreshToken(refreshToken);

  const client = await pool.connect();
  let transactionStarted = false;
  try {
    await ensureRefreshTokensTable();
    await client.query("BEGIN");
    transactionStarted = true;

    const tokenResult = await client.query(
      `SELECT rt.id,
              rt.user_id,
              rt.expires_at,
              rt.revoked_at,
              rt.replaced_by_token_id
       FROM refresh_tokens rt
       WHERE rt.token_hash = $1
       LIMIT 1
       FOR UPDATE`,
      [tokenHash],
    );

    if (tokenResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(401).json({
        message: "Refresh token non valido.",
      });
    }

    const current = tokenResult.rows[0];

    if (current.revoked_at) {
      if (current.replaced_by_token_id) {
        await client.query(
          `UPDATE refresh_tokens
           SET revoked_at = COALESCE(revoked_at, NOW())
           WHERE user_id = $1`,
          [current.user_id],
        );
      }

      await client.query("COMMIT");
      return res.status(401).json({
        message: "Refresh token revocato.",
      });
    }

    if (isExpired(current.expires_at)) {
      await client.query(
        `UPDATE refresh_tokens
         SET revoked_at = COALESCE(revoked_at, NOW())
         WHERE id = $1`,
        [current.id],
      );
      await client.query("COMMIT");

      return res.status(401).json({
        message: "Refresh token scaduto.",
      });
    }

    const tenantUser = await resolveActiveTenantUserById(current.user_id, client);
    if (!tenantUser) {
      await client.query(
        `UPDATE refresh_tokens
         SET revoked_at = COALESCE(revoked_at, NOW())
         WHERE id = $1`,
        [current.id],
      );
      await client.query("COMMIT");

      return res.status(401).json({
        message: "Sessione non valida per tenant non attivo.",
      });
    }

    const next = await createRefreshTokenRecord(client, current.user_id, req);
    await client.query(
      `UPDATE refresh_tokens
       SET revoked_at = NOW(),
           replaced_by_token_id = $2
       WHERE id = $1`,
      [current.id, next.id],
    );

    const { token: accessToken, expiresIn } = await issueAccessToken(
      tenantUser,
      jwtSecret,
    );

    await client.query("COMMIT");
    return res.status(200).json({
      access_token: accessToken,
      refresh_token: next.refreshToken,
      token_type: "Bearer",
      identity_type: TENANT_IDENTITY_TYPE,
      expires_in: expiresIn,
      tenant: buildTenantPayload(tenantUser),
    });
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK");
    }
    return res.status(500).json({
      message: "Errore durante il refresh sessione.",
      detail: error.message,
    });
  } finally {
    client.release();
  }
}

async function logout(req, res) {
  if (!hasOnlyKeys(req.body, refreshKeys)) {
    return res.status(400).json({
      message: "Payload non valido.",
    });
  }

  const refreshToken = normalizeRequiredText(req.body?.refresh_token, { min: 32, max: 1024 });
  if (!refreshToken) {
    return res.status(400).json({
      message: "Refresh token non valido.",
    });
  }

  try {
    await ensureRefreshTokensTable();

    const tokenHash = hashRefreshToken(refreshToken);
    const revokeResult = await pool.query(
      `UPDATE refresh_tokens
       SET revoked_at = COALESCE(revoked_at, NOW())
       WHERE token_hash = $1`,
      [tokenHash],
    );

    let auditStudioId = null;
    let auditUserId = null;
    let auditEmail = null;

    if (revokeResult.rowCount > 0) {
      const auditUserResult = await pool.query(
        `SELECT u.id, u.studio_id, u.email
         FROM refresh_tokens rt
         INNER JOIN users u
           ON u.id = rt.user_id
         WHERE rt.token_hash = $1
         LIMIT 1`,
        [tokenHash],
      );

      if (auditUserResult.rowCount > 0) {
        const row = auditUserResult.rows[0];
        auditStudioId = Number(row.studio_id) || null;
        auditUserId = Number(row.id) || null;
        auditEmail = typeof row.email === "string" ? row.email : null;
      }
    }

    await safeLogAuthEvent({
      studioId: auditStudioId,
      userId: auditUserId,
      eventKey: "logout",
      outcome: "success",
      email: auditEmail,
    });

    return res.status(200).json({
      message: "Logout completato.",
    });
  } catch (error) {
    return res.status(500).json({
      message: "Errore durante il logout.",
      detail: error.message,
    });
  }
}

async function listSignupBusinessTypes(_req, res) {
  try {
    const templates = await listVerticalTemplates();
    const businessTypes = templates
      .map((template) => ({
        key: template.key,
        name: template.name,
      }))
      .filter((entry) => typeof entry.key === "string" && entry.key.trim().length > 0)
      .sort((left, right) => String(left.name).localeCompare(String(right.name), "it"));

    return res.status(200).json({
      business_types: businessTypes,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Errore nel recupero tipologie attivita per signup.",
      detail: error.message,
    });
  }
}

module.exports = {
  signup,
  login,
  refreshSession,
  logout,
  listSignupBusinessTypes,
};
