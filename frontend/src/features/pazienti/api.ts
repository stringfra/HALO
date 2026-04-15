import { apiFetch, parseJsonResponse } from "@/lib/api-client";

type ClientApiRecord = {
  id?: number;
  client_id?: number;
  nome?: string | null;
  cognome?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  telefono?: string | null;
  phone?: string | null;
  email?: string | null;
  note?: string | null;
  notes?: string | null;
  medico_id?: number | null;
  owner_user_id?: number | null;
  medico_nome?: string | null;
  owner_display_name?: string | null;
  created_at?: string | null;
  createdAt?: string | null;
};

export type Paziente = {
  id: number;
  client_id: number;
  nome: string;
  cognome: string;
  first_name: string;
  last_name: string;
  telefono: string | null;
  phone: string | null;
  email: string | null;
  note: string | null;
  notes: string | null;
  medico_id: number | null;
  owner_user_id: number | null;
  medico_nome: string | null;
  owner_display_name: string | null;
  created_at: string | null;
  createdAt: string | null;
};

export type PazientePayload = {
  nome: string;
  cognome: string;
  medico_id: number;
  telefono?: string;
  email?: string;
  note?: string;
};

function normalizeClient(record: ClientApiRecord): Paziente {
  const id = Number(record.client_id ?? record.id ?? 0);
  const nome = record.first_name ?? record.nome ?? "";
  const cognome = record.last_name ?? record.cognome ?? "";
  const telefono = record.phone ?? record.telefono ?? null;
  const note = record.notes ?? record.note ?? null;
  const medicoId = record.owner_user_id ?? record.medico_id ?? null;
  const medicoNome = record.owner_display_name ?? record.medico_nome ?? null;
  const createdAt = record.createdAt ?? record.created_at ?? null;

  return {
    id,
    client_id: id,
    nome,
    cognome,
    first_name: nome,
    last_name: cognome,
    telefono,
    phone: telefono,
    email: record.email ?? null,
    note,
    notes: note,
    medico_id: medicoId,
    owner_user_id: medicoId,
    medico_nome: medicoNome,
    owner_display_name: medicoNome,
    created_at: createdAt,
    createdAt,
  };
}

function toClientPayload(payload: PazientePayload) {
  return {
    first_name: payload.nome,
    last_name: payload.cognome,
    owner_user_id: payload.medico_id,
    phone: payload.telefono,
    email: payload.email,
    notes: payload.note,
  };
}

function normalizeBaseUrl() {
  const rawBase =
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ??
    "http://localhost:4000/api";

  if (rawBase.endsWith("/api")) {
    return rawBase.slice(0, -4);
  }

  return rawBase;
}

const patientsEndpoint = `${normalizeBaseUrl()}/api/v2/clients`;

export async function listPazienti() {
  const response = await apiFetch(patientsEndpoint, {
    method: "GET",
    cache: "no-store",
  });

  const data = await parseJsonResponse<ClientApiRecord[]>(response);
  return data.map(normalizeClient);
}

export async function createPaziente(payload: PazientePayload) {
  const response = await apiFetch(patientsEndpoint, {
    method: "POST",
    body: JSON.stringify(toClientPayload(payload)),
  });

  return normalizeClient(await parseJsonResponse<ClientApiRecord>(response));
}

export async function updatePaziente(id: number, payload: PazientePayload) {
  const response = await apiFetch(`${patientsEndpoint}/${id}`, {
    method: "PUT",
    body: JSON.stringify(toClientPayload(payload)),
  });

  return normalizeClient(await parseJsonResponse<ClientApiRecord>(response));
}

export async function deletePaziente(id: number) {
  const response = await apiFetch(`${patientsEndpoint}/${id}`, {
    method: "DELETE",
  });

  return parseJsonResponse<{ message: string; id: number; client_id: number }>(response);
}
