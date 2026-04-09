import { apiFetch, parseJsonResponse } from "@/lib/api-client";

type AppointmentApiRecord = {
  id?: number;
  appointment_id?: number;
  paziente_id?: number;
  client_id?: number;
  nome?: string | null;
  cognome?: string | null;
  data?: string;
  appointment_date?: string;
  ora?: string;
  appointment_time?: string;
  medico?: string;
  owner_display_name?: string | null;
  stato?: "in_attesa" | "confermato" | "completato" | "annullato";
  appointment_status?: "in_attesa" | "confermato" | "completato" | "annullato";
};

export type BackendAppointment = {
  id: number;
  appointment_id: number;
  paziente_id: number;
  client_id: number;
  nome: string | null;
  cognome: string | null;
  data: string;
  appointment_date: string;
  ora: string;
  appointment_time: string;
  medico: string;
  owner_display_name: string;
  stato: "in_attesa" | "confermato" | "completato" | "annullato";
  appointment_status: "in_attesa" | "confermato" | "completato" | "annullato";
};

export type AppointmentPayload = {
  paziente_id: number;
  data: string;
  ora: string;
  medico?: string;
  stato?: "in_attesa" | "confermato" | "completato" | "annullato";
};

export type AppointmentUpdatePayload = Partial<AppointmentPayload>;

function normalizeAppointment(record: AppointmentApiRecord): BackendAppointment {
  const id = Number(record.appointment_id ?? record.id ?? 0);
  const clientId = Number(record.client_id ?? record.paziente_id ?? 0);
  const data = record.appointment_date ?? record.data ?? "";
  const ora = record.appointment_time ?? record.ora ?? "";
  const medico = record.owner_display_name ?? record.medico ?? "";
  const stato = record.appointment_status ?? record.stato ?? "in_attesa";

  return {
    id,
    appointment_id: id,
    paziente_id: clientId,
    client_id: clientId,
    nome: record.nome ?? null,
    cognome: record.cognome ?? null,
    data,
    appointment_date: data,
    ora,
    appointment_time: ora,
    medico,
    owner_display_name: medico,
    stato,
    appointment_status: stato,
  };
}

function toAppointmentPayload(payload: AppointmentPayload | AppointmentUpdatePayload) {
  return {
    client_id: payload.paziente_id,
    appointment_date: payload.data,
    appointment_time: payload.ora,
    owner_display_name: payload.medico,
    appointment_status: payload.stato,
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

const appointmentsEndpoint = `${normalizeBaseUrl()}/api/v2/appointments`;

export async function listAppuntamenti() {
  const response = await apiFetch(appointmentsEndpoint, {
    method: "GET",
    cache: "no-store",
  });

  const data = await parseJsonResponse<AppointmentApiRecord[]>(response);
  return data.map(normalizeAppointment);
}

export async function createAppuntamento(payload: AppointmentPayload) {
  const response = await apiFetch(appointmentsEndpoint, {
    method: "POST",
    body: JSON.stringify(toAppointmentPayload(payload)),
  });

  return normalizeAppointment(await parseJsonResponse<AppointmentApiRecord>(response));
}

export async function updateAppuntamento(
  id: number,
  payload: AppointmentUpdatePayload,
) {
  const response = await apiFetch(`${appointmentsEndpoint}/${id}`, {
    method: "PUT",
    body: JSON.stringify(toAppointmentPayload(payload)),
  });

  return normalizeAppointment(await parseJsonResponse<AppointmentApiRecord>(response));
}

export async function deleteAppuntamento(id: number) {
  const response = await apiFetch(`${appointmentsEndpoint}/${id}`, {
    method: "DELETE",
  });

  return parseJsonResponse<{ message: string; id: number; appointment_id: number }>(response);
}
