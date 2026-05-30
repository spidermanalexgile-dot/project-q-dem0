import { useStore } from "./useStore";
import { feeAtPct, payAtPct, activeDayType, setView, type State } from "./state";
import { fmtEur } from "./format";

function leverV(state: State, id: string): number {
  const l = state.levers.find((x) => x.id === id);
  if (!l) throw new Error("missing lever " + id);
  return l.value;
}

/* ─── Hero curve chart ───────────────────────────────────────────────────── */

function CurveChart() {
  const state = useStore();
  if (!state) return <div className="curve-stage" />;

  // Fixed viewBox — SVG scales via CSS.
  const w = 1000;
  const h = 580;
  const padL = 56;
  const padR = 28;
  const padT = 30;
  const padB = 52;
  const innerW = Math.max(1, w - padL - padR);
  const innerH = Math.max(1, h - padT - padB);

  const xMin = 20;
  const xMax = 250;

  const cap = leverV(state, "max_fee_cap");
  const base = leverV(state, "base_fee");
  const ceilingPct = leverV(state, "ceiling_pct");
  const rebate = state.shoulder_rebate;
  const credit = rebate.enabled ? rebate.credit : 0;
  const threshold = rebate.enabled ? rebate.applies_below_pct : null;
  const realPayCap = state.phase.real_pay_cap;

  const yMax = Math.max(cap + Math.max(8, cap * 0.1), base + 12);
  const yMin = rebate.enabled ? -credit - 4 : -3;

  const xS = (pct: number) => padL + ((pct - xMin) / (xMax - xMin)) * innerW;
  const yS = (fee: number) => padT + (1 - (fee - yMin) / (yMax - yMin)) * innerH;

  // Curve sample points — 1° resolution, skipping credit-zone discontinuity.
  const mainStart = threshold != null ? Math.max(threshold, xMin) : xMin;
  const pts: { pct: number; fee: number; x: number; y: number }[] = [];
  for (let pct = mainStart; pct <= xMax; pct += 1) {
    const f = feeAtPct(pct, state);
    pts.push({ pct, fee: f, x: xS(pct), y: yS(f) });
  }
  const pathD = pts
    .map((p, i) => (i ? "L" : "M") + p.x.toFixed(1) + "," + p.y.toFixed(1))
    .join(" ");
  const payD = pts
    .map(
      (p, i) =>
        (i ? "L" : "M") +
        p.x.toFixed(1) +
        "," +
        yS(Math.min(p.fee, realPayCap)).toFixed(1),
    )
    .join(" ");

  // Q-Cash band polygon (between fee curve and pay-line where fee > realPayCap).
  let qcashPolyPoints: string[] = [];
  const overCap = pts.filter((p) => p.fee > realPayCap);
  if (overCap.length > 1) {
    qcashPolyPoints = [
      ...overCap.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`),
      ...overCap
        .slice()
        .reverse()
        .map((p) => `${p.x.toFixed(1)},${yS(realPayCap).toFixed(1)}`),
    ];
  }

  // Active day dot + callout.
  const activeDay =
    activeDayType(state);
  const activeFee = feeAtPct(activeDay.demand_pct, state);
  const activePay = payAtPct(activeDay.demand_pct, state);
  const ax = xS(Math.min(xMax, Math.max(xMin, activeDay.demand_pct)));
  const ay = yS(activeFee);

  // Y gridline values (whole €).
  const yStep = cap >= 100 ? 20 : cap >= 40 ? 10 : 5;
  const yGrid: number[] = [];
  for (let v = 0; v <= yMax + yStep - 0.01; v += yStep) yGrid.push(v);

  // Callout placement: flip left if it'd overflow.
  const calloutW = 138;
  const calloutH = 36;
  const calloutLeft =
    ax > w - padR - calloutW - 14 ? ax - calloutW - 14 : ax + 14;
  const calloutTop = Math.max(padT + 24, ay - calloutH - 6);

  return (
    <div className="curve-stage">
      <svg className="curve-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="curve-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" style={{ stopColor: "var(--curve-stop-1)" }} />
            <stop offset="38%" style={{ stopColor: "var(--curve-stop-2)" }} />
            <stop offset="80%" style={{ stopColor: "var(--curve-stop-3)" }} />
            <stop offset="100%" style={{ stopColor: "var(--curve-stop-3)" }} />
          </linearGradient>
          <linearGradient id="curve-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E0763C" stopOpacity="0.20" />
            <stop offset="60%" stopColor="#E3A93C" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#E3A93C" stopOpacity="0" />
          </linearGradient>
          <filter id="soft-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        {/* Horizontal gridlines (left-hand €-axis number labels intentionally
            omitted — the curve markers + active-day callout carry the values). */}
        {yGrid.map((v) => (
          <g key={"yg-" + v}>
            <line
              x1={padL}
              y1={yS(v)}
              x2={w - padR}
              y2={yS(v)}
              stroke="currentColor"
              opacity={v === 0 ? 0.18 : 0.07}
            />
          </g>
        ))}

        {/* Real-pay cap dashed line */}
        {realPayCap < cap && (
          <g>
            <line
              x1={padL}
              y1={yS(realPayCap)}
              x2={w - padR}
              y2={yS(realPayCap)}
              stroke="#54C9B5"
              strokeWidth="1"
              strokeDasharray="2 4"
              opacity="0.6"
            />
            <text
              x={padL + 4}
              y={yS(realPayCap) - 5}
              textAnchor="start"
              style={{
                fill: "#2c8676",
                fontFamily: "var(--font-mono)",
                fontSize: 9.5,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              Real pay cap · €{realPayCap}
            </text>
          </g>
        )}

        {/* X ticks */}
        {[20, 50, 100, 150, 200, 250].map((p) => (
          <g key={"xt-" + p}>
            <line
              x1={xS(p)}
              y1={yS(yMin)}
              x2={xS(p)}
              y2={yS(yMin) + 5}
              stroke="currentColor"
              opacity="0.25"
            />
            <text
              x={xS(p)}
              y={yS(yMin) + 20}
              textAnchor="middle"
              className="curve-tick-label"
            >
              {p}%
            </text>
          </g>
        ))}

        {/* Axis label */}
        <text
          x={w - padR}
          y={h - 8}
          textAnchor="end"
          style={{
            fill: "var(--ink-soft)",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
          }}
        >
          Capacity vs. target
        </text>

        {/* Q-Cash band */}
        {qcashPolyPoints.length > 0 && (
          <polygon points={qcashPolyPoints.join(" ")} fill="#54C9B5" opacity="0.18" />
        )}

        {/* Filled area under fee curve (warm wash) */}
        <path
          d={
            pathD +
            ` L ${xS(xMax).toFixed(1)},${yS(yMin).toFixed(1)} L ${xS(mainStart).toFixed(1)},${yS(yMin).toFixed(1)} Z`
          }
          fill="url(#curve-fill)"
        />

        {/* Credit zone (band + bold line + dashed connector) */}
        {rebate.enabled && threshold !== null && (
          <g>
            <rect
              x={xS(xMin)}
              y={yS(0)}
              width={xS(threshold) - xS(xMin)}
              height={yS(-credit) - yS(0)}
              fill="#9DBA77"
              opacity="0.20"
              rx="4"
            />
            <line
              x1={xS(xMin)}
              y1={yS(-credit)}
              x2={xS(threshold)}
              y2={yS(-credit)}
              stroke="#5a7d3b"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <line
              x1={xS(threshold)}
              y1={yS(-credit)}
              x2={xS(threshold)}
              y2={yS(0)}
              stroke="#5a7d3b"
              strokeWidth="1.5"
              strokeDasharray="3 3"
              opacity="0.5"
            />
            <text
              x={xS(xMin) + 6}
              y={yS(-credit) + 14}
              className="curve-marker-label"
              style={{ fill: "#5a7d3b", fontWeight: 500, fontSize: 10.5 }}
            >
              Shoulder credit −€{credit}
            </text>
          </g>
        )}

        {/* Pay-line (real out-of-pocket) */}
        <path
          d={payD}
          fill="none"
          style={{ stroke: "var(--ink)" }}
          strokeWidth="1.5"
          strokeDasharray="5 5"
          opacity="0.42"
        />

        {/* Fee curve — main hero stroke (glow under + crisp top) */}
        <path
          d={pathD}
          fill="none"
          stroke="url(#curve-grad)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.35"
          filter="url(#soft-glow)"
        />
        <path
          d={pathD}
          fill="none"
          stroke="url(#curve-grad)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Target marker (100%) */}
        <g>
          <line
            x1={xS(100)}
            y1={padT + 18}
            x2={xS(100)}
            y2={yS(yMin)}
            stroke="#E3A93C"
            strokeWidth="1"
            strokeDasharray="3 4"
            opacity="0.8"
          />
          <g transform={`translate(${xS(100)}, ${padT + 4})`}>
            <rect x="-30" y="0" width="60" height="18" rx="9" fill="#E3A93C" />
            <text
              x="0"
              y="12"
              textAnchor="middle"
              style={{
                fill: "#1C1917",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.12em",
              }}
            >
              TARGET
            </text>
          </g>
        </g>

        {/* Ceiling marker */}
        <g>
          <line
            x1={xS(ceilingPct)}
            y1={padT + 18}
            x2={xS(ceilingPct)}
            y2={yS(yMin)}
            stroke="#E0763C"
            strokeWidth="1"
            strokeDasharray="3 4"
            opacity="0.8"
          />
          <g transform={`translate(${xS(ceilingPct)}, ${padT + 4})`}>
            <rect x="-34" y="0" width="68" height="18" rx="9" fill="#E0763C" />
            <text
              x="0"
              y="12"
              textAnchor="middle"
              style={{
                fill: "#FBF6EC",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.12em",
              }}
            >
              CEILING
            </text>
          </g>
        </g>

        {/* Active day dot */}
        <g>
          <circle cx={ax} cy={ay} r="14" style={{ fill: "var(--ink)" }} opacity="0.06" />
          <circle cx={ax} cy={ay} r="7" style={{ fill: "var(--ink)" }} />
          <circle cx={ax} cy={ay} r="3" style={{ fill: "var(--ink-inverse)" }} />
        </g>

        {/* Active day callout */}
        <g transform={`translate(${calloutLeft}, ${calloutTop})`}>
          <rect x="0" y="0" width={calloutW} height={calloutH} rx="8" style={{ fill: "var(--ink)" }} />
          <text
            x="10"
            y="13"
            style={{
              fill: "#E3A93C",
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
          >
            At {activeDay.demand_pct}% capacity
          </text>
          <text
            x="10"
            y="28"
            style={{
              fill: "var(--ink-inverse)",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            Fee {fmtEur(activeFee)}
            {activeFee > realPayCap && (
              <tspan style={{ fill: "#54C9B5", fontSize: 10.5, fontWeight: 400 }}>
                {" "}
                · pay {fmtEur(activePay)}
              </tspan>
            )}
          </text>
        </g>
      </svg>
    </div>
  );
}

/* ─── Annual demand profile ("zoom out" — whole-year DPM view) ───────────── */

/** Plain-English crowd descriptor for a demand %, so a non-technical viewer can
 *  read the chart at a glance. Demand % = visitors that day vs. the target/normal
 *  day (100% = a normal full day; 200% = twice as crowded). */
function crowdLabel(demandPct: number): string {
  if (demandPct >= 175) return "Very busy";
  if (demandPct >= 125) return "Busy";
  if (demandPct >= 85) return "Normal";
  if (demandPct >= 50) return "Quiet";
  return "Very quiet";
}

function YearCurve() {
  const state = useStore();
  if (!state) return <div className="curve-stage" />;

  const w = 1000;
  const h = 580;
  const padL = 56;
  const padR = 28;
  const padT = 30;
  const padB = 52;
  const innerW = Math.max(1, w - padL - padR);
  const innerH = Math.max(1, h - padT - padB);

  const cap = leverV(state, "max_fee_cap");
  const totalDays = state.seasonal.reduce((a, s) => a + s.days, 0) || 365;
  const peakDemand = Math.max(100, ...state.seasonal.map((s) => s.demand_pct));
  const yMax = Math.ceil((peakDemand * 1.12) / 20) * 20;

  const xS = (d: number) => padL + (d / totalDays) * innerW;
  const yS = (v: number) => padT + (1 - v / yMax) * innerH;
  const baseY = yS(0);

  // Load-duration style: sort the DPM seasonal bins by demand (desc) and lay
  // them across the 365-day axis — a single glance shows how many days a year
  // sit at each demand level, coloured by the fee that level would charge.
  const bins = [...state.seasonal].sort((a, b) => b.demand_pct - a.demand_pct);
  type Band = {
    x0: number;
    x1: number;
    y: number;
    color: string;
    demand: number;
    days: number;
    fee: number;
  };
  const bands: Band[] = [];
  const stepPts: string[] = [];
  let cum = 0;
  for (const b of bins) {
    const x0 = xS(cum);
    const x1 = xS(cum + b.days);
    const y = yS(Math.min(yMax, b.demand_pct));
    const fee = feeAtPct(b.demand_pct, state);
    const ratio = cap > 0 ? fee / cap : 0;
    const color =
      fee < 0
        ? "var(--sage)"
        : ratio > 0.7
          ? "var(--penalty)"
          : ratio > 0.3
            ? "var(--ochre)"
            : "var(--sage)";
    bands.push({ x0, x1, y, color, demand: b.demand_pct, days: b.days, fee });
    stepPts.push(`${x0.toFixed(1)},${y.toFixed(1)}`, `${x1.toFixed(1)},${y.toFixed(1)}`);
    cum += b.days;
  }
  const stepPath = stepPts.map((p, i) => (i ? "L" : "M") + p).join(" ");
  const areaPath =
    stepPath +
    ` L ${xS(totalDays).toFixed(1)},${baseY.toFixed(1)} L ${xS(0).toFixed(1)},${baseY.toFixed(1)} Z`;

  // Y gridlines.
  const yStep = yMax > 250 ? 50 : 25;
  const yGrid: number[] = [];
  for (let v = 0; v <= yMax + 0.01; v += yStep) yGrid.push(v);

  // X ticks (quarters of the year).
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(totalDays * f));

  const activeDay =
    activeDayType(state);
  const activeY = yS(Math.min(yMax, activeDay.demand_pct));

  return (
    <div className="curve-stage">
      <svg className="curve-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="year-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E0763C" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#E3A93C" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Horizontal gridlines + %-axis ticks */}
        {yGrid.map((v) => (
          <g key={"yg-" + v}>
            <line
              x1={padL}
              y1={yS(v)}
              x2={w - padR}
              y2={yS(v)}
              stroke="currentColor"
              opacity={v === 0 ? 0.18 : 0.07}
            />
            <text x={padL - 10} y={yS(v) + 4} textAnchor="end" className="curve-tick-label">
              {v}%
            </text>
          </g>
        ))}

        {/* X ticks (cumulative days of the year) */}
        {xTicks.map((d, i) => (
          <g key={"xt-" + i}>
            <line x1={xS(d)} y1={baseY} x2={xS(d)} y2={baseY + 5} stroke="currentColor" opacity="0.25" />
            <text x={xS(d)} y={baseY + 20} textAnchor="middle" className="curve-tick-label">
              {d === 0 ? "0" : `${d} days`}
            </text>
          </g>
        ))}

        {/* Target (100%) reference line */}
        <line
          x1={padL}
          y1={yS(100)}
          x2={w - padR}
          y2={yS(100)}
          stroke="#E3A93C"
          strokeWidth="1"
          strokeDasharray="3 4"
          opacity="0.75"
        />
        <g transform={`translate(${w - padR - 62}, ${yS(100) - 9})`}>
          <rect x="0" y="0" width="60" height="18" rx="9" fill="#E3A93C" />
          <text
            x="30"
            y="12"
            textAnchor="middle"
            style={{
              fill: "#1C1917",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.1em",
            }}
          >
            TARGET
          </text>
        </g>

        {/* Warm wash under the duration curve */}
        <path d={areaPath} fill="url(#year-fill)" />

        {/* Coloured demand bands (fee intensity) */}
        {bands.map((b, i) => (
          <g key={"band-" + i}>
            <rect
              x={b.x0}
              y={b.y}
              width={Math.max(0, b.x1 - b.x0)}
              height={Math.max(0, baseY - b.y)}
              style={{ fill: b.color }}
              opacity="0.22"
            />
            <line
              x1={b.x0}
              y1={b.y}
              x2={b.x1}
              y2={b.y}
              style={{ stroke: b.color }}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {/* Labels sit INSIDE the band (below its top line) so they never
                collide with the axis caption or with neighbouring bands. */}
            {b.x1 - b.x0 > 58 && baseY - b.y > 40 && (
              <g>
                <text
                  x={(b.x0 + b.x1) / 2}
                  y={b.y + 16}
                  textAnchor="middle"
                  className="year-band-label"
                  style={{ fontWeight: 600 }}
                >
                  {crowdLabel(b.demand)}
                </text>
                <text x={(b.x0 + b.x1) / 2} y={b.y + 29} textAnchor="middle" className="year-band-label">
                  {b.days} days · {fmtEur(b.fee)}
                </text>
              </g>
            )}
          </g>
        ))}

        {/* Step outline */}
        <path d={stepPath} fill="none" style={{ stroke: "var(--ink)" }} strokeWidth="1.5" opacity="0.5" />

        {/* Active modelled-day demand reference */}
        <line
          x1={padL}
          y1={activeY}
          x2={w - padR}
          y2={activeY}
          style={{ stroke: "var(--ink)" }}
          strokeWidth="1"
          strokeDasharray="2 4"
          opacity="0.5"
        />
        {/* Small marker where the modelled-day line meets the y-axis — keeps the
            line readable without an inline label that could land on a band. */}
        <circle cx={padL} cy={activeY} r="3.5" style={{ fill: "var(--ink)" }} />
        {/* Modelled-day caption lives in a FIXED top-left slot, never on the data,
            so it can't overlap the band labels at any demand level. */}
        <text
          x={padL}
          y={padT - 14}
          textAnchor="start"
          className="year-band-label"
          style={{ fill: "var(--ink-mute)", fontWeight: 600 }}
        >
          Modelling: {activeDay.label} · {crowdLabel(activeDay.demand_pct)}
        </text>

        {/* X-axis caption */}
        <text
          x={w - padR}
          y={h - 8}
          textAnchor="end"
          style={{
            fill: "var(--ink-soft)",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
          }}
        >
          Days of the year, busiest → quietest →
        </text>
      </svg>
    </div>
  );
}

/* ─── Decile bucket strip ───────────────────────────────────────────────── */

function BucketStrip() {
  const state = useStore();
  if (!state) return null;
  const cap = leverV(state, "max_fee_cap");
  const bucketPcts = [60, 80, 100, 120, 140, 160, 180, 200, 220, 240];
  return (
    <div className="bucket-strip">
      {bucketPcts.map((pct) => {
        const f = feeAtPct(pct, state);
        const rounded = Math.round(f);
        const ratio = cap > 0 ? Math.max(0, f / cap) : 0;
        let cls = "";
        if (f < 0) cls = "credit";
        else if (ratio > 0.7) cls = "high";
        else if (ratio > 0.3) cls = "warn";
        const color =
          f < 0
            ? "#5a7d3b"
            : ratio > 0.7
              ? "#E0763C"
              : ratio > 0.3
                ? "#E3A93C"
                : "#7c8c69";
        return (
          <div key={pct} className={"bucket " + cls}>
            <div className="bucket-pct">{pct}%</div>
            <div className="bucket-fee">{fmtEur(rounded)}</div>
            <div
              className="bucket-bar"
              style={{
                color,
                width: Math.max(8, Math.abs(ratio) * 100) + "%",
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

/* ─── Curve panel composite ─────────────────────────────────────────────── */

export function CurvePanel() {
  const state = useStore();
  if (!state) return null;
  const view = state.view;
  const activeDay =
    activeDayType(state);
  const totalDays = state.seasonal.reduce((a, s) => a + s.days, 0);
  return (
    <section className="panel panel-pad curve-panel">
      <header className="panel-header">
        <div>
          <div className="panel-title">
            {view === "cost" ? "Consumer cost curve" : "How busy the city is across the year"}
          </div>
          <div className="panel-sub" style={{ marginTop: 4 }}>
            {view === "cost"
              ? `${activeDay.demand_pct}% of a normal day · ${activeDay.date}`
              : `${totalDays} days grouped busiest → quietest · taller = more crowded`}
          </div>
        </div>
        <div className="curve-legend">
          <div className="curve-view-toggle" role="tablist" aria-label="Curve view">
            <button
              className={view === "cost" ? "on" : ""}
              onClick={() => setView("cost")}
              aria-pressed={view === "cost"}
            >
              Cost curve
            </button>
            <button
              className={view === "year" ? "on" : ""}
              onClick={() => setView("year")}
              aria-pressed={view === "year"}
            >
              Zoom out · year
            </button>
          </div>
          {view === "cost" && (
            <>
              <span className="legend-swatch" style={{ color: "#E3A93C" }}>
                <i /> Fee
              </span>
              <span className="legend-swatch" style={{ color: "#54C9B5" }}>
                <i /> Q-Cash
              </span>
            </>
          )}
          <span className="confidence-pill">
            <span className="dot" /> Model confidence {state.confidence}%
          </span>
        </div>
      </header>

      {view === "cost" ? (
        <>
          <CurveChart />
          <BucketStrip />
        </>
      ) : (
        <>
          <YearCurve />
          <p className="year-explainer">
            Each block is a stretch of the year at a similar crowd level — widest
            blocks are the most common kind of day. <strong>Height = how busy</strong> (100%
            is a normal day, 200% is twice as crowded); the <strong>fee</strong> shown is what a
            visitor pays on those days. Read it left-to-right: the busy, higher-fee
            days first, down to the quiet, cheap days.
          </p>
        </>
      )}
    </section>
  );
}
