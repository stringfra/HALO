"use client";

import { useMemo } from "react";
import {
  formatDateToDmy,
  formatDateToIso,
  parseProjectDate,
} from "@/lib/date-utils";

type ProjectDateFieldProps = {
  label: string;
  value: string;
  required?: boolean;
  showValuePreview?: boolean;
  onChange: (nextValue: string) => void;
};

function dmyToIso(value: string) {
  const parsed = parseProjectDate(value);
  if (!parsed) {
    return "";
  }
  return formatDateToIso(parsed);
}

export function ProjectDateField({
  label,
  value,
  required = false,
  showValuePreview = true,
  onChange,
}: ProjectDateFieldProps) {
  const isoValue = useMemo(() => dmyToIso(value), [value]);

  function handleDatePickerChange(nextIsoValue: string) {
    const parsed = parseProjectDate(nextIsoValue);
    if (!parsed) {
      return;
    }
    onChange(formatDateToDmy(parsed));
  }

  function setTodayDate() {
    onChange(formatDateToDmy(new Date()));
  }

  return (
    <div className="grid gap-1.5 text-sm">
      <label className="grid gap-1">
        <span className="font-medium">
          {label}
          {required ? " *" : ""}
        </span>
        <input
          type="date"
          value={isoValue}
          onChange={(event) => handleDatePickerChange(event.target.value)}
          className="halo-input w-full sm:w-[220px]"
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={setTodayDate}
          className="halo-btn-primary px-3 py-1.5 text-xs"
        >
          Oggi
        </button>
        {showValuePreview && (
          <span className="text-xs text-[var(--ui-muted)]">{value}</span>
        )}
      </div>
    </div>
  );
}
