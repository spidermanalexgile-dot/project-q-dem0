import { useRef, useState } from "react";
import { useStore } from "./useStore";
import { setLever, setTargetCapacity, targetCapacity, type LeverId } from "./state";
import { fmtCompactNum, fmtNumber } from "./format";

/** Target capacity is an operator INPUT (visitors/day), shown at the top of the
 *  Levers panel — lowering it rebases the whole demand model to a higher %. */
function TargetCapacityRow() {
  const state = useStore();
  if (!state) return null;
  const target = targetCapacity(state);
  const baseline = state.capacity.baseline || target;
  return (
    <div className={"lever lever-input" + (target !== baseline ? " custom" : "")}>
      <div className="lever-label">
        Target capacity
        <div className="lever-sub">Visitors/day · rebases demand</div>
      </div>
      <div className="lever-input-box">
        <input
          type="number"
          min={5000}
          max={120000}
          step={1000}
          value={target}
          onChange={(e) => {
            if (e.target.value !== "") setTargetCapacity(Number(e.target.value));
          }}
          aria-label="Target capacity in visitors per day"
        />
        <span>/day</span>
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

  return (
    <div className={"lever" + (flashing ? " flashing" : "")}>
      <div className="lever-label">
        {meta.label}
        <div className="lever-sub">{subText}</div>
      </div>
      <div className="lever-value">
        {meta.prefix || ""}
        {meta.format(displayValue)}
        {meta.suffix || ""}
      </div>
      <div className="slider-row">
        <div className="track">
          <div className="fill" style={{ width: pct * 100 + "%" }} />
        </div>
        <input
          type="range"
          min={lever.min}
          max={lever.max}
          step={lever.step || 1}
          value={lever.value}
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
            Move any one · resolves &lt;1s
          </div>
        </div>
      </header>
      <div className="levers-list">
        <TargetCapacityRow />
        {ids.map((id) => (
          <LeverRow key={id} id={id} />
        ))}
      </div>
    </section>
  );
}
