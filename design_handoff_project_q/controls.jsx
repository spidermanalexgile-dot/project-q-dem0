/* Project Q — top bar, revenue panel, levers panel.
 * All three subscribe to the single store. All mutations flow through window.ProjectQ.
 */

const { useEffect: useEffectC, useRef: useRefC, useState: useStateC, useMemo } = React;

function fmtBigEur(n) {
  const v = Math.round(n);
  return "€\u00A0" + Math.abs(v).toLocaleString("en-US") + (v < 0 ? "" : "");
}
function fmtCompactEur(n) {
  const v = Math.round(n);
  const abs = Math.abs(v);
  const sign = v < 0 ? "−" : v > 0 ? "+" : "";
  if (abs >= 1_000_000_000) return sign + "€" + (abs / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + "B";
  if (abs >= 1_000_000) return sign + "€" + (abs / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (abs >= 10_000) return sign + "€" + Math.round(abs / 1_000) + "k";
  if (abs >= 1_000) return sign + "€" + (abs / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return sign + "€" + abs;
}
function fmtNumber(n) {
  return Math.round(n).toLocaleString("en-US");
}

// ---------- TOP BAR ----------
function TopBar() {
  const state = window.useStore();
  if (!state) return null;
  const activeDay = state.day_types.find((d) => d.id === state.activeDay) || state.day_types[0];
  const year = state.phase.year;

  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true" />
        <div>
          <div className="brand-name">Project Q</div>
          <div className="brand-sub">Authority Control · v0.4</div>
        </div>
      </div>

      <div className="tb-context">
        <div className="tb-field">
          <div className="tb-label">Location</div>
          <div className="tb-select">
            <select
              value={state.location.id}
              onChange={(e) => {
                // single-payload demo — placeholder for loadPayload(otherCity)
                console.log("location change requested:", e.target.value);
              }}
            >
              <option value={state.location.id}>{state.location.label}</option>
              <option value="dubrovnik" disabled>Dubrovnik (load payload)</option>
              <option value="barcelona" disabled>Barcelona (load payload)</option>
            </select>
          </div>
        </div>

        <div style={{ width: 1, height: 32, background: "var(--hairline)" }} />

        <div className="tb-field">
          <div className="tb-label">Modelling day</div>
          <div className="tb-select">
            <select
              value={state.activeDay}
              onChange={(e) => window.ProjectQ.setDayType(e.target.value)}
            >
              {state.day_types.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label} · {d.date}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ width: 1, height: 32, background: "var(--hairline)" }} />

        <div className="tb-field">
          <div className="tb-label">Demand</div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 14,
              fontWeight: 500,
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid var(--hairline)",
              minWidth: 60,
              textAlign: "center",
            }}
          >
            {activeDay.demand_pct}%
          </div>
        </div>
      </div>

      <div className="tb-field" style={{ alignItems: "flex-end" }}>
        <div className="tb-label">Deployment phase</div>
        <div className="phase-toggle" role="tablist" aria-label="Deployment year">
          {[1, 2, 3].map((y) => (
            <button
              key={y}
              className={y === year ? "on" : ""}
              onClick={() => window.ProjectQ.setPhase(y)}
              aria-pressed={y === year}
            >
              YR&nbsp;{y}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
window.TopBar = TopBar;

// ---------- REVENUE PANEL ----------
function DeltaChip({ value }) {
  if (Math.abs(value) < 1) {
    return (
      <span className="delta-chip zero" aria-label="no change">
        — no change
      </span>
    );
  }
  const up = value > 0;
  return (
    <span className={"delta-chip " + (up ? "up" : "down")}>
      <svg viewBox="0 0 8 8" aria-hidden="true">
        {up ? (
          <path d="M0 6 L4 1 L8 6 Z" fill="currentColor" />
        ) : (
          <path d="M0 2 L4 7 L8 2 Z" fill="currentColor" />
        )}
      </svg>
      {(up ? "+" : "−") + fmtCompactEur(Math.abs(value)).replace(/^[+−]/, "")}
    </span>
  );
}

function RevenuePanel() {
  const state = window.useStore();
  if (!state) return null;
  const d = window.ProjectQ.compute();
  const dayDelta = d.dayRevenue - (d.prevDayRev ?? d.dayRevenue);
  const annualDelta = d.annualRevenue - (d.prevAnnualRev ?? d.annualRevenue);
  const activeDay = d.activeDay;

  return (
    <section className="panel panel-pad revenue-panel">
      <header className="panel-header">
        <div>
          <div className="panel-title">Revenue forecast</div>
          <div className="panel-sub" style={{ marginTop: 4 }}>
            Recomputes instantly
          </div>
        </div>
      </header>

      <div className="revenue-grid">
        <div className="rev-card">
          <div className="rev-label">Total day revenue</div>
          <div className="rev-figure day">
            <span className="currency">€</span>
            {fmtNumber(d.dayRevenue).replace(/^-/, "")}
            {d.dayRevenue < 0 && (
              <span style={{ color: "var(--penalty)", fontSize: "0.4em", marginLeft: 8 }}>
                NET CREDIT
              </span>
            )}
          </div>
          <div className="rev-foot">
            <span className="rev-note">{activeDay.date}</span>
            <DeltaChip value={dayDelta} />
          </div>
        </div>

        <div className="rev-card annual">
          <div className="rev-label">Projected annual revenue</div>
          <div className="rev-figure annual">
            <span className="currency">€</span>
            {fmtNumber(d.annualRevenue)}
          </div>
          <div className="rev-foot">
            <span className="rev-note">365-day rollup</span>
            <DeltaChip value={annualDelta} />
          </div>
        </div>
      </div>
    </section>
  );
}
window.RevenuePanel = RevenuePanel;

// ---------- LEVERS ----------
const LEVER_META = {
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
    format: (v) => v,
    ticks: ["€0", "€50"],
  },
  max_fee_cap: {
    label: "Max-fee cap",
    sub: "Asymptote of curve",
    prefix: "€",
    format: (v) => v,
    ticks: ["€10", "€200"],
  },
  ceiling_pct: {
    label: "Capacity ceiling",
    sub: "Where curve goes near-vertical",
    suffix: "%",
    format: (v) => v,
    ticks: ["120%", "250%"],
  },
};

function LeverRow({ id }) {
  const state = window.useStore();
  const lever = state.levers.find((l) => l.id === id);
  const meta = LEVER_META[id];
  const [flashing, setFlashing] = useStateC(false);
  const flashRef = useRefC();
  if (!lever || !meta) return null;

  const pct = (lever.value - lever.min) / (lever.max - lever.min);

  return (
    <div className={"lever" + (flashing ? " flashing" : "")}>
      <div className="lever-label">
        {meta.label}
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9.5,
            color: "var(--ink-soft)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginTop: 2,
            fontWeight: 400,
          }}
        >
          {meta.sub}
        </div>
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
            window.ProjectQ.setLever(id, Number(e.target.value));
            setFlashing(true);
            clearTimeout(flashRef.current);
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
  const state = window.useStore();
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
        onClick={() => window.ProjectQ.setRebate(!r.enabled)}
        role="switch"
        aria-checked={r.enabled}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            window.ProjectQ.setRebate(!r.enabled);
          }
        }}
      >
        <div className="knob" />
      </div>
    </div>
  );
}

function LeversPanel() {
  const state = window.useStore();
  if (!state) return null;
  const ids = state.levers.map((l) => l.id);
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
window.LeversPanel = LeversPanel;
