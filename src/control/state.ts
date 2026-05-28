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

  // delta-tracking internals
  __lastDayRev: number;
  __lastAnnualRev: number;
  __prevDayRev: number;
  __prevAnnualRev: number;
  __deltaSeq?: number;
};

export type Payload = Omit<
  State,
  "activeDay" | "__lastDayRev" | "__lastAnnualRev" | "__prevDayRev" | "__prevAnnualRev" | "__deltaSeq"
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

export function loadPayload(input: Payload | string): void {
  const parsed: Payload = isMarkdownString(input) ? parseMarkdownPayload(input) : input;
  validatePayload(parsed);
  // Defensive deep clone so we don't mutate a caller's object.
  const next = JSON.parse(JSON.stringify(parsed)) as State;
  if (!next.activeDay) next.activeDay = next.day_types[0].id;
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
  if (s.activeDay === id) return;
  bumpDeltas();
  s.activeDay = id;
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

export function setRebate(enabled: boolean): void {
  const s = requireState();
  if (s.shoulder_rebate.enabled === enabled) return;
  bumpDeltas();
  s.shoulder_rebate.enabled = enabled;
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
  setPhase: typeof setPhase;
  setRebate: typeof setRebate;
  getState: typeof getState;
  subscribe: typeof subscribe;
  compute: typeof compute;
  feeAtPct: (pct: number) => number;
  payAtPct: (pct: number) => number;
  qcashAtPct: (pct: number) => number;
  dayRevenue: (demand_pct: number) => number;
  annualRevenue: () => number;
};

export function installGlobalApi(): void {
  if (typeof window === "undefined") return;
  const api: ProjectQApi = {
    loadPayload,
    setLever,
    setDayType,
    setPhase,
    setRebate,
    getState,
    subscribe,
    compute,
    feeAtPct: (pct: number) => feeAtPct(pct),
    payAtPct: (pct: number) => payAtPct(pct),
    qcashAtPct: (pct: number) => qcashAtPct(pct),
    dayRevenue: (demand_pct: number) => dayRevenue(demand_pct),
    annualRevenue: () => annualRevenue(),
  };
  (window as unknown as { ProjectQ: ProjectQApi }).ProjectQ = api;
}

declare global {
  interface Window {
    ProjectQ: ProjectQApi;
  }
}
