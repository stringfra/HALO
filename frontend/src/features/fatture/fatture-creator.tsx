"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { formatDateToDmy, parseProjectDate } from "@/lib/date-utils";
import { ProjectDateField } from "@/components/forms/project-date-field";
import { useBootstrap } from "@/features/bootstrap/use-bootstrap";
import { listPazienti, type Paziente } from "@/features/pazienti/api";
import { getSessionSnapshot, subscribeToSession } from "@/features/auth/session";
import {
  createFattura,
  createFatturaStripeLink,
  listFatture,
  markFatturaAsPaid,
  reconcileFatturaStripeSuccess,
  type FatturaListItem,
} from "./api";

type FatturaForm = {
  pazienteId: string;
  importo: string;
  stato: "da_pagare" | "pagata";
  data: string;
};

type FatturaDraft = {
  pazienteId: number;
  pazienteNome: string;
  importo: number;
  stato: "da_pagare" | "pagata";
  data: string;
};

type InvoiceStatusFilter = "all" | "pagata" | "da_pagare";

function createInitialForm(): FatturaForm {
  return {
    pazienteId: "",
    importo: "",
    stato: "da_pagare",
    data: formatDateToDmy(new Date()),
  };
}

const dmyDatePattern = /^\d{2}\s\d{2}\s\d{4}$/;
const amountPattern = /^\d+(?:[.,]\d{1,2})?$/;

function parseInvoiceAmount(value: string) {
  const normalized = value.trim();
  if (!amountPattern.test(normalized)) {
    return null;
  }
  const parsed = Number.parseFloat(normalized.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 99999999) {
    return null;
  }
  return Number(parsed.toFixed(2));
}

function normalizeStripeStatus(value: string | null) {
  if (!value) {
    return "";
  }
  return value.trim().toLowerCase();
}

function hasActiveStripeCheckout(fattura: FatturaListItem) {
  if (fattura.stato === "pagata") {
    return false;
  }

  const hasStripeLink =
    typeof fattura.stripe_payment_link === "string" &&
    fattura.stripe_payment_link.trim().length > 0 &&
    typeof fattura.stripe_session_id === "string" &&
    fattura.stripe_session_id.trim().length > 0;
  if (!hasStripeLink) {
    return false;
  }

  const status = normalizeStripeStatus(fattura.stripe_status);
  return status !== "failed" && status !== "expired";
}

function canMarkInvoiceAsPaid(fattura: FatturaListItem) {
  if (fattura.stato === "pagata") {
    return false;
  }

  const hasStripeLink =
    typeof fattura.stripe_payment_link === "string" &&
    fattura.stripe_payment_link.trim().length > 0 &&
    typeof fattura.stripe_session_id === "string" &&
    fattura.stripe_session_id.trim().length > 0;
  if (!hasStripeLink) {
    return true;
  }

  const status = normalizeStripeStatus(fattura.stripe_status);
  return status === "failed" || status === "expired";
}

function getStripeStatusBadge(fattura: FatturaListItem) {
  if (fattura.stato === "pagata") {
    return {
      label: "Pagata",
      className: "bg-[var(--ui-accent-soft)] text-[var(--ui-accent)]",
    };
  }

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
  if (status === "paid") {
    return {
      label: "Pagato",
      className: "bg-[var(--ui-accent-soft)] text-[var(--ui-accent)]",
    };
  }
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

function formatStripeGeneratedAt(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function FattureCreator() {
  const session = useSyncExternalStore(subscribeToSession, getSessionSnapshot, () => null);
  const { data: bootstrap } = useBootstrap();
  const role = session?.ruolo ?? "SEGRETARIO";
  const [patients, setPatients] = useState<Paziente[]>([]);
  const [fatture, setFatture] = useState<FatturaListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FatturaForm>(() => createInitialForm());
  const [draft, setDraft] = useState<FatturaDraft | null>(null);
  const [stripePromptInvoiceId, setStripePromptInvoiceId] = useState<number | null>(null);
  const [creatingStripeLink, setCreatingStripeLink] = useState(false);
  const [copyingStripeLinkId, setCopyingStripeLinkId] = useState<number | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<InvoiceStatusFilter>("all");
  const clientSingular = bootstrap?.labels?.client_singular || "Paziente";
  const clientPlural = bootstrap?.labels?.client_plural || "Pazienti";
  const invoiceSingular = bootstrap?.labels?.invoice_singular || "Fattura";
  const invoicePlural = bootstrap?.labels?.invoice_plural || "Fatture";
  const refreshInvoices = useCallback(async () => {
    try {
      const fattureData = await listFatture();
      setFatture(fattureData);
      return fattureData;
    } catch {
      return null;
    }
  }, []);

  const loadPageData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [patientsData, fattureData] = await Promise.all([
        listPazienti(),
        listFatture(),
      ]);
      setPatients(patientsData);
      setFatture(fattureData);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : `Errore caricando ${clientPlural.toLowerCase()} e ${invoicePlural.toLowerCase()}.`;
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [clientPlural, invoicePlural]);

  useEffect(() => {
    void loadPageData();
  }, [loadPageData]);

  useEffect(() => {
    if (loading || typeof window === "undefined") {
      return;
    }

    const shouldPoll = fatture.some((item) => hasActiveStripeCheckout(item));
    if (!shouldPoll) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshInvoices();
    }, 10000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fatture, loading, refreshInvoices]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const stripeOutcome = params.get("stripe");
    if (stripeOutcome !== "success") {
      return;
    }

    const rawInvoiceId = params.get("fattura_id");
    const parsedInvoiceId =
      rawInvoiceId && /^\d+$/.test(rawInvoiceId)
        ? Number.parseInt(rawInvoiceId, 10)
        : null;
    const rawSessionId = params.get("session_id");
    const sessionId =
      typeof rawSessionId === "string" && rawSessionId.trim().startsWith("cs_")
        ? rawSessionId.trim()
        : null;

    setError(null);
    setSuccess("Pagamento ricevuto. Verifica allineamento stato fattura...");

    let cancelled = false;
    let timeoutId: number | null = null;
    let reconcileAttempted = false;
    let attempts = 0;
    const maxAttempts = 20;

    const clearStripeQuery = () => {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete("stripe");
      nextUrl.searchParams.delete("session_id");
      nextUrl.searchParams.delete("fattura_id");
      window.history.replaceState({}, "", nextUrl.toString());
    };

    const checkInvoiceStatus = async () => {
      if (cancelled) {
        return;
      }

      if (!reconcileAttempted && sessionId) {
        reconcileAttempted = true;
        try {
          await reconcileFatturaStripeSuccess({
            session_id: sessionId,
            ...(parsedInvoiceId ? { fattura_id: parsedInvoiceId } : {}),
          });
        } catch {
          // Fallback silenzioso: se la riconciliazione non riesce, continua polling locale.
        }
      }

      const latestInvoices = await refreshInvoices();
      if (!latestInvoices || cancelled) {
        return;
      }

      const targetInvoice = parsedInvoiceId
        ? latestInvoices.find((item) => item.id === parsedInvoiceId)
        : latestInvoices.find((item) => normalizeStripeStatus(item.stripe_status) === "paid");

      if (targetInvoice?.stato === "pagata") {
        setSuccess("Stato fattura aggiornato in tabella.");
        clearStripeQuery();
        return;
      }

      attempts += 1;
      if (attempts >= maxAttempts) {
        setSuccess("Pagamento registrato, aggiornamento stato in corso.");
        clearStripeQuery();
        return;
      }

      timeoutId = window.setTimeout(() => {
        void checkInvoiceStatus();
      }, 3000);
    };

    void checkInvoiceStatus();

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [refreshInvoices]);

  const selectedPatientName = useMemo(() => {
    const patientId = Number.parseInt(form.pazienteId, 10);
    const found = patients.find((patient) => patient.id === patientId);
    if (!found) {
      return "";
    }
    return `${found.nome} ${found.cognome}`;
  }, [form.pazienteId, patients]);
  const paidCount = useMemo(
    () => fatture.filter((item) => item.stato === "pagata").length,
    [fatture],
  );
  const pendingCount = useMemo(
    () => fatture.filter((item) => item.stato === "da_pagare").length,
    [fatture],
  );
  const filteredFatture = useMemo(() => {
    if (statusFilter === "all") {
      return fatture;
    }

    return fatture.filter((item) => item.stato === statusFilter);
  }, [fatture, statusFilter]);
  const roleCopy =
    role === "ADMIN"
      ? {
          badge: "Fatture · controllo admin",
          title: "Supervisione fatturazione studio",
          description:
            "Vista completa per monitorare incassi, verificare registrazioni e supportare il flusso segreteria.",
          formHint: "Inserimento controllato di nuove fatture e stato pagamento.",
          emptyDraft: `Seleziona ${clientSingular.toLowerCase()} e dettagli per registrare una ${invoiceSingular.toLowerCase()}.`,
        }
      : {
          badge: "Fatture · operativita segreteria",
          title: `Gestione fatture ${clientPlural.toLowerCase()}`,
          description:
            "Area operativa per registrare fatture, aggiornare stato pagamento e verificare lo storico.",
          formHint: "Compila il form e registra subito la fattura sul database.",
          emptyDraft: `Compila il form per creare una ${invoiceSingular.toLowerCase()}.`,
        };

  function handleChange<K extends keyof FatturaForm>(key: K, value: FatturaForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetForm() {
    setForm(createInitialForm());
  }

  async function handleConfirmCreateStripeLink() {
    if (stripePromptInvoiceId === null || creatingStripeLink) {
      return;
    }

    setError(null);
    setSuccess(null);
    setCreatingStripeLink(true);
    try {
      const stripeSession = await createFatturaStripeLink(stripePromptInvoiceId);
      setSuccess(
        stripeSession.reused
          ? `Link Stripe gia presente per fattura ID ${stripeSession.fattura_id}.`
          : `Sessione Stripe creata per fattura ID ${stripeSession.fattura_id}.`,
      );
      setStripePromptInvoiceId(null);
      await refreshInvoices();
    } catch (stripeError) {
      const message =
        stripeError instanceof Error
          ? stripeError.message
          : "Creazione sessione Stripe non riuscita.";
      setError(message);
    } finally {
      setCreatingStripeLink(false);
    }
  }

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
      setSuccess(`Fattura ID ${fatturaId} segnata come pagata.`);
      await refreshInvoices();
    } catch (markError) {
      const message =
        markError instanceof Error
          ? markError.message
          : "Aggiornamento stato fattura non riuscito.";
      setError(message);
    } finally {
      setMarkingPaidId(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const pazienteId = Number.parseInt(form.pazienteId, 10);
    const importo = parseInvoiceAmount(form.importo);
    const normalizedDate = form.data.trim();
    const parsedDate = parseProjectDate(normalizedDate);

    if (!Number.isInteger(pazienteId) || pazienteId <= 0) {
      setError(`Seleziona un ${clientSingular.toLowerCase()} valido.`);
      return;
    }
    if (importo === null) {
      setError("Inserisci un importo valido maggiore di zero.");
      return;
    }
    if (!dmyDatePattern.test(normalizedDate) || !parsedDate) {
      setError("Data non valida. Usa il formato DD MM YYYY.");
      return;
    }

    const patient = patients.find((candidate) => candidate.id === pazienteId) ?? null;

    setSaving(true);
    try {
      const created = await createFattura({
        paziente_id: pazienteId,
        importo,
        stato: form.stato,
        data: normalizedDate,
      });

      setDraft({
        pazienteId,
        pazienteNome: patient
          ? `${patient.nome} ${patient.cognome}`
          : `${clientSingular} #${pazienteId}`,
        importo,
        stato: form.stato,
        data: created.data,
      });

      setSuccess(`${invoiceSingular} salvata su database (ID ${created.id}).`);
      if (created.stato === "da_pagare") {
        setStripePromptInvoiceId(created.id);
      }
      resetForm();
      await refreshInvoices();
    } catch (saveError) {
      const message =
        saveError instanceof Error
          ? saveError.message
          : "Salvataggio fattura non riuscito.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="halo-page halo-reveal">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ui-muted)]">
        {roleCopy.badge}
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight">
        {roleCopy.title}
      </h2>
      <p className="mt-2 max-w-[70ch] text-sm text-[var(--ui-muted)]">{roleCopy.description}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <article className="rounded-[var(--radius-md)] border border-[var(--ui-border)] bg-white p-3">
          <p className="text-xs uppercase tracking-[0.1em] text-[var(--ui-muted)]">Totale</p>
          <p className="mt-1 text-2xl font-semibold">{fatture.length}</p>
        </article>
        <article className="rounded-[var(--radius-md)] border border-[var(--ui-border)] bg-white p-3">
          <p className="text-xs uppercase tracking-[0.1em] text-[var(--ui-muted)]">Pagate</p>
          <p className="mt-1 text-2xl font-semibold">{paidCount}</p>
        </article>
        <article className="rounded-[var(--radius-md)] border border-[var(--ui-border)] bg-white p-3">
          <p className="text-xs uppercase tracking-[0.1em] text-[var(--ui-muted)]">Da pagare</p>
          <p className="mt-1 text-2xl font-semibold">{pendingCount}</p>
        </article>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[420px_1fr]">
        <article className="halo-panel">
          <h3 className="text-sm font-semibold">{`Nuova ${invoiceSingular.toLowerCase()} (non fiscale)`}</h3>
          <p className="mt-1 text-xs text-[var(--ui-muted)]">
            {roleCopy.formHint}
          </p>

          {error && (
            <p className="halo-alert halo-alert-danger mt-3">
              {error}
            </p>
          )}
          {success && (
            <p className="halo-alert halo-alert-success mt-3">
              {success}
            </p>
          )}

          <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">{clientSingular} *</span>
              <select
                value={form.pazienteId}
                onChange={(event) => handleChange("pazienteId", event.target.value)}
                disabled={loading}
                className="halo-select disabled:opacity-70"
              >
                <option value="">
                  {loading ? "Caricamento..." : `Seleziona ${clientSingular.toLowerCase()}`}
                </option>
                {patients.map((patient) => (
                  <option key={patient.id} value={String(patient.id)}>
                    {patient.nome} {patient.cognome}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium">Importo *</span>
              <input
                value={form.importo}
                onChange={(event) => handleChange("importo", event.target.value)}
                placeholder="es. 120.00"
                className="halo-input"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium">Stato pagamento *</span>
              <select
                value={form.stato}
                onChange={(event) =>
                  handleChange("stato", event.target.value as FatturaForm["stato"])
                }
                className="halo-select"
              >
                <option value="da_pagare">Da pagare</option>
                <option value="pagata">Pagata</option>
              </select>
            </label>

            <ProjectDateField
              label="Data (DD MM YYYY)"
              required
              value={form.data}
              showValuePreview={false}
              onChange={(nextValue) => handleChange("data", nextValue)}
            />

            <div className="mt-1 flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={saving || loading}
                className="halo-btn-primary px-4 py-2 text-sm"
              >
                {saving ? "Salvataggio..." : `Salva ${invoiceSingular.toLowerCase()}`}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="halo-btn-secondary px-4 py-2 text-sm"
              >
                Reset
              </button>
            </div>
          </form>
        </article>

        <article className="halo-panel">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">{`Lista ${invoicePlural.toLowerCase()}`}</h3>
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as InvoiceStatusFilter)
                }
                className="halo-select w-[122px] px-2 py-1.5 text-xs"
              >
                <option value="all">Tutte</option>
                <option value="pagata">Pagate</option>
                <option value="da_pagare">Non pagate</option>
              </select>
              <Link
                href="/fatture/da-incassare"
                className="halo-btn-secondary px-3 py-1.5 text-xs"
              >
                {`${invoicePlural} da incassare`}
              </Link>
            </div>
          </div>

          <div className="halo-table-wrap mt-4">
            <table className="halo-table">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">ID</th>
                  <th className="px-3 py-2 text-left font-semibold">{clientSingular}</th>
                  <th className="px-3 py-2 text-left font-semibold">Data</th>
                  <th className="px-3 py-2 text-left font-semibold">Importo</th>
                  <th className="px-3 py-2 text-left font-semibold">Stato fattura (backend)</th>
                  <th className="px-3 py-2 text-left font-semibold">Pagamento Stripe</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-3 py-3 text-[var(--ui-muted)]" colSpan={6}>
                      {`Caricamento ${invoicePlural.toLowerCase()}...`}
                    </td>
                  </tr>
                ) : filteredFatture.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-[var(--ui-muted)]" colSpan={6}>
                      {`Nessuna ${invoiceSingular.toLowerCase()} presente per il filtro selezionato.`}
                    </td>
                  </tr>
                ) : (
                  filteredFatture.map((fattura) => (
                    <tr key={fattura.id}>
                      {(() => {
                        const badge = getStripeStatusBadge(fattura);
                        const stripeLink =
                          typeof fattura.stripe_payment_link === "string"
                            ? fattura.stripe_payment_link.trim()
                            : "";
                        const canOpenLink = stripeLink.length > 0;
                        const generatedAt = formatStripeGeneratedAt(
                          fattura.stripe_generated_at,
                        );

                        return (
                          <>
                      <td className="px-3 py-2 font-medium">{fattura.id}</td>
                      <td className="px-3 py-2">
                        {`${fattura.nome ?? ""} ${fattura.cognome ?? ""}`.trim() ||
                          `${clientSingular} #${fattura.paziente_id}`}
                      </td>
                      <td className="px-3 py-2 text-[var(--ui-muted)]">{fattura.data}</td>
                      <td className="px-3 py-2">
                        EUR {Number.parseFloat(fattura.importo).toFixed(2)}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            fattura.stato === "pagata"
                              ? "bg-[var(--ui-accent-soft)] text-[var(--ui-accent)]"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {fattura.stato === "pagata" ? "Pagata" : "Da pagare"}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-2">
                          <span
                            className={`w-fit rounded-full px-2 py-1 text-xs font-semibold ${
                              badge.label === "Non generato" ? "self-center text-center" : ""
                            } ${badge.className}`}
                          >
                            {badge.label}
                          </span>

                          {generatedAt && (
                            <span className="text-xs text-[var(--ui-muted)]">
                              Generato: {generatedAt}
                            </span>
                          )}

                          {canOpenLink && (
                            <div className="flex flex-wrap gap-2">
                              <a
                                href={stripeLink}
                                target="_blank"
                                rel="noreferrer"
                                className="halo-btn-secondary px-2.5 py-1 text-xs"
                              >
                                Apri
                              </a>
                              <button
                                type="button"
                                onClick={() => void handleCopyStripeLink(fattura.id, stripeLink)}
                                disabled={copyingStripeLinkId === fattura.id}
                                className="halo-btn-secondary px-2.5 py-1 text-xs"
                              >
                                {copyingStripeLinkId === fattura.id ? "Copia..." : "Copia link"}
                              </button>
                            </div>
                          )}

                          {canMarkInvoiceAsPaid(fattura) && (
                            <button
                              type="button"
                              onClick={() => void handleMarkAsPaid(fattura.id)}
                              disabled={markingPaidId === fattura.id}
                              className="halo-btn-primary w-fit px-2.5 py-1 text-xs"
                            >
                              {markingPaidId === fattura.id ? "Aggiornamento..." : "Segna pagata"}
                            </button>
                          )}
                        </div>
                      </td>
                          </>
                        );
                      })()}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!draft ? (
            <p className="mt-4 text-sm text-[var(--ui-muted)]">
              {roleCopy.emptyDraft}
            </p>
          ) : (
            <div className="mt-4 grid gap-2 rounded-[var(--radius-md)] border border-dashed border-[var(--ui-border)] bg-slate-50 p-3 text-xs text-[var(--ui-muted)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ui-muted)]">
                Riepilogo ultima creazione
              </p>
              <p>
                <span className="font-semibold text-slate-700">{`${clientSingular}:`}</span>{" "}
                {draft.pazienteNome}
              </p>
              <p>
                <span className="font-semibold text-slate-700">Importo:</span> EUR{" "}
                {draft.importo.toFixed(2)}
              </p>
              <p>
                <span className="font-semibold text-slate-700">Stato selezionato nel form:</span>{" "}
                {draft.stato === "pagata" ? "Pagata" : "Da pagare"}
              </p>
              <p>
                <span className="font-semibold text-slate-700">Data:</span> {draft.data}
              </p>
              <p className="mt-1 text-[11px] text-[var(--ui-muted)]">
                Valore di inserimento. Lo stato ufficiale e quello nella tabella fatture.
              </p>
            </div>
          )}

          {selectedPatientName && (
            <p className="mt-4 text-xs text-[var(--ui-muted)]">
              {`${clientSingular} selezionato:`} {selectedPatientName}
            </p>
          )}
        </article>
      </div>

      <ConfirmDialog
        open={stripePromptInvoiceId !== null}
        title="Generare link di pagamento Stripe?"
        description={`La ${invoiceSingular.toLowerCase()} e stata salvata. Vuoi creare ora un link di pagamento da inviare al ${clientSingular.toLowerCase()}?`}
        confirmLabel="Genera link"
        cancelLabel="Non ora"
        confirmingLabel="Generazione..."
        confirmTone="primary"
        isConfirming={creatingStripeLink}
        onConfirm={() => void handleConfirmCreateStripeLink()}
        onCancel={() => {
          if (creatingStripeLink) {
            return;
          }
          setStripePromptInvoiceId(null);
        }}
      />
    </section>
  );
}
