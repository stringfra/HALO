const bcrypt = require("bcrypt");
const crypto = require("crypto");
const { pool } = require("../src/config/db");
const { hasOnlyKeys, isValidEmail, normalizeRequiredText } = require("../src/validation/input");
const { getUserPermissions } = require("../src/services/permissions.service");
const {
  buildTenantUserAuthContext,
  issueAccessTokenForContext,
} = require("../src/services/auth-context.service");

const loginKeys = ["email", "password"];
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

async function login(req, res) {
  if (!hasOnlyKeys(req.body, loginKeys)) {
    return res.status(400).json({
      message: "Payload non valido.",
    });
  }

  const email = normalizeRequiredText(req.body?.email, { min: 6, max: 255 });
  const password = normalizeRequiredText(req.body?.password, { min: 8, max: 255 });

  if (!email || !isValidEmail(email) || !password) {
    return res.status(400).json({
      message: "Email o password non validi.",
    });
  }

  try {
    await ensureRefreshTokensTable();

    const result = await pool.query(
      `SELECT id, email, password_hash, ruolo, studio_id
       FROM users
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [email],
    );

    if (result.rowCount === 0) {
      return res.status(401).json({
        message: "Credenziali non valide.",
      });
    }

    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
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

    return res.status(200).json({
      token: accessToken,
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: "Bearer",
      expires_in: expiresIn,
    });
  } catch (error) {
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
              rt.replaced_by_token_id,
              u.ruolo,
              u.studio_id
       FROM refresh_tokens rt
       INNER JOIN users u ON u.id = rt.user_id
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

    const next = await createRefreshTokenRecord(client, current.user_id, req);
    await client.query(
      `UPDATE refresh_tokens
       SET revoked_at = NOW(),
           replaced_by_token_id = $2
       WHERE id = $1`,
      [current.id, next.id],
    );

    const { token: accessToken, expiresIn } = await issueAccessToken(
      { id: current.user_id, ruolo: current.ruolo, studio_id: current.studio_id },
      jwtSecret,
    );

    await client.query("COMMIT");
    return res.status(200).json({
      access_token: accessToken,
      refresh_token: next.refreshToken,
      token_type: "Bearer",
      expires_in: expiresIn,
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
    await pool.query(
      `UPDATE refresh_tokens
       SET revoked_at = COALESCE(revoked_at, NOW())
       WHERE token_hash = $1`,
      [tokenHash],
    );

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

module.exports = {
  login,
  refreshSession,
  logout,
};
