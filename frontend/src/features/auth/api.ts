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

function normalizeApiBase() {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ??
    "http://localhost:4000/api"
  );
}

const loginEndpoint = `${normalizeApiBase()}/login`;
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
