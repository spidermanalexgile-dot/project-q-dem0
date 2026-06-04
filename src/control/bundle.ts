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
  daily: /daily.*prediction/i,
  monthly: /monthly.*summary/i,
  shocks: /shock.*scenario/i,
  assumptions: /assumption/i,
};

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
  const out: DailyRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const c = rows[r];
    if (!c[ix("date")]) continue;
    out.push({
      date: c[ix("date")].trim(),
      dow: c[ix("day")]?.trim() ?? "",
      week: firstNum(c[ix("week")]) || 0,
      month: c[ix("month")]?.trim() ?? "",
      base_visitors: firstNum(c[ix("base_daily_visitors")]) || 0,
      growth_factor: firstNum(c[ix("growth_factor")]) || 0,
      predicted_visitors: firstNum(c[ix("predicted_visitors_2027")]) || 0,
      shock_pct: firstNum(c[ix("shock_pct")]) || 0,
      shock_label: c[ix("shock_label")]?.trim() ?? "",
      adjusted_visitors: firstNum(c[ix("adjusted_visitors")]) || 0,
      cpi: firstNum(c[ix("cpi")]) || 0,
      notes: c[ix("notes")]?.trim() ?? "",
    });
  }
  return out;
}

function parseMonthly(text: string): { months: MonthlySummaryRow[]; total: MonthlySummaryRow | null } {
  const rows = parseCSV(text);
  const ix = indexer(rows[0]);
  const months: MonthlySummaryRow[] = [];
  let total: MonthlySummaryRow | null = null;
  for (let r = 1; r < rows.length; r++) {
    const c = rows[r];
    const name = c[ix("month")]?.trim();
    if (!name) continue;
    const row: MonthlySummaryRow = {
      month: name,
      days: firstNum(c[ix("days")]) || 0,
      total_visitors: firstNum(c[ix("total_visitors_predicted")]) || 0,
      avg_daily: firstNum(c[ix("avg_daily_predicted")]) || 0,
      peak_day: firstNum(c[ix("peak_day_predicted")]) || 0,
      min_day: firstNum(c[ix("min_day_predicted")]) || 0,
      breaches: firstNum(c[ix("capacity_breaches")]) || 0,
      avg_cpi: firstNum(c[ix("avg_adj_cpi")]) || 0,
    };
    // TOTAL row stays a separate flag, never a 13th month.
    if (name.toUpperCase() === "TOTAL") total = row;
    else months.push(row);
  }
  return { months, total };
}

function parseShocks(text: string): Shock[] {
  const rows = parseCSV(text);
  const ix = indexer(rows[0]);
  const out: Shock[] = [];
  for (let r = 1; r < rows.length; r++) {
    const c = rows[r];
    const label = c[ix("scenario")]?.trim();
    if (!label) continue;
    out.push({
      id: slug(label),
      label,
      duration_days: firstNum(c[ix("duration_days")]) || 0,
      demand_shock_pct: firstNum(c[ix("demand_shock_pct")]) || 0,
      // Signed exactly as Ollie reports: positive Visitors_Lost = visitors LOST
      // (negative shock); negative = visitors gained (surge). Preserve, do NOT flip.
      visitors_delta: firstNum(c[ix("visitors_lost")]) || 0,
      // Signed the same way: positive = revenue lost, negative = revenue gained.
      revenue_impact_usd: firstNum(c[ix("revenue_impact_usd")]) || 0,
      avg_daily_during: firstNum(c[ix("avg_daily_during_shock")]) || 0,
      cpi_during: firstNum(c[ix("cpi_during_shock")]) || 0,
    });
  }
  return out;
}

function parseAssumptions(text: string): Assumption[] {
  const rows = parseCSV(text);
  const ix = indexer(rows[0]);
  const out: Assumption[] = [];
  for (let r = 1; r < rows.length; r++) {
    const c = rows[r];
    const param = c[ix("parameter")]?.trim();
    if (!param) continue;
    out.push({
      param,
      value: c[ix("value")]?.trim() ?? "",
      source: c[ix("source")]?.trim() ?? "",
      confidence: firstNum(c[ix("confidence_0_100")]) || 0,
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

  // capacity.threshold ← Sustainable_Capacity_Threshold
  const threshold = firstNum(assumptionValue(assumptions, /sustainable_capacity_threshold/i));
  const run_confidence = firstNum(assumptionValue(assumptions, /overall_run_confidence/i));
  const eur_usd_rate = firstNum(assumptionValue(assumptions, /eur_usd_rate/i));

  /* validation */
  if (daily.length < 355 || daily.length > 375) {
    throw new Error(`daily rows out of range: expected 365 ±10, got ${daily.length}`);
  }
  const adjSum = daily.reduce((a, d) => a + d.adjusted_visitors, 0);
  if (total && total.total_visitors > 0) {
    const drift = Math.abs(adjSum - total.total_visitors) / total.total_visitors;
    if (drift > 0.01) {
      throw new Error(`daily Adjusted_Visitors sum (${Math.round(adjSum)}) differs from Monthly TOTAL (${total.total_visitors}) by ${(drift * 100).toFixed(1)}% (>1%)`);
    }
  }
  if (!(threshold > 0)) throw new Error("capacity threshold missing or not > 0");
  if (shocks.length === 0) throw new Error("no shock scenarios parsed");
  for (const s of shocks) {
    if (!s.id || !Number.isFinite(s.demand_shock_pct) || !Number.isFinite(s.cpi_during)) {
      throw new Error(`shock '${s.label}' is missing required fields`);
    }
  }
  const hasBaseYear = assumptions.some((a) => /base_year/i.test(a.param));
  const hasGrowth = assumptions.some((a) => /growth/i.test(a.param));
  if (!hasBaseYear || !hasGrowth) {
    throw new Error("assumptions register missing base_year / growth keys");
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
  };
}
