import { useRef, useState } from "react";
import { useStore } from "./useStore";
import { setLever, type LeverId } from "./state";
import { fmtCompactNum, fmtNumber } from "./format";

type LeverMeta = {
  label: string;
  sub: string;
  prefix?: string;
  suffix?: string;
  /** Suffix shown on the min/max tick labels (kept terse vs. the value suffix). */
  tickSuffix?: string;
  format: (v: number) => string;
};

const LEVER_META: Record<LeverId, LeverMeta> = {
  target_capacity: {
    label: "Target capacity",
    sub: "100% anchor",
    suffix: "/day",
    format: (v) => fmtNumber(v),
  },
  base_fee: {
    label: "Base fee at target",
    sub: "Fee at 100%",
    prefix: "€",
    format: (v) => String(v),
  },
  max_fee_cap: {
    label: "Max-fee cap",
    sub: "Asymptote of curve",
    prefix: "€",
    format: (v) => String(v),
  },
  ceiling_pct: {
    label: "Capacity ceiling",
    sub: "Where curve goes near-vertical",
    suffix: "%",
    tickSuffix: "%",
    format: (v) => String(v),
  },
};

/** Tick label for a lever bound — derived from the payload's min/max so the
 *  slider always reflects the loaded DPM bounds (never hardcoded). */
function fmtTick(v: number, meta: LeverMeta): string {
  const num = Math.abs(v) >= 10000 ? fmtCompactNum(v) : String(v);
  return (meta.prefix || "") + num + (meta.tickSuffix || "");
}

function LeverRow({ id }: { id: LeverId }) {
  const state = useStore();
  const lever = state?.levers.find((l) => l.id === id);
  const meta = LEVER_META[id];
  const [flashing, setFlashing] = useState(false);
  const flashRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  if (!state || !lever || !meta) return null;

  const pct = (lever.value - lever.min) / (lever.max - lever.min);

  return (
    <div className={"lever" + (flashing ? " flashing" : "")}>
      <div className="lever-label">
        {meta.label}
        <div className="lever-sub">{meta.sub}</div>
      </div>
      <div className="lever-value">
        {meta.prefix || ""}
        {meta.format(lever.value)}
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
          <span>{fmtTick(lever.min, meta)}</span>
          <span>{fmtTick(lever.max, meta)}</span>
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
        {ids.map((id) => (
          <LeverRow key={id} id={id} />
        ))}
      </div>
    </section>
  );
}
