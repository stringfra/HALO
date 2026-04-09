const { pool } = require("../config/db");

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toMonthBounds(referenceDate) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();

  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);

  return {
    start: toIsoDate(start),
    end: toIsoDate(end),
  };
}

function parseIsoDate(value) {
  if (typeof value !== "string") {
    return null;
  }

  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const candidate = new Date(year, month - 1, day);

  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return null;
  }

  return candidate;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function resolveRangeBounds(rangeFrom, rangeTo, referenceDate = new Date()) {
  const ref = new Date(referenceDate);
  const fallbackEnd = toIsoDate(ref);
  const fallbackStart = toIsoDate(addDays(ref, -29));

  const fromDate = parseIsoDate(rangeFrom) ? rangeFrom : fallbackStart;
  const toDate = parseIsoDate(rangeTo) ? rangeTo : fallbackEnd;

  return {
    fromDate,
    toDate,
  };
}

async function sommaFatturePagate({ fromDate = null, toDate = null, studioId = null } = {}) {
  const result = await pool.query(
    `SELECT COALESCE(SUM(importo), 0)::numeric(12,2)::text AS totale
     FROM fatture
     WHERE stato = 'pagata'
       AND ($1::date IS NULL OR data >= $1::date)
       AND ($2::date IS NULL OR data <= $2::date)
       AND ($3::bigint IS NULL OR studio_id = $3::bigint)`,
    [fromDate, toDate, studioId],
  );

  return Number(result.rows[0].totale);
}

async function entrateUltimiGiorni(days = 30, studioId = null) {
  const safeDays = Math.max(1, Math.min(365, Number(days) || 30));
  const result = await pool.query(
    `WITH giorni AS (
       SELECT generate_series(
         CURRENT_DATE - ($1::int - 1),
         CURRENT_DATE,
         interval '1 day'
       )::date AS giorno
     )
     SELECT TO_CHAR(g.giorno, 'DD MM YYYY') AS data,
            COALESCE(SUM(f.importo), 0)::numeric(12,2)::text AS totale
     FROM giorni g
     LEFT JOIN fatture f
       ON f.data = g.giorno
      AND f.stato = 'pagata'
      AND ($2::bigint IS NULL OR f.studio_id = $2::bigint)
     GROUP BY g.giorno
     ORDER BY g.giorno`,
    [safeDays, studioId],
  );

  return result.rows.map((row) => ({
    data: row.data,
    totale: Number(row.totale),
  }));
}

async function entratePerIntervallo({
  fromDate,
  toDate,
  granularity = "day",
  studioId = null,
}) {
  const safeGranularity = String(granularity || "day").trim().toLowerCase();
  if (!["day", "week", "month"].includes(safeGranularity)) {
    throw new Error("Granularita non supportata.");
  }

  if (safeGranularity === "day") {
    const result = await pool.query(
      `WITH periodi AS (
         SELECT generate_series($1::date, $2::date, interval '1 day')::date AS period_start
       )
       SELECT TO_CHAR(p.period_start, 'DD MM YYYY') AS data,
              COALESCE(SUM(f.importo), 0)::numeric(12,2)::text AS totale
       FROM periodi p
       LEFT JOIN fatture f
         ON f.data = p.period_start
        AND f.stato = 'pagata'
        AND ($3::bigint IS NULL OR f.studio_id = $3::bigint)
       GROUP BY p.period_start
       ORDER BY p.period_start`,
      [fromDate, toDate, studioId],
    );

    return result.rows.map((row) => ({
      data: row.data,
      totale: Number(row.totale),
    }));
  }

  if (safeGranularity === "week") {
    const result = await pool.query(
      `WITH periodi AS (
         SELECT generate_series(
           date_trunc('week', $1::date)::date,
           date_trunc('week', $2::date)::date,
           interval '1 week'
         )::date AS period_start
       )
       SELECT TO_CHAR(p.period_start, 'DD MM YYYY') AS data,
              COALESCE(SUM(f.importo), 0)::numeric(12,2)::text AS totale
       FROM periodi p
       LEFT JOIN fatture f
         ON f.data >= p.period_start
        AND f.data < (p.period_start + interval '1 week')
        AND f.data >= $1::date
        AND f.data <= $2::date
        AND f.stato = 'pagata'
        AND ($3::bigint IS NULL OR f.studio_id = $3::bigint)
       GROUP BY p.period_start
       ORDER BY p.period_start`,
      [fromDate, toDate, studioId],
    );

    return result.rows.map((row) => ({
      data: row.data,
      totale: Number(row.totale),
    }));
  }

  const result = await pool.query(
    `WITH periodi AS (
       SELECT generate_series(
         date_trunc('month', $1::date)::date,
         date_trunc('month', $2::date)::date,
         interval '1 month'
       )::date AS period_start
     )
     SELECT TO_CHAR(p.period_start, 'DD MM YYYY') AS data,
            COALESCE(SUM(f.importo), 0)::numeric(12,2)::text AS totale
     FROM periodi p
     LEFT JOIN fatture f
       ON f.data >= p.period_start
      AND f.data < (date_trunc('month', p.period_start::timestamp) + interval '1 month')::date
      AND f.data >= $1::date
      AND f.data <= $2::date
      AND f.stato = 'pagata'
      AND ($3::bigint IS NULL OR f.studio_id = $3::bigint)
     GROUP BY p.period_start
     ORDER BY p.period_start`,
    [fromDate, toDate, studioId],
  );

  return result.rows.map((row) => ({
    data: row.data,
    totale: Number(row.totale),
  }));
}

async function calcolaGuadagni({
  referenceDate = new Date(),
  studioId = null,
  rangeFrom = null,
  rangeTo = null,
  granularity = "day",
} = {}) {
  const today = toIsoDate(referenceDate);
  const { start, end } = toMonthBounds(referenceDate);
  const { fromDate, toDate } = resolveRangeBounds(rangeFrom, rangeTo, referenceDate);

  const [giornaliero, mensile, totale, ultimi30Giorni] = await Promise.all([
    sommaFatturePagate({ fromDate: today, toDate: today, studioId }),
    sommaFatturePagate({ fromDate: start, toDate: end, studioId }),
    sommaFatturePagate({ studioId }),
    entratePerIntervallo({
      fromDate,
      toDate,
      granularity,
      studioId,
    }),
  ]);

  return {
    giornaliero,
    mensile,
    totale,
    ultimi30Giorni,
    range_start: fromDate,
    range_end: toDate,
    granularity,
    points_count: ultimi30Giorni.length,
  };
}

module.exports = {
  sommaFatturePagate,
  entrateUltimiGiorni,
  entratePerIntervallo,
  calcolaGuadagni,
};
