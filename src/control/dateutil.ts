/**
 * Deterministic calendar helpers for the modelling-day date picker.
 *
 * Pure + deterministic: no Date.now, no Math.random, no timezone reads. We parse
 * explicit Y-M-D values only, so the same date always yields the same result —
 * this is what lets the live agent read demand back and confirm it.
 */

const MONTHS_3 = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];
const MONTH_LABEL = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const WEEKDAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

const CUM_DAYS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

/** Day of year, 1-based (1 Jan = 1). month is 1-based. */
export function dayOfYear(y: number, month: number, day: number): number {
  let doy = CUM_DAYS[month - 1] + day;
  if (month > 2 && isLeap(y)) doy += 1;
  return doy;
}

export function yearLength(y: number): number {
  return isLeap(y) ? 366 : 365;
}

/** Sakamoto's algorithm — 0 = Sunday. Deterministic, no Date object. */
export function weekday(y: number, m: number, d: number): number {
  const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const yy = m < 3 ? y - 1 : y;
  return (yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) + t[m - 1] + d) % 7;
}

/** Parse an ISO "YYYY-MM-DD" into [y, m, d]; returns null if malformed. */
export function parseISO(iso: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** "2026-08-01" → "Sat 1 Aug 2026". */
export function formatISO(iso: string): string {
  const p = parseISO(iso);
  if (!p) return iso;
  const [y, m, d] = p;
  return `${WEEKDAY_LABEL[weekday(y, m, d)]} ${d} ${MONTH_LABEL[m - 1]} ${y}`;
}

/**
 * Parse a day_type's free-text date ("Sat 1 Aug", "Wed 27 May") into a day of
 * year for the given calendar year. Weekday prefix is ignored; we only need the
 * day + month. Returns null if no day/month can be read.
 */
export function anchorDayOfYear(dateText: string, year: number): number | null {
  const m = /(\d{1,2})\s*([A-Za-z]{3,})/.exec(dateText);
  if (!m) return null;
  const day = Number(m[1]);
  const mon = MONTHS_3.indexOf(m[2].slice(0, 3).toLowerCase());
  if (mon < 0) return null;
  return dayOfYear(year, mon + 1, day);
}

type Anchor = { doy: number; demand: number };

/**
 * Estimate the modelled demand % for a calendar date by interpolating the DPM's
 * own day_type anchors (each has a date + demand_pct) across the year, wrapping
 * around the Dec→Jan boundary. Fully payload-driven — no city demand is invented
 * here, we only blend the values Ollie's DPM provided.
 */
export function demandForISO(
  iso: string,
  dayTypes: { date: string; demand_pct: number }[],
): number | null {
  const p = parseISO(iso);
  if (!p) return null;
  const [y, mo, d] = p;
  const target = dayOfYear(y, mo, d);
  const len = yearLength(y);

  const anchors: Anchor[] = dayTypes
    .map((dt) => {
      const doy = anchorDayOfYear(dt.date, y);
      return doy == null ? null : { doy, demand: dt.demand_pct };
    })
    .filter((a): a is Anchor => a != null)
    .sort((a, b) => a.doy - b.doy);

  if (anchors.length === 0) return 100;
  if (anchors.length === 1) return anchors[0].demand;

  // Exact anchor hit.
  for (const a of anchors) if (a.doy === target) return a.demand;

  // Nearest anchor below / above the target (within the year).
  let lower: Anchor | null = null;
  let upper: Anchor | null = null;
  for (const a of anchors) if (a.doy <= target) lower = a;
  for (let i = anchors.length - 1; i >= 0; i--) {
    if (anchors[i].doy >= target) upper = anchors[i];
  }
  // Wrap across the year boundary when the target sits outside the anchor span.
  if (!lower) {
    const last = anchors[anchors.length - 1];
    lower = { doy: last.doy - len, demand: last.demand };
    upper = anchors[0];
  }
  if (!upper) {
    const first = anchors[0];
    upper = { doy: first.doy + len, demand: first.demand };
    lower = anchors[anchors.length - 1];
  }
  if (lower.doy === upper.doy) return lower.demand;
  const t = (target - lower.doy) / (upper.doy - lower.doy);
  return Math.round(lower.demand + (upper.demand - lower.demand) * t);
}
