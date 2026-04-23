"use client";

import axios from "axios";
import {
  clearStoredSession,
  getStoredRefreshToken,
  storeSessionTokens,
  type AuthSession,
} from "./session";

type LoginResponse = {
  token?: string;
  access_token?: string;
  refresh_token?: string;
};

type SignupResponse = {
  token?: string;
  access_token?: string;
  refresh_token?: string;
};

type SignupBusinessTypesResponse = {
  business_types?: Array<{
    key?: string;
    name?: string;
  }>;
};

export type SignupBusinessType = {
  key: string;
  name: string;
};

export type SignupPayload = {
  nome: string;
  cognome: string;
  email: string;
  password: string;
  tenant_name: string;
  business_type: string;
};

function normalizeApiBase() {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ??
    "http://localhost:4000/api"
  );
}

const loginEndpoint = `${normalizeApiBase()}/login`;
const signupEndpoint = `${normalizeApiBase()}/signup`;
const signupBusinessTypesEndpoint = `${normalizeApiBase()}/signup/business-types`;
const logoutEndpoint = `${normalizeApiBase()}/logout`;

export async function loginWithPassword(email: string, password: string): Promise<AuthSession> {
  try {
    const response = await axios.post<LoginResponse>(
      loginEndpoint,
      { email, password },
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    const accessToken =
      typeof response.data?.access_token === "string" && response.data.access_token.length > 0
        ? response.data.access_token
        : response.data?.token;
    const refreshToken =
      typeof response.data?.refresh_token === "string" && response.data.refresh_token.length > 0
        ? response.data.refresh_token
        : null;

    if (typeof accessToken !== "string" || accessToken.length === 0) {
      throw new Error("Token di login non ricevuto.");
    }
    if (!refreshToken) {
      throw new Error("Refresh token di login non ricevuto.");
    }

    const session = storeSessionTokens(accessToken, refreshToken);
    if (!session) {
      throw new Error("Token di login non valido.");
    }

    return session;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const backendMessage =
        typeof error.response?.data?.message === "string"
          ? error.response.data.message
          : null;
      throw new Error(backendMessage || "Credenziali non valide.");
    }

    throw error;
  }
}

export async function listSignupBusinessTypes(): Promise<SignupBusinessType[]> {
  try {
    const response = await axios.get<SignupBusinessTypesResponse>(signupBusinessTypesEndpoint, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    const items = Array.isArray(response.data?.business_types) ? response.data.business_types : [];
    return items
      .map((entry) => ({
        key: typeof entry.key === "string" ? entry.key.trim() : "",
        name: typeof entry.name === "string" ? entry.name.trim() : "",
      }))
      .filter((entry) => entry.key.length > 0 && entry.name.length > 0);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const backendMessage =
        typeof error.response?.data?.message === "string"
          ? error.response.data.message
          : null;
      throw new Error(backendMessage || "Errore caricando le categorie disponibili.");
    }

    throw error;
  }
}

export async function signupTenantOwner(payload: SignupPayload): Promise<AuthSession> {
  try {
    const response = await axios.post<SignupResponse>(signupEndpoint, payload, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    const accessToken =
      typeof response.data?.access_token === "string" && response.data.access_token.length > 0
        ? response.data.access_token
        : response.data?.token;
    const refreshToken =
      typeof response.data?.refresh_token === "string" && response.data.refresh_token.length > 0
        ? response.data.refresh_token
        : null;

    if (typeof accessToken !== "string" || accessToken.length === 0) {
      throw new Error("Token signup non ricevuto.");
    }
    if (!refreshToken) {
      throw new Error("Refresh token signup non ricevuto.");
    }

    const session = storeSessionTokens(accessToken, refreshToken);
    if (!session) {
      throw new Error("Token signup non valido.");
    }

    return session;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const backendMessage =
        typeof error.response?.data?.message === "string"
          ? error.response.data.message
          : null;
      throw new Error(backendMessage || "Errore durante la registrazione.");
    }

    throw error;
  }
}

export async function logoutCurrentSession() {
  const refreshToken = getStoredRefreshToken();

  try {
    if (refreshToken) {
      await fetch(logoutEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    }
  } catch {
    // Logout API is best-effort, local cleanup must always happen.
  } finally {
    clearStoredSession();
  }
}
