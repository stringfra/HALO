import { apiFetch, parseJsonResponse } from "@/lib/api-client";

export type StatsRevenuePoint = {
  data: string;
  totale: number;
};

export type StatsGranularity = "day" | "week" | "month";

export type StatsGuadagni = {
  giornaliero: number;
  mensile: number;
  totale: number;
  ultimi30Giorni: StatsRevenuePoint[];
  range_start?: string;
  range_end?: string;
  granularity?: StatsGranularity;
  points_count?: number;
  currency: string;
};

export type GuadagniStatsQuery = {
  dateFrom?: string;
  dateTo?: string;
  granularity?: StatsGranularity;
};

function normalizeBaseUrl() {
  const rawBase =
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ??
    "http://localhost:4000/api";

  if (rawBase.endsWith("/api")) {
    return rawBase.slice(0, -4);
  }

  return rawBase;
}

const statsEndpoint = `${normalizeBaseUrl()}/stats/guadagni`;

export async function getGuadagniStats(query: GuadagniStatsQuery = {}) {
  const endpoint = new URL(statsEndpoint);
  if (query.dateFrom) {
    endpoint.searchParams.set("date_from", query.dateFrom);
  }
  if (query.dateTo) {
    endpoint.searchParams.set("date_to", query.dateTo);
  }
  if (query.granularity) {
    endpoint.searchParams.set("granularity", query.granularity);
  }

  const response = await apiFetch(endpoint.toString(), {
    method: "GET",
    cache: "no-store",
  });

  return parseJsonResponse<StatsGuadagni>(response);
}
