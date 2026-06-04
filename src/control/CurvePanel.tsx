import { useEffect, useState } from "react";
import { useStore } from "./useStore";
import {
  feeAtPct,
  activeDayType,
  managedDemandPct,
  liveDemandPct,
  targetCapacity,
  capacityThreshold,
  activeCPI,
  activeShockObj,
  activeAdjustedVisitors,
  setView,
  type State,
} from "./state";
import { fmtEur, fmtNumber } from "./format";

function leverV(state: State, id: string): number {
  const l = state.levers.find((x) => x.id === id);
  if (!l) throw new Error("missing lever " + id);
  return l.value;
}

/** Colour-coded CPI pill colour: green slack <0.8, neutral 0.8–1.0, ochre warn
 *  1.0–1.5, penalty red ≥1.5. */
function cpiColor(cpi: number): string {
  if (cpi < 0.8) return "#3FB97A";
  if (cpi < 1.0) return "#8a8475";
  if (cpi < 1.5) return "#E3A93C";
  return "#E0763C";
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

  const xMin = 0;
  const xMax = 250;

  const cap = leverV(state, "max_fee_cap");
  const base = leverV(state, "base_fee");
  const ceilingPct = leverV(state, "ceiling_pct");
  const rebate = state.shoulder_rebate;
  const credit = rebate.enabled ? rebate.credit : 0;
  const threshold = rebate.enabled ? rebate.applies_below_pct : null;

  // The fee at 0% occupancy is the credit floor — the earliest visitors may be
  // PAID to come. Give the y-axis room below zero for it.
  const feeAtEmpty = feeAtPct(0, state);
  const yMax = Math.max(cap + Math.max(8, cap * 0.1), base + 12);
  const yMin = Math.min(-3, Math.floor((feeAtEmpty - 4) / 5) * 5);

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

  // Active day dot + callout — placed at the LIVE occupancy (rebased by the
  // chosen target capacity), so the dot moves right when target capacity drops.
  const activeDay =
    activeDayType(state);
  const activeLive = liveDemandPct(activeDay.demand_pct, state);
  const activeFee = feeAtPct(activeLive, state);
  const ax = xS(Math.min(xMax, Math.max(xMin, activeLive)));
  const ay = yS(activeFee);

  // DPM v2 — Capacity Pressure Index for the active day + the threshold marker.
  const cpiThreshold = capacityThreshold(state); // sustainable carrying capacity
  const targetCap = targetCapacity(state);
  const cpi = activeCPI(state); // null on v1 payloads (no threshold)
  const adjVisitors = activeAdjustedVisitors(state);
  const shock = activeShockObj(state);
  // Threshold reference line, expressed as % of the policy target (Venice 104.2%).
  const thPct =
    cpiThreshold && targetCap ? (cpiThreshold / targetCap) * 100 : null;

  // Y gridline values (whole €).
  const yStep = cap >= 100 ? 20 : cap >= 40 ? 10 : 5;
  const yGrid: number[] = [];
  for (let v = 0; v <= yMax + yStep - 0.01; v += yStep) yGrid.push(v);

  // Callout placement: flip left if it'd overflow. Grows a line when CPI is shown.
  const calloutW = 150;
  const calloutH = cpi != null ? 52 : 36;
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

        {/* DPM v2 — capacity-pressure threshold (CPI = 1.0) reference line. Sits
            between TARGET (100%) and CEILING; the label drops below the top pills
            so the three never collide. Hidden on v1 payloads (no threshold). */}
        {thPct != null && (
          <g>
            <line
              x1={xS(thPct)}
              y1={padT + 30}
              x2={xS(thPct)}
              y2={yS(yMin)}
              stroke="#8a8475"
              strokeWidth="1"
              strokeDasharray="2 4"
              opacity="0.3"
            />
            <text
              x={xS(thPct) + 4}
              y={padT + 27}
              textAnchor="start"
              style={{
                fill: "#8a8475",
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                letterSpacing: "0.1em",
                opacity: 0.75,
              }}
            >
              CPI 1.0
            </text>
          </g>
        )}

        {/* Active day dot */}
        <g>
          <circle cx={ax} cy={ay} r="14" style={{ fill: "var(--ink)" }} opacity="0.06" />
          <circle cx={ax} cy={ay} r="7" style={{ fill: "var(--ink)" }} />
          <circle cx={ax} cy={ay} r="3" style={{ fill: "var(--ink-inverse)" }} />
        </g>

        {/* Active day callout */}
        <g transform={`translate(${calloutLeft}, ${calloutTop})`}>
          {cpi != null && cpiThreshold != null && (
            <title>
              {`Capacity Pressure Index — ${fmtNumber(adjVisitors)} of ${fmtNumber(cpiThreshold)} sustainable/day. ${cpi.toFixed(2)}× threshold.` +
                (shock ? ` Stress: ${shock.label}.` : "")}
            </title>
          )}
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
            At {Math.round(activeLive)}% capacity
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
          </text>
          {cpi != null && (
            <g transform="translate(10, 44)">
              <rect x="0" y="-9" width="62" height="14" rx="7" fill={cpiColor(cpi)} />
              <text
                x="31"
                y="1.5"
                textAnchor="middle"
                style={{
                  fill: "#1C1917",
                  fontFamily: "var(--font-mono)",
                  fontSize: 9.5,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                }}
              >
                CPI {cpi.toFixed(2)}
              </text>
            </g>
          )}
        </g>
      </svg>
    </div>
  );
}

/* ─── Annual demand profile ("zoom out" — whole-year DPM view) ───────────── */

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Fallback monthly profile if a payload predates the `monthly` field — a smooth
 *  Venice-style summer bell curve so the zoom-out always reads chronologically. */
const FALLBACK_MONTHLY = [52, 78, 85, 112, 138, 168, 190, 200, 158, 118, 70, 66];

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

  const occTarget = state.occupancy_target ?? 100;

  // Chronological monthly profile (Jan → Dec). Each month's BASELINE demand is
  // rebased to LIVE occupancy by the chosen target capacity, then the pricing
  // curve deters/attracts it toward the target (managed).
  const monthsRaw = (state.monthly && state.monthly.length === 12
    ? state.monthly.map((m) => m.demand_pct)
    : FALLBACK_MONTHLY);
  const months = monthsRaw.map((baselinePct, i) => {
    const live = liveDemandPct(baselinePct, state);
    const managed = managedDemandPct(live, state);
    return { name: MONTH_NAMES[i], live, managed, fee: feeAtPct(live, state) };
  });

  const peak = Math.max(occTarget, ...months.map((m) => Math.max(m.live, m.managed)));
  const yMax = Math.ceil((peak * 1.12) / 20) * 20;

  // x positions the 12 months evenly across the year (centre of each month).
  const xAt = (i: number) => padL + ((i + 0.5) / 12) * innerW;
  const yS = (v: number) => padT + (1 - v / yMax) * innerH;
  const baseY = yS(0);

  const linePath = (key: "live" | "managed") =>
    months.map((m, i) => (i ? "L" : "M") + xAt(i).toFixed(1) + "," + yS(Math.min(yMax, m[key])).toFixed(1)).join(" ");
  const rawPath = linePath("live");
  const manPath = linePath("managed");
  const areaPath =
    manPath +
    ` L ${xAt(11).toFixed(1)},${baseY.toFixed(1)} L ${xAt(0).toFixed(1)},${baseY.toFixed(1)} Z`;

  // How close to target did pricing get us? Mean abs deviation, raw vs managed.
  const rawSpread = months.reduce((a, m) => a + Math.abs(m.live - occTarget), 0) / 12;
  const manSpread = months.reduce((a, m) => a + Math.abs(m.managed - occTarget), 0) / 12;
  const flattenPct = rawSpread > 0.5 ? Math.round((1 - manSpread / rawSpread) * 100) : 0;

  const yStep = yMax > 250 ? 50 : 25;
  const yGrid: number[] = [];
  for (let v = 0; v <= yMax + 0.01; v += yStep) yGrid.push(v);

  const activeDay = activeDayType(state);
  const activeLive = liveDemandPct(activeDay.demand_pct, state);
  const activeY = yS(Math.min(yMax, activeLive));

  return (
    <div className="curve-stage">
      <svg className="curve-svg" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="year-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3FB97A" stopOpacity="0.34" />
            <stop offset="55%" stopColor="#4FC98A" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#7FD9A8" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Legend + how-flat badge (top-left, fixed slot). */}
        <text x={padL} y={padT - 14} textAnchor="start" className="year-band-label" style={{ fill: "var(--ink-mute)" }}>
          <tspan style={{ fill: "var(--penalty)" }}>– – forecast crowd</tspan>
          {"   "}
          <tspan style={{ fontWeight: 600 }}>▬ after pricing</tspan>
          {flattenPct > 1 && (
            <tspan style={{ fill: "#2c8676", fontWeight: 600 }}>{`   ·  ${flattenPct}% closer to ${occTarget}%`}</tspan>
          )}
        </text>

        {/* Horizontal gridlines + %-axis ticks */}
        {yGrid.map((v) => (
          <g key={"yg-" + v}>
            <line x1={padL} y1={yS(v)} x2={w - padR} y2={yS(v)} stroke="currentColor" opacity={v === 0 ? 0.18 : 0.07} />
            <text x={padL - 10} y={yS(v) + 4} textAnchor="end" className="curve-tick-label">
              {v}%
            </text>
          </g>
        ))}

        {/* X axis — MONTH labels (chronological Jan → Dec) */}
        {months.map((m, i) => (
          <g key={"mx-" + i}>
            <line x1={xAt(i)} y1={baseY} x2={xAt(i)} y2={baseY + 4} stroke="currentColor" opacity="0.2" />
            <text x={xAt(i)} y={baseY + 18} textAnchor="middle" className="curve-tick-label">
              {m.name}
            </text>
          </g>
        ))}

        {/* Occupancy-target reference line */}
        <line x1={padL} y1={yS(occTarget)} x2={w - padR} y2={yS(occTarget)} stroke="#E3A93C" strokeWidth="1" strokeDasharray="3 4" opacity="0.75" />
        <g transform={`translate(${w - padR - 82}, ${yS(occTarget) - 9})`}>
          <rect x="0" y="0" width="80" height="18" rx="9" fill="#E3A93C" />
          <text x="40" y="12" textAnchor="middle" style={{ fill: "#1C1917", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em" }}>
            TARGET {occTarget}%
          </text>
        </g>

        {/* Warm wash under the managed curve */}
        <path d={areaPath} fill="url(#year-fill)" />

        {/* Raw forecast bell curve (before pricing) — dashed */}
        <path d={rawPath} fill="none" style={{ stroke: "var(--penalty)" }} strokeWidth="2" strokeDasharray="5 4" opacity="0.6" strokeLinejoin="round" />

        {/* Managed curve (after pricing) — solid green hero line */}
        <path d={manPath} fill="none" stroke="#2FA866" strokeWidth="2.75" strokeLinejoin="round" strokeLinecap="round" />

        {/* Month dots on the managed curve + a fee label on the peak month */}
        {months.map((m, i) => {
          const cy = yS(Math.min(yMax, m.managed));
          const isPeak = m.managed === Math.max(...months.map((x) => x.managed));
          return (
            <g key={"md-" + i}>
              {/* drop from forecast → managed where pricing deterred the crowd */}
              {yS(Math.min(yMax, m.managed)) - yS(Math.min(yMax, m.live)) > 8 && (
                <line x1={xAt(i)} y1={yS(Math.min(yMax, m.live)) + 2} x2={xAt(i)} y2={cy - 3} style={{ stroke: "var(--penalty)" }} strokeWidth="1" strokeDasharray="2 2" opacity="0.45" />
              )}
              <circle cx={xAt(i)} cy={cy} r="2.8" fill="#2FA866" />
              {isPeak && (
                <text x={xAt(i)} y={cy - 9} textAnchor="middle" className="year-band-label" style={{ fontWeight: 600 }}>
                  {m.name} · {Math.round(m.managed)}% · {fmtEur(m.fee)}
                </text>
              )}
            </g>
          );
        })}

        {/* Active modelled-day reference */}
        <line x1={padL} y1={activeY} x2={w - padR} y2={activeY} style={{ stroke: "var(--ink)" }} strokeWidth="1" strokeDasharray="2 4" opacity="0.45" />
        <circle cx={padL} cy={activeY} r="3.5" style={{ fill: "var(--ink)" }} />
        <text x={padL} y={h - 8} textAnchor="start" className="year-band-label" style={{ fill: "var(--ink-mute)", fontWeight: 600 }}>
          Modelling: {activeDay.label} · {Math.round(activeLive)}%
        </text>

        {/* X-axis caption */}
        <text x={w - padR} y={h - 8} textAnchor="end" style={{ fill: "var(--ink-soft)", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase" }}>
          Month of the year (summer peak)
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
  const [showAssumptions, setShowAssumptions] = useState(false);

  // Esc closes the assumptions slide-out.
  useEffect(() => {
    if (!showAssumptions) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowAssumptions(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showAssumptions]);

  if (!state) return null;
  const view = state.view;
  const activeDay = activeDayType(state);
  const shock = activeShockObj(state);
  const assumptions = state.assumptions;

  return (
    <section className="panel panel-pad curve-panel">
      <header className="panel-header">
        <div>
          <div className="panel-title">
            {view === "cost"
              ? "Consumer cost curve"
              : `Steering the year toward ${state.occupancy_target ?? 100}% capacity`}
          </div>
          <div className="panel-sub" style={{ marginTop: 4 }}>
            {view === "cost"
              ? `${Math.round(liveDemandPct(activeDay.demand_pct, state))}% of ${(targetCapacity(state) / 1000).toFixed(0)}k capacity · ${activeDay.date}`
              : `Summer-peak bell curve · dashed = forecast, solid = after pricing`}
          </div>
          {state.provenance && <div className="curve-provenance">{state.provenance}</div>}
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
            <span className="legend-swatch" style={{ color: "#E3A93C" }}>
              <i /> Fee
            </span>
          )}
          <div className="curve-conf">
            <span className="confidence-pill">
              <span className="dot" /> Model confidence {state.confidence}%
            </span>
            {state.run_confidence != null && (
              <span className="run-confidence">Run confidence {state.run_confidence} / 100</span>
            )}
          </div>
          {assumptions && assumptions.length > 0 && (
            <button
              className="assumptions-info"
              onClick={() => setShowAssumptions(true)}
              title="Where these numbers come from — open the assumptions register"
              aria-label="Open the assumptions register"
            >
              ⓘ
            </button>
          )}
        </div>
      </header>

      {view === "cost" ? (
        <>
          <CurveChart />
          {shock && (
            <div className="stress-banner" role="status">
              ⚠ Stress test active — {shock.label} · {shock.duration_days}d · CPI{" "}
              {shock.cpi_during.toFixed(2)}
            </div>
          )}
          <BucketStrip />
        </>
      ) : (
        <>
          <YearCurve />
          <p className="year-explainer">
            The <strong style={{ color: "var(--penalty)" }}>dashed line</strong> is the forecast
            crowd; the <strong>solid blocks</strong> are where each day actually settles once the
            fee deters peak visitors. The goal is a flat year at <strong>100% capacity</strong> —
            raise the <strong>base fee</strong> or <strong>max-fee cap</strong> (or lower the
            <strong> ceiling</strong>) and the busy days get pulled down toward the target line.
          </p>
        </>
      )}

      {/* Assumptions register — tucked-away slide-out (scrolls internally only) */}
      {showAssumptions && assumptions && (
        <>
          <div className="assumptions-scrim" onClick={() => setShowAssumptions(false)} />
          <aside className="assumptions-panel" role="dialog" aria-label="Assumptions register">
            <header className="assumptions-head">
              <div>
                <div className="assumptions-title">Assumptions register</div>
                <div className="assumptions-sub">
                  {assumptions.length} parameters · source + confidence
                  {state.run_confidence != null ? ` · run ${state.run_confidence}/100` : ""}
                </div>
              </div>
              <button
                className="assumptions-close"
                onClick={() => setShowAssumptions(false)}
                aria-label="Close assumptions"
              >
                ×
              </button>
            </header>
            <div className="assumptions-scroll">
              <table className="assumptions-table">
                <thead>
                  <tr>
                    <th>Parameter</th>
                    <th>Value</th>
                    <th>Source</th>
                    <th>Conf.</th>
                  </tr>
                </thead>
                <tbody>
                  {assumptions.map((a, i) => (
                    <tr key={i}>
                      <td>{a.param}</td>
                      <td>{a.value}</td>
                      <td className="src">{a.source}</td>
                      <td className="conf">{a.confidence}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {state.provenance && <div className="assumptions-foot">{state.provenance}</div>}
          </aside>
        </>
      )}
    </section>
  );
}
