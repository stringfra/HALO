import { apiFetch, parseJsonResponse } from "@/lib/api-client";

type InvoiceApiRecord = {
  id?: number;
  invoice_id?: number;
  paziente_id?: number;
  client_id?: number;
  nome?: string | null;
  cognome?: string | null;
  importo?: string;
  amount?: string;
  stato?: "da_pagare" | "pagata";
  invoice_status?: "da_pagare" | "pagata";
  data?: string;
  invoice_date?: string;
  stripe_session_id?: string | null;
  stripe_payment_link?: string | null;
  stripe_checkout_url?: string | null;
  stripe_status?: string | null;
  stripe_generated_at?: string | null;
};

export type FatturaPayload = {
  paziente_id: number;
  importo: number;
  stato: "da_pagare" | "pagata";
  data: string;
};

export type FatturaResponse = {
  id: number;
  invoice_id: number;
  paziente_id: number;
  client_id: number;
  importo: string;
  amount: string;
  stato: "da_pagare" | "pagata";
  invoice_status: "da_pagare" | "pagata";
  data: string;
  invoice_date: string;
};

export type FatturaListItem = {
  id: number;
  invoice_id: number;
  paziente_id: number;
  client_id: number;
  nome: string | null;
  cognome: string | null;
  importo: string;
  amount: string;
  stato: "da_pagare" | "pagata";
  invoice_status: "da_pagare" | "pagata";
  data: string;
  invoice_date: string;
  stripe_session_id: string | null;
  stripe_payment_link: string | null;
  stripe_checkout_url: string | null;
  stripe_status: string | null;
  stripe_generated_at: string | null;
};

export type FatturaStripeLinkResponse = {
  fattura_id: number;
  stripe_session_id: string;
  stripe_checkout_url: string;
  stripe_status: string;
  stripe_expires_at: number | null;
  stripe_generated_at?: string | null;
  reused?: boolean;
};

export type FatturaStripeReconcilePayload = {
  session_id: string;
  fattura_id?: number;
};

export type FatturaStripeReconcileResponse = {
  reconciled: boolean;
  fattura_id?: number;
  payment_status: string | null;
  stripe_status: string | null;
};

export type FatturaMarkPaidResponse = {
  id: number;
  stato: "pagata";
  already_paid?: boolean;
};

export type ListFattureFilters = {
  stato?: "da_pagare" | "pagata";
};

function normalizeInvoice<T extends InvoiceApiRecord>(record: T): FatturaListItem {
  const id = Number(record.invoice_id ?? record.id ?? 0);
  const clientId = Number(record.client_id ?? record.paziente_id ?? 0);
  const amount = record.amount ?? record.importo ?? "0";
  const status = record.invoice_status ?? record.stato ?? "da_pagare";
  const date = record.invoice_date ?? record.data ?? "";
  const checkoutUrl = record.stripe_checkout_url ?? record.stripe_payment_link ?? null;

  return {
    id,
    invoice_id: id,
    paziente_id: clientId,
    client_id: clientId,
    nome: record.nome ?? null,
    cognome: record.cognome ?? null,
    importo: amount,
    amount,
    stato: status,
    invoice_status: status,
    data: date,
    invoice_date: date,
    stripe_session_id: record.stripe_session_id ?? null,
    stripe_payment_link: checkoutUrl,
    stripe_checkout_url: checkoutUrl,
    stripe_status: record.stripe_status ?? null,
    stripe_generated_at: record.stripe_generated_at ?? null,
  };
}

function toInvoicePayload(payload: FatturaPayload) {
  return {
    client_id: payload.paziente_id,
    amount: payload.importo,
    invoice_status: payload.stato,
    invoice_date: payload.data,
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

const invoicesEndpoint = `${normalizeBaseUrl()}/api/v2/invoices`;

export async function createFattura(payload: FatturaPayload) {
  const response = await apiFetch(invoicesEndpoint, {
    method: "POST",
    body: JSON.stringify(toInvoicePayload(payload)),
  });

  return normalizeInvoice(await parseJsonResponse<InvoiceApiRecord>(response));
}

export async function listFatture(filters?: ListFattureFilters) {
  const endpoint = new URL(invoicesEndpoint);
  if (filters?.stato) {
    endpoint.searchParams.set("invoice_status", filters.stato);
  }

  const response = await apiFetch(endpoint.toString(), {
    method: "GET",
    cache: "no-store",
  });

  const data = await parseJsonResponse<InvoiceApiRecord[]>(response);
  return data.map(normalizeInvoice);
}

export async function createFatturaStripeLink(fatturaId: number) {
  const response = await apiFetch(
    `${invoicesEndpoint}/${encodeURIComponent(String(fatturaId))}/stripe-link`,
    {
      method: "POST",
    },
  );

  return parseJsonResponse<FatturaStripeLinkResponse>(response);
}

export async function reconcileFatturaStripeSuccess(payload: FatturaStripeReconcilePayload) {
  const response = await apiFetch(`${invoicesEndpoint}/stripe/reconcile-success`, {
    method: "POST",
    body: JSON.stringify({
      session_id: payload.session_id,
      invoice_id: payload.fattura_id,
    }),
  });

  return parseJsonResponse<FatturaStripeReconcileResponse>(response);
}

export async function markFatturaAsPaid(fatturaId: number) {
  const response = await apiFetch(
    `${invoicesEndpoint}/${encodeURIComponent(String(fatturaId))}/mark-paid`,
    {
      method: "POST",
    },
  );

  return parseJsonResponse<FatturaMarkPaidResponse>(response);
}
