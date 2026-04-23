const { getUserPermissions } = require("../src/services/permissions.service");
const {
  TENANT_IDENTITY_TYPE,
  verifyJwtToken,
} = require("../src/services/auth-context.service");
const { resolveActiveTenantUserById } = require("../src/services/tenant-auth-resolution.service");

function logAuthDenied(req, reason, extra = {}) {
  const requestId = req.requestId || "n/a";
  const method = req.method || "UNKNOWN";
  const path = req.originalUrl || req.url || "unknown-path";
  const ip = req.ip || req.socket?.remoteAddress || "unknown-ip";
  const userId = req.user?.id ?? "anon";
  const studioId = req.user?.studio_id ?? "anon";
  const ruolo = req.user?.ruolo ? String(req.user.ruolo).toUpperCase() : "anon";

  const details = Object.entries(extra)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");

  const suffix = details ? ` ${details}` : "";
  console.warn(
    `[AUTH_DENY] requestId=${requestId} method=${method} path=${path} ip=${ip} userId=${userId} studioId=${studioId} ruolo=${ruolo} reason=${reason}${suffix}`,
  );
}

function extractBearerToken(authorizationHeader) {
  if (typeof authorizationHeader !== "string") {
    return null;
  }

  const [scheme, token] = authorizationHeader.trim().split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

async function verifyToken(req, res, next) {
  const token = extractBearerToken(req.headers?.authorization);
  if (!token) {
    logAuthDenied(req, "missing_or_invalid_authorization_header");
    return res.status(401).json({
      message: "Token mancante o formato Authorization non valido.",
    });
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    logAuthDenied(req, "jwt_secret_not_configured");
    return res.status(500).json({
      message: "Configurazione autenticazione non valida.",
    });
  }

  try {
    const authContext = verifyJwtToken(token, jwtSecret);

    if (authContext.identityType !== TENANT_IDENTITY_TYPE) {
      logAuthDenied(req, "token_payload_invalid_context", {
        identityType: authContext.identityType || "missing",
      });
      return res.status(401).json({
        message: "Token non valido. Effettua di nuovo il login.",
      });
    }

    const activeTenantUser = await resolveActiveTenantUserById(authContext.userId);
    if (!activeTenantUser) {
      logAuthDenied(req, "tenant_user_not_active_or_not_found", {
        authUserId: authContext.userId,
      });
      return res.status(401).json({
        message: "Sessione non valida per utente o tenant non attivo.",
      });
    }

    if (Number(activeTenantUser.studio_id) !== Number(authContext.studioId)) {
      logAuthDenied(req, "tenant_session_mismatch", {
        tokenStudioId: authContext.studioId,
        dbStudioId: activeTenantUser.studio_id,
      });
      return res.status(403).json({
        message: "Mismatch tenant/sessione. Effettua di nuovo il login.",
      });
    }

    req.auth = authContext;
    req.user = {
      id: activeTenantUser.id,
      studio_id: activeTenantUser.studio_id,
      ruolo: activeTenantUser.ruolo,
      tenant_code: activeTenantUser.tenant_code || authContext.tenantCode || null,
      permissions: authContext.permissions,
    };
    return next();
  } catch (error) {
    const tokenErrorName = error?.name || "unknown";
    const isExpiredToken = tokenErrorName === "TokenExpiredError";

    logAuthDenied(req, isExpiredToken ? "token_expired" : "token_invalid", {
      tokenError: error?.name || "unknown",
    });

    return res.status(401).json({
      message: isExpiredToken
        ? "Token scaduto. Effettua di nuovo il login."
        : "Token non valido. Effettua di nuovo il login.",
    });
  }
}

function authorize(roles = []) {
  const normalizedRoles = Array.isArray(roles)
    ? roles.map((role) => String(role).toUpperCase())
    : [];

  return (req, res, next) => {
    if (!req.user?.ruolo) {
      logAuthDenied(req, "missing_authenticated_user_on_authorize");
      return res.status(401).json({
        message: "Utente non autenticato.",
      });
    }

    const userRole = String(req.user.ruolo).toUpperCase();
    if (!normalizedRoles.includes(userRole)) {
      logAuthDenied(req, "role_not_authorized", {
        requiredRoles: normalizedRoles.join(","),
      });
      return res.status(403).json({
        message: "Accesso negato: ruolo non autorizzato.",
      });
    }

    return next();
  };
}

function requirePermission(permissionKey) {
  return async (req, res, next) => {
    if (!req.user?.ruolo) {
      logAuthDenied(req, "missing_authenticated_user_on_require_permission");
      return res.status(401).json({
        message: "Utente non autenticato.",
      });
    }

    try {
      const permissions = await getUserPermissions(req.user);
      req.user.permissions = permissions;

      if (!permissions.includes(permissionKey)) {
        logAuthDenied(req, "permission_not_authorized", {
          requiredPermission: permissionKey,
        });
        return res.status(403).json({
          message: "Accesso negato: permesso non autorizzato.",
        });
      }

      return next();
    } catch (error) {
      return res.status(500).json({
        message: "Errore nella verifica permessi utente.",
        detail: error.message,
      });
    }
  };
}

module.exports = {
  verifyToken,
  authorize,
  requirePermission,
};
