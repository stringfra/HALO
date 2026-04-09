"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useBootstrap } from "@/features/bootstrap/use-bootstrap";
import {
  listFatture,
  markFatturaAsPaid,
  type FatturaListItem,
} from "./api";

function normalizeStripeStatus(value: string | null) {
  if (!value) {
    return "";
  }

  return value.trim().toLowerCase();
}

function getStripeStatusBadge(fattura: FatturaListItem) {
  const hasStripeLink =
    typeof fattura.stripe_payment_link === "string" &&
    fattura.stripe_payment_link.trim().length > 0 &&
    typeof fattura.stripe_session_id === "string" &&
    fattura.stripe_session_id.trim().length > 0;

  if (!hasStripeLink) {
    return {
      label: "Non generato",
      className: "bg-slate-100 text-slate-700",
    };
  }

  const status = normalizeStripeStatus(fattura.stripe_status);
  if (status === "open") {
    return {
      label: "Link attivo",
      className: "bg-cyan-100 text-cyan-700",
    };
  }
  if (status === "expired") {
    return {
      label: "Scaduto",
      className: "bg-amber-100 text-amber-700",
    };
  }
  if (status === "failed") {
    return {
      label: "Fallito",
      className: "bg-rose-100 text-rose-700",
    };
  }

  return {
    label: "In elaborazione",
    className: "bg-slate-100 text-slate-700",
  };
}

function canOpenStripeLink(fattura: FatturaListItem) {
  return (
    typeof fattura.stripe_payment_link === "string" &&
    fattura.stripe_payment_link.trim().length > 0
  );
}

export function FattureDaIncassare() {
  const { data: bootstrap } = useBootstrap();
  const [fatture, setFatture] = useState<FatturaListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copyingStripeLinkId, setCopyingStripeLinkId] = useState<number | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<number | null>(null);
  const clientSingular = bootstrap?.labels?.client_singular || "Paziente";
  const invoiceSingular = bootstrap?.labels?.invoice_singular || "Fattura";
  const invoicePlural = bootstrap?.labels?.invoice_plural || "Fatture";

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("it-IT", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 2,
      }),
    [],
  );

  const loadFatture = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listFatture({ stato: "da_pagare" });
      setFatture(data);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : `Errore nel caricamento delle ${invoicePlural.toLowerCase()} da incassare.`;
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [invoicePlural]);

  useEffect(() => {
    void loadFatture();
  }, [loadFatture]);

  const totaleDaIncassare = useMemo(
    () => fatture.reduce((sum, item) => sum + Number(item.importo), 0),
    [fatture],
  );

  const numeroFattureNonPagate = fatture.length;

  const importoMedio = useMemo(() => {
    if (fatture.length === 0) {
      return 0;
    }

    return totaleDaIncassare / fatture.length;
  }, [fatture.length, totaleDaIncassare]);

  async function handleCopyStripeLink(fatturaId: number, link: string) {
    if (copyingStripeLinkId !== null) {
      return;
    }

    if (typeof navigator === "undefined" || !navigator.clipboard) {
      setError("Copia link non supportata in questo browser.");
      return;
    }

    setError(null);
    setSuccess(null);
    setCopyingStripeLinkId(fatturaId);
    try {
      await navigator.clipboard.writeText(link);
      setSuccess(`Link Stripe copiato (fattura ID ${fatturaId}).`);
    } catch {
      setError("Impossibile copiare il link Stripe. Riprova.");
    } finally {
      setCopyingStripeLinkId(null);
    }
  }

  async function handleMarkAsPaid(fatturaId: number) {
    if (markingPaidId !== null) {
      return;
    }

    setError(null);
    setSuccess(null);
    setMarkingPaidId(fatturaId);
    try {
      await markFatturaAsPaid(fatturaId);
      setFatture((prev) => prev.filter((item) => item.id !== fatturaId));
      setSuccess(`${invoiceSingular} ID ${fatturaId} segnata come pagata.`);
    } catch (markError) {
      const message =
        markError instanceof Error
          ? markError.message
          : `Aggiornamento stato ${invoiceSingular.toLowerCase()} non riuscito.`;
      setError(message);
    } finally {
      setMarkingPaidId(null);
    }
  }

  return (
    <section className="halo-page halo-reveal">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ui-muted)]">
        {`${invoicePlural} da incassare`}
      </p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Elenco insoluti studio
          </h2>
          <p className="mt-2 max-w-[70ch] text-sm text-[var(--ui-muted)]">
            {`Vista operativa dedicata alle ${invoicePlural.toLowerCase()} non pagate, con riepilogo economico e lista completa.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/fatture" className="halo-btn-secondary px-4 py-2 text-sm">
            {`Apri ${invoicePlural.toLowerCase()}`}
          </Link>
          <Link href="/dashboard" className="halo-btn-secondary px-4 py-2 text-sm">
            Torna dashboard
          </Link>
        </div>
      </div>

      {error && <p className="halo-alert halo-alert-danger mt-4">{error}</p>}
      {success && <p className="halo-alert halo-alert-success mt-4">{success}</p>}

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <article className="halo-panel">
          <p className="text-xs uppercase tracking-[0.1em] text-[var(--ui-muted)]">
            Totale da incassare
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {currencyFormatter.format(totaleDaIncassare)}
          </p>
        </article>
        <article className="halo-panel">
          <p className="text-xs uppercase tracking-[0.1em] text-[var(--ui-muted)]">
            {`${invoicePlural} non pagate`}
          </p>
          <p className="mt-1 text-2xl font-semibold">{numeroFattureNonPagate}</p>
        </article>
        <article className="halo-panel">
          <p className="text-xs uppercase tracking-[0.1em] text-[var(--ui-muted)]">
            Importo medio
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {currencyFormatter.format(importoMedio)}
          </p>
        </article>
      </div>

      <article className="halo-panel mt-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">{`Lista ${invoicePlural.toLowerCase()} non pagate`}</h3>
            <p className="mt-1 text-xs text-[var(--ui-muted)]">
              {`Mostra tutte le ${invoicePlural.toLowerCase()} con stato backend \`da_pagare\`.`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadFatture()}
            disabled={loading}
            className="halo-btn-secondary px-4 py-2 text-sm"
          >
            {loading ? "Aggiornamento..." : "Aggiorna"}
          </button>
        </div>

        <div className="halo-table-wrap mt-4">
          <table className="halo-table">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left font-semibold">ID</th>
                <th className="px-4 py-3 text-left font-semibold">{clientSingular}</th>
                <th className="px-4 py-3 text-left font-semibold">Data</th>
                <th className="px-4 py-3 text-left font-semibold">Importo</th>
                <th className="px-4 py-3 text-left font-semibold">Stato</th>
                <th className="px-4 py-3 text-left font-semibold">Stripe</th>
                <th className="px-4 py-3 text-left font-semibold">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-3 text-[var(--ui-muted)]" colSpan={7}>
                    {`Caricamento ${invoicePlural.toLowerCase()} da incassare...`}
                  </td>
                </tr>
              ) : fatture.length === 0 ? (
                <tr>
                  <td className="px-4 py-5 text-center text-[var(--ui-muted)]" colSpan={7}>
                    {`Nessuna ${invoiceSingular.toLowerCase()} da incassare.`}
                  </td>
                </tr>
              ) : (
                fatture.map((fattura) => {
                  const stripeBadge = getStripeStatusBadge(fattura);
                  const stripeLink = canOpenStripeLink(fattura)
                    ? fattura.stripe_payment_link!.trim()
                    : "";

                  return (
                    <tr key={fattura.id}>
                      <td className="px-4 py-3 font-medium">{fattura.id}</td>
                      <td className="px-4 py-3">
                        {`${fattura.nome ?? ""} ${fattura.cognome ?? ""}`.trim() ||
                          `${clientSingular} #${fattura.paziente_id}`}
                      </td>
                      <td className="px-4 py-3 text-[var(--ui-muted)]">{fattura.data}</td>
                      <td className="px-4 py-3 font-semibold">
                        {currencyFormatter.format(Number(fattura.importo))}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                          Da pagare
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${stripeBadge.className}`}
                        >
                          {stripeBadge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {stripeLink ? (
                            <>
                              <a
                                href={stripeLink}
                                target="_blank"
                                rel="noreferrer"
                                className="halo-btn-secondary px-2.5 py-1 text-xs"
                              >
                                Apri link
                              </a>
                              <button
                                type="button"
                                onClick={() => void handleCopyStripeLink(fattura.id, stripeLink)}
                                disabled={copyingStripeLinkId === fattura.id}
                                className="halo-btn-secondary px-2.5 py-1 text-xs"
                              >
                                {copyingStripeLinkId === fattura.id ? "Copia..." : "Copia link"}
                              </button>
                            </>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => void handleMarkAsPaid(fattura.id)}
                            disabled={markingPaidId === fattura.id}
                            className="halo-btn-primary px-2.5 py-1 text-xs"
                          >
                            {markingPaidId === fattura.id ? "Aggiornamento..." : "Segna pagata"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
