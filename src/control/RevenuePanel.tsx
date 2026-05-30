import { useStore } from "./useStore";
import { compute } from "./state";
import { fmtCompactEur, fmtEur, fmtNumber } from "./format";

function DeltaChip({ value }: { value: number }) {
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

export function RevenuePanel() {
  const state = useStore();
  if (!state) return null;
  const d = compute();
  const dayDelta = d.dayRevenue - (d.prevDayRev ?? d.dayRevenue);
  const annualDelta = d.annualRevenue - (d.prevAnnualRev ?? d.annualRevenue);
  const activeDay = d.activeDay;
  // What one visitor pays today, at the crowd level being modelled. Below the
  // credit threshold this can be negative (a rebate); we show it plainly.
  const todayFee = d.fee(activeDay.demand_pct);

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

      <div className="sustain-fee">
        <div className="sustain-fee-label">Sustainability fee if booked today</div>
        <div className="sustain-fee-figure">{fmtEur(todayFee)}</div>
        <div className="sustain-fee-note">
          per visitor · {activeDay.demand_pct}% of a normal day · {activeDay.date}
        </div>
      </div>

      <div className="revenue-grid">
        <div className="rev-card">
          <div className="rev-label">Total day revenue</div>
          <div className="rev-figure day">
            <span className="currency">€</span>
            {fmtNumber(d.dayRevenue).replace(/^-/, "")}
            {d.dayRevenue < 0 && (
              <span
                style={{ color: "var(--penalty)", fontSize: "0.4em", marginLeft: 8 }}
              >
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
