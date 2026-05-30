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

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

const ORDINAL_WORDS: Record<string, number> = {
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7,
  eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13,
  fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18,
  nineteenth: 19, twentieth: 20, "twenty-first": 21, "twenty-second": 22,
  "twenty-third": 23, "twenty-fourth": 24, "twenty-fifth": 25, "twenty-sixth": 26,
  "twenty-seventh": 27, "twenty-eighth": 28, "twenty-ninth": 29, thirtieth: 30,
  "thirty-first": 31,
};

function pad2(n: number): string {
  return n < 10 ? "0" + n : String(n);
}

/**
 * Parse a spoken/typed date into ISO "YYYY-MM-DD", or null if no date is found.
 * Handles ISO ("2026-08-01"), "August 1", "1st of August", "model December 9th",
 * ordinal words ("August first"), and an optional 4-digit year (defaults to the
 * supplied modelling year). Deterministic — no Date object, no "today".
 */
export function parseSpokenDate(textRaw: string, defaultYear: number): string | null {
  const text = textRaw.toLowerCase();

  // ISO form first.
  const iso = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (iso) {
    const y = Number(iso[1]);
    const mo = Number(iso[2]);
    const d = Number(iso[3]);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return `${y}-${pad2(mo)}-${pad2(d)}`;
  }

  // Find a month name.
  let monthIdx = -1;
  for (let i = 0; i < MONTH_NAMES.length; i++) {
    const re = new RegExp(`\\b${MONTH_NAMES[i].slice(0, 3)}[a-z]*\\b`);
    if (re.test(text)) {
      monthIdx = i;
      break;
    }
  }
  if (monthIdx < 0) {
    // Numeric "1/8" or "8/1" not supported (ambiguous); only month-name dates.
    return null;
  }

  // Day number: digits ("1", "1st", "9th") near anywhere in the phrase.
  let day: number | null = null;
  const dnum = /\b(\d{1,2})(?:st|nd|rd|th)?\b/.exec(text);
  if (dnum) day = Number(dnum[1]);
  if (day == null) {
    for (const [word, n] of Object.entries(ORDINAL_WORDS)) {
      if (new RegExp(`\\b${word}\\b`).test(text)) {
        day = n;
        break;
      }
    }
  }
  if (day == null || day < 1 || day > 31) return null;

  // Optional explicit 4-digit year (anything that isn't the day).
  let year = defaultYear;
  const ynum = /\b(20\d{2})\b/.exec(text);
  if (ynum) year = Number(ynum[1]);

  return `${year}-${pad2(monthIdx + 1)}-${pad2(day)}`;
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

export type DemandExplain = {
  demand: number;
  exact: boolean;
  // The two DPM anchors the value was blended between (label = date text).
  lower: { label: string; demand: number; daysAway: number } | null;
  upper: { label: string; demand: number; daysAway: number } | null;
  weightUpper: number; // 0..1 — how far toward the upper anchor
};

/**
 * Like demandForISO, but returns HOW the figure was derived: which two DPM
 * day_type anchors it sits between and the blend weight. This is what powers the
 * analyst agent's truthful "why is this date's demand N%?" answers — the number
 * is never invented, it's interpolated from Ollie's anchors.
 */
export function explainDemandForISO(
  iso: string,
  dayTypes: { label?: string; date: string; demand_pct: number }[],
): DemandExplain | null {
  const p = parseISO(iso);
  if (!p) return null;
  const [y, mo, d] = p;
  const target = dayOfYear(y, mo, d);
  const len = yearLength(y);

  const anchors = dayTypes
    .map((dt) => {
      const doy = anchorDayOfYear(dt.date, y);
      return doy == null ? null : { doy, demand: dt.demand_pct, label: dt.label || dt.date };
    })
    .filter((a): a is { doy: number; demand: number; label: string } => a != null)
    .sort((a, b) => a.doy - b.doy);

  if (anchors.length === 0) return { demand: 100, exact: false, lower: null, upper: null, weightUpper: 0 };

  for (const a of anchors) {
    if (a.doy === target) {
      return {
        demand: a.demand,
        exact: true,
        lower: { label: a.label, demand: a.demand, daysAway: 0 },
        upper: { label: a.label, demand: a.demand, daysAway: 0 },
        weightUpper: 0,
      };
    }
  }

  let lower: typeof anchors[number] | null = null;
  let upper: typeof anchors[number] | null = null;
  for (const a of anchors) if (a.doy <= target) lower = a;
  for (let i = anchors.length - 1; i >= 0; i--) if (anchors[i].doy >= target) upper = anchors[i];

  let lowDoy: number;
  let upDoy: number;
  if (!lower) {
    const last = anchors[anchors.length - 1];
    lower = last;
    lowDoy = last.doy - len;
    upper = anchors[0];
    upDoy = upper.doy;
  } else if (!upper) {
    const first = anchors[0];
    upper = first;
    upDoy = first.doy + len;
    lowDoy = lower.doy;
  } else {
    lowDoy = lower.doy;
    upDoy = upper.doy;
  }

  const span = upDoy - lowDoy || 1;
  const t = (target - lowDoy) / span;
  const demand = Math.round(lower.demand + (upper.demand - lower.demand) * t);
  return {
    demand,
    exact: false,
    lower: { label: lower.label, demand: lower.demand, daysAway: Math.abs(target - lowDoy) },
    upper: { label: upper.label, demand: upper.demand, daysAway: Math.abs(upDoy - target) },
    weightUpper: t,
  };
}
