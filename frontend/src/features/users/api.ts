import { apiFetch, parseJsonResponse } from "@/lib/api-client";

type UserApiRecord = {
  id?: number;
  user_id?: number;
  nome?: string;
  display_name?: string;
  email?: string;
  ruolo?: "ADMIN" | "DENTISTA" | "DIPENDENTE" | "SEGRETARIO";
  role_key?: "ADMIN" | "DENTISTA" | "DIPENDENTE" | "SEGRETARIO";
  role_alias?: string;
  created_at?: string;
};

export type UserListItem = {
  id: number;
  user_id: number;
  nome: string;
  display_name: string;
  email: string;
  ruolo: "ADMIN" | "DENTISTA" | "DIPENDENTE" | "SEGRETARIO";
  role_key: "ADMIN" | "DENTISTA" | "DIPENDENTE" | "SEGRETARIO";
  role_alias?: string;
  created_at: string;
};

export type CreateUserPayload = {
  nome: string;
  email: string;
  password: string;
  ruolo: "ADMIN" | "DENTISTA" | "DIPENDENTE" | "SEGRETARIO";
};

export type UpdateUserPayload = {
  nome?: string;
  email?: string;
  password?: string;
  ruolo?: "ADMIN" | "DENTISTA" | "DIPENDENTE" | "SEGRETARIO";
};

function normalizeUser(record: UserApiRecord): UserListItem {
  const id = Number(record.user_id ?? record.id ?? 0);
  const ruolo = record.role_key ?? record.ruolo ?? "DIPENDENTE";
  const nome = record.display_name ?? record.nome ?? "";

  return {
    id,
    user_id: id,
    nome,
    display_name: nome,
    email: record.email ?? "",
    ruolo,
    role_key: ruolo,
    role_alias: record.role_alias,
    created_at: record.created_at ?? "",
  };
}

function toUserPayload(payload: CreateUserPayload | UpdateUserPayload) {
  return {
    display_name: payload.nome,
    email: payload.email,
    password: payload.password,
    role_key: payload.ruolo,
  };
}

function usersEndpoint() {
  const rawBase =
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ??
    "http://localhost:4000/api";

  if (rawBase.endsWith("/api")) {
    return `${rawBase}/v2/users`;
  }

  return `${rawBase}/api/v2/users`;
}

export async function listUsers() {
  const response = await apiFetch(usersEndpoint(), {
    method: "GET",
    cache: "no-store",
  });

  const data = await parseJsonResponse<UserApiRecord[]>(response);
  return data.map(normalizeUser);
}

export async function listDentisti() {
  const users = await listUsers();
  return users.filter((user) => user.role_key === "DENTISTA" || user.role_key === "DIPENDENTE");
}

export async function createUser(payload: CreateUserPayload) {
  const response = await apiFetch(usersEndpoint(), {
    method: "POST",
    body: JSON.stringify(toUserPayload(payload)),
  });

  return normalizeUser(await parseJsonResponse<UserApiRecord>(response));
}

export async function updateUser(userId: number, payload: UpdateUserPayload) {
  const response = await apiFetch(`${usersEndpoint()}/${userId}`, {
    method: "PUT",
    body: JSON.stringify(toUserPayload(payload)),
  });

  return normalizeUser(await parseJsonResponse<UserApiRecord>(response));
}

export async function deleteUser(userId: number) {
  const response = await apiFetch(`${usersEndpoint()}/${userId}`, {
    method: "DELETE",
  });

  return parseJsonResponse<{ message: string; id: number; user_id: number }>(response);
}
