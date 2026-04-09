const crypto = require("crypto");
const { pool } = require("../config/db");
const { parsePositiveInt } = require("../validation/input");

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const GOOGLE_CALENDAR_LIST_URL = "https://www.googleapis.com/calendar/v3/users/me/calendarList";

function createHttpError(statusCode, message, detail) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (detail) {
    error.detail = detail;
  }
  return error;
}

function normalizeEnvString(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function requireEnv(key) {
  const value = normalizeEnvString(process.env[key]);
  if (!value) {
    throw createHttpError(500, `Variabile ambiente mancante: ${key}.`);
  }
  return value;
}

function getOAuthScopes() {
  const configuredScopes = normalizeEnvString(process.env.GOOGLE_OAUTH_SCOPES);
  if (!configuredScopes) {
    return [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/calendar.readonly",
    ];
  }

  return configuredScopes
    .split(/\s+/)
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0);
}

function getStateTtlSeconds() {
  const parsed = parsePositiveInt(process.env.GOOGLE_OAUTH_STATE_TTL_SEC, { max: 3600 });
  return parsed || 600;
}

function encodeBase64Url(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(String(value), "utf8");
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(value) {
  const normalized = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? 0 : 4 - (normalized.length % 4);
  return Buffer.from(`${normalized}${"=".repeat(padding)}`, "base64").toString("utf8");
}

function getStateSecret() {
  return requireEnv("GOOGLE_OAUTH_STATE_SECRET");
}

function getTokenEncryptionKey() {
  const raw = requireEnv("GOOGLE_TOKEN_ENCRYPTION_KEY");
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw createHttpError(
      500,
      "GOOGLE_TOKEN_ENCRYPTION_KEY non valido: usa 64 caratteri esadecimali.",
    );
  }

  return Buffer.from(raw, "hex");
}

function signStatePayload(encodedPayload) {
  return crypto.createHmac("sha256", getStateSecret()).update(encodedPayload).digest("hex");
}

function buildOAuthState({
  studioId,
  userId,
  redirectTo = null,
}) {
  const normalizedStudioId = parsePositiveInt(studioId);
  const normalizedUserId = parsePositiveInt(userId);
  if (!normalizedStudioId || !normalizedUserId) {
    throw createHttpError(400, "Contesto OAuth non valido.");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const ttlSeconds = getStateTtlSeconds();
  const payload = {
    studio_id: normalizedStudioId,
    user_id: normalizedUserId,
    nonce: crypto.randomBytes(16).toString("hex"),
    iat: nowSeconds,
    exp: nowSeconds + ttlSeconds,
  };

  if (typeof redirectTo === "string" && redirectTo.trim().length > 0) {
    payload.redirect_to = redirectTo.trim();
  }

  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = signStatePayload(encodedPayload);
  return {
    state: `${encodedPayload}.${signature}`,
    expiresAt: new Date((nowSeconds + ttlSeconds) * 1000).toISOString(),
  };
}

function verifyOAuthState(stateRaw) {
  const state = typeof stateRaw === "string" ? stateRaw.trim() : "";
  const [encodedPayload, providedSignature] = state.split(".");

  if (!encodedPayload || !providedSignature) {
    throw createHttpError(400, "State OAuth non valido.");
  }

  const expectedSignature = signStatePayload(encodedPayload);
  const expectedBuffer = Buffer.from(expectedSignature, "hex");
  const providedBuffer = Buffer.from(providedSignature, "hex");
  if (
    expectedBuffer.length !== providedBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    throw createHttpError(400, "Firma state OAuth non valida.");
  }

  let payload = null;
  try {
    payload = JSON.parse(decodeBase64Url(encodedPayload));
  } catch {
    throw createHttpError(400, "Payload state OAuth non valido.");
  }

  const studioId = parsePositiveInt(payload?.studio_id);
  const userId = parsePositiveInt(payload?.user_id);
  const issuedAt = parsePositiveInt(payload?.iat);
  const expiresAt = parsePositiveInt(payload?.exp);
  const nonce = typeof payload?.nonce === "string" ? payload.nonce.trim() : "";
  const redirectTo =
    typeof payload?.redirect_to === "string" && payload.redirect_to.trim().length > 0
      ? payload.redirect_to.trim()
      : null;

  if (!studioId || !userId || !issuedAt || !expiresAt || nonce.length < 16) {
    throw createHttpError(400, "State OAuth incompleto.");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (expiresAt < nowSeconds) {
    throw createHttpError(400, "State OAuth scaduto.");
  }

  return {
    studioId,
    userId,
    issuedAt,
    expiresAt,
    nonce,
    redirectTo,
  };
}

function encryptGoogleToken(plainText) {
  if (typeof plainText !== "string" || plainText.length === 0) {
    throw createHttpError(500, "Token Google non valido da cifrare.");
  }

  const iv = crypto.randomBytes(12);
  const key = getTokenEncryptionKey();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `v1:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

function decryptGoogleToken(cipherText) {
  if (typeof cipherText !== "string" || cipherText.trim().length === 0) {
    throw createHttpError(500, "Token cifrato non valido.");
  }

  const [version, ivHex, tagHex, encryptedHex] = cipherText.split(":");
  if (version !== "v1" || !ivHex || !tagHex || !encryptedHex) {
    throw createHttpError(500, "Formato token cifrato non supportato.");
  }

  const key = getTokenEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(tagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return plain.toString("utf8");
}

function safeJsonParse(value) {
  if (typeof value !== "string") {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function decodeJwtPayload(token) {
  if (typeof token !== "string") {
    return null;
  }

  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }

  return safeJsonParse(decodeBase64Url(parts[1]));
}

async function exchangeGoogleAuthorizationCode(code) {
  const normalizedCode = typeof code === "string" ? code.trim() : "";
  if (!normalizedCode) {
    throw createHttpError(400, "Authorization code Google mancante.");
  }

  const clientId = requireEnv("GOOGLE_CLIENT_ID");
  const clientSecret = requireEnv("GOOGLE_CLIENT_SECRET");
  const redirectUri = requireEnv("GOOGLE_OAUTH_REDIRECT_URI");

  const body = new URLSearchParams({
    code: normalizedCode,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const text = await response.text();
  const parsed = safeJsonParse(text) || {};
  if (!response.ok) {
    throw createHttpError(
      400,
      "Exchange token Google fallito.",
      parsed?.error_description || parsed?.error || text || "unknown_error",
    );
  }

  const accessToken = typeof parsed?.access_token === "string" ? parsed.access_token : "";
  const refreshToken = typeof parsed?.refresh_token === "string" ? parsed.refresh_token : "";
  const expiresIn = parsePositiveInt(parsed?.expires_in, { max: 86400 }) || 3600;
  const idToken = typeof parsed?.id_token === "string" ? parsed.id_token : null;

  if (!accessToken) {
    throw createHttpError(500, "Risposta token Google incompleta: access_token mancante.");
  }

  return {
    accessToken,
    refreshToken: refreshToken || null,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
    idToken,
  };
}

async function fetchGoogleUserInfo(accessToken) {
  if (typeof accessToken !== "string" || accessToken.trim().length === 0) {
    return null;
  }

  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  const text = await response.text();
  const parsed = safeJsonParse(text);
  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const email =
    typeof parsed.email === "string" && parsed.email.trim().length > 0
      ? parsed.email.trim()
      : null;

  return {
    email,
  };
}

async function saveGoogleConnection({
  studioId,
  connectedByUserId,
  accessToken,
  refreshToken,
  expiresAt,
  accountEmail = null,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const previousActiveResult = await client.query(
      `SELECT id,
              calendar_id,
              refresh_token_encrypted
       FROM google_calendar_connections
       WHERE studio_id = $1
         AND status = 'active'
       ORDER BY id DESC
       LIMIT 1`,
      [studioId],
    );

    const previousActive = previousActiveResult.rows[0] || null;
    await client.query(
      `UPDATE google_calendar_connections
       SET status = 'revoked',
           updated_at = NOW()
       WHERE studio_id = $1
         AND status = 'active'`,
      [studioId],
    );

    let refreshTokenEncrypted = null;
    if (refreshToken) {
      refreshTokenEncrypted = encryptGoogleToken(refreshToken);
    } else if (previousActive?.refresh_token_encrypted) {
      refreshTokenEncrypted = previousActive.refresh_token_encrypted;
    }

    if (!refreshTokenEncrypted) {
      throw createHttpError(
        400,
        "Refresh token Google non disponibile. Ricollega l'account con consenso completo.",
      );
    }

    const insertResult = await client.query(
      `INSERT INTO google_calendar_connections (
         studio_id,
         connected_by_user_id,
         google_account_email,
         calendar_id,
         access_token_encrypted,
         refresh_token_encrypted,
         token_expires_at,
         status,
         last_sync_at,
         last_error,
         created_at,
         updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', NULL, NULL, NOW(), NOW())
       RETURNING id,
                 studio_id,
                 connected_by_user_id,
                 google_account_email,
                 calendar_id,
                 token_expires_at,
                 status,
                 last_sync_at,
                 last_error,
                 created_at,
                 updated_at`,
      [
        studioId,
        connectedByUserId,
        accountEmail,
        previousActive?.calendar_id || null,
        encryptGoogleToken(accessToken),
        refreshTokenEncrypted,
        expiresAt.toISOString(),
      ],
    );

    await client.query("COMMIT");
    return insertResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getActiveGoogleConnection(studioId) {
  const result = await pool.query(
    `SELECT id,
            studio_id,
            connected_by_user_id,
            google_account_email,
            calendar_id,
            access_token_encrypted,
            refresh_token_encrypted,
            token_expires_at,
            status,
            last_sync_at,
            last_error,
            created_at,
            updated_at
     FROM google_calendar_connections
     WHERE studio_id = $1
       AND status = 'active'
     ORDER BY id DESC
     LIMIT 1`,
    [studioId],
  );

  return result.rows[0] || null;
}

async function refreshGoogleAccessToken(connection) {
  if (!connection?.id) {
    throw createHttpError(404, "Connessione Google Calendar non trovata.");
  }

  const refreshToken = decryptGoogleToken(connection.refresh_token_encrypted);
  if (!refreshToken) {
    throw createHttpError(400, "Refresh token Google non disponibile.");
  }

  const body = new URLSearchParams({
    client_id: requireEnv("GOOGLE_CLIENT_ID"),
    client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const text = await response.text();
  const parsed = safeJsonParse(text) || {};
  if (!response.ok) {
    const errorDetail = parsed?.error_description || parsed?.error || "refresh_failed";

    await pool.query(
      `UPDATE google_calendar_connections
       SET status = 'error',
           last_error = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [connection.id, String(errorDetail)],
    );

    throw createHttpError(401, "Refresh token Google fallito.", errorDetail);
  }

  const accessToken = typeof parsed?.access_token === "string" ? parsed.access_token : "";
  const newRefreshToken =
    typeof parsed?.refresh_token === "string" ? parsed.refresh_token : null;
  const expiresIn = parsePositiveInt(parsed?.expires_in, { max: 86400 }) || 3600;

  if (!accessToken) {
    throw createHttpError(500, "Risposta refresh Google incompleta: access_token mancante.");
  }

  const nextExpiresAt = new Date(Date.now() + expiresIn * 1000);
  const encryptedAccessToken = encryptGoogleToken(accessToken);
  const encryptedRefreshToken = newRefreshToken
    ? encryptGoogleToken(newRefreshToken)
    : connection.refresh_token_encrypted;

  await pool.query(
    `UPDATE google_calendar_connections
     SET access_token_encrypted = $2,
         refresh_token_encrypted = $3,
         token_expires_at = $4,
         status = 'active',
         last_error = NULL,
         updated_at = NOW()
     WHERE id = $1`,
    [connection.id, encryptedAccessToken, encryptedRefreshToken, nextExpiresAt.toISOString()],
  );

  return {
    accessToken,
    expiresAt: nextExpiresAt,
  };
}

async function getUsableGoogleAccessToken(studioId) {
  const connection = await getActiveGoogleConnection(studioId);
  if (!connection) {
    throw createHttpError(404, "Nessuna connessione Google Calendar attiva.");
  }

  const expiryTime = new Date(connection.token_expires_at).getTime();
  const nowTime = Date.now();
  const isExpired = !Number.isFinite(expiryTime) || expiryTime <= nowTime + 60 * 1000;

  if (!isExpired) {
    return {
      connection,
      accessToken: decryptGoogleToken(connection.access_token_encrypted),
    };
  }

  const refreshed = await refreshGoogleAccessToken(connection);
  const refreshedConnection = await getActiveGoogleConnection(studioId);

  return {
    connection: refreshedConnection || connection,
    accessToken: refreshed.accessToken,
  };
}

async function listGoogleCalendars(studioId) {
  const usable = await getUsableGoogleAccessToken(studioId);
  const response = await fetch(GOOGLE_CALENDAR_LIST_URL, {
    headers: {
      Authorization: `Bearer ${usable.accessToken}`,
    },
  });

  const text = await response.text();
  const parsed = safeJsonParse(text) || {};
  if (!response.ok) {
    throw createHttpError(
      response.status >= 400 && response.status < 600 ? response.status : 502,
      "Errore recuperando calendari Google.",
      parsed?.error?.message || text || "calendar_list_failed",
    );
  }

  const items = Array.isArray(parsed?.items) ? parsed.items : [];
  return items.map((entry) => ({
    id: typeof entry?.id === "string" ? entry.id : "",
    summary: typeof entry?.summary === "string" ? entry.summary : "",
    primary: Boolean(entry?.primary),
    time_zone: typeof entry?.timeZone === "string" ? entry.timeZone : null,
    access_role: typeof entry?.accessRole === "string" ? entry.accessRole : null,
  }));
}

async function revokeGoogleToken(token) {
  if (typeof token !== "string" || token.trim().length === 0) {
    return false;
  }

  const body = new URLSearchParams({
    token: token.trim(),
  });

  try {
    const response = await fetch(GOOGLE_REVOKE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    return response.ok;
  } catch {
    return false;
  }
}

function buildGoogleOAuthUrl({ studioId, userId, redirectTo = null }) {
  const clientId = requireEnv("GOOGLE_CLIENT_ID");
  const redirectUri = requireEnv("GOOGLE_OAUTH_REDIRECT_URI");
  const oauthState = buildOAuthState({
    studioId,
    userId,
    redirectTo,
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    scope: getOAuthScopes().join(" "),
    state: oauthState.state,
  });

  return {
    authUrl: `${GOOGLE_AUTH_URL}?${params.toString()}`,
    state: oauthState.state,
    stateExpiresAt: oauthState.expiresAt,
  };
}

async function processOAuthCallback({ code, state }) {
  const verifiedState = verifyOAuthState(state);
  const tokenBundle = await exchangeGoogleAuthorizationCode(code);

  let accountEmail = null;
  const userInfo = await fetchGoogleUserInfo(tokenBundle.accessToken);
  if (userInfo?.email) {
    accountEmail = userInfo.email;
  } else {
    const jwtPayload = decodeJwtPayload(tokenBundle.idToken);
    if (typeof jwtPayload?.email === "string" && jwtPayload.email.trim().length > 0) {
      accountEmail = jwtPayload.email.trim();
    }
  }

  const connection = await saveGoogleConnection({
    studioId: verifiedState.studioId,
    connectedByUserId: verifiedState.userId,
    accessToken: tokenBundle.accessToken,
    refreshToken: tokenBundle.refreshToken,
    expiresAt: tokenBundle.expiresAt,
    accountEmail,
  });

  return {
    state: verifiedState,
    connection,
  };
}

module.exports = {
  buildGoogleOAuthUrl,
  createHttpError,
  decryptGoogleToken,
  encryptGoogleToken,
  getActiveGoogleConnection,
  getUsableGoogleAccessToken,
  listGoogleCalendars,
  processOAuthCallback,
  revokeGoogleToken,
  verifyOAuthState,
};
