"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { UsersListPanel } from "@/features/users/users-list-panel";
import { GoogleCalendarSettingsPanel } from "@/features/google-calendar/google-calendar-settings-panel";
import { getSessionSnapshot, subscribeToSession } from "@/features/auth/session";
import { useBootstrap } from "@/features/bootstrap/use-bootstrap";

export default function ImpostazioniPage() {
  const session = useSyncExternalStore(subscribeToSession, getSessionSnapshot, () => null);
  const { data: bootstrap } = useBootstrap();
  const studioValue = session?.studioId ? String(session.studioId) : "";
  const tenantLabel = bootstrap?.tenant?.display_name || (session?.studioId ? `Studio #${session.studioId}` : "Tenant non disponibile");
  const inventoryPlural = bootstrap?.labels?.inventory_plural || "Magazzino";
  const permissions = bootstrap?.current_user?.permissions || [];

  return (
    <section className="halo-page halo-reveal">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ui-muted)]">
        Impostazioni Admin
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight">
        Controllo struttura tenant
      </h2>
      <p className="mt-2 max-w-[70ch] text-sm text-[var(--ui-muted)]">
        Area riservata ad amministrazione: configurazione utenti e monitoraggio
        risorse operative.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <article className="halo-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--ui-muted)]">
            Contesto tenant
          </p>
          <h3 className="mt-2 text-lg font-semibold">Tenant attivo</h3>
          <p className="mt-2 text-sm text-[var(--ui-muted)]">
            {`Sessione corrente associata a ${tenantLabel}. Il selettore multi-tenant e predisposto, ma al momento resta bloccato su un solo tenant.`}
          </p>
          <div className="mt-4 grid gap-2">
            <label htmlFor="studio-selector" className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ui-muted)]">
              Selezione tenant
            </label>
            <select
              id="studio-selector"
              value={studioValue}
              disabled
              className="halo-select disabled:cursor-not-allowed disabled:opacity-80"
            >
              <option value={studioValue}>{tenantLabel}</option>
            </select>
          </div>
        </article>

        <article className="halo-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--ui-muted)]">
            Operativita tenant
          </p>
          <h3 className="mt-2 text-lg font-semibold">{`${inventoryPlural} centralizzato`}</h3>
          <p className="mt-2 text-sm text-[var(--ui-muted)]">
            Accesso diretto a riordini, elementi sotto soglia e scorte critiche.
          </p>
          <div className="mt-4">
            <Link href="/magazzino" className="halo-btn-primary px-4 py-2 text-sm">
              {`Apri ${inventoryPlural.toLowerCase()}`}
            </Link>
          </div>
        </article>
      </div>

      <GoogleCalendarSettingsPanel permissions={permissions} />
      <UsersListPanel />
    </section>
  );
}
