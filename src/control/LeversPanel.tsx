import { useRef, useState } from "react";
import { useStore } from "./useStore";
import {
  setLever,
  targetCapacity,
  activeOccupancyTarget,
  setOccupancyTarget,
  resetLevers,
  activeDayType,
  liveDemandPct,
  feeAtPct,
  isStatusQuo,
  type LeverId,
} from "./state";
import { fmtCompactNum, fmtEur, fmtNumber } from "./format";

/** The fee Q charges on the SELECTED day — the dynamic, per-day OUTPUT of the
 *  curve below. Negative (a credit) in the low season, high at the peak; it
 *  updates every time the modelled day changes, so the policy is visibly "not one
 *  size fits all" even though the levers (the year-long curve) stay put. */
function DayFeeRow() {
  const state = useStore();
  if (!state) return null;
  const day = activeDayType(state);
  const live = liveDemandPct(day.demand_pct, state);
  const fee = feeAtPct(live, state);
  // Status quo (before Q): it's just the flat €5 access fee, not a Q-set price.
  const quo = isStatusQuo(state);
  const cls = quo ? "" : fee < 0 ? " credit" : fee >= 40 ? " high" : fee >= 12 ? " warn" : "";
  return (
    <div className={"day-fee-row" + cls}>
      <div className="day-fee-head">
        <span className="day-fee-label">{quo ? "Current access fee" : "Fee Q sets for this day"}</span>
        <span className="day-fee-day">{day.date} · {Math.round(live)}%</span>
      </div>
      <div className="day-fee-figure">
        {fee < 0 ? `−€${Math.abs(Math.round(fee))}` : fmtEur(fee)}
        <span className="day-fee-tag">{quo ? "flat · status quo" : fee < 0 ? "paid to come" : "per visitor"}</span>
      </div>
    </div>
  );
}

const TARGET_MIN = 50;
const TARGET_MAX = 250;

/** The level Q steers the whole demand curve to — a draggable bar (touch-easy on
 *  the iPad), shown as both a % of capacity and an absolute headcount (55k =
 *  100%). Dragging it re-prices the year; the value syncs to the web view. */
function TargetCapacityRow() {
  const state = useStore();
  if (!state) return null;
  const base = targetCapacity(state); // the 100% capacity anchor (operating assumption)
  const pct = activeOccupancyTarget(state); // the level Q steers demand to
  const people = Math.round((base * pct) / 100); // absolute target headcount
  const off = pct !== 100; // steering away from capacity
  const fill = ((Math.max(TARGET_MIN, Math.min(TARGET_MAX, pct)) - TARGET_MIN) / (TARGET_MAX - TARGET_MIN)) * 100;
  return (
    <div className={"lever target-cap" + (off ? " custom" : "")}>
      <div className="lever-label">
        Target capacity
        <div className="lever-sub">Q steers demand here · 100% = capacity</div>
      </div>
      <div className="lever-value">
        {fmtNumber(people)}
        <span className="tc-pct">{pct}%</span>
      </div>
      <div className="slider-row">
        <div className="track">
          <div className="fill" style={{ width: fill + "%" }} />
        </div>
        <input
          type="range"
          min={TARGET_MIN}
          max={TARGET_MAX}
          step={5}
          value={Math.max(TARGET_MIN, Math.min(TARGET_MAX, pct))}
          onChange={(e) => setOccupancyTarget(Number(e.target.value))}
          aria-label="Target capacity — % of capacity Q steers demand to"
        />
        <div className="ticks">
          <span>{TARGET_MIN}%</span>
          <span>{TARGET_MAX}%</span>
        </div>
      </div>
    </div>
  );
}

type LeverMeta = {
  label: string;
  sub: string;
  prefix?: string;
  suffix?: string;
  /** Suffix shown on the min/max tick labels (kept terse vs. the value suffix). */
  tickSuffix?: string;
  format: (v: number) => string;
  /** When set, the slider value (in its own units) is shown as an absolute
   *  visitor count = round(targetCapacity × v/unitDivisor). Lets the Capacity
   *  ceiling read as people/day instead of a bare percentage. */
  asVisitors?: boolean;
};

const LEVER_META: Record<LeverId, LeverMeta> = {
  target_capacity: {
    label: "Target capacity",
    sub: "Normal-day visitors",
    suffix: "/day",
    format: (v) => fmtNumber(v),
  },
  base_fee: {
    // Goes negative → a credit that draws visitors into the low season.
    label: "Base fee at target",
    sub: "Fee at 100% · negative = credit",
    format: (v) => (v < 0 ? `−€${Math.abs(v)}` : `€${v}`),
  },
  max_fee_cap: {
    label: "Max-fee cap",
    sub: "Asymptote of curve",
    prefix: "€",
    format: (v) => String(v),
  },
  ceiling_pct: {
    label: "Capacity ceiling",
    sub: "Crowd limit",
    suffix: "/day",
    format: (v) => fmtNumber(v),
    asVisitors: true,
  },
};

/** Tick label for a lever bound — derived from the payload's min/max so the
 *  slider always reflects the loaded DPM bounds (never hardcoded). For visitor
 *  levers we convert the % bound to an absolute count using target capacity. */
function fmtTick(v: number, meta: LeverMeta, targetCap: number): string {
  const raw = meta.asVisitors ? Math.round((targetCap * v) / 100) : v;
  const num = Math.abs(raw) >= 10000 ? fmtCompactNum(raw) : String(raw);
  return (meta.prefix || "") + num + (meta.tickSuffix || "");
}

function LeverRow({ id }: { id: LeverId }) {
  const state = useStore();
  const lever = state?.levers.find((l) => l.id === id);
  const meta = LEVER_META[id];
  const [flashing, setFlashing] = useState(false);
  const flashRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  if (!state || !lever || !meta) return null;

  const targetCap = targetCapacity(state);
  const pct = (lever.value - lever.min) / (lever.max - lever.min);
  // For visitor levers the displayed value is the absolute count; we also show
  // the original % alongside so the relationship to the target is still clear.
  const displayValue = meta.asVisitors ? Math.round((targetCap * lever.value) / 100) : lever.value;
  const subText = meta.asVisitors ? `${meta.sub} · ${lever.value}% of target` : meta.sub;
  // Status quo (before Q, no lever touched): the levers are dormant — value shows
  // "—" and the slider is locked. "Let Q fix this" brings them to life.
  const dormant = isStatusQuo(state);

  return (
    <div className={"lever" + (flashing ? " flashing" : "") + (dormant ? " dormant" : "")}>
      <div className="lever-label">
        {meta.label}
        <div className="lever-sub">{subText}</div>
      </div>
      <div className="lever-value">
        {dormant ? (
          "—"
        ) : (
          <>
            {meta.prefix || ""}
            {meta.format(displayValue)}
            {meta.suffix || ""}
          </>
        )}
      </div>
      <div className="slider-row">
        <div className="track">
          <div className="fill" style={{ width: (dormant ? 0 : pct * 100) + "%" }} />
        </div>
        <input
          type="range"
          min={lever.min}
          max={lever.max}
          step={lever.step || 1}
          value={lever.value}
          disabled={dormant}
          onChange={(e) => {
            setLever(id, Number(e.target.value));
            setFlashing(true);
            if (flashRef.current) clearTimeout(flashRef.current);
            flashRef.current = setTimeout(() => setFlashing(false), 350);
          }}
          aria-label={meta.label}
        />
        <div className="ticks">
          <span>{fmtTick(lever.min, meta, targetCap)}</span>
          <span>{fmtTick(lever.max, meta, targetCap)}</span>
        </div>
      </div>
    </div>
  );
}

export function LeversPanel() {
  const state = useStore();
  if (!state) return null;
  const ids = state.levers.map((l) => l.id as LeverId);
  return (
    <section className="panel panel-pad levers-panel">
      <header className="panel-header">
        <div>
          <div className="panel-title">Levers</div>
          <div className="panel-sub" style={{ marginTop: 4 }}>
            Year-long policy · daily fee adapts
          </div>
        </div>
        <button
          type="button"
          className="lever-reset"
          onClick={() => resetLevers()}
          title="Reset levers to defaults and show the un-managed forecast crowd on the zoom-out"
        >
          Reset
        </button>
      </header>
      <div className="levers-list">
        <DayFeeRow />
        <TargetCapacityRow />
        {ids.map((id) => (
          <LeverRow key={id} id={id} />
        ))}
      </div>
    </section>
  );
}
