"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  disconnectGoogleCalendar,
  getGoogleCalendarStatus,
  getGoogleCalendarTenantFeature,
  listGoogleCalendars,
  saveGoogleCalendarConfig,
  setGoogleCalendarTenantFeature,
  startGoogleCalendarOAuth,
  type GoogleCalendarListItem,
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
  const [selectedCalendarId, setSelectedCalendarId] = useState("");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadGoogleCalendarState = useCallback(async () => {
    if (!canReadGoogleCalendar) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const feature = await getGoogleCalendarTenantFeature();
      setFeatureEnabled(feature.enabled);
      setFeatureConfig(feature.config);

      if (!feature.enabled) {
        setStatus(null);
        setCalendars([]);
        setSelectedCalendarId("");
        return;
      }

      const integrationStatus = await getGoogleCalendarStatus();
      setStatus(integrationStatus);
      setSelectedCalendarId(integrationStatus.connection?.calendar_id || "");
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

  async function handleEnableFeature() {
    if (!canManageGoogleCalendar) {
      return;
    }

    setError(null);
    setSuccess(null);
    setBusyAction("enable-feature");

    try {
      await setGoogleCalendarTenantFeature({
        enabled: true,
        config: featureConfig,
      });
      setSuccess("Integrazione Google Calendar abilitata.");
      await loadGoogleCalendarState();
    } catch (actionError) {
      const message =
        actionError instanceof Error
          ? actionError.message
          : "Errore abilitando l'integrazione Google Calendar.";
      setError(message);
    } finally {
      setBusyAction(null);
    }
  }

  async function handleConnect() {
    if (!canManageGoogleCalendar || !featureEnabled) {
      return;
    }

    setError(null);
    setSuccess(null);
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

  async function handleDisconnect() {
    if (!canManageGoogleCalendar || !featureEnabled || !status?.connected) {
      return;
    }

    setError(null);
    setSuccess(null);
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

  async function handleLoadCalendars() {
    if (!canReadGoogleCalendar || !featureEnabled || !status?.connected) {
      return;
    }

    setError(null);
    setSuccess(null);
    setBusyAction("load-calendars");

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
      setBusyAction(null);
    }
  }

  async function handleSaveTargetCalendar() {
    if (!canManageGoogleCalendar || !featureEnabled || !status?.connected) {
      return;
    }

    const calendarId = selectedCalendarId.trim();
    if (!calendarId) {
      setError("Seleziona un calendario Google prima di salvare.");
      return;
    }

    setError(null);
    setSuccess(null);
    setBusyAction("save-config");

    try {
      await saveGoogleCalendarConfig({
        calendarId,
      });
      setSuccess("Calendario Google target salvato.");
      await loadGoogleCalendarState();
    } catch (actionError) {
      const message =
        actionError instanceof Error
          ? actionError.message
          : "Errore salvando il calendario target.";
      setError(message);
    } finally {
      setBusyAction(null);
    }
  }

  if (!canReadGoogleCalendar) {
    return (
      <article className="halo-panel">
        <h3 className="text-sm font-semibold">Google Calendar</h3>
        <p className="mt-2 text-sm text-[var(--ui-muted)]">
          Permessi insufficienti per visualizzare questa sezione.
        </p>
      </article>
    );
  }

  return (
    <article className="halo-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Google Calendar</h3>
          <p className="mt-1 text-xs text-[var(--ui-muted)]">
            Connessione account Google e selezione calendario target.
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

      {!featureEnabled ? (
        <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--ui-border)] bg-white p-3">
          <p className="text-sm text-[var(--ui-muted)]">
            L&apos;integrazione Google Calendar e disabilitata per questa azienda.
          </p>
          {canManageGoogleCalendar ? (
            <button
              type="button"
              className="halo-btn-primary mt-3 px-3 py-1.5 text-xs"
              disabled={busyAction === "enable-feature"}
              onClick={() => void handleEnableFeature()}
            >
              {busyAction === "enable-feature" ? "Abilitazione..." : "Abilita integrazione"}
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--ui-border)] bg-white p-3">
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
                  || busyAction === "disconnect"
                  || !status?.connected
                }
                onClick={() => void handleDisconnect()}
              >
                Disconnetti
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--ui-border)] bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--ui-muted)]">
              Calendario target
            </p>

            <label className="mt-3 grid gap-1 text-sm">
              <span className="font-medium">Calendario Google</span>
              <select
                className="halo-select"
                value={selectedCalendarId}
                onChange={(event) => setSelectedCalendarId(event.target.value)}
                disabled={!status?.connected}
              >
                <option value="">
                  {calendars.length === 0
                    ? "Carica i calendari disponibili"
                    : "Seleziona un calendario"}
                </option>
                {calendars.map((calendar) => (
                  <option key={calendar.id} value={calendar.id}>
                    {calendar.primary ? "★ " : ""}
                    {calendar.summary}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="halo-btn-secondary px-3 py-1.5 text-xs"
                disabled={!status?.connected || busyAction === "load-calendars"}
                onClick={() => void handleLoadCalendars()}
              >
                {busyAction === "load-calendars" ? "Caricamento..." : "Carica calendari"}
              </button>
              <button
                type="button"
                className="halo-btn-primary px-3 py-1.5 text-xs"
                disabled={!status?.connected || busyAction === "save-config"}
                onClick={() => void handleSaveTargetCalendar()}
              >
                {busyAction === "save-config" ? "Salvataggio..." : "Salva calendario target"}
              </button>
            </div>

            <p className="mt-3 text-xs text-[var(--ui-muted)]">
              Calendario corrente: {status?.connection?.calendar_id || "non configurato"}
            </p>
          </div>
        </>
      )}
    </article>
  );
}
