"use client";

import { apiFetch, parseJsonResponse } from "@/lib/api-client";

type TenantFeatureOverride = {
  feature_key?: string;
  enabled?: boolean;
  config_json?: Record<string, unknown>;
};

type TenantFeaturesResponse = {
  feature_catalog?: string[];
  resolved_feature_flags?: Record<string, boolean>;
  overrides?: TenantFeatureOverride[];
};

type GoogleCalendarConnectionStatusApi = {
  id?: number;
  studio_id?: number;
  connected_by_user_id?: number | null;
  google_account_email?: string | null;
  calendar_id?: string | null;
  token_expires_at?: string | null;
  status?: "active" | "revoked" | "error";
  last_sync_at?: string | null;
  last_error?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type GoogleCalendarStatusApi = {
  connected?: boolean;
  connection?: GoogleCalendarConnectionStatusApi | null;
  config?: Record<string, unknown>;
};

type GoogleCalendarOAuthStartResponse = {
  auth_url?: string;
  state_expires_at?: string;
};

type GoogleCalendarListApiResponse = {
  total?: number;
  calendars?: Array<{
    id?: string;
    summary?: string;
    primary?: boolean;
    time_zone?: string | null;
    access_role?: string | null;
  }>;
};

type GoogleCalendarConfigResponseApi = {
  message?: string;
  connected?: boolean;
  connection?: GoogleCalendarConnectionStatusApi | null;
  config?: Record<string, unknown>;
};

type GoogleCalendarDisconnectResponseApi = {
  message?: string;
  disconnected?: boolean;
  revoke?: {
    refresh_token_revoked?: boolean;
    access_token_revoked?: boolean;
  };
};

type GoogleCalendarWorkerRunOnceResponseApi = {
  message?: string;
  summary?: {
    claimed?: number;
    done?: number;
    retry?: number;
    failed?: number;
    details?: Array<Record<string, unknown>>;
  };
};

type GoogleCalendarSyncMetricsApi = {
  studio_id?: number;
  generated_at?: string;
  window_hours?: number;
  queue?: {
    pending?: number;
    retry?: number;
    processing?: number;
    done?: number;
    failed?: number;
    total?: number;
    due_now?: number;
    oldest_pending_at?: string | null;
  };
  recent_window?: {
    pending?: number;
    retry?: number;
    processing?: number;
    done?: number;
    failed?: number;
    total_created?: number;
  };
  failures?: Array<{
    id?: number;
    appointment_id?: number;
    operation?: string;
    attempts?: number;
    last_error?: string | null;
    created_at?: string | null;
    processed_at?: string | null;
  }>;
  link_errors?: {
    total?: number;
    recent?: Array<{
      appointment_id?: number;
      google_event_id?: string | null;
      last_error?: string | null;
      updated_at?: string | null;
    }>;
  };
};

type GoogleCalendarFullResyncResponseApi = {
  message?: string;
  triggered?: boolean;
  reason?: string;
  total_candidates?: number;
  enqueued?: number;
  skipped?: number;
  failed?: number;
  failed_appointment_ids?: number[];
  params?: {
    include_past?: boolean;
    include_cancelled?: boolean;
    date_from?: string | null;
    date_to?: string | null;
    limit?: number;
  };
};

export type GoogleCalendarTenantFeature = {
  enabled: boolean;
  config: Record<string, unknown>;
};

export type GoogleCalendarStatus = {
  connected: boolean;
  connection: {
    id: number;
    studio_id: number;
    connected_by_user_id: number | null;
    google_account_email: string | null;
    calendar_id: string | null;
    token_expires_at: string | null;
    status: "active" | "revoked" | "error";
    last_sync_at: string | null;
    last_error: string | null;
    created_at: string | null;
    updated_at: string | null;
  } | null;
  config: Record<string, unknown>;
};

export type GoogleCalendarListItem = {
  id: string;
  summary: string;
  primary: boolean;
  time_zone: string | null;
  access_role: string | null;
};

export type GoogleCalendarSyncMetrics = {
  studio_id: number;
  generated_at: string;
  window_hours: number;
  queue: {
    pending: number;
    retry: number;
    processing: number;
    done: number;
    failed: number;
    total: number;
    due_now: number;
    oldest_pending_at: string | null;
  };
  recent_window: {
    pending: number;
    retry: number;
    processing: number;
    done: number;
    failed: number;
    total_created: number;
  };
  failures: Array<{
    id: number;
    appointment_id: number;
    operation: string;
    attempts: number;
    last_error: string | null;
    created_at: string | null;
    processed_at: string | null;
  }>;
  link_errors: {
    total: number;
    recent: Array<{
      appointment_id: number;
      google_event_id: string | null;
      last_error: string | null;
      updated_at: string | null;
    }>;
  };
};

export type GoogleCalendarFullResyncResponse = {
  message: string;
  triggered: boolean;
  reason: string;
  total_candidates: number;
  enqueued: number;
  skipped: number;
  failed: number;
  failed_appointment_ids: number[];
  params: {
    include_past: boolean;
    include_cancelled: boolean;
    date_from: string | null;
    date_to: string | null;
    limit: number;
  };
};

function normalizeApiBase() {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ??
    "http://localhost:4000/api"
  );
}

function normalizeBackendBase() {
  const apiBase = normalizeApiBase();
  if (apiBase.endsWith("/api")) {
    return apiBase.slice(0, -4);
  }
  return apiBase;
}

function tenantAdminFeaturesEndpoint() {
  return `${normalizeApiBase()}/admin/tenant-features`;
}

function googleCalendarEndpoint(path = "") {
  return `${normalizeBackendBase()}/api/v3/integrations/google-calendar${path}`;
}

function normalizeObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function normalizeGoogleCalendarStatus(data: GoogleCalendarStatusApi): GoogleCalendarStatus {
  const connection = data.connection
    ? {
        id: Number(data.connection.id ?? 0),
        studio_id: Number(data.connection.studio_id ?? 0),
        connected_by_user_id:
          data.connection.connected_by_user_id === null
            ? null
            : Number(data.connection.connected_by_user_id ?? 0),
        google_account_email: data.connection.google_account_email ?? null,
        calendar_id: data.connection.calendar_id ?? null,
        token_expires_at: data.connection.token_expires_at ?? null,
        status: (data.connection.status ?? "active") as "active" | "revoked" | "error",
        last_sync_at: data.connection.last_sync_at ?? null,
        last_error: data.connection.last_error ?? null,
        created_at: data.connection.created_at ?? null,
        updated_at: data.connection.updated_at ?? null,
      }
    : null;

  return {
    connected: Boolean(data.connected),
    connection,
    config: normalizeObject(data.config),
  };
}

export async function getGoogleCalendarTenantFeature(): Promise<GoogleCalendarTenantFeature> {
  const response = await apiFetch(tenantAdminFeaturesEndpoint(), {
    method: "GET",
    cache: "no-store",
  });

  const data = await parseJsonResponse<TenantFeaturesResponse>(response);
  const enabled = Boolean(data.resolved_feature_flags?.["calendar.google.enabled"]);
  const override =
    data.overrides?.find((item) => item.feature_key === "calendar.google.enabled") ?? null;
  const config = normalizeObject(override?.config_json);

  return {
    enabled,
    config,
  };
}

export async function setGoogleCalendarTenantFeature({
  enabled,
  config = {},
}: {
  enabled: boolean;
  config?: Record<string, unknown>;
}) {
  const response = await apiFetch(
    `${tenantAdminFeaturesEndpoint()}/calendar.google.enabled`,
    {
      method: "PUT",
      body: JSON.stringify({
        enabled,
        config,
      }),
    },
  );

  return parseJsonResponse<{
    message: string;
    feature: {
      feature_key: string;
      enabled: boolean;
      config_json: Record<string, unknown>;
    };
  }>(response);
}

export async function getGoogleCalendarStatus() {
  const response = await apiFetch(googleCalendarEndpoint("/status"), {
    method: "GET",
    cache: "no-store",
  });

  return normalizeGoogleCalendarStatus(
    await parseJsonResponse<GoogleCalendarStatusApi>(response),
  );
}

export async function startGoogleCalendarOAuth(redirectTo?: string) {
  const response = await apiFetch(googleCalendarEndpoint("/oauth/start"), {
    method: "POST",
    body: JSON.stringify(
      redirectTo
        ? {
            redirect_to: redirectTo,
          }
        : {},
    ),
  });

  const data = await parseJsonResponse<GoogleCalendarOAuthStartResponse>(response);
  return {
    auth_url: data.auth_url || "",
    state_expires_at: data.state_expires_at || "",
  };
}

export async function listGoogleCalendars() {
  const response = await apiFetch(googleCalendarEndpoint("/calendars"), {
    method: "GET",
    cache: "no-store",
  });

  const data = await parseJsonResponse<GoogleCalendarListApiResponse>(response);
  const calendars = Array.isArray(data.calendars) ? data.calendars : [];
  return calendars
    .map((calendar) => ({
      id: calendar.id ?? "",
      summary: calendar.summary ?? "",
      primary: Boolean(calendar.primary),
      time_zone: calendar.time_zone ?? null,
      access_role: calendar.access_role ?? null,
    }))
    .filter((calendar) => calendar.id.length > 0);
}

export async function saveGoogleCalendarConfig({
  calendarId,
  defaultDurationMinutes,
}: {
  calendarId?: string;
  defaultDurationMinutes?: number;
}) {
  const payload: Record<string, unknown> = {};
  if (typeof calendarId === "string") {
    payload.calendar_id = calendarId;
  }
  if (typeof defaultDurationMinutes === "number") {
    payload.default_duration_minutes = defaultDurationMinutes;
  }

  const response = await apiFetch(googleCalendarEndpoint("/config"), {
    method: "PUT",
    body: JSON.stringify(payload),
  });

  const data = await parseJsonResponse<GoogleCalendarConfigResponseApi>(response);
  return {
    message: data.message || "Configurazione aggiornata.",
    status: normalizeGoogleCalendarStatus({
      connected: data.connected,
      connection: data.connection,
      config: data.config,
    }),
  };
}

export async function disconnectGoogleCalendar() {
  const response = await apiFetch(googleCalendarEndpoint("/disconnect"), {
    method: "POST",
    body: JSON.stringify({}),
  });

  return parseJsonResponse<GoogleCalendarDisconnectResponseApi>(response);
}

export async function runGoogleCalendarWorkerOnce({
  batchSize,
  maxAttempts,
}: {
  batchSize?: number;
  maxAttempts?: number;
} = {}) {
  const payload: Record<string, unknown> = {};
  if (typeof batchSize === "number") {
    payload.batch_size = batchSize;
  }
  if (typeof maxAttempts === "number") {
    payload.max_attempts = maxAttempts;
  }

  const response = await apiFetch(googleCalendarEndpoint("/sync/worker/run-once"), {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const data = await parseJsonResponse<GoogleCalendarWorkerRunOnceResponseApi>(response);
  return {
    message: data.message || "Worker eseguito.",
    summary: {
      claimed: Number(data.summary?.claimed ?? 0),
      done: Number(data.summary?.done ?? 0),
      retry: Number(data.summary?.retry ?? 0),
      failed: Number(data.summary?.failed ?? 0),
      details: Array.isArray(data.summary?.details) ? data.summary?.details : [],
    },
  };
}

export async function getGoogleCalendarSyncMetrics({
  windowHours,
  failedLimit,
}: {
  windowHours?: number;
  failedLimit?: number;
} = {}): Promise<GoogleCalendarSyncMetrics> {
  const searchParams = new URLSearchParams();
  if (typeof windowHours === "number") {
    searchParams.set("window_hours", String(windowHours));
  }
  if (typeof failedLimit === "number") {
    searchParams.set("failed_limit", String(failedLimit));
  }

  const query = searchParams.toString();
  const response = await apiFetch(
    googleCalendarEndpoint(`/sync/metrics${query ? `?${query}` : ""}`),
    {
      method: "GET",
      cache: "no-store",
    },
  );
  const data = await parseJsonResponse<GoogleCalendarSyncMetricsApi>(response);

  return {
    studio_id: Number(data.studio_id ?? 0),
    generated_at: data.generated_at ?? "",
    window_hours: Number(data.window_hours ?? 24),
    queue: {
      pending: Number(data.queue?.pending ?? 0),
      retry: Number(data.queue?.retry ?? 0),
      processing: Number(data.queue?.processing ?? 0),
      done: Number(data.queue?.done ?? 0),
      failed: Number(data.queue?.failed ?? 0),
      total: Number(data.queue?.total ?? 0),
      due_now: Number(data.queue?.due_now ?? 0),
      oldest_pending_at: data.queue?.oldest_pending_at ?? null,
    },
    recent_window: {
      pending: Number(data.recent_window?.pending ?? 0),
      retry: Number(data.recent_window?.retry ?? 0),
      processing: Number(data.recent_window?.processing ?? 0),
      done: Number(data.recent_window?.done ?? 0),
      failed: Number(data.recent_window?.failed ?? 0),
      total_created: Number(data.recent_window?.total_created ?? 0),
    },
    failures: Array.isArray(data.failures)
      ? data.failures.map((item) => ({
          id: Number(item.id ?? 0),
          appointment_id: Number(item.appointment_id ?? 0),
          operation: String(item.operation ?? ""),
          attempts: Number(item.attempts ?? 0),
          last_error: item.last_error ?? null,
          created_at: item.created_at ?? null,
          processed_at: item.processed_at ?? null,
        }))
      : [],
    link_errors: {
      total: Number(data.link_errors?.total ?? 0),
      recent: Array.isArray(data.link_errors?.recent)
        ? data.link_errors.recent.map((item) => ({
            appointment_id: Number(item.appointment_id ?? 0),
            google_event_id: item.google_event_id ?? null,
            last_error: item.last_error ?? null,
            updated_at: item.updated_at ?? null,
          }))
        : [],
    },
  };
}

export async function runGoogleCalendarFullResync({
  includePast,
  includeCancelled,
  dateFrom,
  dateTo,
  limit,
}: {
  includePast?: boolean;
  includeCancelled?: boolean;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
} = {}): Promise<GoogleCalendarFullResyncResponse> {
  const payload: Record<string, unknown> = {};
  if (typeof includePast === "boolean") {
    payload.include_past = includePast;
  }
  if (typeof includeCancelled === "boolean") {
    payload.include_cancelled = includeCancelled;
  }
  if (typeof dateFrom === "string" && dateFrom.trim().length > 0) {
    payload.date_from = dateFrom.trim();
  }
  if (typeof dateTo === "string" && dateTo.trim().length > 0) {
    payload.date_to = dateTo.trim();
  }
  if (typeof limit === "number") {
    payload.limit = limit;
  }

  const response = await apiFetch(googleCalendarEndpoint("/sync/full"), {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const data = await parseJsonResponse<GoogleCalendarFullResyncResponseApi>(response);

  return {
    message: data.message || "Full resync avviato.",
    triggered: Boolean(data.triggered),
    reason: data.reason || "",
    total_candidates: Number(data.total_candidates ?? 0),
    enqueued: Number(data.enqueued ?? 0),
    skipped: Number(data.skipped ?? 0),
    failed: Number(data.failed ?? 0),
    failed_appointment_ids: Array.isArray(data.failed_appointment_ids)
      ? data.failed_appointment_ids.map((id) => Number(id))
      : [],
    params: {
      include_past: Boolean(data.params?.include_past),
      include_cancelled: Boolean(data.params?.include_cancelled),
      date_from: data.params?.date_from ?? null,
      date_to: data.params?.date_to ?? null,
      limit: Number(data.params?.limit ?? 0),
    },
  };
}
