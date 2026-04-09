/* eslint-disable @typescript-eslint/no-require-imports */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");
}

test("stats API forwards range and granularity query params", () => {
  const source = read("src/features/dashboard/api.ts");

  assert.match(source, /searchParams\.set\("date_from", query\.dateFrom\)/);
  assert.match(source, /searchParams\.set\("date_to", query\.dateTo\)/);
  assert.match(source, /searchParams\.set\("granularity", query\.granularity\)/);
});

test("dashboard keeps upcoming appointments KPI based on future pending/confirmed records", () => {
  const source = read("src/app/dashboard/page.tsx");

  assert.match(source, /function countUpcomingAppointments\(/);
  assert.match(source, /new Set<BackendAppointment\["stato"\]>\(\[/);
  assert.match(source, /"in_attesa"/);
  assert.match(source, /"confermato"/);
  assert.match(source, /appointmentStamp >= nowRomeStamp/);
  assert.match(source, /timeZone: "Europe\/Rome"/);
});

test("dashboard computes revenue trend using previous window with equal length", () => {
  const source = read("src/app/dashboard/page.tsx");

  assert.match(source, /function sumPaidInvoicesInRange\(/);
  assert.match(source, /const rangeDays = diffDaysInclusive\(requestedRange\.fromDate, requestedRange\.toDate\)/);
  assert.match(source, /const previousRangeEnd = shiftDays\(requestedRange\.fromDate, -1\)/);
  assert.match(source, /const previousRangeStart = shiftDays\(previousRangeEnd, -\(rangeDays - 1\)\)/);
  assert.match(source, /sumPaidInvoicesInRange\(allInvoices, previousRangeStart, previousRangeEnd\)/);
});

test("dashboard refreshes temporal KPI snapshot periodically", () => {
  const source = read("src/app/dashboard/page.tsx");

  assert.match(source, /window\.setInterval\(\(\) => \{/);
  assert.match(source, /setTimeTick\(Date\.now\(\)\)/);
  assert.match(source, /30_000/);
});

test("dashboard syncs range filters with URL querystring", () => {
  const source = read("src/app/dashboard/page.tsx");

  assert.match(source, /usePathname, useRouter, useSearchParams/);
  assert.match(source, /nextParams\.set\("range", rangePreset\)/);
  assert.match(source, /if \(rangePreset === "custom" && customDateFrom && customDateTo\)/);
  assert.match(source, /nextParams\.delete\("from"\)/);
  assert.match(source, /nextParams\.delete\("to"\)/);
  assert.match(source, /nextParams\.set\("granularity", granularityMode\)/);
  assert.match(source, /nextParams\.delete\("granularity"\)/);
  assert.match(source, /router\.replace\(href, \{ scroll: false \}\)/);
});

test("custom preset pre-fills missing from/to dates from current range", () => {
  const source = read("src/app/dashboard/page.tsx");

  assert.match(source, /const handlePresetSelection = \(preset: RangePreset\) => \{/);
  assert.match(source, /if \(preset === "custom"\)/);
  assert.match(source, /if \(!customDateFrom\)/);
  assert.match(source, /setCustomDateFrom\(requestedRange\.fromIso\)/);
  assert.match(source, /if \(!customDateTo\)/);
  assert.match(source, /setCustomDateTo\(requestedRange\.toIso\)/);
  assert.match(source, /onClick=\{\(\) => handlePresetSelection\(preset\.key\)\}/);
});

test("custom URL mode remains custom even when one date is missing", () => {
  const source = read("src/app/dashboard/page.tsx");

  assert.doesNotMatch(source, /rangePreset = "30d"/);
  assert.match(source, /const rangePreset = parseRangePreset\(searchParams\.get\("range"\)\)/);
});
