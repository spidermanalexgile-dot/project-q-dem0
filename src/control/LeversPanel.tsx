import { useRef, useState } from "react";
import { useStore } from "./useStore";
import { setLever, setRebate, type LeverId } from "./state";
import { fmtNumber } from "./format";

type LeverMeta = {
  label: string;
  sub: string;
  prefix?: string;
  suffix?: string;
  format: (v: number) => string;
  ticks: [string, string];
};

const LEVER_META: Record<LeverId, LeverMeta> = {
  target_capacity: {
    label: "Target capacity",
    sub: "100% anchor",
    suffix: "/day",
    format: (v) => fmtNumber(v),
    ticks: ["20k", "120k"],
  },
  base_fee: {
    label: "Base fee at target",
    sub: "Fee at 100%",
    prefix: "€",
    format: (v) => String(v),
    ticks: ["€0", "€50"],
  },
  max_fee_cap: {
    label: "Max-fee cap",
    sub: "Asymptote of curve",
    prefix: "€",
    format: (v) => String(v),
    ticks: ["€10", "€200"],
  },
  ceiling_pct: {
    label: "Capacity ceiling",
    sub: "Where curve goes near-vertical",
    suffix: "%",
    format: (v) => String(v),
    ticks: ["120%", "250%"],
  },
};

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
          <span>{meta.ticks[0]}</span>
          <span>{meta.ticks[1]}</span>
        </div>
      </div>
    </div>
  );
}

function RebateRow() {
  const state = useStore();
  if (!state) return null;
  const r = state.shoulder_rebate;
  return (
    <div className="rebate-row">
      <div className="rebate-text">
        <strong style={{ fontWeight: 500 }}>Shoulder-season recirculation</strong>
        <span className="meta">
          Below {r.applies_below_pct}% capacity · €{r.credit} Q-Cash to local business
        </span>
      </div>
      <div
        className={"switch " + (r.enabled ? "on" : "")}
        onClick={() => setRebate(!r.enabled)}
        role="switch"
        aria-checked={r.enabled}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            setRebate(!r.enabled);
          }
        }}
      >
        <div className="knob" />
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
        <RebateRow />
      </div>
    </section>
  );
}
