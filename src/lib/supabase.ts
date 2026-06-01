/**
 * Supabase data layer for the Project Q Authority Control Dashboard.
 *
 * This is the corrected, DETERMINISTIC version of the build-doc's lib/supabase.js.
 * Two deliberate departures from the doc, both decided with the team:
 *
 *  1. recalculate() does NOT call Claude. The doc put the LLM in the live recalc
 *     loop, which (a) can't meet the "<1s" requirement — an Anthropic round-trip
 *     is seconds, not milliseconds — and (b) makes the headline revenue figure
 *     non-deterministic (same levers → different numbers run-to-run), which is
 *     unacceptable for a policy instrument shown to decision-makers. Instead we
 *     run the SAME deterministic calc engine the dashboard already uses
 *     (feeAtPct / dayRevenue / annualRevenue), so the numbers are exact,
 *     reproducible, and instant. Supabase is used for what it's actually good at:
 *     persistence, the change_audit trail, and multi-client Realtime sync.
 *
 *  2. No Anthropic key on the client. (The doc's process.env.ANTHROPIC_API_KEY is
 *     undefined in a Vite browser anyway, and a VITE_-prefixed key would ship in
 *     the public bundle.) The only browser credential here is the Supabase ANON
 *     key, which is designed for the browser and gated by row-level security.
 *
 * STATUS: wired but not yet connected — the Supabase project URL below does not
 * resolve yet (DPM runs in progress; Ollie provisions the DB later). Every call
 * is guarded so the dashboard keeps working off the local engine until then.
 * When the project goes live, nothing here needs to change.
 */

import { createClient } from "@supabase/supabase-js";
import {
  feeAtPct,
  annualRevenue,
  type State,
  type DayType,
  type SeasonalBin,
} from "../control/state";

// From the build doc. The anon key is a PUBLIC client key (RLS-protected) — safe
// to ship in the browser, unlike a service-role or Anthropic key. Overridable via
// VITE_SUPABASE_ANON_KEY for non-prod environments.
const SUPABASE_URL = "https://cuoiymalbbxbmtbldwso.supabase.co";
const SUPABASE_ANON_KEY =
  (import.meta.env?.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1b2l5bWFsYnh4Ym10Ymxkd3NvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyNTY0MTEsImV4cCI6MjA5NTgzMjQxMX0.AdOBzPkrJFghoQ-ndDoVQZrXn85Wo6H_xiKa0WRaj8A";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export const VENICE_ID = "63f2bf98-e89f-48de-80b5-209a6b96db6f";

/** Congestion-ramp sharpness used by the engine's fee curve above the target.
 *  A model constant (not a lever); surfaced in computed_state.curve for the chart. */
const CURVE_EXPONENT = 22;
const PLATEAU_END_PCT = 100;

/* ─── DB row shapes (subset we read) ─────────────────────────────────────── */

export type LeverStateRow = {
  destination_id: string;
  target_capacity: number;
  base_fee: number;
  max_fee_cap: number;
  ceiling_pct: number;
  shoulder_rebate_enabled: boolean;
};

export type DemandRow = {
  destination_id: string;
  year: number;
  seasonal_buckets: SeasonalBin[] | null;
  day_types: DayType[] | null;
  confidence: number | null;
  source_notes?: string | null;
};

/** The computed_state contract the chart + day cards + revenue read. Identical
 *  shape to the doc, but every value comes from the deterministic engine. */
export type ComputedState = {
  curve: {
    base_fee_at_target: number;
    max_fee_cap: number;
    ceiling_pct: number;
    plateau_end_pct: number;
    exponent: number;
  };
  fee_schedule: { id: string; label: string; date: string; demand_pct: number; fee: number }[];
  projected_revenue: number;
  confidence: number;
};

/* ─── deterministic compute ──────────────────────────────────────────────── */

/** Build a calc-engine snapshot from the live DB rows. baseline === target so a
 *  year's demand_pct is read straight against the steered capacity (the doc's
 *  "100% ANCHOR" semantics) with no extra rebasing. */
function buildSnapshot(levers: LeverStateRow, demand: DemandRow): State {
  const target = Number(levers.target_capacity);
  const base = Number(levers.base_fee);
  const cap = Number(levers.max_fee_cap);
  const ceiling = Number(levers.ceiling_pct);
  const dayTypes: DayType[] = (demand.day_types ?? []).map((d) => ({
    id: d.id,
    label: d.label,
    date: d.date,
    demand_pct: Number(d.demand_pct),
  }));
  const seasonal: SeasonalBin[] = (demand.seasonal_buckets ?? []).map((s) => ({
    days: Number(s.days),
    demand_pct: Number(s.demand_pct),
  }));

  return {
    location: { id: "venice", label: "Venice", currency: "EUR" },
    capacity: { target, baseline: target, unit: "visitors/day" },
    confidence: Number(demand.confidence ?? 0),
    curve: {
      base_fee_at_target: base,
      max_fee_cap: cap,
      ceiling_pct: ceiling,
      shape: { plateau_end_pct: PLATEAU_END_PCT, exponent: CURVE_EXPONENT },
    },
    shoulder_rebate: { enabled: !!levers.shoulder_rebate_enabled, credit: 8, applies_below_pct: 28 },
    levers: [
      { id: "base_fee", min: 0, max: 50, step: 1, value: base },
      { id: "max_fee_cap", min: 10, max: 200, step: 5, value: cap },
      { id: "ceiling_pct", min: 120, max: 250, step: 5, value: ceiling },
      { id: "target_capacity", min: 20000, max: 120000, step: 1000, value: target },
    ],
    day_types: dayTypes,
    phase: { year: 1, real_pay_cap: 20 },
    seasonal,
    activeDay: dayTypes[0]?.id ?? "",
    customDemand: null,
    customDate: null,
    view: "cost",
    occupancy_target: 100,
    __lastDayRev: 0,
    __lastAnnualRev: 0,
    __prevDayRev: 0,
    __prevAnnualRev: 0,
  };
}

/**
 * Deterministic replacement for the doc's Claude call. Same input/output contract
 * (curve, fee_schedule, projected_revenue, confidence) — computed exactly by the
 * dashboard's own engine, in microseconds, with no network and no LLM variance.
 */
export function deterministicRecalculate(levers: LeverStateRow, demand: DemandRow): ComputedState {
  const snap = buildSnapshot(levers, demand);
  return {
    curve: {
      base_fee_at_target: snap.curve.base_fee_at_target,
      max_fee_cap: snap.curve.max_fee_cap,
      ceiling_pct: snap.curve.ceiling_pct,
      plateau_end_pct: PLATEAU_END_PCT,
      exponent: CURVE_EXPONENT,
    },
    fee_schedule: snap.day_types.map((d) => ({
      id: d.id,
      label: d.label,
      date: d.date,
      demand_pct: d.demand_pct,
      fee: Math.round(feeAtPct(d.demand_pct, snap)),
    })),
    projected_revenue: Math.round(annualRevenue(snap)),
    confidence: Number(demand.confidence ?? 0),
  };
}

/* ─── persistence + sync (deterministic compute, then write) ─────────────── */

/**
 * Recompute deterministically and persist: append the result to computed_state
 * (which Realtime broadcasts to every connected viewer) and log the lever move to
 * change_audit. Network writes are guarded so a not-yet-provisioned DB never
 * breaks the live dashboard — the computed result is returned regardless.
 */
export async function recalculate(
  levers: LeverStateRow,
  demand: DemandRow,
  leverName: string,
  valueBefore: number | null,
  valueAfter: number | null,
): Promise<ComputedState> {
  const result = deterministicRecalculate(levers, demand);
  try {
    const { data: computed } = await supabase
      .from("computed_state")
      .insert({
        destination_id: levers.destination_id,
        context_year: demand.year,
        triggered_by_lever: leverName,
        curve: result.curve,
        fee_schedule: result.fee_schedule,
        projected_revenue: result.projected_revenue,
        confidence: result.confidence,
      })
      .select()
      .single();

    await supabase.from("change_audit").insert({
      destination_id: levers.destination_id,
      lever_name: leverName,
      value_before: valueBefore,
      value_after: valueAfter,
      changed_by: "authority",
      computed_state_id: computed?.id,
    });
  } catch {
    // DB not reachable yet — the deterministic result still stands.
  }
  return result;
}

/** Load the current levers, latest computed row, and demand context for a year. */
export async function loadInitialState(contextYear = 2026) {
  const [{ data: levers }, { data: computed }, { data: demand }] = await Promise.all([
    supabase.from("lever_state").select("*").eq("destination_id", VENICE_ID).single(),
    supabase
      .from("computed_state")
      .select("*")
      .eq("destination_id", VENICE_ID)
      .eq("context_year", contextYear)
      .order("computed_at", { ascending: false })
      .limit(1)
      .single(),
    supabase.from("historical_demand").select("*").eq("destination_id", VENICE_ID).eq("year", contextYear).single(),
  ]);
  return { levers, computed, demand };
}

/** Realtime: fire onUpdate with every new computed_state row for Venice. */
export function subscribeToUpdates(onUpdate: (row: ComputedState & Record<string, unknown>) => void) {
  const channel = supabase
    .channel("computed_state_changes")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "computed_state", filter: `destination_id=eq.${VENICE_ID}` },
      (payload) => onUpdate(payload.new as ComputedState & Record<string, unknown>),
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

/** Lever change (call on slider RELEASE, not on drag): optimistic update, persist
 *  the lever, then deterministically recompute + write computed_state. */
export async function handleLeverChange(
  currentLevers: LeverStateRow,
  currentDemand: DemandRow,
  leverName: keyof LeverStateRow,
  newValue: number,
  setLevers: (l: LeverStateRow) => void,
  setComputed: (c: ComputedState) => void,
) {
  const oldValue = currentLevers[leverName] as number;
  const updatedLevers = { ...currentLevers, [leverName]: newValue };
  setLevers(updatedLevers); // optimistic

  try {
    await supabase
      .from("lever_state")
      .update({ [leverName]: newValue, updated_at: new Date().toISOString() })
      .eq("destination_id", VENICE_ID);
  } catch {
    /* DB not reachable yet */
  }

  const result = await recalculate(updatedLevers, currentDemand, leverName, oldValue, newValue);
  setComputed(result);
}

/** Year change: levers stay; demand context swaps; recompute against that year. */
export async function handleYearChange(
  currentLevers: LeverStateRow,
  newYear: number,
  setSelectedYear: (y: number) => void,
  setDemand: (d: DemandRow) => void,
  setComputed: (c: ComputedState) => void,
) {
  setSelectedYear(newYear);
  const { data: newDemand } = await supabase
    .from("historical_demand")
    .select("*")
    .eq("destination_id", VENICE_ID)
    .eq("year", newYear)
    .single();
  if (!newDemand) return;
  setDemand(newDemand as DemandRow);
  const result = await recalculate(currentLevers, newDemand as DemandRow, "context_year_change", null, newYear);
  setComputed(result);
}
