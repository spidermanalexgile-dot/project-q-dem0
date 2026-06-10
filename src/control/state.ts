/**
 * Project Q · Authority Control Dashboard
 * Single state store + deterministic calc engine.
 *
 * Pure functions, no I/O, no Math.random, no Date.now. Same inputs → same
 * outputs, every time — this is what lets the live agent read back state and
 * confirm changes deterministically.
 *
 * Two writers: human via sliders/selects, agent via window.ProjectQ.
 * Both go through the documented commands; both trigger the same notify cycle.
 */

import { demandForISO, formatISO } from "./dateutil";
import { executeVoiceCommand } from "./voice";
import { ask } from "./analyst";
import { setElevenCredentials, setElevenVoice, listFemaleVoices, voiceStatus } from "./speech";
import { parseBundle } from "./bundle";

export type LeverId =
  | "target_capacity"
  | "base_fee"
  | "max_fee_cap"
  | "ceiling_pct";

export type Lever = {
  id: LeverId;
  min: number;
  max: number;
  step?: number;
  value: number;
  /** Value at load time — restored by resetLevers(). */
  def?: number;
};

export type DayType = {
  id: string;
  label: string;
  date: string;
  demand_pct: number;
};

export type ShoulderRebate = {
  enabled: boolean;
  credit: number;
  applies_below_pct: number;
};

export type CurveSpec = {
  base_fee_at_target: number;
  max_fee_cap: number;
  ceiling_pct: number;
  // credit_depth = how far below base_fee the curve dips at 0% (the winter credit
  // floor). Bigger = deeper off-season discounts → stronger trough attraction.
  shape: { plateau_end_pct: number; exponent: number; credit_depth?: number };
};

export type SeasonalBin = { days: number; demand_pct: number };

export type MonthlyBin = { month: string; demand_pct: number };

/* ─── DPM v2 bundle types (all additive / optional on State) ─────────────── */

export type DailyRow = {
  date: string; // ISO yyyy-mm-dd
  dow: string;
  week: number;
  month: string;
  base_visitors: number;
  growth_factor: number;
  predicted_visitors: number;
  shock_pct: number;
  shock_label: string;
  adjusted_visitors: number;
  cpi: number;
  notes: string;
  period_label?: string; // e.g. "2024_actual" / "2027_projected" (5-year bundle)
};

/** Bundle monthly summary. Stored under `monthly_summary` (NOT `monthly`) so the
 *  v1 `monthly: {month, demand_pct}[]` the year-curve reads is never broken. */
export type MonthlySummaryRow = {
  month: string; // "January".."December" | "TOTAL"
  days: number;
  total_visitors: number;
  avg_daily: number;
  peak_day: number;
  min_day: number;
  breaches: number;
  avg_cpi: number;
};

export type Shock = {
  id: string;
  label: string;
  duration_days: number;
  demand_shock_pct: number; // signed: -10 = -10% demand, +40 = surge
  visitors_delta: number; // signed: positive = lost (Ollie's convention, preserved)
  revenue_impact_usd: number; // signed: positive = revenue lost
  avg_daily_during: number;
  cpi_during: number;
};

export type Assumption = { param: string; value: string; source: string; confidence: number };

export type Phase = { year: 1 | 2 | 3; real_pay_cap: number };

export type State = {
  location: { id: string; label: string; currency: string };
  // target = the live daily capacity the authority is steering to (operator input).
  // baseline = the capacity the DPM's demand_pct figures were measured against; we
  // rebase live demand by baseline/target so changing target reshapes every curve.
  // threshold = the CPI denominator (sustainable carrying capacity); distinct
  // from target (the curve's policy 100% anchor). Both exist; don't conflate.
  capacity: { target: number; baseline: number; unit: string; threshold?: number };
  confidence: number;
  curve: CurveSpec;
  shoulder_rebate: ShoulderRebate;
  levers: Lever[];
  day_types: DayType[];
  phase: Phase;
  seasonal: SeasonalBin[];
  monthly?: MonthlyBin[];

  // ── DPM v2 bundle (optional; absent for v1 payloads) ──────────────────────
  daily?: DailyRow[];
  monthly_summary?: MonthlySummaryRow[];
  monthly_total?: MonthlySummaryRow | null;
  shocks?: Shock[];
  assumptions?: Assumption[];
  run_confidence?: number; // overall run confidence (e.g. 58); display honestly
  active_shock?: string | null; // applied shock id, null/undefined = baseline
  eur_usd_rate?: number; // from Assumptions; for USD→EUR shock impact conversion
  growth_rate?: number; // annual demand growth (e.g. 0.02); for the 5-year zoom-out
  zoomSpan?: 1 | 5; // years shown in the zoom-out view
  pricing_off?: boolean; // reset state — no deterrence, managed = raw forecast
  q_fixed?: boolean; // "Let Q fix this" active — per-day optimal pricing, levers re-tune per day
  locked_cutoff?: string; // last confirmed-actual ISO date (5-year bundle); pre-cutoff is locked
  provenance?: string; // "Curve params: … · Daily data: …" merge note

  activeDay: string;
  // Free-form modelled demand. When non-null the operator has typed a demand %
  // directly (or picked a calendar date) and it overrides the selected
  // day_type's demand_pct everywhere.
  customDemand: number | null;
  // ISO "YYYY-MM-DD" when the operator picked a specific calendar date; the
  // demand is derived from it. null when modelling a preset day or a raw %.
  customDate: string | null;
  // Which hero chart is showing: the cost curve or the annual "zoom out" view.
  view: "cost" | "year";
  // Desired occupancy the authority is steering toward (% of capacity). Pricing
  // deters crowds above it and the curve flattens toward it. Default 100%.
  occupancy_target: number;

  // delta-tracking internals
  __lastDayRev: number;
  __lastAnnualRev: number;
  __prevDayRev: number;
  __prevAnnualRev: number;
  __deltaSeq?: number;
};

export type Payload = Omit<
  State,
  "activeDay" | "customDemand" | "customDate" | "occupancy_target" | "__lastDayRev" | "__lastAnnualRev" | "__prevDayRev" | "__prevAnnualRev" | "__deltaSeq"
> & {
  activeDay?: string;
  // payload may omit phase; defaults to Year 1 / real pay cap 20
  phase?: Partial<Phase>;
};

type Listener = (state: State | null) => void;

const listeners = new Set<Listener>();
let state: State | null = null;
let prevDayRev = 0;
let prevAnnualRev = 0;
let deltaTimer: ReturnType<typeof setTimeout> | null = null;
let version = 0;

function notify() {
  version++;
  for (const fn of listeners) fn(state);
}

/** Snapshot for useSyncExternalStore. We mutate state in place (the prototype
 *  does too), so the reference never changes — components read live state but
 *  re-render when this counter bumps. */
export function getStoreVersion(): number {
  return version;
}

function requireState(): State {
  if (!state) throw new Error("ProjectQ: no payload loaded yet");
  return state;
}

function leverVal(snap: State, id: LeverId): number {
  const l = snap.levers.find((x) => x.id === id);
  if (!l) throw new Error(`ProjectQ: missing lever ${id}`);
  return l.value;
}

/* ─── pure calc engine ──────────────────────────────────────────────────── */

/** The live daily capacity the authority is steering to (operator input). */
export function targetCapacity(snap: State = requireState()): number {
  return snap.capacity?.target ?? 50000;
}

/**
 * Live demand % — the DPM's demand figures are measured against a baseline
 * capacity; if the operator lowers the live target, the SAME forecast crowd is a
 * bigger share of capacity. live% = baseline% × (baseline / target). So setting
 * target 50k → 40k makes a 100% day read as 125%, reshaping every curve.
 */
export function liveDemandPct(baseline_pct: number, snap: State = requireState()): number {
  const baseline = snap.capacity?.baseline || snap.capacity?.target || 50000;
  const target = targetCapacity(snap) || baseline;
  return baseline_pct * (baseline / target);
}

/**
 * Fee at a given occupancy %. Two regions:
 *  • Below target (0…plateau): a RAMP, not a flat line — the earliest visitors
 *    can be paid to come (negative, down to −credit_floor at 0%) and the price
 *    climbs to base_fee at the target, so the 30k-th visitor pays more than the
 *    10k-th. Linear from −floor(0%) → base_fee(target).
 *  • Above target (plateau…ceiling): the exponential congestion ramp to the cap.
 * `pct` is the LIVE occupancy (already rebased by target capacity).
 */
/** The status-quo flat day-tripper fee shown before Q (or any manual tuning)
 *  shapes the curve — Venice's current real-world €5 access fee. */
export const STATUS_QUO_FEE = 5;

/** The fee for the very first visitor (0% occupancy) is anchored at least this
 *  far into credit territory — you're almost paid to come in the dead of winter,
 *  no matter how high the at-target base fee climbs on a peak day. */
export const FIRST_VISITOR_FLOOR = -15;

export function feeAtPct(pct: number, snap: State = requireState()): number {
  // Before "Let Q fix this" (and before any lever is moved) the curve is just the
  // flat €5 access fee — the current policy. Q (or a manual lever move) turns it
  // into the dynamic curve below.
  const pristine = snap.levers.every((l) => typeof l.def !== "number" || l.value === l.def);
  if (!snap.q_fixed && pristine) return STATUS_QUO_FEE;

  const base = leverVal(snap, "base_fee");
  const cap = leverVal(snap, "max_fee_cap");
  const ceiling = leverVal(snap, "ceiling_pct");
  const plateauEnd = snap.curve.shape.plateau_end_pct; // = target occupancy (100%)
  const exp = snap.curve.shape.exponent;

  if (pct <= plateauEnd) {
    // Ramp from a credit floor at 0% up to the base fee at the target. The floor
    // is a discount that pulls the very first off-season visitors in; when the
    // base fee is itself negative (a credit), the whole low end is a credit.
    // The ramp is CONVEX (accelerating) so it steepens as it approaches the
    // target, anticipating the over-target spike — the gap from the low end to
    // base is less abrupt and the curve flows smoothly into the congestion ramp.
    const creditDepth = snap.curve.shape.credit_depth ?? 12; // off-season discount depth
    // Anchor the first visitor firmly in credit territory ("almost paid to come")
    // even when the at-target base is high — Math.min keeps floor ≤ base so the
    // ramp still rises into the base fee at the target.
    const floor = Math.min(base - creditDepth, FIRST_VISITOR_FLOOR);
    if (plateauEnd <= 0) return base;
    const t = Math.max(0, pct) / plateauEnd; // 0 at empty, 1 at target
    const tp = Math.pow(t, 1.8); // convex: gentle early, steeper near 100%
    return floor + (base - floor) * tp;
  }
  if (pct >= ceiling) return cap;
  const t = (pct - plateauEnd) / (ceiling - plateauEnd);
  const tp = Math.pow(t, exp);
  return base + (cap - base) * tp;
}

export function payAtPct(pct: number, snap: State = requireState()): number {
  const f = feeAtPct(pct, snap);
  if (f < 0) return f;
  const realCap = snap.phase.real_pay_cap;
  return Math.min(f, realCap);
}

export function qcashAtPct(pct: number, snap: State = requireState()): number {
  const f = feeAtPct(pct, snap);
  if (f < 0) return 0;
  return Math.max(0, f - snap.phase.real_pay_cap);
}

/**
 * Euro-scale of visitor price-sensitivity used by the demand-response model.
 * A modelling assumption (the DPM doesn't ship an elasticity figure yet): the
 * higher the fee charged on a day, the more that day's crowd is pushed toward the
 * 100% target. ~€30 means a €30 fee roughly halves a day's deviation from target.
 */
export const DEMAND_REF_EUR = 30;

/** The fee Q charges a day to steer it toward the flatten target — a credit
 *  (negative) below target to fill the off-season, a premium (positive) above it
 *  to deter the peaks, scaled by how far the day sits from target. */
function optimalDayFee(demand: number, target: number): number {
  return Math.max(-45, Math.min(150, 1.2 * (demand - target)));
}

/**
 * Managed demand — the crowd level a day actually settles at AFTER the pricing
 * curve deters (or, on quiet days, fails to deter) visitors. This is the whole
 * point of dynamic pricing: it steers the year toward the OCCUPANCY TARGET. The
 * fee is set from the day's forecast (raw) demand; that fee then compresses the
 * day's deviation from the target — busy days carry the highest fee so they
 * compress most, while quiet days sit near the base fee and barely move.
 *
 * managed = target + (raw − target) · e^(−fee / DEMAND_REF_EUR)
 *
 * Raising base_fee / max_fee_cap, or lowering ceiling_pct, all raise the fees and
 * therefore pull the curve toward the target. Pure + deterministic.
 */
export function occupancyTarget(snap: State = requireState()): number {
  return snap.occupancy_target ?? 100;
}

export function managedDemandPct(raw_pct: number, snap: State = requireState()): number {
  // Reset / "no pricing" state: the managed crowd IS the raw forecast crowd.
  if (snap.pricing_off) return raw_pct;
  const target = occupancyTarget(snap);
  if (snap.q_fixed) {
    // "Let Q fix this": each day is priced OPTIMALLY for that day, so the whole
    // year flattens BOTH ways — off-season pulled up, peaks pushed down — toward
    // the target, independent of the (per-day display) lever values.
    const f = optimalDayFee(raw_pct, target);
    return target + (raw_pct - target) * Math.exp(-Math.abs(f) / DEMAND_REF_EUR);
  }
  // Manual: the day responds to the curve's fee. A positive fee on a busy day
  // DETERS it down; a NEGATIVE fee (credit) on a quiet day ATTRACTS it up — so
  // dragging base_fee negative genuinely lifts off-season tourist demand.
  const fee = feeAtPct(raw_pct, snap);
  const effort = raw_pct >= target ? Math.max(0, fee) : Math.max(0, -fee);
  return target + (raw_pct - target) * Math.exp(-effort / DEMAND_REF_EUR);
}

/**
 * Day revenue for a BASELINE demand figure. We rebase to live occupancy (so the
 * fee reflects the chosen target capacity), then the actual heads = target × the
 * live %. Both the fee and the headcount move when target capacity changes.
 */
export function dayRevenue(baseline_pct: number, snap: State = requireState()): number {
  const live = liveDemandPct(baseline_pct, snap);
  const visitors = targetCapacity(snap) * (live / 100);
  // Pre-cutoff actuals are priced at the historical flat €5 fee — no levers,
  // same crowd, far lower revenue.
  const locked = !!snap.customDate && !!snap.locked_cutoff && snap.customDate <= snap.locked_cutoff;
  return visitors * (locked ? STATUS_QUO_FEE : feeAtPct(live, snap));
}

/**
 * The year currently in focus. Custom-date year → locked-cutoff year → first
 * daily-row year → modelling-year fallback (no Date.now, to stay deterministic).
 */
export function activeYear(snap: State = requireState()): number {
  if (snap.customDate) {
    const y = Number(snap.customDate.slice(0, 4));
    if (Number.isFinite(y)) return y;
  }
  if (snap.locked_cutoff) {
    const y = Number(snap.locked_cutoff.slice(0, 4));
    if (Number.isFinite(y)) return y;
  }
  if (snap.daily && snap.daily[0]) {
    const y = Number(snap.daily[0].date.slice(0, 4));
    if (Number.isFinite(y)) return y;
  }
  return 2026;
}

/**
 * Baseline annual revenue (no stress overlay).
 *  • PREFERRED: when daily granularity is present, sum the real day predictions —
 *    each day's visitors × the fee at its % of target. For a multi-year (5-year)
 *    bundle, sum only the ACTIVE YEAR's rows so the figure is a single year.
 *  • BACKWARD-COMPAT: with no daily data, fall back to the monthly/seasonal rollup.
 */
function baselineAnnualRevenue(snap: State): number {
  if (snap.daily && snap.daily.length > 0) {
    const target = targetCapacity(snap) || 1;
    const yr = snap.daily.length > 400 ? activeYear(snap) : null;
    let total = 0;
    for (const d of snap.daily) {
      if (yr !== null && Number(d.date.slice(0, 4)) !== yr) continue;
      // Confirmed actuals (on/before the cutoff) earn the historical flat €5 fee —
      // no lever pricing; only post-cutoff projections respond to the curve.
      const locked = snap.locked_cutoff ? d.date <= snap.locked_cutoff : false;
      const pctOfTarget = (d.adjusted_visitors / target) * 100;
      total += d.adjusted_visitors * (locked ? STATUS_QUO_FEE : feeAtPct(pctOfTarget, snap));
    }
    return total;
  }
  const bins = snap.monthly
    ? snap.monthly.map((m) => ({ days: 365 / 12, demand_pct: m.demand_pct }))
    : snap.seasonal;
  let total = 0;
  for (const s of bins) total += s.days * dayRevenue(s.demand_pct, snap);
  return total;
}

export function annualRevenue(snap: State = requireState()): number {
  const base = baselineAnnualRevenue(snap);
  const shock = activeShockObj(snap);
  if (shock) {
    // Ollie reports Revenue_Impact_USD signed (positive = revenue LOST). Convert
    // USD→EUR and subtract, so a loss lowers revenue and a surge (negative) lifts it.
    return base - shock.revenue_impact_usd / eurUsdRate(snap);
  }
  return base;
}

/* ─── DPM v2: capacity-pressure (CPI) + stress-test overlay ──────────────── */

/** USD→EUR rate from the bundle's Assumptions; 1.0 when absent. */
export function eurUsdRate(snap: State = requireState()): number {
  return snap.eur_usd_rate && snap.eur_usd_rate > 0 ? snap.eur_usd_rate : 1.0;
}

/** Smooth Venice-style summer bell curve — fallback when a payload predates the
 *  `monthly` field, so the zoom-out always reads chronologically. */
export const FALLBACK_MONTHLY = [52, 78, 85, 112, 138, 168, 190, 200, 158, 118, 70, 66];

/** The 12-month baseline demand profile (demand_pct, Jan→Dec). */
export function monthlyDemandProfile(snap: State = requireState()): number[] {
  return snap.monthly && snap.monthly.length === 12
    ? snap.monthly.map((m) => m.demand_pct)
    : FALLBACK_MONTHLY;
}

/** Annual demand growth rate (e.g. 0.02 = 2%/yr) from the bundle's Assumptions;
 *  defaults to 2% so the 5-year zoom-out always has a sensible slope. */
export function annualGrowthRate(snap: State = requireState()): number {
  return snap.growth_rate && snap.growth_rate > 0 ? snap.growth_rate : 0.02;
}

/** Sustainable carrying-capacity threshold (CPI denominator), or undefined for
 *  v1 payloads that carry no threshold. */
export function capacityThreshold(snap: State = requireState()): number | undefined {
  return snap.capacity?.threshold;
}

/** The currently-applied shock object, or null at baseline. */
export function activeShockObj(snap: State = requireState()): Shock | null {
  if (!snap.active_shock || !snap.shocks) return null;
  return snap.shocks.find((s) => s.id === snap.active_shock) ?? null;
}

/** The active day's modelled demand %, after any stress overlay
 *  (adjusted = baseline × (1 + demand_shock_pct/100)). */
export function effectiveActiveDemandPct(snap: State = requireState()): number {
  const base = activeDayType(snap).demand_pct;
  const shock = activeShockObj(snap);
  return shock ? base * (1 + shock.demand_shock_pct / 100) : base;
}

/** Active day's PROJECTED (forecast) headcount = effective % of target × target. */
export function activeAdjustedVisitors(snap: State = requireState()): number {
  return (effectiveActiveDemandPct(snap) / 100) * targetCapacity(snap);
}

/** Active day's MANAGED headcount — the crowd that actually shows up AFTER the
 *  pricing curve deters peak visitors. Drops toward the sustainable line as the
 *  fees bite, so it reflects "Suggest levers". */
export function activeManagedVisitors(snap: State = requireState()): number {
  const live = liveDemandPct(effectiveActiveDemandPct(snap), snap);
  return (managedDemandPct(live, snap) / 100) * targetCapacity(snap);
}

/** Flatten target for "Let Q fix this" — the level the whole year is steered to. */
export const FLATTEN_TARGET_PCT = 90;

function clampLever(l: Lever, v: number): number {
  return Math.max(l.min, Math.min(l.max, Math.round(v / (l.step || 1)) * (l.step || 1)));
}

/**
 * Re-tune the levers to the ACTIVE day's optimal pricing — a negative (credit)
 * base fee on quiet days, a high cap on busy days. Called whenever the modelled
 * day changes while Q is managing, so the levers + the cost curve visibly change
 * day-to-day ("it's not one size fits all"). The whole-year flatten itself is
 * driven by managedDemandPct's per-day optimal, not by these display values.
 */
function retuneForDay(s: State): void {
  const D = effectiveActiveDemandPct(s);
  const T = occupancyTarget(s) || FLATTEN_TARGET_PCT;
  const fee = optimalDayFee(D, T);
  const base = s.levers.find((l) => l.id === "base_fee");
  const cap = s.levers.find((l) => l.id === "max_fee_cap");
  if (base) base.value = clampLever(base, fee);
  if (cap) cap.value = clampLever(cap, Math.max(fee, (base?.value ?? 0) + (cap.step || 1)));
  // Quiet days get a deeper credit floor (more incentive to come); busy days none.
  s.curve.shape.credit_depth = D < T ? Math.min(60, Math.round(18 + (T - D) * 0.7)) : 12;
}

/**
 * "Let Q fix this" — turn on per-day optimal pricing. Q flattens the WHOLE year
 * toward ~90% BOTH ways (off-season paid up, peaks priced down), and the levers
 * re-tune to each day as you cycle through them. Moving a lever or Reset turns it
 * off. Deterministic.
 */
export function suggestSustainableLevers(): number {
  const s = requireState();
  bumpDeltas();
  s.pricing_off = false;
  s.q_fixed = true;
  s.occupancy_target = FLATTEN_TARGET_PCT;
  retuneForDay(s);
  commitDeltas();
  notify();
  return FLATTEN_TARGET_PCT;
}

/**
 * Capacity Pressure Index for the active day. null when no threshold is loaded.
 *  • Under a stress test → the scenario's CPI_During_Shock (Ollie's figure).
 *  • Else if a daily row matches the active date → that row's CPI.
 *  • Else computed: (demand%/100 × target) / threshold.
 */
export function activeCPI(snap: State = requireState()): number | null {
  const threshold = capacityThreshold(snap);
  if (!threshold || threshold <= 0) return null;
  const shock = activeShockObj(snap);
  if (shock) return shock.cpi_during;
  // Match a real daily row by the active day's date if one lines up.
  const date = snap.customDate;
  if (date && snap.daily) {
    const row = snap.daily.find((d) => d.date === date);
    if (row) return row.cpi;
  }
  return ((activeDayType(snap).demand_pct / 100) * targetCapacity(snap)) / threshold;
}

export function activeDayType(snap: State = requireState()): DayType {
  // A typed free-form demand (or a picked calendar date) overrides the selected
  // preset day everywhere.
  if (snap.customDemand != null) {
    return {
      id: "__custom",
      label: snap.customDate ? "Calendar day" : "Custom demand",
      date: snap.customDate ? formatISO(snap.customDate) : "Free-form",
      demand_pct: snap.customDemand,
    };
  }
  return snap.day_types.find((d) => d.id === snap.activeDay) || snap.day_types[0];
}

/* ─── delta tracking ────────────────────────────────────────────────────── */

function bumpDeltas() {
  const s = requireState();
  prevDayRev = s.__lastDayRev ?? dayRevenue(effectiveActiveDemandPct());
  prevAnnualRev = s.__lastAnnualRev ?? annualRevenue();
  if (deltaTimer) clearTimeout(deltaTimer);
  s.__deltaSeq = (s.__deltaSeq || 0) + 1;
}

function commitDeltas() {
  const s = requireState();
  s.__lastDayRev = dayRevenue(effectiveActiveDemandPct());
  s.__lastAnnualRev = annualRevenue();
  s.__prevDayRev = prevDayRev;
  s.__prevAnnualRev = prevAnnualRev;
  if (deltaTimer) clearTimeout(deltaTimer);
  deltaTimer = setTimeout(() => {
    if (!state) return;
    state.__prevDayRev = state.__lastDayRev;
    state.__prevAnnualRev = state.__lastAnnualRev;
    notify();
  }, 3500);
}

/* ─── payload validation ────────────────────────────────────────────────── */

function validatePayload(p: Payload): void {
  if (!p || typeof p !== "object") throw new Error("payload must be an object");
  if (!Array.isArray(p.day_types) || p.day_types.length === 0) {
    throw new Error("payload requires at least one day_type");
  }
  if (!Array.isArray(p.seasonal)) {
    throw new Error("payload requires a seasonal[] array");
  }
  const dayTotal = p.seasonal.reduce((acc, s) => acc + (s.days || 0), 0);
  if (dayTotal < 360 || dayTotal > 370) {
    throw new Error(`seasonal[].days must sum to ~365, got ${dayTotal}`);
  }
  for (const l of p.levers) {
    if (l.value < l.min || l.value > l.max) {
      throw new Error(`lever ${l.id} value ${l.value} out of bounds [${l.min}, ${l.max}]`);
    }
  }
  const plateauEnd = p.curve.shape.plateau_end_pct;
  if (p.curve.ceiling_pct <= plateauEnd) {
    throw new Error("ceiling_pct must be > plateau_end_pct");
  }
  if (p.curve.max_fee_cap <= p.curve.base_fee_at_target) {
    throw new Error("max_fee_cap must be > base_fee_at_target");
  }
}

/* ─── mutations / commands ──────────────────────────────────────────────── */

function isMarkdownString(input: unknown): input is string {
  return typeof input === "string";
}

function parseMarkdownPayload(md: string): Payload {
  // Look for a fenced ```json … ``` block.
  const fenceRe = /```json\s*([\s\S]*?)```/i;
  const match = md.match(fenceRe);
  if (!match) {
    // Allow a bare JSON object too (graceful fallback).
    const trimmed = md.trim();
    if (trimmed.startsWith("{")) {
      return JSON.parse(trimmed) as Payload;
    }
    throw new Error("loadPayload(markdown): no ```json fenced block found");
  }
  return JSON.parse(match[1]) as Payload;
}

/**
 * EXPONENT ×10 ENCODING NORMALIZATION.
 *
 * Ollie's DPM emits curve.shape.exponent as an INTEGER ×10-encoded value. His
 * Venice 2026 DPM PDF documents this explicitly ("EXPONENT ENCODING NOTE"):
 *
 *   "The schema requires whole integers only. The curve exponent of 2.2 is
 *    represented as the integer 22. The dashboard MUST divide this value by 10
 *    to obtain the float 2.2 for the pricing function calculation."
 *
 * We handle BOTH the encoded form and a future cleaned-up direct-float form in
 * this single, robust code path:
 *   - exponent >= 10  → treat as ×10-encoded → divide by 10   (22 → 2.2)
 *   - exponent <  10  → treat as a direct float → use as-is    (forward-compat
 *                       for when the DPM schema is cleaned up to emit 2.2)
 *
 * No realistic fee curve uses an exponent >= 10, so this disambiguation is safe.
 * Rationale & source: Ollie's Venice 2026 DPM PDF, "EXPONENT ENCODING NOTE".
 */
function normalizeCurveExponent(shape: { exponent: number }): void {
  if (typeof shape?.exponent === "number" && shape.exponent >= 10) {
    shape.exponent = shape.exponent / 10;
  }
}

/** Validate + normalize a v1 payload into a fresh State (does NOT touch the
 *  global store). Shared by loadPayload and the bundle's base-layer resolution. */
function normalizePayloadToState(parsed: Payload): State {
  validatePayload(parsed);
  // Defensive deep clone so we don't mutate a caller's object.
  const next = JSON.parse(JSON.stringify(parsed)) as State;
  // Normalize Ollie's integer-encoded curve exponent (e.g. 22 → 2.2) before any
  // pricing calc reads it. See normalizeCurveExponent() above for the rationale.
  normalizeCurveExponent(next.curve.shape);
  if (!next.activeDay) next.activeDay = next.day_types[0].id;
  next.customDemand = null;
  next.customDate = null;
  next.view = "cost";
  if (typeof next.occupancy_target !== "number") next.occupancy_target = 100;
  // Baseline = the capacity the DPM demand_pct figures were measured against.
  // Default it to the initial target so live rebasing starts at 1:1.
  if (!next.capacity) next.capacity = { target: 50000, baseline: 50000, unit: "visitors/day" };
  if (typeof next.capacity.baseline !== "number") next.capacity.baseline = next.capacity.target;
  // target_capacity is an operator INPUT now (capacity.target), not a slider —
  // drop it from levers if a legacy payload still lists it.
  next.levers = next.levers.filter((l) => l.id !== "target_capacity");
  // Shoulder-season recirculation has been retired from the product. Force it
  // off on every load so no payload (legacy or uploaded) can re-introduce the
  // credit zone in the curve or revenue.
  if (next.shoulder_rebate) next.shoulder_rebate.enabled = false;
  if (!next.phase) next.phase = { year: 1, real_pay_cap: 20 };
  next.active_shock = null;
  next.pricing_off = false;
  next.q_fixed = false;
  if (next.zoomSpan !== 5) next.zoomSpan = 1;
  // Capture each lever's load-time value as its reset default.
  for (const l of next.levers) if (typeof l.def !== "number") l.def = l.value;
  // Initialise delta-tracking fields against the new state.
  next.__lastDayRev = 0;
  next.__lastAnnualRev = 0;
  next.__prevDayRev = 0;
  next.__prevAnnualRev = 0;
  return next;
}

/** Install a freshly-built State as the live store + seed delta tracking. */
function commitState(next: State): void {
  state = next;
  state.__lastDayRev = dayRevenue(effectiveActiveDemandPct());
  state.__lastAnnualRev = annualRevenue();
  state.__prevDayRev = state.__lastDayRev;
  state.__prevAnnualRev = state.__lastAnnualRev;
  notify();
}

export function loadPayload(input: Payload | string): void {
  const parsed: Payload = isMarkdownString(input) ? parseMarkdownPayload(input) : input;
  commitState(normalizePayloadToState(parsed));
}

/**
 * Load Ollie's DPM v2 four-CSV bundle and layer it onto a v1 base payload.
 *
 * `files` is the dropped/selected set ({name,text}). Parsing + validation live in
 * bundle.ts (throws on failure → caller keeps previous state, red toast). Base
 * resolution (the v1 curve params / levers / day_types the bundle doesn't carry):
 *   1. a .json / .md in the dropped set → use it as the base;
 *   2. else the currently-loaded v1 state (boot default venice-2026.json);
 *   3. else error (nothing to layer onto).
 * Then the bundle's additive fields (threshold, daily, monthly_summary, shocks,
 * assumptions, run_confidence, eur_usd_rate) overlay on top.
 */
export function loadBundle(files: { name: string; text: string }[]): void {
  const data = parseBundle(files); // throws on validation failure

  const jsonFile = files.find((f) => /\.(json|md)$/i.test(f.name));
  let base: State;
  let curveSource: string;
  if (jsonFile) {
    const parsed = /\.md$/i.test(jsonFile.name)
      ? parseMarkdownPayload(jsonFile.text)
      : (JSON.parse(jsonFile.text) as Payload);
    base = normalizePayloadToState(parsed);
    curveSource = jsonFile.name;
  } else if (state) {
    // Layer onto the live v1 payload (keeps its confidence, curve, day_types).
    base = JSON.parse(JSON.stringify(state)) as State;
    curveSource = "venice-2026.json";
  } else {
    throw new Error("no v1 base payload to layer the bundle onto");
  }

  // Overlay the additive bundle fields.
  base.capacity.threshold = data.threshold;
  base.daily = data.daily;
  base.monthly_summary = data.monthly_summary;
  base.monthly_total = data.monthly_total;
  base.shocks = data.shocks;
  base.assumptions = data.assumptions;
  base.run_confidence = data.run_confidence;
  base.eur_usd_rate = data.eur_usd_rate;
  base.growth_rate = data.growth_rate;
  base.locked_cutoff = data.locked_cutoff;
  base.active_shock = null;
  // Default the modelled day to the first FULLY-projected year (cutoff year + 1)
  // so the default 1-year view is entirely lever-influenced — "Let Q fix this"
  // flattens the whole year, not just the post-cutoff half. (Earlier years are
  // confirmed actuals and stay locked when viewed.)
  if (data.locked_cutoff) {
    const projYear = Number(data.locked_cutoff.slice(0, 4)) + 1;
    const dd = `${projYear}-07-15`;
    const dem = demandForDate(dd, base);
    if (dem != null) {
      base.customDate = dd;
      base.customDemand = dem;
    }
  }
  const year = data.daily[0]?.date?.slice(0, 4) ?? "2027";
  base.provenance = `Curve params: ${curveSource} · Daily data: venice-${year} bundle`;

  commitState(base);
}

/** Apply a stress-test scenario (or null = baseline). All live-displayed
 *  numbers reflect the scenario via the calc helpers. */
export function setActiveShock(id: string | null): void {
  const s = requireState();
  const next = id && s.shocks?.some((sh) => sh.id === id) ? id : null;
  if ((s.active_shock ?? null) === next) return;
  bumpDeltas();
  s.active_shock = next;
  commitDeltas();
  notify();
}

export function setLever(id: LeverId | string, value: number): void {
  const s = requireState();
  // target_capacity is no longer a slider — redirect old callers (incl. voice).
  if (id === "target_capacity") {
    setTargetCapacity(Number(value));
    return;
  }
  const l = s.levers.find((x) => x.id === id);
  if (!l) return;
  const v = Math.max(l.min, Math.min(l.max, Number(value)));
  if (l.value === v) return;
  bumpDeltas();
  l.value = v;
  s.pricing_off = false; // moving a lever re-engages pricing
  s.q_fixed = false; // manual override — leave Q's per-day auto-management
  commitDeltas();
  notify();
}

/** Set the live daily target capacity (operator input). Rebases every curve via
 *  liveDemandPct, so a lower target makes the forecast crowd read as higher %. */
export function setTargetCapacity(people: number): void {
  const s = requireState();
  const v = Math.max(5000, Math.min(200000, Math.round(Number(people) / 1000) * 1000));
  if (s.capacity.target === v) return;
  bumpDeltas();
  s.capacity.target = v;
  s.pricing_off = false;
  commitDeltas();
  notify();
}

export function setDayType(id: string): void {
  const s = requireState();
  // Selecting a preset day clears any free-form demand / calendar override.
  if (s.activeDay === id && s.customDemand == null && s.customDate == null) return;
  bumpDeltas();
  s.activeDay = id;
  s.customDemand = null;
  s.customDate = null;
  if (s.q_fixed) retuneForDay(s); // Q re-prices for the new day
  commitDeltas();
  notify();
}

/** Free-form modelled demand (%). Pass null to revert to the selected day_type.
 *  Clamped to a sane 0–400% range. Clears any picked calendar date. */
export function setDemand(pct: number | null): void {
  const s = requireState();
  const next = pct == null ? null : Math.max(0, Math.min(400, Math.round(Number(pct))));
  if (s.customDemand === next && s.customDate == null) return;
  bumpDeltas();
  s.customDemand = next;
  s.customDate = null;
  if (s.q_fixed) retuneForDay(s);
  commitDeltas();
  notify();
}

/** Demand % for a calendar date. Prefers a smooth interpolation of the 12-month
 *  profile (so off-season days read genuinely low and summer days high, on the
 *  same 'normal-day' scale as the curve) — falls back to the coarse day_type
 *  anchors when no monthly profile is loaded. Deterministic. */
function demandForDate(iso: string, snap: State): number | null {
  // Exact daily row (5-year bundle) wins — its CPI is the real % of capacity.
  if (snap.daily && snap.daily.length) {
    const row = snap.daily.find((d) => d.date === iso);
    if (row && row.cpi > 0) return Math.round(row.cpi);
  }
  if (snap.monthly && snap.monthly.length === 12) {
    const parts = iso.split("-").map(Number);
    const m = parts[1];
    const d = parts[2];
    if (m >= 1 && m <= 12 && d >= 1) {
      const dim = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1] || 30;
      const frac = Math.min(1, Math.max(0, (d - 1) / dim));
      const cur = snap.monthly[m - 1].demand_pct;
      const nxt = snap.monthly[m % 12].demand_pct; // wrap Dec→Jan
      return Math.round(cur + (nxt - cur) * frac);
    }
  }
  return demandForISO(iso, snap.day_types);
}

/**
 * Model a specific calendar date ("YYYY-MM-DD"). The demand % comes from the
 * monthly profile (smooth seasonal) when present, else the day_type anchors. Pass
 * null to revert to the selected preset day. Deterministic — same date → same demand.
 */
export function setDate(iso: string | null): void {
  const s = requireState();
  if (iso == null) {
    if (s.customDate == null && s.customDemand == null) return;
    bumpDeltas();
    s.customDate = null;
    s.customDemand = null;
    commitDeltas();
    notify();
    return;
  }
  const demand = demandForDate(iso, s);
  if (demand == null) return; // malformed date — ignore, keep current state
  if (s.customDate === iso && s.customDemand === demand) return;
  bumpDeltas();
  s.customDate = iso;
  s.customDemand = demand;
  if (s.q_fixed) retuneForDay(s); // re-price for the dragged/picked day
  commitDeltas();
  notify();
}

/** Switch the hero chart between the cost curve and the annual "zoom out" view. */
export function setView(view: "cost" | "year"): void {
  const s = requireState();
  if (s.view === view) return;
  s.view = view;
  notify();
}

/** Zoom-out span in years (1 or 5). Switches to the year view. */
export function setZoomSpan(years: number): void {
  const s = requireState();
  const span: 1 | 5 = years >= 5 ? 5 : 1;
  if (s.view === "year" && s.zoomSpan === span) return;
  s.view = "year";
  s.zoomSpan = span;
  notify();
}

/** Mutate `s` into the un-managed "now" state: levers at their loaded defaults,
 *  no pricing intervention (managed = raw forecast). Shared by resetLevers() and
 *  the day-selection commands (so each new day shows the real, un-optimised crowd
 *  before "Let Q fix this" reveals Q's managed result — the disparity). */
function resetToNow(s: State): void {
  for (const l of s.levers) if (typeof l.def === "number") l.value = l.def;
  s.occupancy_target = 100;
  s.curve.shape.credit_depth = 12; // restore the default (shallow) credit floor
  s.pricing_off = true;
  s.q_fixed = false;
}

/**
 * Reset the lever settings to their loaded defaults so the managed (green) line
 * tracks the raw forecast crowd — i.e. "what happens with no pricing intervention".
 * The inverse of suggestSustainableLevers(). Pricing re-engages on any lever move.
 */
export function resetLevers(): void {
  const s = requireState();
  bumpDeltas();
  resetToNow(s);
  commitDeltas();
  notify();
}

/**
 * Set the desired occupancy (% of capacity) the authority wants to hold today,
 * and AUTO-TUNE the fee levers so the busiest forecast day is deterred down to
 * that target. Deters crowds above the target (higher fees the further over),
 * while leaving quiet days near the base fee so they're never over-penalised.
 *
 * We solve for the fee the peak day must carry to land at the target —
 *   managed(peakRaw) = target  ⇒  fee* = −DEMAND_REF_EUR · ln((target−peakRaw)/(target−peakRaw))…
 * — then set max_fee_cap so the curve actually charges fee* at the peak. Pure +
 * deterministic; clamps to the lever's bounds. Pass null to clear (back to 100%).
 */
export function setOccupancyTarget(pct: number | null): void {
  const s = requireState();
  const next = pct == null ? 100 : Math.max(0, Math.min(300, Math.round(pct)));
  bumpDeltas();
  s.occupancy_target = next;
  s.pricing_off = false; // steering to a target re-engages pricing

  // Auto-tune: find the fee the busiest day needs so it settles AT the target.
  const peakRaw = Math.max(100, ...s.seasonal.map((b) => b.demand_pct), activeDayType(s).demand_pct);
  if (peakRaw > next) {
    // managed = target + (raw−target)·e^(−fee/REF) ⇒ to reach exactly `target`
    // the fee must be very large; aim for landing within ~1% of target instead.
    const desiredGap = Math.max(0.01, 1 / Math.max(1, peakRaw - next)); // fraction of the over-shoot left
    const feeStar = -DEMAND_REF_EUR * Math.log(desiredGap);
    const cap = s.levers.find((l) => l.id === "max_fee_cap");
    const ceiling = s.levers.find((l) => l.id === "ceiling_pct");
    const base = s.levers.find((l) => l.id === "base_fee");
    // The peak day charges ~max_fee_cap (it sits at/above the ceiling), so set the
    // cap to the fee we need, clamped to its bounds.
    if (cap) {
      const wanted = Math.round(feeStar / (cap.step || 1)) * (cap.step || 1);
      cap.value = Math.max(cap.min, Math.min(cap.max, Math.max(wanted, base ? base.value + (cap.step || 1) : wanted)));
    }
    // Make sure the ceiling isn't so high the peak never reaches the cap fee.
    if (ceiling && peakRaw < ceiling.value) {
      ceiling.value = Math.max(ceiling.min, Math.min(ceiling.value, Math.max(peakRaw, ceiling.min)));
    }
  }

  commitDeltas();
  notify();
}

export function setPhase(year: 1 | 2 | 3): void {
  const s = requireState();
  if (s.phase.year === year) return;
  bumpDeltas();
  s.phase.year = year;
  s.phase.real_pay_cap = year === 1 ? 20 : year === 2 ? 60 : 150;
  commitDeltas();
  notify();
}

/**
 * Shoulder-season recirculation has been retired from the product. This command
 * is kept on the API surface for backward compatibility but is now a no-op — the
 * rebate stays disabled regardless of the argument.
 */
export function setRebate(_enabled: boolean): void {
  const s = requireState();
  if (!s.shoulder_rebate.enabled) return;
  bumpDeltas();
  s.shoulder_rebate.enabled = false;
  commitDeltas();
  notify();
}

export function getState(): State | null {
  return state;
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export type Computed = {
  activeDay: DayType;
  dayRevenue: number;
  annualRevenue: number;
  prevDayRev: number;
  prevAnnualRev: number;
  fee: (pct: number) => number;
  pay: (pct: number) => number;
  qcash: (pct: number) => number;
};

export function compute(): Computed {
  const s = requireState();
  const dt = activeDayType(s);
  return {
    activeDay: dt,
    // Use the stress-adjusted active demand so the day-revenue card reflects an
    // applied shock; equals the baseline demand when no shock is active.
    dayRevenue: dayRevenue(effectiveActiveDemandPct(s), s),
    annualRevenue: annualRevenue(s),
    prevDayRev: s.__prevDayRev,
    prevAnnualRev: s.__prevAnnualRev,
    fee: (pct: number) => feeAtPct(pct, s),
    pay: (pct: number) => payAtPct(pct, s),
    qcash: (pct: number) => qcashAtPct(pct, s),
  };
}

/* ─── window.ProjectQ surface (live-agent + console) ────────────────────── */

export type ProjectQApi = {
  loadPayload: typeof loadPayload;
  /** Load Ollie's DPM v2 four-CSV bundle ({name,text}[]) onto the v1 base. */
  loadBundle: typeof loadBundle;
  setLever: typeof setLever;
  setDayType: typeof setDayType;
  setDemand: typeof setDemand;
  setDate: typeof setDate;
  setView: typeof setView;
  setOccupancyTarget: typeof setOccupancyTarget;
  setTargetCapacity: typeof setTargetCapacity;
  /** Apply a stress-test scenario by id (or null = baseline). */
  setActiveShock: typeof setActiveShock;
  setPhase: typeof setPhase;
  setRebate: typeof setRebate;
  getState: typeof getState;
  subscribe: typeof subscribe;
  compute: typeof compute;
  feeAtPct: (pct: number) => number;
  payAtPct: (pct: number) => number;
  qcashAtPct: (pct: number) => number;
  dayRevenue: (demand_pct: number) => number;
  managedDemandPct: (raw_pct: number) => number;
  liveDemandPct: (baseline_pct: number) => number;
  targetCapacity: () => number;
  annualRevenue: () => number;
  /** DPM v2: Capacity Pressure Index for the active day (null if no threshold). */
  activeCPI: () => number | null;
  /** DPM v2: sustainable capacity threshold (CPI denominator), or undefined. */
  capacityThreshold: () => number | undefined;
  /** DPM v2: the active stress scenario object, or null at baseline. */
  activeShock: () => Shock | null;
  /** DPM v2: projected (forecast) vs managed (post-pricing) headcount today. */
  activeAdjustedVisitors: () => number;
  activeManagedVisitors: () => number;
  /** Auto-tune the levers to hold managed demand at the sustainable threshold
   *  (CPI 1.0). Returns the sustainable % it steered to. */
  suggestSustainableLevers: () => number;
  /** Reset levers to defaults + lift the target so the managed (green) zoom-out
   *  line tracks the raw forecast crowd (no pricing intervention). */
  resetLevers: () => void;
  /** Set the zoom-out span in years (1 or 5); switches to the year view. */
  setZoomSpan: (years: number) => void;
  /** Parse + apply a natural-language voice/text command; returns the spoken
   *  confirmation string (theme changes are UI-side and a no-op here). */
  voiceCommand: (transcript: string) => string;
  /** Ask the deterministic analyst a question; returns its text answer (any
   *  suggested lever change is surfaced in the in-UI chat, not auto-applied). */
  askAnalyst: (question: string) => string;
  /** Ask the Claude-brained concierge (tool-use over the deterministic engine).
   *  Resolves to her spoken answer, or null when the /api/agent proxy isn't
   *  configured — in which case askAnalyst is the deterministic fallback. */
  askAgent: (question: string) => Promise<string | null>;
  /** Enable the premium ElevenLabs voice (key persisted to localStorage). The
   *  optional `voice` is a female voice name ("Charlotte") or curated id; anything
   *  else falls back to the default female voice. Pass null key to clear. */
  setVoiceApiKey: (key: string | null, voice?: string) => void;
  /** Switch the premium female voice by name without re-entering the key. */
  setVoice: (voice: string) => void;
  /** List the selectable female voices (name + short description). */
  listVoices: () => { name: string; note: string }[];
  /** Which TTS engine is active: 'server-proxy' (secure), 'client-key', 'browser'. */
  voiceStatus: () => { engine: "server-proxy" | "client-key" | "browser"; voice: string };
};

export function installGlobalApi(): void {
  if (typeof window === "undefined") return;
  const api: ProjectQApi = {
    loadPayload,
    loadBundle,
    setLever,
    setDayType,
    setDemand,
    setDate,
    setView,
    setOccupancyTarget,
    setTargetCapacity,
    setActiveShock,
    setPhase,
    setRebate,
    getState,
    subscribe,
    compute,
    feeAtPct: (pct: number) => feeAtPct(pct),
    payAtPct: (pct: number) => payAtPct(pct),
    qcashAtPct: (pct: number) => qcashAtPct(pct),
    dayRevenue: (demand_pct: number) => dayRevenue(demand_pct),
    managedDemandPct: (raw_pct: number) => managedDemandPct(raw_pct),
    liveDemandPct: (baseline_pct: number) => liveDemandPct(baseline_pct),
    targetCapacity: () => targetCapacity(),
    annualRevenue: () => annualRevenue(),
    activeCPI: () => activeCPI(),
    capacityThreshold: () => capacityThreshold(),
    activeShock: () => activeShockObj(),
    activeAdjustedVisitors: () => activeAdjustedVisitors(),
    activeManagedVisitors: () => activeManagedVisitors(),
    suggestSustainableLevers: () => suggestSustainableLevers(),
    resetLevers: () => resetLevers(),
    setZoomSpan: (years: number) => setZoomSpan(years),
    voiceCommand: (transcript: string) =>
      executeVoiceCommand(transcript, { getState, setLever, setDemand, setDayType, setDate, setView, setOccupancyTarget }),
    askAnalyst: (question: string) => {
      const s = getState();
      return s ? ask(question, s).answer : "No payload loaded yet.";
    },
    // Dynamic import keeps the brain (which imports this module via agent-tools)
    // out of state.ts's static dependency graph — no import cycle at load time.
    askAgent: async (question: string) => {
      const { agentAsk } = await import("./agent");
      const r = await agentAsk(question);
      return r ? r.answer : null;
    },
    setVoiceApiKey: (key: string | null, voice?: string) => setElevenCredentials(key, voice),
    setVoice: (voice: string) => setElevenVoice(voice),
    listVoices: () => listFemaleVoices(),
    voiceStatus: () => voiceStatus(),
  };
  (window as unknown as { ProjectQ: ProjectQApi }).ProjectQ = api;
}

declare global {
  interface Window {
    ProjectQ: ProjectQApi;
  }
}
