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
import { setElevenCredentials, setElevenVoice, listFemaleVoices } from "./speech";

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
  shape: { plateau_end_pct: number; exponent: number };
};

export type SeasonalBin = { days: number; demand_pct: number };

export type Phase = { year: 1 | 2 | 3; real_pay_cap: number };

export type State = {
  location: { id: string; label: string; currency: string };
  capacity: { target: number; unit: string };
  confidence: number;
  curve: CurveSpec;
  shoulder_rebate: ShoulderRebate;
  levers: Lever[];
  day_types: DayType[];
  phase: Phase;
  seasonal: SeasonalBin[];

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

export function feeAtPct(pct: number, snap: State = requireState()): number {
  const rebate = snap.shoulder_rebate;
  if (rebate && rebate.enabled && pct < rebate.applies_below_pct) {
    return -rebate.credit;
  }
  const base = leverVal(snap, "base_fee");
  const cap = leverVal(snap, "max_fee_cap");
  const ceiling = leverVal(snap, "ceiling_pct");
  const plateauEnd = snap.curve.shape.plateau_end_pct;
  const exp = snap.curve.shape.exponent;
  if (pct <= plateauEnd) return base;
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
  const fee = Math.max(0, feeAtPct(raw_pct, snap));
  const target = occupancyTarget(snap);
  const compression = Math.exp(-fee / DEMAND_REF_EUR); // 1 at €0 fee → →0 as fee climbs
  return target + (raw_pct - target) * compression;
}

export function dayRevenue(demand_pct: number, snap: State = requireState()): number {
  const tc = leverVal(snap, "target_capacity");
  const visitors = tc * (demand_pct / 100);
  return visitors * feeAtPct(demand_pct, snap);
}

export function annualRevenue(snap: State = requireState()): number {
  let total = 0;
  for (const s of snap.seasonal) total += s.days * dayRevenue(s.demand_pct, snap);
  return total;
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
  prevDayRev = s.__lastDayRev ?? dayRevenue(activeDayType().demand_pct);
  prevAnnualRev = s.__lastAnnualRev ?? annualRevenue();
  if (deltaTimer) clearTimeout(deltaTimer);
  s.__deltaSeq = (s.__deltaSeq || 0) + 1;
}

function commitDeltas() {
  const s = requireState();
  s.__lastDayRev = dayRevenue(activeDayType().demand_pct);
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

export function loadPayload(input: Payload | string): void {
  const parsed: Payload = isMarkdownString(input) ? parseMarkdownPayload(input) : input;
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
  // Shoulder-season recirculation has been retired from the product. Force it
  // off on every load so no payload (legacy or uploaded) can re-introduce the
  // credit zone in the curve or revenue.
  if (next.shoulder_rebate) next.shoulder_rebate.enabled = false;
  if (!next.phase) next.phase = { year: 1, real_pay_cap: 20 };
  // Initialise delta-tracking fields against the new state.
  next.__lastDayRev = 0;
  next.__lastAnnualRev = 0;
  next.__prevDayRev = 0;
  next.__prevAnnualRev = 0;
  state = next;
  state.__lastDayRev = dayRevenue(activeDayType().demand_pct);
  state.__lastAnnualRev = annualRevenue();
  state.__prevDayRev = state.__lastDayRev;
  state.__prevAnnualRev = state.__lastAnnualRev;
  notify();
}

export function setLever(id: LeverId | string, value: number): void {
  const s = requireState();
  const l = s.levers.find((x) => x.id === id);
  if (!l) return;
  const v = Math.max(l.min, Math.min(l.max, Number(value)));
  if (l.value === v) return;
  bumpDeltas();
  l.value = v;
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
  commitDeltas();
  notify();
}

/**
 * Model a specific calendar date ("YYYY-MM-DD"). The demand % is interpolated
 * from the DPM's own day_type date anchors (see demandForISO). Pass null to
 * revert to the selected preset day. Deterministic — same date → same demand.
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
  const demand = demandForISO(iso, s.day_types);
  if (demand == null) return; // malformed date — ignore, keep current state
  if (s.customDate === iso && s.customDemand === demand) return;
  bumpDeltas();
  s.customDate = iso;
  s.customDemand = demand;
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
    dayRevenue: dayRevenue(dt.demand_pct, s),
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
  setLever: typeof setLever;
  setDayType: typeof setDayType;
  setDemand: typeof setDemand;
  setDate: typeof setDate;
  setView: typeof setView;
  setOccupancyTarget: typeof setOccupancyTarget;
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
  annualRevenue: () => number;
  /** Parse + apply a natural-language voice/text command; returns the spoken
   *  confirmation string (theme changes are UI-side and a no-op here). */
  voiceCommand: (transcript: string) => string;
  /** Ask the deterministic analyst a question; returns its text answer (any
   *  suggested lever change is surfaced in the in-UI chat, not auto-applied). */
  askAnalyst: (question: string) => string;
  /** Enable the premium ElevenLabs voice (key persisted to localStorage). The
   *  optional `voice` is a female voice name ("Charlotte") or curated id; anything
   *  else falls back to the default female voice. Pass null key to clear. */
  setVoiceApiKey: (key: string | null, voice?: string) => void;
  /** Switch the premium female voice by name without re-entering the key. */
  setVoice: (voice: string) => void;
  /** List the selectable female voices (name + short description). */
  listVoices: () => { name: string; note: string }[];
};

export function installGlobalApi(): void {
  if (typeof window === "undefined") return;
  const api: ProjectQApi = {
    loadPayload,
    setLever,
    setDayType,
    setDemand,
    setDate,
    setView,
    setOccupancyTarget,
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
    annualRevenue: () => annualRevenue(),
    voiceCommand: (transcript: string) =>
      executeVoiceCommand(transcript, { getState, setLever, setDemand, setDayType, setDate, setView, setOccupancyTarget }),
    askAnalyst: (question: string) => {
      const s = getState();
      return s ? ask(question, s).answer : "No payload loaded yet.";
    },
    setVoiceApiKey: (key: string | null, voice?: string) => setElevenCredentials(key, voice),
    setVoice: (voice: string) => setElevenVoice(voice),
    listVoices: () => listFemaleVoices(),
  };
  (window as unknown as { ProjectQ: ProjectQApi }).ProjectQ = api;
}

declare global {
  interface Window {
    ProjectQ: ProjectQApi;
  }
}
