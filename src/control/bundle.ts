/**
 * DPM v2 CSV-bundle parser.
 *
 * Ollie's DPM now emits a four-CSV bundle per city/year (daily predictions,
 * monthly summary, shock scenarios, assumptions register) instead of a single
 * v1 JSON. This module is the pure parsing layer: it takes the raw file texts,
 * detects the bundle, parses each CSV into the additive State fields, validates,
 * and returns a structured BundleData. No DOM, no store access, no new deps —
 * a tiny hand-written CSV parser handles the quoted-comma fields ("5,880,000").
 *
 * state.loadBundle() consumes this and layers it onto a v1 base payload.
 */

import type {
  DailyRow,
  MonthlySummaryRow,
  Shock,
  Assumption,
} from "./state";

/* ─── tiny CSV parser (quoted fields with commas supported) ─────────────── */

/** Parse CSV text into rows of string cells. Handles double-quoted fields that
 *  contain commas and escaped "" quotes. Skips blank lines. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let sawField = false;
  const pushField = () => {
    row.push(field);
    field = "";
    sawField = true;
  };
  const pushRow = () => {
    pushField();
    // Drop fully-empty lines.
    if (!(row.length === 1 && row[0].trim() === "")) rows.push(row);
    row = [];
    sawField = false;
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      pushField();
    } else if (c === "\n") {
      pushRow();
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field !== "" || sawField || row.length) pushRow();
  return rows;
}

/** First numeric token in a string, commas stripped. "52,111 /day" → 52111,
 *  "1.1635 (4 Jun 2026)" → 1.1635, "-25" → -25, "58 / 100" → 58. NaN if none. */
function firstNum(s: string | undefined): number {
  if (s == null) return NaN;
  const m = String(s).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : NaN;
}

/** Header-indexed row reader: maps a header array to a {col → index} lookup so
 *  parsing is resilient to column reordering. */
function indexer(header: string[]): (name: string) => number {
  const map = new Map<string, number>();
  header.forEach((h, i) => map.set(h.trim().toLowerCase(), i));
  return (name: string) => map.get(name.trim().toLowerCase()) ?? -1;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* ─── bundle detection ──────────────────────────────────────────────────── */

const FILE_KEYS = {
  daily: /daily.*(prediction|dataset|data)/i,
  monthly: /monthly.*summary/i,
  shocks: /shock.*scenario/i,
  assumptions: /assumption/i,
};

/** First present column index among the given header names (-1 if none). Lets the
 *  parsers accept BOTH the v2 single-year format and the v3 five-year format. */
function col(ix: (n: string) => number, ...names: string[]): number {
  for (const n of names) {
    const i = ix(n);
    if (i >= 0) return i;
  }
  return -1;
}
function cell(c: string[], i: number): string {
  return i >= 0 ? c[i] ?? "" : "";
}

/** True when a set of filenames looks like the four-CSV DPM bundle (we peek at
 *  names, not content). Requires all four expected files. */
export function isBundleFilenames(names: string[]): boolean {
  const lower = names.map((n) => n.toLowerCase());
  return (
    lower.some((n) => FILE_KEYS.daily.test(n)) &&
    lower.some((n) => FILE_KEYS.monthly.test(n)) &&
    lower.some((n) => FILE_KEYS.shocks.test(n)) &&
    lower.some((n) => FILE_KEYS.assumptions.test(n))
  );
}

export type BundleData = {
  daily: DailyRow[];
  monthly_summary: MonthlySummaryRow[];
  monthly_total: MonthlySummaryRow | null;
  shocks: Shock[];
  assumptions: Assumption[];
  threshold: number;
  run_confidence?: number;
  eur_usd_rate?: number;
  growth_rate?: number;
  locked_cutoff?: string; // last confirmed-actual ISO date (5-year bundles)
};

type NamedFile = { name: string; text: string };

function pick(files: NamedFile[], re: RegExp): NamedFile | undefined {
  return files.find((f) => re.test(f.name.toLowerCase()));
}

/* ─── per-CSV parsers ───────────────────────────────────────────────────── */

function parseDaily(text: string): DailyRow[] {
  const rows = parseCSV(text);
  if (rows.length < 2) throw new Error("daily CSV has no data rows");
  const ix = indexer(rows[0]);
  const ci = {
    date: col(ix, "date"),
    dow: col(ix, "day_of_week", "day"),
    week: col(ix, "week_of_year", "week"),
    month: col(ix, "month_name", "month"),
    base: col(ix, "daily_visitors_overnight", "base_daily_visitors"),
    growth: col(ix, "growth_factor"),
    total: col(ix, "daily_visitors_total", "predicted_visitors_2027"),
    adjusted: col(ix, "adjusted_visitors", "daily_visitors_total"),
    shockPct: col(ix, "shock_pct"),
    event: col(ix, "major_event_name", "shock_label"),
    cpi: col(ix, "cpi"),
    notes: col(ix, "notes"),
    period: col(ix, "period_label"),
  };
  const out: DailyRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const c = rows[r];
    if (!cell(c, ci.date)) continue;
    out.push({
      date: cell(c, ci.date).trim(),
      dow: cell(c, ci.dow).trim(),
      week: firstNum(cell(c, ci.week)) || 0,
      month: cell(c, ci.month).trim(),
      base_visitors: firstNum(cell(c, ci.base)) || 0,
      growth_factor: ci.growth >= 0 ? firstNum(cell(c, ci.growth)) || 1 : 1,
      predicted_visitors: firstNum(cell(c, ci.total)) || 0,
      shock_pct: ci.shockPct >= 0 ? firstNum(cell(c, ci.shockPct)) || 0 : 0,
      shock_label: cell(c, ci.event).trim(),
      adjusted_visitors: firstNum(cell(c, ci.adjusted)) || 0,
      cpi: firstNum(cell(c, ci.cpi)) || 0,
      notes: cell(c, ci.notes).trim(),
      period_label: ci.period >= 0 ? cell(c, ci.period).trim() || undefined : undefined,
    });
  }
  return out;
}

function parseMonthly(text: string): { months: MonthlySummaryRow[]; total: MonthlySummaryRow | null } {
  const rows = parseCSV(text);
  const ix = indexer(rows[0]);
  const ci = {
    month: col(ix, "month_name", "month"),
    days: col(ix, "days"),
    total: col(ix, "total_visitors_predicted", "total_visitors"),
    avg: col(ix, "avg_daily_predicted", "avg_daily_visitors"),
    peak: col(ix, "peak_day_predicted", "peak_day_visitors"),
    min: col(ix, "min_day_predicted", "min_day_visitors"),
    breaches: col(ix, "capacity_breaches"),
    cpi: col(ix, "avg_adj_cpi", "avg_cpi"),
  };
  const months: MonthlySummaryRow[] = [];
  let total: MonthlySummaryRow | null = null;
  for (let r = 1; r < rows.length; r++) {
    const c = rows[r];
    const name = cell(c, ci.month).trim();
    if (!name) continue;
    const row: MonthlySummaryRow = {
      month: name,
      days: firstNum(cell(c, ci.days)) || 0,
      total_visitors: firstNum(cell(c, ci.total)) || 0,
      avg_daily: firstNum(cell(c, ci.avg)) || 0,
      peak_day: firstNum(cell(c, ci.peak)) || 0,
      min_day: firstNum(cell(c, ci.min)) || 0,
      breaches: firstNum(cell(c, ci.breaches)) || 0,
      avg_cpi: firstNum(cell(c, ci.cpi)) || 0,
    };
    // TOTAL row (v2 only) stays a separate flag, never a 13th month.
    if (name.toUpperCase() === "TOTAL") total = row;
    else months.push(row);
  }
  return { months, total };
}

function parseShocks(text: string): Shock[] {
  const rows = parseCSV(text);
  const ix = indexer(rows[0]);
  const ci = {
    label: col(ix, "scenario_name", "scenario"),
    dur: col(ix, "duration_days"),
    demand: col(ix, "demand_shock_pct"),
    lost: col(ix, "visitors_lost_est", "visitors_lost"),
    rev: col(ix, "revenue_impact_usd"),
    avg: col(ix, "avg_daily_during_shock"),
    cpi: col(ix, "cpi_during_shock"),
  };
  const out: Shock[] = [];
  for (let r = 1; r < rows.length; r++) {
    const c = rows[r];
    const label = cell(c, ci.label).trim();
    if (!label) continue;
    out.push({
      id: slug(label),
      label,
      duration_days: firstNum(cell(c, ci.dur)) || 0,
      demand_shock_pct: firstNum(cell(c, ci.demand)) || 0,
      // Signed exactly as Ollie reports: positive = visitors LOST (negative shock);
      // negative = visitors gained (surge). Preserve, do NOT flip.
      visitors_delta: firstNum(cell(c, ci.lost)) || 0,
      revenue_impact_usd: firstNum(cell(c, ci.rev)) || 0,
      avg_daily_during: firstNum(cell(c, ci.avg)) || 0,
      cpi_during: firstNum(cell(c, ci.cpi)) || 0,
    });
  }
  return out;
}

function parseAssumptions(text: string): Assumption[] {
  const rows = parseCSV(text);
  const ix = indexer(rows[0]);
  const ci = {
    param: col(ix, "parameter"),
    value: col(ix, "value"),
    source: col(ix, "source_citation", "source"),
    conf: col(ix, "confidence_0_100"),
  };
  const out: Assumption[] = [];
  for (let r = 1; r < rows.length; r++) {
    const c = rows[r];
    const param = cell(c, ci.param).trim();
    if (!param) continue;
    out.push({
      param,
      value: cell(c, ci.value).trim(),
      source: cell(c, ci.source).trim(),
      confidence: ci.conf >= 0 ? firstNum(cell(c, ci.conf)) || 0 : 0,
    });
  }
  return out;
}

function assumptionValue(rows: Assumption[], re: RegExp): string | undefined {
  return rows.find((a) => re.test(a.param))?.value;
}

/* ─── assemble + validate ───────────────────────────────────────────────── */

/**
 * Parse the four-CSV bundle into additive State fields and validate. Throws on
 * any validation failure so the caller can keep the previous state + red-toast.
 */
export function parseBundle(files: NamedFile[]): BundleData {
  const dailyF = pick(files, FILE_KEYS.daily);
  const monthlyF = pick(files, FILE_KEYS.monthly);
  const shocksF = pick(files, FILE_KEYS.shocks);
  const assumptionsF = pick(files, FILE_KEYS.assumptions);
  if (!dailyF || !monthlyF || !shocksF || !assumptionsF) {
    throw new Error("bundle is missing one of the four expected CSV files");
  }

  const daily = parseDaily(dailyF.text);
  const { months, total } = parseMonthly(monthlyF.text);
  const shocks = parseShocks(shocksF.text);
  const assumptions = parseAssumptions(assumptionsF.text);

  // Sustainable capacity threshold — v2 "Sustainable_Capacity_Threshold" or
  // v3 "Capacity_Sustainable_Daily".
  const threshold = firstNum(
    assumptionValue(assumptions, /sustainable_capacity_threshold|capacity_sustainable_daily/i),
  );
  // Run confidence — v2 "Overall_Run_Confidence" or v3 "Confidence_2027_projected".
  const run_confidence = firstNum(
    assumptionValue(assumptions, /overall_run_confidence|confidence_2027_projected/i),
  );
  const eur_usd_rate = firstNum(assumptionValue(assumptions, /eur_usd_rate/i));
  // Growth — v2 "Applied_Growth_Rate" ("2.0% per year" → ÷100) or v3
  // "Growth_Overnight_Annual" (0.025, already a fraction).
  const growthV3 = firstNum(assumptionValue(assumptions, /growth_overnight_annual/i));
  const growthPct = firstNum(assumptionValue(assumptions, /applied_growth_rate/i));
  const growth_rate = Number.isFinite(growthV3) && growthV3 > 0
    ? growthV3
    : Number.isFinite(growthPct) && growthPct > 0
      ? growthPct / 100
      : undefined;

  const isFiveYear = daily.length > 400; // 5-year bundles carry ~1827 rows

  /* validation */
  if (isFiveYear) {
    if (daily.length < 1820 || daily.length > 1835) {
      throw new Error(`5-year daily rows out of range: expected ~1827, got ${daily.length}`);
    }
  } else if (daily.length < 355 || daily.length > 375) {
    throw new Error(`daily rows out of range: expected 365 ±10, got ${daily.length}`);
  }
  // Daily-vs-monthly drift check only applies to single-year v2 bundles.
  if (!isFiveYear) {
    const adjSum = daily.reduce((a, d) => a + d.adjusted_visitors, 0);
    if (total && total.total_visitors > 0) {
      const drift = Math.abs(adjSum - total.total_visitors) / total.total_visitors;
      if (drift > 0.01) {
        throw new Error(`daily Adjusted_Visitors sum (${Math.round(adjSum)}) differs from Monthly TOTAL (${total.total_visitors}) by ${(drift * 100).toFixed(1)}% (>1%)`);
      }
    }
  }
  if (!(threshold > 0)) throw new Error("capacity threshold missing or not > 0");
  if (shocks.length === 0) throw new Error("no shock scenarios parsed");
  for (const s of shocks) {
    if (!s.id || !Number.isFinite(s.demand_shock_pct) || !Number.isFinite(s.cpi_during)) {
      throw new Error(`shock '${s.label}' is missing required fields`);
    }
  }

  // locked_cutoff = last confirmed-actual ISO date (period_label ends "_actual").
  let locked_cutoff: string | undefined;
  for (let i = daily.length - 1; i >= 0; i--) {
    if (daily[i].period_label && /_actual$/i.test(daily[i].period_label!)) {
      locked_cutoff = daily[i].date;
      break;
    }
  }

  return {
    daily,
    monthly_summary: months,
    monthly_total: total,
    shocks,
    assumptions,
    threshold,
    run_confidence: Number.isFinite(run_confidence) ? run_confidence : undefined,
    eur_usd_rate: Number.isFinite(eur_usd_rate) ? eur_usd_rate : undefined,
    growth_rate,
    locked_cutoff,
  };
}
