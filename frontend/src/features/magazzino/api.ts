import { apiFetch, parseJsonResponse } from "@/lib/api-client";

type InventoryApiRecord = {
  id?: number;
  inventory_item_id?: number;
  nome?: string;
  name?: string;
  quantita?: number;
  stock_quantity?: number;
  soglia_minima?: number;
  reorder_threshold?: number;
  sotto_soglia?: boolean;
  da_riordinare?: number;
};

export type Prodotto = {
  id: number;
  inventory_item_id: number;
  nome: string;
  name: string;
  quantita: number;
  stock_quantity: number;
  soglia_minima: number;
  reorder_threshold: number;
  sotto_soglia: boolean;
  da_riordinare: number;
};

export type ProdottoPayload = {
  nome?: string;
  quantita?: number;
  soglia_minima?: number;
};

function normalizeInventoryItem(record: InventoryApiRecord): Prodotto {
  const id = Number(record.inventory_item_id ?? record.id ?? 0);
  const nome = record.name ?? record.nome ?? "";
  const quantita = record.stock_quantity ?? record.quantita ?? 0;
  const sogliaMinima = record.reorder_threshold ?? record.soglia_minima ?? 0;

  return {
    id,
    inventory_item_id: id,
    nome,
    name: nome,
    quantita,
    stock_quantity: quantita,
    soglia_minima: sogliaMinima,
    reorder_threshold: sogliaMinima,
    sotto_soglia: Boolean(record.sotto_soglia),
    da_riordinare: Number(record.da_riordinare ?? 0),
  };
}

function toInventoryPayload(payload: ProdottoPayload) {
  return {
    name: payload.nome,
    stock_quantity: payload.quantita,
    reorder_threshold: payload.soglia_minima,
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

const productsEndpoint = `${normalizeBaseUrl()}/api/v2/inventory-items`;
const productsLowStockEndpoint = `${productsEndpoint}/sotto-soglia`;

export async function listProdotti() {
  const response = await apiFetch(productsEndpoint, {
    method: "GET",
    cache: "no-store",
  });

  const data = await parseJsonResponse<InventoryApiRecord[]>(response);
  return data.map(normalizeInventoryItem);
}

export async function listProdottiSottoSoglia() {
  const response = await apiFetch(productsLowStockEndpoint, {
    method: "GET",
    cache: "no-store",
  });

  const data = await parseJsonResponse<InventoryApiRecord[]>(response);
  return data.map(normalizeInventoryItem);
}

export async function createProdotto(payload: Required<ProdottoPayload>) {
  const response = await apiFetch(productsEndpoint, {
    method: "POST",
    body: JSON.stringify(toInventoryPayload(payload)),
  });

  return normalizeInventoryItem(await parseJsonResponse<InventoryApiRecord>(response));
}

export async function updateProdotto(id: number, payload: ProdottoPayload) {
  const response = await apiFetch(`${productsEndpoint}/${id}`, {
    method: "PUT",
    body: JSON.stringify(toInventoryPayload(payload)),
  });

  return normalizeInventoryItem(await parseJsonResponse<InventoryApiRecord>(response));
}

export async function deleteProdotto(id: number) {
  const response = await apiFetch(`${productsEndpoint}/${id}`, {
    method: "DELETE",
  });

  return parseJsonResponse<{ message: string; id: number; inventory_item_id: number }>(response);
}
