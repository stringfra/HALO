"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  disconnectGoogleCalendar,
  getGoogleCalendarSyncMetrics,
  getGoogleCalendarStatus,
  getGoogleCalendarTenantFeature,
  listGoogleCalendars,
  runGoogleCalendarFullResync,
  runGoogleCalendarWorkerOnce,
  saveGoogleCalendarConfig,
  setGoogleCalendarTenantFeature,
  startGoogleCalendarOAuth,
  type GoogleCalendarFullResyncResponse,
  type GoogleCalendarListItem,
  type GoogleCalendarSyncMetrics,
  type GoogleCalendarStatus,
} from "./api";

type GoogleCalendarSettingsPanelProps = {
  permissions: string[];
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "n/d";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function parseDuration(value: string) {
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 1440) {
    return null;
  }
  return parsed;
}

function parseResyncLimit(value: string) {
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 10000) {
    return null;
  }
  return parsed;
}

function isIsoDateString(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

export function GoogleCalendarSettingsPanel({
  permissions,
}: GoogleCalendarSettingsPanelProps) {
  const searchParams = useSearchParams();
  const justConnected = searchParams?.get("google_calendar") === "connected";
  const canReadGoogleCalendar =
    permissions.includes("calendar.google.read") || permissions.includes("calendar.google.manage");
  const canManageGoogleCalendar = permissions.includes("calendar.google.manage");
  const [loading, setLoading] = useState(true);
  const [featureEnabled, setFeatureEnabled] = useState(false);
  const [featureConfig, setFeatureConfig] = useState<Record<string, unknown>>({});
  const [status, setStatus] = useState<GoogleCalendarStatus | null>(null);
  const [calendars, setCalendars] = useState<GoogleCalendarListItem[]>([]);
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const [selectedCalendarId, setSelectedCalendarId] = useState("");
  const [durationInput, setDurationInput] = useState("30");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [workerSummary, setWorkerSummary] = useState<{
    claimed: number;
    done: number;
    retry: number;
    failed: number;
  } | null>(null);
  const [syncMetrics, setSyncMetrics] = useState<GoogleCalendarSyncMetrics | null>(null);
  const [fullResyncSummary, setFullResyncSummary] = useState<GoogleCalendarFullResyncResponse | null>(null);
  const [resyncIncludePast, setResyncIncludePast] = useState(false);
  const [resyncIncludeCancelled, setResyncIncludeCancelled] = useState(false);
  const [resyncDateFrom, setResyncDateFrom] = useState("");
  const [resyncDateTo, setResyncDateTo] = useState("");
  const [resyncLimitInput, setResyncLimitInput] = useState("1000");

  const resetMessages = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []);

  const loadGoogleCalendarState = useCallback(async () => {
    if (!canReadGoogleCalendar) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setWorkerSummary(null);
    setFullResyncSummary(null);
    try {
      const feature = await getGoogleCalendarTenantFeature();
      setFeatureEnabled(feature.enabled);
      setFeatureConfig(feature.config);

      const configuredDuration = parseDuration(
        String(feature.config.default_duration_minutes ?? "30"),
      );
      setDurationInput(String(configuredDuration ?? 30));

      if (feature.enabled) {
        const integrationStatus = await getGoogleCalendarStatus();
        const metrics = await getGoogleCalendarSyncMetrics();
        setStatus(integrationStatus);
        setSyncMetrics(metrics);
        if (integrationStatus.connection?.calendar_id) {
          setSelectedCalendarId(integrationStatus.connection.calendar_id);
        } else {
          setSelectedCalendarId("");
        }
      } else {
        setStatus(null);
        setSyncMetrics(null);
        setCalendars([]);
        setSelectedCalendarId("");
      }
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Errore caricando stato Google Calendar.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [canReadGoogleCalendar]);

  useEffect(() => {
    void loadGoogleCalendarState();
  }, [loadGoogleCalendarState]);

  useEffect(() => {
    if (justConnected) {
      setSuccess("Connessione Google completata con successo.");
    }
  }, [justConnected]);

  const workerSummaryLabel = useMemo(() => {
    if (!workerSummary) {
      return null;
    }
    return `Worker: claimed=${workerSummary.claimed}, done=${workerSummary.done}, retry=${workerSummary.retry}, failed=${workerSummary.failed}`;
  }, [workerSummary]);

  async function handleToggleFeature(enabled: boolean) {
    if (!canManageGoogleCalendar) {
      return;
    }

    resetMessages();
    setBusyAction("toggle-feature");
    try {
      await setGoogleCalendarTenantFeature({
        enabled,
        config: featureConfig,
      });
      setSuccess(
        enabled
          ? "Feature Google Calendar abilitata per il tenant."
          : "Feature Google Calendar disattivata per il tenant.",
      );
      await loadGoogleCalendarState();
    } catch (actionError) {
      const message =
        actionError instanceof Error
          ? actionError.message
          : "Errore aggiornando feature Google Calendar.";
      setError(message);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleConnect() {
    if (!canManageGoogleCalendar || !featureEnabled) {
      return;
    }

    resetMessages();
    setBusyAction("oauth-start");
    try {
      const redirectTo =
        typeof window !== "undefined" ? `${window.location.origin}/impostazioni` : undefined;
      const response = await startGoogleCalendarOAuth(redirectTo);
      if (!response.auth_url) {
        throw new Error("URL OAuth Google non disponibile.");
      }
      window.location.assign(response.auth_url);
    } catch (actionError) {
      const message =
        actionError instanceof Error
          ? actionError.message
          : "Errore avviando connessione OAuth.";
      setError(message);
      setBusyAction(null);
    }
  }

  async function handleLoadCalendars() {
    if (!canReadGoogleCalendar || !featureEnabled || !status?.connected) {
      return;
    }

    resetMessages();
    setLoadingCalendars(true);
    try {
      const items = await listGoogleCalendars();
      setCalendars(items);
      setSuccess(`Calendari caricati: ${items.length}.`);
    } catch (actionError) {
      const message =
        actionError instanceof Error
          ? actionError.message
          : "Errore nel recupero calendari Google.";
      setError(message);
    } finally {
      setLoadingCalendars(false);
    }
  }

  async function handleSaveConfig() {
    if (!canManageGoogleCalendar || !featureEnabled || !status?.connected) {
      return;
    }

    const defaultDurationMinutes = parseDuration(durationInput);
    if (!defaultDurationMinutes) {
      setError("Durata default non valida (1-1440 minuti).");
      return;
    }

    if (!selectedCalendarId.trim()) {
      setError("Seleziona un calendario Google prima di salvare.");
      return;
    }

    resetMessages();
    setBusyAction("save-config");
    try {
      await saveGoogleCalendarConfig({
        calendarId: selectedCalendarId.trim(),
        defaultDurationMinutes,
      });

      await setGoogleCalendarTenantFeature({
        enabled: true,
        config: {
          ...featureConfig,
          default_duration_minutes: defaultDurationMinutes,
        },
      });

      setSuccess("Configurazione Google Calendar salvata.");
      await loadGoogleCalendarState();
    } catch (actionError) {
      const message =
        actionError instanceof Error
          ? actionError.message
          : "Errore salvando configurazione Google Calendar.";
      setError(message);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDisconnect() {
    if (!canManageGoogleCalendar || !featureEnabled) {
      return;
    }

    resetMessages();
    setBusyAction("disconnect");
    try {
      await disconnectGoogleCalendar();
      setSuccess("Connessione Google Calendar disconnessa.");
      setCalendars([]);
      setSelectedCalendarId("");
      await loadGoogleCalendarState();
    } catch (actionError) {
      const message =
        actionError instanceof Error
          ? actionError.message
          : "Errore disconnettendo Google Calendar.";
      setError(message);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRunWorkerOnce() {
    if (!canManageGoogleCalendar || !featureEnabled) {
      return;
    }

    resetMessages();
    setBusyAction("run-worker");
    try {
      const result = await runGoogleCalendarWorkerOnce();
      const metrics = await getGoogleCalendarSyncMetrics();
      setWorkerSummary({
        claimed: result.summary.claimed,
        done: result.summary.done,
        retry: result.summary.retry,
        failed: result.summary.failed,
      });
      setSyncMetrics(metrics);
      setSuccess(result.message);
    } catch (actionError) {
      const message =
        actionError instanceof Error
          ? actionError.message
          : "Errore eseguendo worker Google Calendar.";
      setError(message);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRefreshMetrics() {
    if (!canReadGoogleCalendar || !featureEnabled) {
      return;
    }

    resetMessages();
    setBusyAction("refresh-metrics");
    try {
      const metrics = await getGoogleCalendarSyncMetrics();
      setSyncMetrics(metrics);
      setSuccess("Metriche sync aggiornate.");
    } catch (actionError) {
      const message =
        actionError instanceof Error
          ? actionError.message
          : "Errore nel recupero metriche sync.";
      setError(message);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRunFullResync() {
    if (!canManageGoogleCalendar || !featureEnabled || !status?.connected) {
      return;
    }

    const dateFrom = resyncDateFrom.trim();
    const dateTo = resyncDateTo.trim();
    const limit = parseResyncLimit(resyncLimitInput);

    if (!limit) {
      setError("Limite full resync non valido (1-10000).");
      return;
    }
    if (dateFrom.length > 0 && !isIsoDateString(dateFrom)) {
      setError("date_from non valida (formato YYYY-MM-DD).");
      return;
    }
    if (dateTo.length > 0 && !isIsoDateString(dateTo)) {
      setError("date_to non valida (formato YYYY-MM-DD).");
      return;
    }

    resetMessages();
    setBusyAction("run-full-resync");
    try {
      const result = await runGoogleCalendarFullResync({
        includePast: resyncIncludePast,
        includeCancelled: resyncIncludeCancelled,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        limit,
      });
      setFullResyncSummary(result);
      setSuccess(
        `${result.message} Enqueued: ${result.enqueued}, skipped: ${result.skipped}, failed: ${result.failed}.`,
      );

      const metrics = await getGoogleCalendarSyncMetrics();
      setSyncMetrics(metrics);
    } catch (actionError) {
      const message =
        actionError instanceof Error
          ? actionError.message
          : "Errore avviando full resync.";
      setError(message);
    } finally {
      setBusyAction(null);
    }
  }

  if (!canReadGoogleCalendar) {
    return (
      <article className="halo-panel mt-5">
        <h3 className="text-sm font-semibold">Google Calendar</h3>
        <p className="mt-2 text-sm text-[var(--ui-muted)]">
          Permessi insufficienti per visualizzare lo stato integrazione Google Calendar.
        </p>
      </article>
    );
  }

  return (
    <article className="halo-panel mt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Integrazione Google Calendar</h3>
          <p className="mt-1 text-xs text-[var(--ui-muted)]">
            Gestione connessione OAuth, calendario target e worker di sincronizzazione.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadGoogleCalendarState()}
          className="halo-btn-secondary px-3 py-1.5 text-xs"
          disabled={loading}
        >
          {loading ? "Aggiornamento..." : "Aggiorna stato"}
        </button>
      </div>

      {error && <p className="halo-alert halo-alert-danger mt-3">{error}</p>}
      {success && <p className="halo-alert halo-alert-success mt-3">{success}</p>}
      {workerSummaryLabel && (
        <p className="halo-alert halo-alert-warning mt-3">{workerSummaryLabel}</p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[var(--radius-md)] border border-[var(--ui-border)] bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--ui-muted)]">
            Feature flag
          </p>
          <p className="mt-2 text-sm">
            Stato:{" "}
            <span className={featureEnabled ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>
              {featureEnabled ? "Abilitata" : "Disabilitata"}
            </span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="halo-btn-primary px-3 py-1.5 text-xs"
              disabled={!canManageGoogleCalendar || busyAction === "toggle-feature" || featureEnabled}
              onClick={() => void handleToggleFeature(true)}
            >
              Abilita feature
            </button>
            <button
              type="button"
              className="halo-btn-secondary px-3 py-1.5 text-xs"
              disabled={!canManageGoogleCalendar || busyAction === "toggle-feature" || !featureEnabled}
              onClick={() => void handleToggleFeature(false)}
            >
              Disabilita feature
            </button>
          </div>
        </div>

        <div className="rounded-[var(--radius-md)] border border-[var(--ui-border)] bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--ui-muted)]">
            Connessione
          </p>
          <p className="mt-2 text-sm">
            Stato:{" "}
            <span
              className={
                status?.connected
                  ? "font-semibold text-emerald-700"
                  : "font-semibold text-[var(--ui-muted)]"
              }
            >
              {status?.connected ? "Connesso" : "Non connesso"}
            </span>
          </p>
          <p className="mt-1 text-xs text-[var(--ui-muted)]">
            Account: {status?.connection?.google_account_email || "n/d"}
          </p>
          <p className="mt-1 text-xs text-[var(--ui-muted)]">
            Scadenza token: {formatDateTime(status?.connection?.token_expires_at || null)}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="halo-btn-primary px-3 py-1.5 text-xs"
              disabled={
                !canManageGoogleCalendar
                || !featureEnabled
                || busyAction === "oauth-start"
                || status?.connected
              }
              onClick={() => void handleConnect()}
            >
              Collega Google
            </button>
            <button
              type="button"
              className="halo-btn-danger px-3 py-1.5 text-xs"
              disabled={
                !canManageGoogleCalendar
                || !featureEnabled
                || busyAction === "disconnect"
                || !status?.connected
              }
              onClick={() => void handleDisconnect()}
            >
              Disconnetti
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--ui-border)] bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--ui-muted)]">
          Configurazione calendario
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Calendario Google target</span>
            <select
              className="halo-select"
              value={selectedCalendarId}
              onChange={(event) => setSelectedCalendarId(event.target.value)}
              disabled={!featureEnabled || !status?.connected}
            >
              <option value="">
                {calendars.length === 0
                  ? "Carica i calendari disponibili"
                  : "Seleziona un calendario"}
              </option>
              {calendars.map((calendar) => (
                <option key={calendar.id} value={calendar.id}>
                  {calendar.primary ? "★ " : ""}{calendar.summary}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium">Durata default appuntamento (minuti)</span>
            <input
              className="halo-input"
              value={durationInput}
              onChange={(event) => setDurationInput(event.target.value)}
              inputMode="numeric"
              placeholder="30"
              disabled={!featureEnabled}
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="halo-btn-secondary px-3 py-1.5 text-xs"
            disabled={!featureEnabled || !status?.connected || loadingCalendars}
            onClick={() => void handleLoadCalendars()}
          >
            {loadingCalendars ? "Caricamento calendari..." : "Carica calendari"}
          </button>
          <button
            type="button"
            className="halo-btn-primary px-3 py-1.5 text-xs"
            disabled={!featureEnabled || !status?.connected || busyAction === "save-config"}
            onClick={() => void handleSaveConfig()}
          >
            Salva configurazione
          </button>
        </div>

        <p className="mt-3 text-xs text-[var(--ui-muted)]">
          Calendario corrente: {status?.connection?.calendar_id || "non configurato"}
        </p>
        {status?.connection?.last_error ? (
          <p className="mt-1 text-xs text-rose-700">
            Ultimo errore sync: {status.connection.last_error}
          </p>
        ) : null}
      </div>

      <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--ui-border)] bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--ui-muted)]">
          Operazioni sync
        </p>
        <p className="mt-2 text-sm text-[var(--ui-muted)]">
          Esecuzione manuale del worker per processare subito la coda outbox.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="halo-btn-secondary px-3 py-1.5 text-xs"
            disabled={!featureEnabled || busyAction === "run-worker"}
            onClick={() => void handleRunWorkerOnce()}
          >
            {busyAction === "run-worker" ? "Worker in esecuzione..." : "Esegui worker una volta"}
          </button>
          <button
            type="button"
            className="halo-btn-secondary px-3 py-1.5 text-xs"
            disabled={!featureEnabled || busyAction === "refresh-metrics"}
            onClick={() => void handleRefreshMetrics()}
          >
            {busyAction === "refresh-metrics" ? "Aggiornamento metriche..." : "Aggiorna metriche"}
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--ui-border)] bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--ui-muted)]">
          Monitoraggio sync
        </p>
        <p className="mt-2 text-sm text-[var(--ui-muted)]">
          Snapshot coda outbox, errori recenti e stato link eventi Google.
        </p>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded border border-[var(--ui-border)] p-2">
            <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--ui-muted)]">In coda</p>
            <p className="mt-1 text-lg font-semibold">{syncMetrics?.queue.total ?? 0}</p>
          </div>
          <div className="rounded border border-[var(--ui-border)] p-2">
            <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--ui-muted)]">Pronte ora</p>
            <p className="mt-1 text-lg font-semibold">{syncMetrics?.queue.due_now ?? 0}</p>
          </div>
          <div className="rounded border border-[var(--ui-border)] p-2">
            <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--ui-muted)]">Fallite</p>
            <p className="mt-1 text-lg font-semibold text-rose-700">{syncMetrics?.queue.failed ?? 0}</p>
          </div>
          <div className="rounded border border-[var(--ui-border)] p-2">
            <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--ui-muted)]">Link in errore</p>
            <p className="mt-1 text-lg font-semibold text-amber-700">{syncMetrics?.link_errors.total ?? 0}</p>
          </div>
        </div>

        <p className="mt-3 text-xs text-[var(--ui-muted)]">
          Ultimo snapshot: {formatDateTime(syncMetrics?.generated_at || null)}. Pending piu vecchio:{" "}
          {formatDateTime(syncMetrics?.queue.oldest_pending_at || null)}.
        </p>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div className="rounded border border-[var(--ui-border)] p-2">
            <p className="text-xs font-semibold">Outbox fallite recenti</p>
            {syncMetrics?.failures?.length ? (
              <ul className="mt-2 space-y-1 text-xs text-[var(--ui-muted)]">
                {syncMetrics.failures.slice(0, 5).map((item) => (
                  <li key={item.id}>
                    #{item.id} app:{item.appointment_id} op:{item.operation} tentativi:{item.attempts}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-[var(--ui-muted)]">Nessun errore recente.</p>
            )}
          </div>
          <div className="rounded border border-[var(--ui-border)] p-2">
            <p className="text-xs font-semibold">Link eventi in errore</p>
            {syncMetrics?.link_errors?.recent?.length ? (
              <ul className="mt-2 space-y-1 text-xs text-[var(--ui-muted)]">
                {syncMetrics.link_errors.recent.slice(0, 5).map((item) => (
                  <li key={`${item.appointment_id}-${item.google_event_id || "na"}`}>
                    app:{item.appointment_id} event:{item.google_event_id || "n/d"}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-[var(--ui-muted)]">Nessun link in errore.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--ui-border)] bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--ui-muted)]">
          Full resync
        </p>
        <p className="mt-2 text-sm text-[var(--ui-muted)]">
          Accoda una risincronizzazione massiva degli appuntamenti verso Google Calendar.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Data da (YYYY-MM-DD)</span>
            <input
              className="halo-input"
              value={resyncDateFrom}
              onChange={(event) => setResyncDateFrom(event.target.value)}
              placeholder="2026-04-01"
              disabled={!featureEnabled || !status?.connected}
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Data a (YYYY-MM-DD)</span>
            <input
              className="halo-input"
              value={resyncDateTo}
              onChange={(event) => setResyncDateTo(event.target.value)}
              placeholder="2026-12-31"
              disabled={!featureEnabled || !status?.connected}
            />
          </label>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Limite max appuntamenti</span>
            <input
              className="halo-input"
              value={resyncLimitInput}
              onChange={(event) => setResyncLimitInput(event.target.value)}
              inputMode="numeric"
              placeholder="1000"
              disabled={!featureEnabled || !status?.connected}
            />
          </label>
          <label className="inline-flex items-center gap-2 text-xs text-[var(--ui-muted)]">
            <input
              type="checkbox"
              checked={resyncIncludePast}
              onChange={(event) => setResyncIncludePast(event.target.checked)}
              disabled={!featureEnabled || !status?.connected}
            />
            Includi appuntamenti passati
          </label>
          <label className="inline-flex items-center gap-2 text-xs text-[var(--ui-muted)]">
            <input
              type="checkbox"
              checked={resyncIncludeCancelled}
              onChange={(event) => setResyncIncludeCancelled(event.target.checked)}
              disabled={!featureEnabled || !status?.connected}
            />
            Includi annullati
          </label>
        </div>

        <div className="mt-3">
          <button
            type="button"
            className="halo-btn-danger px-3 py-1.5 text-xs"
            disabled={!featureEnabled || !status?.connected || busyAction === "run-full-resync"}
            onClick={() => void handleRunFullResync()}
          >
            {busyAction === "run-full-resync" ? "Full resync in esecuzione..." : "Avvia full resync"}
          </button>
        </div>

        {fullResyncSummary ? (
          <p className="mt-3 text-xs text-[var(--ui-muted)]">
            Ultimo full resync: candidati {fullResyncSummary.total_candidates}, enqueued{" "}
            {fullResyncSummary.enqueued}, skipped {fullResyncSummary.skipped}, failed{" "}
            {fullResyncSummary.failed}.
          </p>
        ) : null}
      </div>
    </article>
  );
}
