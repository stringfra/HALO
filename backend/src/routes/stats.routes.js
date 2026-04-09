const express = require("express");
const { calcolaGuadagni } = require("../services/stats.service");
const { verifyToken, requirePermission } = require("../../middlewares/authMiddleware");
const { requireFeature } = require("../middleware/feature-flags");

const router = express.Router();
const ALLOWED_GRANULARITIES = new Set(["day", "week", "month"]);

class StatsQueryValidationError extends Error {}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function diffDaysInclusive(fromDate, toDate) {
  const fromMidnight = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  const toMidnight = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
  const delta = toMidnight.getTime() - fromMidnight.getTime();
  return Math.floor(delta / (24 * 60 * 60 * 1000)) + 1;
}

function resolveStatsQuery(query = {}, referenceDate = new Date()) {
  const rawFrom = typeof query.date_from === "string" ? query.date_from.trim() : "";
  const rawTo = typeof query.date_to === "string" ? query.date_to.trim() : "";
  const rawGranularity =
    typeof query.granularity === "string" ? query.granularity.trim().toLowerCase() : "";

  if ((rawFrom && !rawTo) || (!rawFrom && rawTo)) {
    throw new StatsQueryValidationError(
      "Intervallo non valido: usare insieme date_from e date_to.",
    );
  }

  const defaultTo = new Date(referenceDate);
  const defaultFrom = addDays(defaultTo, -29);

  const fromDate = rawFrom ? parseIsoDate(rawFrom) : defaultFrom;
  const toDate = rawTo ? parseIsoDate(rawTo) : defaultTo;

  if (!fromDate || !toDate) {
    throw new StatsQueryValidationError(
      "Formato data non valido. Usare YYYY-MM-DD per date_from/date_to.",
    );
  }

  if (fromDate.getTime() > toDate.getTime()) {
    throw new StatsQueryValidationError("Intervallo non valido: date_from deve essere <= date_to.");
  }

  const days = diffDaysInclusive(fromDate, toDate);
  if (days > 365) {
    throw new StatsQueryValidationError(
      "Intervallo troppo ampio: massimo 365 giorni.",
    );
  }

  const inferredGranularity = days <= 90 ? "day" : "week";
  const granularity = rawGranularity || inferredGranularity;
  if (!ALLOWED_GRANULARITIES.has(granularity)) {
    throw new StatsQueryValidationError(
      "Granularita non valida. Valori ammessi: day, week, month.",
    );
  }

  return {
    rangeFrom: toIsoDate(fromDate),
    rangeTo: toIsoDate(toDate),
    granularity,
    referenceDate: toDate,
  };
}

router.use(verifyToken);
router.use(requireFeature("reports.enabled"));

router.get("/guadagni", requirePermission("reports.read"), async (req, res) => {
  try {
    const studioId = Number(req.user?.studio_id);
    const queryParams = resolveStatsQuery(req.query, new Date());
    const stats = await calcolaGuadagni({
      referenceDate: queryParams.referenceDate,
      studioId,
      rangeFrom: queryParams.rangeFrom,
      rangeTo: queryParams.rangeTo,
      granularity: queryParams.granularity,
    });

    return res.status(200).json({
      ...stats,
      currency: "EUR",
    });
  } catch (error) {
    if (error instanceof StatsQueryValidationError) {
      return res.status(400).json({
        message: error.message,
      });
    }

    return res.status(500).json({
      message: "Errore nel calcolo statistiche guadagni.",
      detail: error.message,
    });
  }
});

module.exports = router;
