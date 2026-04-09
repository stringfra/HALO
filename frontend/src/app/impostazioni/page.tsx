"use client";

import { useSyncExternalStore } from "react";
import { GoogleCalendarSettingsPanel } from "@/features/google-calendar/google-calendar-settings-panel";
import { UsersListPanel } from "@/features/users/users-list-panel";
import { getSessionSnapshot, subscribeToSession } from "@/features/auth/session";
import { useBootstrap } from "@/features/bootstrap/use-bootstrap";

export default function ImpostazioniPage() {
  const session = useSyncExternalStore(subscribeToSession, getSessionSnapshot, () => null);
  const { data: bootstrap } = useBootstrap();
  const studioValue = session?.studioId ? String(session.studioId) : "";
  const tenantLabel =
    bootstrap?.tenant?.display_name
    || (session?.studioId ? `Studio #${session.studioId}` : "Tenant non disponibile");
  const permissions = bootstrap?.current_user?.permissions || [];
  const roleLabel = session?.ruolo || "N/D";

  return (
    <section className="halo-page halo-reveal">
      <header className="border-b border-[var(--ui-border)] pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ui-muted)]">
          Impostazioni
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">Azienda e Google Calendar</h2>
        <p className="mt-2 max-w-[70ch] text-sm text-[var(--ui-muted)]">
          Configura connessione Google e calendario target per questa azienda.
        </p>
      </header>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <article className="rounded-[var(--radius-md)] border border-[var(--ui-border)] bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--ui-muted)]">
            Azienda
          </p>
          <p className="mt-2 text-sm font-semibold">{tenantLabel}</p>
          <p className="mt-1 text-xs text-[var(--ui-muted)]">
            ID: {studioValue || "n/d"}
          </p>
        </article>

        <article className="rounded-[var(--radius-md)] border border-[var(--ui-border)] bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--ui-muted)]">
            Sessione
          </p>
          <p className="mt-2 text-sm font-semibold">{roleLabel}</p>
          <p className="mt-1 text-xs text-[var(--ui-muted)]">
            Permessi caricati: {permissions.length}
          </p>
        </article>
      </div>

      <section id="google-calendar" className="mt-6">
        <GoogleCalendarSettingsPanel permissions={permissions} />
      </section>

      <section id="utenti-studio" className="mt-6">
        <UsersListPanel />
      </section>
    </section>
  );
}
