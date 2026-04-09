const jwt = require("jsonwebtoken");

const TENANT_IDENTITY_TYPE = "tenant_user";
const allowedRoles = new Set(["ADMIN", "DENTISTA", "SEGRETARIO", "DIPENDENTE"]);

function parsePositiveId(value) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

function normalizeRole(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function normalizePermissions(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry) => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .sort();
}

function buildTenantUserAuthContext(user, permissions = []) {
  const userId = parsePositiveId(user?.id);
  const studioId = parsePositiveId(user?.studio_id);
  const role = normalizeRole(user?.ruolo);

  if (!userId || !studioId || !allowedRoles.has(role)) {
    throw new Error("Contesto tenant non valido.");
  }

  return {
    identityType: TENANT_IDENTITY_TYPE,
    userId,
    studioId,
    role,
    permissions: normalizePermissions(permissions),
  };
}

function toJwtPayload(authContext) {
  if (authContext?.identityType === TENANT_IDENTITY_TYPE) {
    return {
      identity_type: TENANT_IDENTITY_TYPE,
      id: authContext.userId,
      ruolo: authContext.role,
      studio_id: authContext.studioId,
      permissions: normalizePermissions(authContext.permissions),
    };
  }

  throw new Error("Tipo identita non supportato.");
}

function issueAccessTokenForContext(authContext, jwtSecret, expiresIn) {
  const payload = toJwtPayload(authContext);
  const token = jwt.sign(payload, jwtSecret, { expiresIn });
  const decoded = jwt.decode(token);
  const tokenExpiresIn =
    typeof decoded?.exp === "number" && typeof decoded?.iat === "number"
      ? decoded.exp - decoded.iat
      : 900;

  return {
    token,
    expiresIn: tokenExpiresIn,
  };
}

function parseAuthContextFromPayload(payload) {
  const identityType =
    typeof payload?.identity_type === "string" ? payload.identity_type.trim().toLowerCase() : "";

  if (!identityType || identityType === TENANT_IDENTITY_TYPE) {
    const userId = parsePositiveId(payload?.id);
    const studioId = parsePositiveId(payload?.studio_id);
    const role = normalizeRole(payload?.ruolo);

    if (!userId || !studioId || !allowedRoles.has(role)) {
      return null;
    }

    return {
      identityType: TENANT_IDENTITY_TYPE,
      userId,
      studioId,
      role,
      permissions: normalizePermissions(payload?.permissions),
    };
  }

  return null;
}

function verifyJwtToken(token, jwtSecret) {
  const payload = jwt.verify(token, jwtSecret);
  const authContext = parseAuthContextFromPayload(payload);

  if (!authContext) {
    throw new Error("Token auth context non valido.");
  }

  return authContext;
}

module.exports = {
  TENANT_IDENTITY_TYPE,
  allowedRoles,
  parsePositiveId,
  buildTenantUserAuthContext,
  issueAccessTokenForContext,
  parseAuthContextFromPayload,
  verifyJwtToken,
};
