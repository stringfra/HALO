function pad2(value: number) {
  return String(value).padStart(2, "0");
}

export function formatDateToIso(date: Date) {
  const day = pad2(date.getDate());
  const month = pad2(date.getMonth() + 1);
  const year = date.getFullYear();

  return `${year}-${month}-${day}`;
}

export function formatDateToDmy(date: Date) {
  const day = pad2(date.getDate());
  const month = pad2(date.getMonth() + 1);
  const year = date.getFullYear();

  return `${day} ${month} ${year}`;
}

export function parseProjectDate(value: string) {
  const normalized = value.trim();

  const dmyMatch = normalized.match(/^(\d{2})\s(\d{2})\s(\d{4})$/);
  if (dmyMatch) {
    const day = Number.parseInt(dmyMatch[1], 10);
    const month = Number.parseInt(dmyMatch[2], 10);
    const year = Number.parseInt(dmyMatch[3], 10);
    const candidate = new Date(year, month - 1, day);

    if (
      candidate.getFullYear() === year &&
      candidate.getMonth() === month - 1 &&
      candidate.getDate() === day
    ) {
      return candidate;
    }
  }

  const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = Number.parseInt(isoMatch[1], 10);
    const month = Number.parseInt(isoMatch[2], 10);
    const day = Number.parseInt(isoMatch[3], 10);
    const candidate = new Date(year, month - 1, day);

    if (
      candidate.getFullYear() === year &&
      candidate.getMonth() === month - 1 &&
      candidate.getDate() === day
    ) {
      return candidate;
    }
  }

  return null;
}

export function getProjectMonthKey(value: string) {
  const date = parseProjectDate(value);
  if (!date) {
    return null;
  }

  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}
