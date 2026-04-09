"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  getGuadagniStats,
  type StatsGranularity,
  type StatsGuadagni,
} from "@/features/dashboard/api";
import {
  listAppuntamenti,
  type BackendAppointment,
} from "@/features/agenda/api";
import { listFatture, type FatturaListItem } from "@/features/fatture/api";
import { listPazienti } from "@/features/pazienti/api";
import { getSessionSnapshot, subscribeToSession } from "@/features/auth/session";
import { formatDateToIso, parseProjectDate } from "@/lib/date-utils";

type DashboardSnapshot = {
  stats: StatsGuadagni | null;
  invoices: FatturaListItem[];
  appointments: BackendAppointment[];
  patientsCount: number;
};

type RevenuePoint = {
  key: string;
  date: Date;
  total: number;
};

type Trend = {
  label: string;
  tone: "positive" | "negative" | "neutral";
};

type RangePreset = "7d" | "14d" | "30d" | "90d" | "ytd" | "custom";
type GranularityMode = "auto" | StatsGranularity;

type ResolvedRange = {
  fromDate: Date;
  toDate: Date;
  fromIso: string;
  toIso: string;
  error: string | null;
};

type TimeParts = {
  hours: number;
  minutes: number;
};

type ComparableStampParts = {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
};

const rangePresetValues: RangePreset[] = ["7d", "14d", "30d", "90d", "ytd", "custom"];
const granularityModeValues: GranularityMode[] = ["auto", "day", "week", "month"];

type SearchParamReader = {
  get(name: string): string | null;
};

function isIsoDate(value: string | null) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function parseRangePreset(value: string | null): RangePreset {
  if (value && rangePresetValues.includes(value as RangePreset)) {
    return value as RangePreset;
  }
  return "30d";
}

function parseGranularityMode(value: string | null): GranularityMode {
  if (value && granularityModeValues.includes(value as GranularityMode)) {
    return value as GranularityMode;
  }
  return "auto";
}

function readFiltersFromSearchParams(searchParams: SearchParamReader) {
  const rangePreset = parseRangePreset(searchParams.get("range"));
  const customFrom = isIsoDate(searchParams.get("from")) ? String(searchParams.get("from")) : "";
  const customTo = isIsoDate(searchParams.get("to")) ? String(searchParams.get("to")) : "";
  const granularityMode = parseGranularityMode(searchParams.get("granularity"));

  return {
    rangePreset,
    customFrom,
    customTo,
    granularityMode,
  };
}

function shiftDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfYear(date: Date) {
  return new Date(date.getFullYear(), 0, 1);
}

function diffDaysInclusive(fromDate: Date, toDate: Date) {
  const from = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  const to = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
  const diff = to.getTime() - from.getTime();
  return Math.floor(diff / (24 * 60 * 60 * 1000)) + 1;
}

function inferGranularity(fromDate: Date, toDate: Date): StatsGranularity {
  const days = diffDaysInclusive(fromDate, toDate);
  if (days <= 90) {
    return "day";
  }

  return "week";
}

function resolveRange(
  preset: RangePreset,
  customFrom: string,
  customTo: string,
  referenceDate = new Date(),
): ResolvedRange {
  const fallbackTo = new Date(referenceDate);
  const fallbackFrom = shiftDays(fallbackTo, -29);

  let fromDate = fallbackFrom;
  let toDate = fallbackTo;
  let error: string | null = null;

  if (preset === "7d") {
    fromDate = shiftDays(referenceDate, -6);
    toDate = new Date(referenceDate);
  } else if (preset === "14d") {
    fromDate = shiftDays(referenceDate, -13);
    toDate = new Date(referenceDate);
  } else if (preset === "30d") {
    fromDate = shiftDays(referenceDate, -29);
    toDate = new Date(referenceDate);
  } else if (preset === "90d") {
    fromDate = shiftDays(referenceDate, -89);
    toDate = new Date(referenceDate);
  } else if (preset === "ytd") {
    fromDate = startOfYear(referenceDate);
    toDate = new Date(referenceDate);
  } else if (preset === "custom") {
    const parsedFrom = parseProjectDate(customFrom || "");
    const parsedTo = parseProjectDate(customTo || "");

    if (!parsedFrom || !parsedTo) {
      error = "Intervallo custom non valido: imposta entrambe le date.";
    } else if (parsedFrom.getTime() > parsedTo.getTime()) {
      error = "Intervallo custom non valido: la data iniziale deve precedere quella finale.";
    } else if (diffDaysInclusive(parsedFrom, parsedTo) > 365) {
      error = "Intervallo custom non valido: massimo 365 giorni.";
    } else {
      fromDate = parsedFrom;
      toDate = parsedTo;
    }
  }

  return {
    fromDate,
    toDate,
    fromIso: formatDateToIso(fromDate),
    toIso: formatDateToIso(toDate),
    error,
  };
}

function pseudoTimeFromInvoice(invoiceId: number, index: number) {
  const hour = String((invoiceId + index * 3) % 24).padStart(2, "0");
  const minute = String((invoiceId * 7 + index * 11) % 60).padStart(2, "0");
  return `${hour}:${minute}`;
}

function buildEmailFromInvoice(invoice: FatturaListItem) {
  const first = (invoice.nome || "utente").trim().toLowerCase();
  const last = (invoice.cognome || "cliente").trim().toLowerCase();
  const sanitized = `${first}.${last}`.replace(/[^a-z0-9.]/g, "");
  return `${sanitized}@example.com`;
}

function parseTimeParts(value: string | null | undefined): TimeParts | null {
  const normalized = String(value || "").trim();
  const match = normalized.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  if (!match) {
    return null;
  }

  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return { hours, minutes };
}

function toComparableStamp({
  year,
  month,
  day,
  hours,
  minutes,
}: ComparableStampParts) {
  return (
    year * 100000000 +
    month * 1000000 +
    day * 10000 +
    hours * 100 +
    minutes
  );
}

function getRomeNowComparableStamp(referenceDate = new Date()) {
  const formatter = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(referenceDate);
  const map: Partial<Record<"year" | "month" | "day" | "hour" | "minute", number>> = {};
  for (const part of parts) {
    if (
      part.type === "year" ||
      part.type === "month" ||
      part.type === "day" ||
      part.type === "hour" ||
      part.type === "minute"
    ) {
      map[part.type] = Number.parseInt(part.value, 10);
    }
  }

  return toComparableStamp({
    year: Number(map.year || 0),
    month: Number(map.month || 0),
    day: Number(map.day || 0),
    hours: Number(map.hour || 0),
    minutes: Number(map.minute || 0),
  });
}

function countUpcomingAppointments(
  appointments: BackendAppointment[],
  referenceDate = new Date(),
) {
  const allowedStatuses = new Set<BackendAppointment["stato"]>([
    "in_attesa",
    "confermato",
  ]);
  const nowRomeStamp = getRomeNowComparableStamp(referenceDate);

  return appointments.filter((appointment) => {
    const status = appointment.stato ?? appointment.appointment_status;
    if (!allowedStatuses.has(status)) {
      return false;
    }

    const parsedDate = parseProjectDate(appointment.data || appointment.appointment_date || "");
    const parsedTime = parseTimeParts(appointment.ora || appointment.appointment_time || "");
    if (!parsedDate || !parsedTime) {
      return false;
    }

    const appointmentStamp = toComparableStamp({
      year: parsedDate.getFullYear(),
      month: parsedDate.getMonth() + 1,
      day: parsedDate.getDate(),
      hours: parsedTime.hours,
      minutes: parsedTime.minutes,
    });

    return appointmentStamp >= nowRomeStamp;
  }).length;
}

function buildRevenueSeries(snapshot: DashboardSnapshot | null): RevenuePoint[] {
  const raw = snapshot?.stats?.ultimi30Giorni ?? [];
  if (raw.length > 0) {
    return raw
      .map((point) => {
        const parsed = parseProjectDate(point.data);
        if (!parsed) {
          return null;
        }

        return {
          key: point.data,
          date: parsed,
          total: Number(point.totale || 0),
        } satisfies RevenuePoint;
      })
      .filter((value): value is RevenuePoint => Boolean(value))
      .sort((left, right) => left.date.getTime() - right.date.getTime());
  }

  const invoices = snapshot?.invoices ?? [];
  const totalByDay = new Map<string, number>();

  for (const invoice of invoices) {
    const date = parseProjectDate(invoice.data);
    if (!date) {
      continue;
    }

    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const amount = Number(invoice.importo || 0);
    totalByDay.set(key, (totalByDay.get(key) ?? 0) + amount);
  }

  const sortedKeys = [...totalByDay.keys()].sort((a, b) => (a > b ? 1 : -1));
  return sortedKeys.map((key) => {
    const [year, month, day] = key.split("-").map((value) => Number.parseInt(value, 10));
    const date = new Date(year, month, day);
    return {
      key,
      date,
      total: totalByDay.get(key) ?? 0,
    };
  });
}

function sumPaidInvoicesInRange(
  invoices: FatturaListItem[],
  fromDate: Date,
  toDate: Date,
) {
  const fromDay = new Date(
    fromDate.getFullYear(),
    fromDate.getMonth(),
    fromDate.getDate(),
  ).getTime();
  const toDay = new Date(
    toDate.getFullYear(),
    toDate.getMonth(),
    toDate.getDate(),
  ).getTime();

  return invoices.reduce((total, invoice) => {
    if (invoice.stato !== "pagata") {
      return total;
    }

    const parsed = parseProjectDate(invoice.data);
    if (!parsed) {
      return total;
    }

    const invoiceDay = new Date(
      parsed.getFullYear(),
      parsed.getMonth(),
      parsed.getDate(),
    ).getTime();

    if (invoiceDay < fromDay || invoiceDay > toDay) {
      return total;
    }

    return total + Number(invoice.importo || 0);
  }, 0);
}

function formatTrend(current: number, previous: number | null): Trend {
  if (previous === null || previous <= 0) {
    return { label: "0%", tone: "neutral" };
  }

  const delta = ((current - previous) / previous) * 100;
  if (Math.abs(delta) < 0.1) {
    return { label: "0%", tone: "neutral" };
  }

  return {
    label: `${delta > 0 ? "+" : ""}${delta.toFixed(0)}%`,
    tone: delta > 0 ? "positive" : "negative",
  };
}

function trendClass(tone: Trend["tone"]) {
  if (tone === "positive") {
    return "bg-[var(--status-success-bg)] text-[var(--status-success-text)]";
  }
  if (tone === "negative") {
    return "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]";
  }
  return "bg-[var(--status-info-bg)] text-[var(--status-info-text)]";
}

type ChartPathData = {
  linePath: string;
  areaPath: string;
  points: Array<{ x: number; y: number; key: string; total: number; date: Date }>;
  width: number;
  height: number;
  padding: number;
  baselineY: number;
};

type ScaledChartPoint = { x: number; y: number; key: string; total: number; date: Date };

function buildMonotoneCurvePaths(points: ScaledChartPoint[], baselineY: number) {
  if (points.length === 0) {
    return {
      linePath: "",
      areaPath: "",
    };
  }

  if (points.length === 1) {
    const point = points[0];
    const linePath = `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    const areaPath = `M ${point.x.toFixed(2)} ${baselineY.toFixed(2)} L ${point.x.toFixed(2)} ${point.y.toFixed(2)} L ${point.x.toFixed(2)} ${baselineY.toFixed(2)} Z`;

    return {
      linePath,
      areaPath,
    };
  }

  const segmentSlopes: number[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const dx = points[index + 1].x - points[index].x;
    const dy = points[index + 1].y - points[index].y;
    segmentSlopes.push(dx === 0 ? 0 : dy / dx);
  }

  const tangents: number[] = [];
  tangents[0] = segmentSlopes[0];
  tangents[points.length - 1] = segmentSlopes[segmentSlopes.length - 1];
  for (let index = 1; index < points.length - 1; index += 1) {
    const left = segmentSlopes[index - 1];
    const right = segmentSlopes[index];
    tangents[index] = left * right <= 0 ? 0 : (left + right) / 2;
  }

  // Fritsch-Carlson slope limiter to keep the cubic curve monotone and avoid spikes.
  for (let index = 0; index < segmentSlopes.length; index += 1) {
    const slope = segmentSlopes[index];
    if (slope === 0) {
      tangents[index] = 0;
      tangents[index + 1] = 0;
      continue;
    }

    const leftRatio = tangents[index] / slope;
    const rightRatio = tangents[index + 1] / slope;
    const norm = Math.hypot(leftRatio, rightRatio);
    if (norm > 3) {
      const scale = 3 / norm;
      tangents[index] = scale * leftRatio * slope;
      tangents[index + 1] = scale * rightRatio * slope;
    }
  }

  const pathChunks = [`M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`];
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const dx = next.x - current.x;

    const cp1x = current.x + dx / 3;
    const cp1y = current.y + (tangents[index] * dx) / 3;
    const cp2x = next.x - dx / 3;
    const cp2y = next.y - (tangents[index + 1] * dx) / 3;

    pathChunks.push(
      `C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${next.x.toFixed(2)} ${next.y.toFixed(2)}`,
    );
  }

  const linePath = pathChunks.join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${baselineY.toFixed(2)} L ${points[0].x.toFixed(2)} ${baselineY.toFixed(2)} Z`;

  return {
    linePath,
    areaPath,
  };
}

function buildChartPath(points: RevenuePoint[]): ChartPathData {
  const width = 980;
  const height = 310;
  const padding = 14;
  const baselineY = height - padding;

  if (points.length === 0) {
    return {
      linePath: "",
      areaPath: "",
      points: [],
      width,
      height,
      padding,
      baselineY,
    };
  }

  const maxTotal = Math.max(...points.map((point) => point.total), 1);
  const stepX = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;

  const scaled: ScaledChartPoint[] = points.map((point, index) => {
    const x = padding + stepX * index;
    const y = baselineY - (point.total / maxTotal) * (height - padding * 2 - 10);
    return { x, y, key: point.key, total: point.total, date: point.date };
  });

  const { linePath, areaPath } = buildMonotoneCurvePaths(scaled, baselineY);

  return {
    linePath,
    areaPath,
    points: scaled,
    width,
    height,
    padding,
    baselineY,
  };
}

function MetricIcon({
  kind,
}: {
  kind: "customers" | "conversions" | "revenue" | "appointments";
}) {
  if (kind === "customers") {
    return (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
        <circle cx="8" cy="7.4" r="2.2" stroke="currentColor" strokeWidth="1.4" />
        <path d="M4.4 13.6c.7-1.8 2-2.7 3.6-2.7 1.7 0 3 .9 3.7 2.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === "conversions") {
    return (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
        <circle cx="10" cy="10" r="6.2" stroke="currentColor" strokeWidth="1.4" />
        <path d="M10 6.1v4.2h3.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === "revenue") {
    return (
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
        <circle cx="10" cy="10" r="6.2" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8.4 12.2c.6.5 1.2.8 1.8.8.9 0 1.5-.4 1.5-1.1 0-1.8-3.8-1-3.8-3.2 0-1 .8-1.8 2.1-1.8.8 0 1.4.2 1.9.6M10 6.2v7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <rect x="3.6" y="4.5" width="12.8" height="11.8" rx="2.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6.7 2.9v3M13.3 2.9v3M4 8.2h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const session = useSyncExternalStore(subscribeToSession, getSessionSnapshot, () => null);
  const filtersFromUrl = useMemo(
    () => readFiltersFromSearchParams(searchParams),
    [searchParams],
  );
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeTick, setTimeTick] = useState(() => Date.now());
  const [rangePreset, setRangePreset] = useState<RangePreset>(filtersFromUrl.rangePreset);
  const [customDateFrom, setCustomDateFrom] = useState(filtersFromUrl.customFrom);
  const [customDateTo, setCustomDateTo] = useState(filtersFromUrl.customTo);
  const [granularityMode, setGranularityMode] = useState<GranularityMode>(filtersFromUrl.granularityMode);

  const requestedRange = useMemo(
    () => resolveRange(rangePreset, customDateFrom, customDateTo, new Date()),
    [customDateFrom, customDateTo, rangePreset],
  );

  const inferredGranularity = useMemo(
    () => inferGranularity(requestedRange.fromDate, requestedRange.toDate),
    [requestedRange.fromDate, requestedRange.toDate],
  );

  const requestedGranularity = granularityMode === "auto" ? undefined : granularityMode;

  const handlePresetSelection = (preset: RangePreset) => {
    if (preset === "custom") {
      if (!customDateFrom) {
        setCustomDateFrom(requestedRange.fromIso);
      }
      if (!customDateTo) {
        setCustomDateTo(requestedRange.toIso);
      }
    }

    setRangePreset(preset);
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTimeTick(Date.now());
    }, 30_000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    setRangePreset((current) =>
      current === filtersFromUrl.rangePreset ? current : filtersFromUrl.rangePreset,
    );
    setCustomDateFrom((current) =>
      current === filtersFromUrl.customFrom ? current : filtersFromUrl.customFrom,
    );
    setCustomDateTo((current) =>
      current === filtersFromUrl.customTo ? current : filtersFromUrl.customTo,
    );
    setGranularityMode((current) =>
      current === filtersFromUrl.granularityMode ? current : filtersFromUrl.granularityMode,
    );
  }, [
    filtersFromUrl.customFrom,
    filtersFromUrl.customTo,
    filtersFromUrl.granularityMode,
    filtersFromUrl.rangePreset,
  ]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("range", rangePreset);

    if (rangePreset === "custom" && customDateFrom && customDateTo) {
      nextParams.set("from", customDateFrom);
      nextParams.set("to", customDateTo);
    } else {
      nextParams.delete("from");
      nextParams.delete("to");
    }

    if (granularityMode !== "auto") {
      nextParams.set("granularity", granularityMode);
    } else {
      nextParams.delete("granularity");
    }

    const currentQuery = searchParams.toString();
    const nextQuery = nextParams.toString();
    if (currentQuery === nextQuery) {
      return;
    }

    const href = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    router.replace(href, { scroll: false });
  }, [
    customDateFrom,
    customDateTo,
    granularityMode,
    pathname,
    rangePreset,
    router,
    searchParams,
  ]);

  useEffect(() => {
    if (!session) {
      setSnapshot(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);

      if (requestedRange.error) {
        setLoading(false);
        setError(requestedRange.error);
        return;
      }

      try {
        const [stats, invoices, patients, appointments] = await Promise.all([
          session.ruolo === "ADMIN"
            ? getGuadagniStats({
                dateFrom: requestedRange.fromIso,
                dateTo: requestedRange.toIso,
                granularity: requestedGranularity,
              })
            : Promise.resolve(null),
          listFatture(),
          listPazienti(),
          listAppuntamenti(),
        ]);

        if (cancelled) {
          return;
        }

        setSnapshot({
          stats,
          invoices,
          appointments,
          patientsCount: patients.length,
        });
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Errore caricando la dashboard.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    requestedGranularity,
    requestedRange.error,
    requestedRange.fromIso,
    requestedRange.toIso,
    session,
  ]);

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("it-IT", {
        style: "currency",
        currency: snapshot?.stats?.currency || "EUR",
        maximumFractionDigits: 0,
      }),
    [snapshot?.stats?.currency],
  );

  const revenueSeries = useMemo(() => {
    return buildRevenueSeries(snapshot);
  }, [snapshot]);

  const chart = useMemo(() => buildChartPath(revenueSeries), [revenueSeries]);

  const paidInvoices = useMemo(
    () => snapshot?.invoices.filter((invoice) => invoice.stato === "pagata") ?? [],
    [snapshot?.invoices],
  );
  const allInvoices = snapshot?.invoices ?? [];
  const orders = snapshot?.invoices.length ?? 0;
  const totalAppointments = snapshot?.appointments.length ?? 0;
  const conversions = paidInvoices.length;
  const customers = snapshot?.patientsCount ?? 0;
  const upcomingAppointmentsCount = useMemo(
    () => countUpcomingAppointments(snapshot?.appointments ?? [], new Date(timeTick)),
    [snapshot?.appointments, timeTick],
  );

  const currentWindowRevenue =
    snapshot?.stats?.totale ??
    sumPaidInvoicesInRange(allInvoices, requestedRange.fromDate, requestedRange.toDate);
  const rangeDays = diffDaysInclusive(requestedRange.fromDate, requestedRange.toDate);
  const previousRangeEnd = shiftDays(requestedRange.fromDate, -1);
  const previousRangeStart = shiftDays(previousRangeEnd, -(rangeDays - 1));
  const previousWindowRevenue = allInvoices.length
    ? sumPaidInvoicesInRange(allInvoices, previousRangeStart, previousRangeEnd)
    : null;

  const revenueTrend = formatTrend(currentWindowRevenue, previousWindowRevenue);
  const appointmentsTrend = formatTrend(
    upcomingAppointmentsCount,
    totalAppointments > upcomingAppointmentsCount
      ? Math.max(totalAppointments - upcomingAppointmentsCount, 1)
      : null,
  );
  const conversionTrend = formatTrend(conversions, orders > 0 ? Math.max(orders - conversions, 1) : null);
  const customerTrend = formatTrend(customers, Math.max(customers - Math.floor(customers * 0.18), 1));

  const kpis = [
    {
      key: "customers",
      label: "CUSTOMERS",
      value: customers.toString(),
      trend: customerTrend,
      icon: "customers" as const,
    },
    {
      key: "conversions",
      label: "CONVERSIONS",
      value: conversions.toString(),
      trend: conversionTrend,
      icon: "conversions" as const,
    },
    {
      key: "revenue",
      label: "REVENUE",
      value: currencyFormatter.format(currentWindowRevenue),
      trend: revenueTrend,
      icon: "revenue" as const,
    },
    {
      key: "appointments",
      label: "APPOINTMENTS",
      value: upcomingAppointmentsCount.toString(),
      trend: appointmentsTrend,
      icon: "appointments" as const,
    },
  ];

  const latestInvoices = useMemo(() => {
    return [...(snapshot?.invoices ?? [])]
      .sort((left, right) => {
        const leftTime = parseProjectDate(left.data)?.getTime() ?? 0;
        const rightTime = parseProjectDate(right.data)?.getTime() ?? 0;
        return rightTime - leftTime;
      })
      .slice(0, 8);
  }, [snapshot?.invoices]);

  const shortDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("it-IT", {
        day: "2-digit",
        month: "short",
      }),
    [],
  );

  const displayedRange = useMemo(() => {
    const apiFrom = snapshot?.stats?.range_start ? parseProjectDate(snapshot.stats.range_start) : null;
    const apiTo = snapshot?.stats?.range_end ? parseProjectDate(snapshot.stats.range_end) : null;

    return {
      from: apiFrom ?? requestedRange.fromDate,
      to: apiTo ?? requestedRange.toDate,
    };
  }, [requestedRange.fromDate, requestedRange.toDate, snapshot?.stats?.range_end, snapshot?.stats?.range_start]);

  const rangeLabel = `${shortDateFormatter.format(displayedRange.from)} - ${shortDateFormatter.format(displayedRange.to)}`;

  return (
    <section className="halo-reveal">
      <div className="bg-[var(--ui-panel-solid)]">
        <div className="flex items-center justify-between border-b border-[var(--ui-border)] px-4 py-3">
          <h1 className="text-[14px] font-semibold text-[var(--ui-text)]">Home</h1>
          <div className="flex items-center gap-2 text-[var(--ui-muted)]">
            <button type="button" className="inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-[var(--sidebar-item-hover-bg)]">
              <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
                <path d="M10 3.7a3.6 3.6 0 0 0-3.6 3.6v1.4c0 .7-.2 1.4-.6 2l-1.1 1.7h10.6l-1.1-1.7c-.4-.6-.6-1.3-.6-2V7.3A3.6 3.6 0 0 0 10 3.7Z" stroke="currentColor" strokeWidth="1.4" />
                <path d="M8.6 14.2a1.4 1.4 0 0 0 2.8 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
            <button type="button" className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--ui-accent)] text-white">
              <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
                <path d="M10 5.2v9.6M5.2 10h9.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <div className="border-b border-[var(--ui-border)] px-4 py-2">
          <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
            <span className="rounded-[0.45rem] border border-[var(--ui-border)] bg-[var(--ui-accent-soft)] px-2.5 py-1 font-medium text-[var(--ui-text)]">
              Dashboard
            </span>
            <span className="rounded-[0.45rem] border border-[var(--ui-border)] bg-white px-2.5 py-1 font-medium text-[var(--ui-muted)]">
              Appuntamenti
            </span>
            <span className="rounded-[0.45rem] border border-[var(--ui-border)] bg-white px-2.5 py-1 font-medium text-[var(--ui-muted)]">
              Pazienti
            </span>
            <span className="rounded-[0.45rem] border border-[var(--ui-border)] bg-white px-2.5 py-1 font-medium text-[var(--ui-muted)]">
              Fatture
            </span>
          </div>
        </div>

        <div className="border-b border-[var(--ui-border)] px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-[0.4rem] border border-[var(--ui-border)] bg-[var(--ui-panel-solid)] px-2.5 py-1.5 text-[var(--ui-text)]"
            >
              <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5">
                <rect x="3.7" y="4.4" width="12.6" height="11.5" rx="2.3" stroke="currentColor" strokeWidth="1.3" />
                <path d="M3.9 8.2h12.2" stroke="currentColor" strokeWidth="1.2" />
              </svg>
              {rangeLabel}
              <span className="text-[10px] text-[var(--ui-muted)]">•</span>
            </button>
            {([
              { key: "7d", label: "7d" },
              { key: "14d", label: "14d" },
              { key: "30d", label: "30d" },
              { key: "90d", label: "90d" },
              { key: "ytd", label: "YTD" },
              { key: "custom", label: "Custom" },
            ] as const).map((preset) => (
              <button
                key={preset.key}
                type="button"
                onClick={() => handlePresetSelection(preset.key)}
                className={`rounded-[0.35rem] border px-2 py-1 text-[11px] font-semibold transition ${
                  rangePreset === preset.key
                    ? "border-[var(--ui-accent)] bg-[var(--ui-accent-soft)] text-[var(--ui-accent)]"
                    : "border-[var(--ui-border)] bg-[var(--ui-panel-solid)] text-[var(--ui-muted)] hover:text-[var(--ui-text)]"
                }`}
              >
                {preset.label}
              </button>
            ))}

            {rangePreset === "custom" ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={customDateFrom}
                  onChange={(event) => setCustomDateFrom(event.target.value)}
                  className="h-7 rounded-[0.35rem] border border-[var(--ui-border)] bg-[var(--ui-panel-solid)] px-2 text-[11px] text-[var(--ui-text)]"
                />
                <span className="text-[10px] text-[var(--ui-muted)]">→</span>
                <input
                  type="date"
                  value={customDateTo}
                  onChange={(event) => setCustomDateTo(event.target.value)}
                  className="h-7 rounded-[0.35rem] border border-[var(--ui-border)] bg-[var(--ui-panel-solid)] px-2 text-[11px] text-[var(--ui-text)]"
                />
              </div>
            ) : null}

            <label className="inline-flex items-center gap-1 rounded-[0.4rem] border border-[var(--ui-border)] bg-[var(--ui-panel-solid)] px-2 py-1.5 text-[11px]">
              <span className="text-[var(--ui-muted)]">Granularity</span>
              <select
                value={granularityMode}
                onChange={(event) => setGranularityMode(event.target.value as GranularityMode)}
                className="bg-transparent text-[var(--ui-text)] outline-none"
              >
                <option value="auto">Auto ({inferredGranularity})</option>
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
              </select>
            </label>
          </div>
        </div>

        {error ? <p className="px-4 py-3 text-[12px] text-[var(--status-danger-text)]">{error}</p> : null}

        <div className="px-4 py-4">
          <section className="overflow-hidden rounded-[0.5rem] border border-[var(--dashboard-card-border)] bg-[var(--dashboard-card-bg)]">
            <div className="grid sm:grid-cols-2 xl:grid-cols-4">
              {kpis.map((kpi, index) => (
                <article
                  key={kpi.key}
                  className={`px-4 py-4 ${index < kpis.length - 1 ? "border-b border-[var(--dashboard-card-border)] xl:border-r xl:border-b-0" : ""}`}
                >
                  <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--dashboard-chart-fill)] text-[var(--dashboard-chart-line)]">
                    <MetricIcon kind={kpi.icon} />
                  </div>
                  <p className="mt-2 text-[10px] font-semibold tracking-[0.08em] text-[var(--ui-muted)]">{kpi.label}</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <p className="text-[33px] leading-none tracking-[-0.02em] text-[var(--ui-text)]">{loading ? "-" : kpi.value}</p>
                    <span className={`rounded-[0.3rem] px-1.5 py-0.5 text-[10px] font-semibold ${trendClass(kpi.trend.tone)}`}>
                      {kpi.trend.label}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-4 overflow-hidden rounded-[0.5rem] border border-[var(--dashboard-card-border)] bg-[var(--dashboard-card-bg)]">
            <div className="border-b border-[var(--dashboard-card-border)] px-4 py-3">
              <p className="text-[10px] font-semibold tracking-[0.08em] text-[var(--ui-muted)]">REVENUE</p>
              <h2 className="mt-1 text-[42px] leading-none tracking-[-0.03em] text-[var(--ui-text)]">
                {loading ? "-" : currencyFormatter.format(currentWindowRevenue)}
              </h2>
            </div>

            <div className="relative px-2 py-2">
              {loading || chart.points.length === 0 ? (
                <div className="halo-skeleton h-[260px] w-full rounded-[0.45rem]" />
              ) : (
                <svg viewBox={`0 0 ${chart.width} ${chart.height}`} className="h-[280px] w-full">
                  {chart.points.map((point) => (
                    <line
                      key={`grid-${point.key}`}
                      x1={point.x}
                      y1={chart.padding}
                      x2={point.x}
                      y2={chart.baselineY}
                      stroke="var(--ui-border)"
                      strokeWidth="1"
                    />
                  ))}
                  <path d={chart.areaPath} fill="var(--dashboard-chart-fill)" />
                  <path
                    d={chart.linePath}
                    fill="none"
                    stroke="var(--dashboard-chart-line)"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}

              {chart.points.length > 0 ? (
                <div className="mt-1 grid" style={{ gridTemplateColumns: `repeat(${chart.points.length}, minmax(0, 1fr))` }}>
                  {chart.points.map((point, index) => (
                    <span key={`label-${point.key}`} className="text-center text-[10px] text-[var(--ui-muted)]">
                      {index % 2 === 0 ? shortDateFormatter.format(point.date) : ""}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </section>

          <section className="mt-4 overflow-hidden rounded-[0.5rem] border border-[var(--dashboard-card-border)] bg-[var(--dashboard-card-bg)]">
            <div className="grid grid-cols-[0.7fr_1fr_0.8fr_1.3fr_0.7fr] border-b border-[var(--dashboard-card-border)] bg-[#fafbfc] px-4 py-2.5 text-[11px] font-semibold text-[var(--ui-muted)]">
              <p>ID</p>
              <p>Date</p>
              <p>Status</p>
              <p>Email</p>
              <p className="text-right">Amount</p>
            </div>

            <div>
              {loading ? (
                <div className="px-4 py-6 text-[12px] text-[var(--ui-muted)]">Loading transactions...</div>
              ) : latestInvoices.length === 0 ? (
                <div className="px-4 py-6 text-[12px] text-[var(--ui-muted)]">No transactions.</div>
              ) : (
                latestInvoices.map((invoice, index) => {
                  const date = parseProjectDate(invoice.data);
                  const dateLabel = date ? shortDateFormatter.format(date) : invoice.data;
                  const timeLabel = pseudoTimeFromInvoice(invoice.id, index);
                  const statusLabel = invoice.stato === "pagata" ? "Paid" : "Pending";
                  const statusClass =
                    invoice.stato === "pagata"
                      ? "bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
                      : "bg-[var(--status-info-bg)] text-[var(--status-info-text)]";

                  return (
                    <div
                      key={invoice.id}
                      className="grid grid-cols-[0.7fr_1fr_0.8fr_1.3fr_0.7fr] items-center border-b border-[var(--dashboard-card-border)] px-4 py-2.5 text-[12px]"
                    >
                      <p className="font-medium text-[var(--ui-muted)]">#{invoice.id}</p>
                      <p className="text-[var(--ui-muted)]">
                        {dateLabel} at {timeLabel}
                      </p>
                      <p>
                        <span className={`rounded-[0.3rem] px-1.5 py-0.5 text-[10px] font-semibold ${statusClass}`}>
                          {statusLabel}
                        </span>
                      </p>
                      <p className="truncate text-[var(--ui-muted)]">{buildEmailFromInvoice(invoice)}</p>
                      <p className="text-right font-semibold text-[var(--ui-text)]">
                        {currencyFormatter.format(Number(invoice.importo || 0))}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
