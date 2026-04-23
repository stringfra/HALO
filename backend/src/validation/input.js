function hasOnlyKeys(body, allowedKeys) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return false;
  }

  const allowed = new Set(allowedKeys);
  return Object.keys(body).every((key) => allowed.has(key));
}

function parseIntegerLike(value) {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    if (!/^-?\d+$/.test(normalized)) {
      return null;
    }
    const parsed = Number.parseInt(normalized, 10);
    return Number.isInteger(parsed) ? parsed : null;
  }

  return null;
}

function parsePositiveInt(value, { max = 2147483647 } = {}) {
  const parsed = parseIntegerLike(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > max) {
    return null;
  }
  return parsed;
}

function parseNonNegativeInt(value, { max = 2147483647 } = {}) {
  const parsed = parseIntegerLike(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > max) {
    return null;
  }
  return parsed;
}

function parsePositiveAmount(value, { max = 99999999 } = {}) {
  let numeric = null;
  if (typeof value === "number") {
    numeric = Number.isFinite(value) ? value : null;
  } else if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
      return null;
    }
    numeric = Number(normalized);
  }

  if (!Number.isFinite(numeric) || numeric <= 0 || numeric > max) {
    return null;
  }
  return Number(numeric.toFixed(2));
}

function normalizeRequiredText(value, { min = 1, max = 255 } = {}) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < min || normalized.length > max) {
    return null;
  }

  return normalized;
}

function normalizeOptionalText(value, { max = 255, multiline = false } = {}) {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    return null;
  }

  const normalized = multiline
    ? value.trim().replace(/\r\n/g, "\n")
    : value.trim().replace(/\s+/g, " ");

  if (normalized.length === 0) {
    return null;
  }
  if (normalized.length > max) {
    return null;
  }

  return normalized;
}

function isValidEmail(value) {
  if (typeof value !== "string" || value.length > 255) {
    return false;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeEmailIdentity(value) {
  const normalized = normalizeRequiredText(value, { min: 6, max: 255 });
  if (!normalized || !isValidEmail(normalized)) {
    return null;
  }

  return normalized.toLowerCase();
}

function isValidPhone(value) {
  if (typeof value !== "string") {
    return false;
  }
  return /^[+0-9()\-\s.]{6,30}$/.test(value.trim());
}

function isStrongPassword(value, { min = 8, max = 255 } = {}) {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    return false;
  }

  // At least 1 lowercase, 1 uppercase, 1 number and 1 special character, no spaces.
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])\S+$/.test(normalized);
}

function parseDateDmyOrIso(value, { allowIso = true } = {}) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();

  const dmyMatch = normalized.match(/^(\d{2})\s(\d{2})\s(\d{4})$/);
  if (dmyMatch) {
    const day = Number.parseInt(dmyMatch[1], 10);
    const month = Number.parseInt(dmyMatch[2], 10);
    const year = Number.parseInt(dmyMatch[3], 10);
    const candidate = new Date(Date.UTC(year, month - 1, day));
    const valid =
      candidate.getUTCFullYear() === year &&
      candidate.getUTCMonth() === month - 1 &&
      candidate.getUTCDate() === day;

    if (!valid) {
      return null;
    }
    return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
  }

  if (allowIso) {
    const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const year = Number.parseInt(isoMatch[1], 10);
      const month = Number.parseInt(isoMatch[2], 10);
      const day = Number.parseInt(isoMatch[3], 10);
      const candidate = new Date(Date.UTC(year, month - 1, day));
      const valid =
        candidate.getUTCFullYear() === year &&
        candidate.getUTCMonth() === month - 1 &&
        candidate.getUTCDate() === day;

      if (!valid) {
        return null;
      }
      return normalized;
    }
  }

  return null;
}

function parseTime(value) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  const match = normalized.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    return null;
  }

  const hh = Number.parseInt(match[1], 10);
  const mm = Number.parseInt(match[2], 10);
  const ss = match[3] ? Number.parseInt(match[3], 10) : 0;

  if (
    Number.isNaN(hh) ||
    Number.isNaN(mm) ||
    Number.isNaN(ss) ||
    hh < 0 ||
    hh > 23 ||
    mm < 0 ||
    mm > 59 ||
    ss < 0 ||
    ss > 59
  ) {
    return null;
  }

  if (match[3]) {
    return `${match[1]}:${match[2]}:${match[3]}`;
  }
  return `${match[1]}:${match[2]}`;
}

function parseEnum(value, allowedValues, { allowUndefined = false } = {}) {
  if (value === undefined) {
    return allowUndefined ? undefined : null;
  }
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  const allowed = allowedValues instanceof Set ? allowedValues : new Set(allowedValues);
  return allowed.has(normalized) ? normalized : null;
}

module.exports = {
  hasOnlyKeys,
  parsePositiveInt,
  parseNonNegativeInt,
  parsePositiveAmount,
  normalizeRequiredText,
  normalizeOptionalText,
  normalizeEmailIdentity,
  isValidEmail,
  isValidPhone,
  isStrongPassword,
  parseDateDmyOrIso,
  parseTime,
  parseEnum,
};
