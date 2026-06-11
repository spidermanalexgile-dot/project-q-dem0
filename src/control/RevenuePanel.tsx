import { useEffect, useRef, useState } from "react";
import { useStore } from "./useStore";
import { compute, activeYear } from "./state";
import { fmtCompactEur, fmtEur, fmtNumber } from "./format";

/** Smoothly count a displayed number toward `target` (easeOutCubic) — the
 *  odometer effect for the sustainability dividend. */
function useCountUp(target: number): number {
  const ref = useRef(0);
  const raf = useRef(0);
  const [, bump] = useState(0);
  useEffect(() => {
    cancelAnimationFrame(raf.current);
    const from = ref.current;
    if (from === target) return;
    const start = performance.now();
    const dur = 1100;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      ref.current = from + (target - from) * e;
      bump((n) => n + 1);
      if (t < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target]);
  return ref.current;
}

/** Sustainability odometer — infrastructure-strain cost Q avoids by pulling the
 *  crowd down off the over-capacity peaks. Counts up as the saving grows. */
function StrainOdometer({ saved }: { saved: number }) {
  const shown = useCountUp(saved);
  const digits = fmtNumber(Math.round(shown));
  return (
    <div className={"strain-odo" + (saved > 0 ? " active" : "")}>
      <div className="strain-odo-head">
        <span className="strain-odo-label">Sustainability dividend</span>
        <span className="strain-odo-sub">infrastructure strain avoided · this year</span>
      </div>
      <div className="strain-odo-figure" aria-label={`€${digits} of strain cost avoided`}>
        <span className="currency">€</span>
        <span className="strain-odo-digits">
          {digits.split("").map((c, i) =>
            c === "," ? (
              <span key={i} className="sep">
                ,
              </span>
            ) : (
              <span key={i} className="reel">
                {c}
              </span>
            ),
          )}
        </span>
      </div>
      <div className="strain-odo-foot">
        {saved > 0
          ? "overuse cost saved as Q flattens the peaks"
          : "engage Q to relieve over-capacity strain"}
      </div>
    </div>
  );
}

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
  // Highlight the figure green when revenue rose, red when it fell (since the
  // last change); neutral when unchanged.
  const trendClass = (delta: number) =>
    Math.abs(delta) < 1 ? "" : delta > 0 ? " up" : " down";
  // Multi-year (5-year) bundle → label the annual figure with the focused year.
  const multiYear = !!state.daily && state.daily.length > 400;
  const yr = multiYear ? activeYear(state) : 0;
  // What one visitor pays today, at the crowd level being modelled. Below the
  // credit threshold this can be negative (a rebate); we show it plainly.
  const todayFee = d.fee(activeDay.demand_pct);

  return (
    <section className="panel panel-pad revenue-panel">
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
          <div className={"rev-figure day" + trendClass(dayDelta)}>
            {fmtEur(Math.abs(d.dayRevenue))}
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
          <div className="rev-label">{multiYear ? `${yr} annual revenue` : "Projected annual revenue"}</div>
          <div className={"rev-figure annual" + trendClass(annualDelta)}>
            {fmtEur(d.annualRevenue)}
          </div>
          <div className="rev-foot">
            <span className="rev-note">{multiYear ? `${yr} full year` : "365-day rollup"}</span>
            <DeltaChip value={annualDelta} />
          </div>
        </div>
      </div>

      <StrainOdometer saved={d.strainSaved} />
    </section>
  );
}
