export type UserRole = "ADMIN" | "DENTISTA" | "DIPENDENTE" | "SEGRETARIO";

export type AuthSession = {
  token: string;
  userId: number;
  studioId: number;
  ruolo: UserRole;
  exp: number | null;
};

const AUTH_TOKEN_STORAGE_KEY = "halo_auth_token";
const REFRESH_TOKEN_STORAGE_KEY = "halo_refresh_token";
const AUTH_SESSION_EVENT = "halo-auth-session-changed";

const ALLOWED_ROLES = new Set<UserRole>(["ADMIN", "DENTISTA", "DIPENDENTE", "SEGRETARIO"]);
let cachedToken: string | null = null;
let cachedSession: AuthSession | null = null;

type JwtPayload = {
  id?: unknown;
  studio_id?: unknown;
  ruolo?: unknown;
  exp?: unknown;
};

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return atob(padded);
}

function parsePositiveId(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

function parseToken(token: string): AuthSession | null {
  try {
    const tokenParts = token.split(".");
    if (tokenParts.length !== 3) {
      return null;
    }

    const payloadJson = decodeBase64Url(tokenParts[1]);
    const payload = JSON.parse(payloadJson) as JwtPayload;

    const userId = parsePositiveId(payload.id);
    const studioId = parsePositiveId(payload.studio_id);
    const ruolo = typeof payload.ruolo === "string" ? payload.ruolo.toUpperCase() : "";
    const exp = typeof payload.exp === "number" ? payload.exp : null;

    if (!userId || !studioId || !ALLOWED_ROLES.has(ruolo as UserRole)) {
      return null;
    }

    if (exp !== null && exp * 1000 <= Date.now()) {
      return null;
    }

    return {
      token,
      userId,
      studioId,
      ruolo: ruolo as UserRole,
      exp,
    };
  } catch {
    return null;
  }
}

function notifySessionChange() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(AUTH_SESSION_EVENT));
}

function setSessionCache(token: string | null, session: AuthSession | null) {
  cachedToken = token;
  cachedSession = session;
}

function readSessionSnapshot() {
  if (typeof window === "undefined") {
    return null;
  }

  const token = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  if (!token) {
    setSessionCache(null, null);
    return null;
  }

  if (token === cachedToken) {
    if (cachedSession && cachedSession.exp !== null && cachedSession.exp * 1000 <= Date.now()) {
      setSessionCache(token, null);
      return null;
    }

    return cachedSession;
  }

  const session = parseToken(token);
  setSessionCache(token, session);
  return session;
}

export function clearStoredSession() {
  setSessionCache(null, null);

  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  notifySessionChange();
}

export function getStoredSession(): AuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const token = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  const session = readSessionSnapshot();
  if (token && !session) {
    clearStoredSession();
    return null;
  }

  return session;
}

export function getStoredToken() {
  return getStoredSession()?.token ?? null;
}

export function getStoredRefreshToken() {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  return value;
}

export function storeSessionToken(token: string) {
  return storeSessionTokens(token, getStoredRefreshToken());
}

export function storeSessionTokens(token: string, refreshToken: string | null) {
  const parsed = parseToken(token);
  if (!parsed || typeof window === "undefined") {
    clearStoredSession();
    return null;
  }

  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  if (typeof refreshToken === "string" && refreshToken.trim().length > 0) {
    window.localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
  } else {
    window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  }
  setSessionCache(token, parsed);
  notifySessionChange();
  return parsed;
}

export function getSessionSnapshot() {
  return readSessionSnapshot();
}

export function subscribeToSession(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const onSessionChanged = () => callback();
  window.addEventListener("storage", onSessionChanged);
  window.addEventListener(AUTH_SESSION_EVENT, onSessionChanged);

  return () => {
    window.removeEventListener("storage", onSessionChanged);
    window.removeEventListener(AUTH_SESSION_EVENT, onSessionChanged);
  };
}
