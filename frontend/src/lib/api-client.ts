import {
  clearStoredSession,
  getStoredRefreshToken,
  getStoredToken,
  storeSessionTokens,
} from "@/features/auth/session";

type UnauthorizedReason = "expired" | "invalid" | "unauthorized";
type RefreshResponse = {
  access_token?: string;
  refresh_token?: string;
  token?: string;
};

let refreshInFlight: Promise<boolean> | null = null;

function normalizeApiBase() {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ??
    "http://localhost:4000/api"
  );
}

const refreshEndpoint = `${normalizeApiBase()}/refresh`;

export function buildApiHeaders(headersInit?: HeadersInit, tokenOverride?: string | null) {
  const headers = new Headers(headersInit);

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const token = tokenOverride ?? getStoredToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return headers;
}

function deriveUnauthorizedReason(message: string): UnauthorizedReason {
  const normalizedMessage = message.toLowerCase();
  if (normalizedMessage.includes("scadut")) {
    return "expired";
  }
  if (normalizedMessage.includes("non valido") || normalizedMessage.includes("revocat")) {
    return "invalid";
  }
  return "unauthorized";
}

function redirectToLogin(reason: UnauthorizedReason) {
  clearStoredSession();

  if (typeof window !== "undefined" && window.location.pathname !== "/login") {
    window.location.assign(`/login?reason=${reason}`);
  }
}

function parseResponseUrl(input: RequestInfo | URL) {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
}

function isAuthEndpoint(url: string) {
  return (
    url.includes("/api/login") ||
    url.includes("/api/refresh") ||
    url.includes("/api/logout")
  );
}

async function attemptRefreshSession() {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) {
    return false;
  }

  try {
    const response = await fetch(refreshEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      return false;
    }

    const data = (await response.json()) as RefreshResponse;
    const accessToken =
      typeof data.access_token === "string" && data.access_token.length > 0
        ? data.access_token
        : typeof data.token === "string" && data.token.length > 0
          ? data.token
          : null;
    const nextRefreshToken =
      typeof data.refresh_token === "string" && data.refresh_token.length > 0
        ? data.refresh_token
        : refreshToken;

    if (!accessToken) {
      return false;
    }

    const session = storeSessionTokens(accessToken, nextRefreshToken);
    return Boolean(session);
  } catch {
    return false;
  }
}

async function refreshSessionWithLock() {
  if (!refreshInFlight) {
    refreshInFlight = attemptRefreshSession().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
  const url = parseResponseUrl(input);
  const requestInit: RequestInit = {
    ...init,
    headers: buildApiHeaders(init?.headers),
  };

  const response = await fetch(input, requestInit);
  if (response.status !== 401 || isAuthEndpoint(url)) {
    return response;
  }

  const refreshed = await refreshSessionWithLock();
  if (!refreshed) {
    return response;
  }

  const retried = await fetch(input, {
    ...init,
    headers: buildApiHeaders(init?.headers),
  });

  return retried;
}

export async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Errore HTTP ${response.status}`;

    try {
      const data = (await response.json()) as { message?: string };
      if (typeof data?.message === "string" && data.message.trim().length > 0) {
        message = data.message;
      }
    } catch {
      message = `Errore HTTP ${response.status}`;
    }

    if (response.status === 401) {
      redirectToLogin(deriveUnauthorizedReason(message));
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}
