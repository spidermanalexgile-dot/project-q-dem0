import { useEffect, useRef, useState } from "react";
import type { PointerEvent as RPE } from "react";
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
  annualGrowthRate,
  monthlyDemandProfile,
  activeYear,
  setView,
  setZoomSpan,
  type State,
  type DailyRow,
} from "./state";
import { setDate } from "./state";
import { fmtEur, fmtNumber, fmtCompactNum } from "./format";

function leverV(state: State, id: string): number {
  const l = state.levers.find((x) => x.id === id);
  if (!l) throw new Error("missing lever " + id);
  return l.value;
}

/** Smooth an SVG polyline into a flowing curve (Catmull-Rom → cubic béziers).
 *  Used by the zoom-out so the demand profile reads as a smooth bell, not facets. */
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length < 3) {
    return points.map((p, i) => (i ? "L" : "M") + p.x.toFixed(1) + "," + p.y.toFixed(1)).join(" ");
  }
  const p = points;
  let d = `M ${p[0].x.toFixed(1)},${p[0].y.toFixed(1)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}

/** Linear blend between two #rrggbb colours (t: 0→a, 1→b). */
function lerpColor(a: string, b: string, t: number): string {
  const hx = (s: string, i: number) => parseInt(s.slice(i, i + 2), 16);
  const r = Math.round(hx(a, 1) + (hx(b, 1) - hx(a, 1)) * t);
  const g = Math.round(hx(a, 3) + (hx(b, 3) - hx(a, 3)) * t);
  const bl = Math.round(hx(a, 5) + (hx(b, 5) - hx(a, 5)) * t);
  return `rgb(${r},${g},${bl})`;
}

/** Eased 0→1 progress that follows the "Let Q fix this" toggle — drives the
 *  without-Q → with-Q animation (line flattening / growing + orange → green).
 *  Shared by the cost curve and the year curve so both transition in lockstep. */
function useQProgress(active: boolean): number {
  const progressRef = useRef(0);
  const rafRef = useRef(0);
  const [, bump] = useState(0);
  useEffect(() => {
    const to = active ? 1 : 0;
    const from = progressRef.current;
    if (from === to) return;
    const start = performance.now();
    const dur = 1900; // slow, deliberate transition
    cancelAnimationFrame(rafRef.current);
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      progressRef.current = from + (to - from) * eased;
      bump((n) => n + 1);
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active]);
  return progressRef.current;
}

/* Sample grid the cost curve is animated on (0…250 % of capacity). */
const FEE_GRID_STEP = 2;
const FEE_GRID_MAX = 250;
const FEE_GRID_N = Math.floor(FEE_GRID_MAX / FEE_GRID_STEP) + 1;

/** A series of values that CHASE a moving target array via per-sample
 *  exponential smoothing. The returned array eases (both ways) whenever the
 *  target changes — so any state change (Let-Q-fix-this OR a manual lever drag)
 *  animates smoothly rather than snapping. Length changes reset instantly. */
function useAnimatedSeries(target: number[]): number[] {
  const dispRef = useRef<number[] | null>(null);
  const rafRef = useRef(0);
  const [, bump] = useState(0);

  if (dispRef.current == null || dispRef.current.length !== target.length) {
    dispRef.current = target.slice(); // first paint / view switch: no animate-in
  }

  const targetKey = target.map((v) => v.toFixed(2)).join(",");
  useEffect(() => {
    const animate = () => {
      const disp = dispRef.current!;
      let moving = false;
      for (let i = 0; i < disp.length; i++) {
        const delta = target[i] - disp[i];
        if (Math.abs(delta) > 0.05) {
          disp[i] += delta * 0.06; // slow ~exponential ease, framerate-tolerant
          moving = true;
        } else {
          disp[i] = target[i];
        }
      }
      if (moving) {
        bump((n) => n + 1);
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey]);

  return dispRef.current!;
}

/** Returns a fee(pct) reader whose values CHASE the live target curve — so the
 *  cost curve eases (both ways) on any change: the Let-Q-fix-this toggle
 *  (flat €5 → dynamic) and manual lever drags (curve → new curve). */
function useAnimatedFee(state: State | null): (pct: number) => number {
  const target: number[] = [];
  for (let i = 0; i < FEE_GRID_N; i++) {
    target.push(state ? feeAtPct(i * FEE_GRID_STEP, state) : 0);
  }
  const disp = useAnimatedSeries(target);
  return (pct: number) => {
    const x = Math.max(0, Math.min(FEE_GRID_MAX, pct)) / FEE_GRID_STEP;
    const i = Math.floor(x);
    const frac = x - i;
    const a = disp[i] ?? 0;
    const b = disp[i + 1] ?? a;
    return a + (b - a) * frac;
  };
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
  const qProgress = useQProgress(!!state?.q_fixed); // 0→1 green tint under Q
  const dispFee = useAnimatedFee(state); // animated fee(pct) — chases the target
  // Draggable probe position (capacity %). null = sit on the active day until
  // the user grabs the handle and slides it along the curve.
  const [probePct, setProbePct] = useState<number | null>(null);
  const probeDrag = useRef(false);
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
  const ceilingPct = leverV(state, "ceiling_pct");
  const rebate = state.shoulder_rebate;
  const credit = rebate.enabled ? rebate.credit : 0;
  const threshold = rebate.enabled ? rebate.applies_below_pct : null;

  // Y-axis range. Scale to the larger of the DISPLAYED and TARGET curves: while
  // the line grows into a taller curve the frame is pinned to the (stable)
  // target, so it doesn't wobble every frame; while it shrinks the frame eases
  // down with the displayed line so nothing clips. (Scaling to the animated max
  // alone made yMax/yMin jitter — a max/floor over easing samples isn't smooth.)
  let curveMaxFee = 0;
  let curveMinFee = 0;
  for (let pct = 0; pct <= xMax; pct += 5) {
    const f = Math.max(dispFee(pct), feeAtPct(pct, state));
    const g = Math.min(dispFee(pct), feeAtPct(pct, state));
    if (f > curveMaxFee) curveMaxFee = f;
    if (g < curveMinFee) curveMinFee = g;
  }
  const yMax = Math.max(curveMaxFee * 1.15, 12);
  const yMin = Math.min(-3, Math.floor((curveMinFee - 4) / 5) * 5);

  const xS = (pct: number) => padL + ((pct - xMin) / (xMax - xMin)) * innerW;
  const yS = (fee: number) => padT + (1 - (fee - yMin) / (yMax - yMin)) * innerH;

  // Curve sample points — 1° resolution, skipping credit-zone discontinuity.
  const mainStart = threshold != null ? Math.max(threshold, xMin) : xMin;
  const pts: { pct: number; fee: number; x: number; y: number }[] = [];
  for (let pct = mainStart; pct <= xMax; pct += 1) {
    const f = dispFee(pct);
    pts.push({ pct, fee: f, x: xS(pct), y: yS(f) });
  }
  const pathD = pts
    .map((p, i) => (i ? "L" : "M") + p.x.toFixed(1) + "," + p.y.toFixed(1))
    .join(" ");

  // Active day's live occupancy — the probe's default resting position.
  const activeDay =
    activeDayType(state);
  const activeLive = liveDemandPct(activeDay.demand_pct, state);

  // DPM v2 — Capacity Pressure Index for the active day + the threshold marker.
  const cpiThreshold = capacityThreshold(state); // sustainable carrying capacity
  const targetCap = targetCapacity(state);
  const cpi = activeCPI(state); // null on v1 payloads (no threshold)
  const adjVisitors = activeAdjustedVisitors(state);
  const shock = activeShockObj(state);
  // Threshold reference line, expressed as % of the policy target (Venice 104.2%).
  const thPct =
    cpiThreshold && targetCap ? (cpiThreshold / targetCap) * 100 : null;

  // ── Draggable probe — slide along the curve to read the fee at any capacity,
  // from the first visitor (0%) up to the last (250%). Sits on the active day
  // until grabbed; the CPI line shows only while it rests there. ──
  const probe = Math.min(xMax, Math.max(xMin, probePct ?? activeLive));
  const probeFee = dispFee(probe);
  const px = xS(probe);
  const py = yS(probeFee);
  const atDay = probePct == null || Math.abs(probe - activeLive) < 1.5;
  const showCpi = cpi != null && atDay;

  // Map a pointer x (screen px) → capacity %, via the SVG's CTM so it tracks the
  // CSS-scaled viewBox correctly. Clamped to the 0…250% domain.
  const pctFromClientX = (svg: SVGSVGElement, clientX: number): number | null => {
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const sp = svg.createSVGPoint();
    sp.x = clientX;
    sp.y = 0;
    const vb = sp.matrixTransform(ctm.inverse());
    const pct = xMin + ((vb.x - padL) / innerW) * (xMax - xMin);
    return Math.min(xMax, Math.max(xMin, pct));
  };
  const onProbeDown = (e: RPE<SVGSVGElement>) => {
    probeDrag.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const p = pctFromClientX(e.currentTarget, e.clientX);
    if (p != null) setProbePct(p);
  };
  const onProbeMove = (e: RPE<SVGSVGElement>) => {
    if (!probeDrag.current) return;
    const p = pctFromClientX(e.currentTarget, e.clientX);
    if (p != null) setProbePct(p);
  };
  const onProbeUp = () => {
    probeDrag.current = false;
  };

  // Y gridline values (whole €).
  const yStep = cap >= 100 ? 20 : cap >= 40 ? 10 : 5;
  const yGrid: number[] = [];
  for (let v = 0; v <= yMax + yStep - 0.01; v += yStep) yGrid.push(v);

  // Callout placement: flip left if it'd overflow. Grows a line when CPI is shown.
  const calloutW = 150;
  const calloutH = showCpi ? 52 : 36;
  const calloutLeft =
    px > w - padR - calloutW - 14 ? px - calloutW - 14 : px + 14;
  const calloutTop = Math.max(padT + 24, py - calloutH - 6);

  return (
    <div className="curve-stage">
      <svg
        className="curve-svg"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ cursor: "ew-resize", touchAction: "none" }}
        onPointerDown={onProbeDown}
        onPointerMove={onProbeMove}
        onPointerUp={onProbeUp}
        onPointerCancel={onProbeUp}
      >
        <defs>
          {/* Hero stroke gradient — eases from the warm fee ramp toward a unified
              green as Q takes over (qProgress 0→1). */}
          <linearGradient id="curve-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={lerpColor("#9dba77", "#2FA866", qProgress)} />
            <stop offset="38%" stopColor={lerpColor("#e3a93c", "#2FA866", qProgress)} />
            <stop offset="80%" stopColor={lerpColor("#e0763c", "#2FA866", qProgress)} />
            <stop offset="100%" stopColor={lerpColor("#e0763c", "#2FA866", qProgress)} />
          </linearGradient>
          <linearGradient id="curve-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lerpColor("#E0763C", "#2FA866", qProgress)} stopOpacity="0.20" />
            <stop offset="60%" stopColor={lerpColor("#E3A93C", "#4FC98A", qProgress)} stopOpacity="0.06" />
            <stop offset="100%" stopColor={lerpColor("#E3A93C", "#7FD9A8", qProgress)} stopOpacity="0" />
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

        {/* Draggable probe handle — slide it along the curve (0–250% capacity) */}
        <g style={{ pointerEvents: "none" }}>
          <circle cx={px} cy={py} r="15" style={{ fill: "var(--ink)" }} opacity="0.06" />
          <circle cx={px} cy={py} r="7.5" fill="var(--panel)" stroke="var(--ink)" strokeWidth="2" />
          <circle cx={px} cy={py} r="3" style={{ fill: "var(--ink)" }} />
        </g>

        {/* Probe callout — capacity % + fee at that point (CPI only on the day) */}
        <g transform={`translate(${calloutLeft}, ${calloutTop})`} style={{ pointerEvents: "none" }}>
          {showCpi && cpiThreshold != null && (
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
            At {Math.round(probe)}% capacity
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
            Fee {fmtEur(probeFee)}
          </text>
          {showCpi && (
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
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Group a 5-year daily dataset into per-year, per-month average CPI (% of
 *  capacity). Returns Map<year, number[12]> — the real demand profile each year. */
function deriveYearlyMonthlyProfiles(daily: DailyRow[]): Map<number, number[]> {
  const acc = new Map<number, { s: number; c: number }[]>();
  for (const d of daily) {
    const y = Number(d.date.slice(0, 4));
    const m = Number(d.date.slice(5, 7));
    if (!Number.isFinite(y) || m < 1 || m > 12) continue;
    if (!acc.has(y)) acc.set(y, Array.from({ length: 12 }, () => ({ s: 0, c: 0 })));
    const cell = acc.get(y)![m - 1];
    cell.s += d.cpi;
    cell.c++;
  }
  const out = new Map<number, number[]>();
  for (const [y, arr] of acc) out.set(y, arr.map((a) => (a.c ? a.s / a.c : 0)));
  return out;
}

/** True when the WHOLE of (year, monthIdx) is on or before the actuals cutoff —
 *  i.e. confirmed historical, not influenced by the levers. */
function isMonthLocked(year: number, monthIdx: number, cutoff: string | undefined): boolean {
  if (!cutoff) return false;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const last = monthIdx === 1 && leap ? 29 : DAYS_IN_MONTH[monthIdx];
  const lastDate = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return lastDate <= cutoff;
}

type YPt = { live: number; managed: number; fee: number; name: string; year: number; mi: number; locked: boolean };

/** Pure derivation of the zoom-out series (per-month live forecast + managed
 *  demand) for the active span. Kept hook-free so it can run before the early
 *  return — the managed values feed the animation hook. */
function buildYearData(state: State) {
  const occTarget = state.occupancy_target ?? 100;
  const span = state.zoomSpan === 5 ? 5 : 1;
  const growth = annualGrowthRate(state);
  const baseMonths = monthlyDemandProfile(state);
  const fiveYr = !!state.daily && state.daily.length > 400;
  const firstYear = state.daily && state.daily[0] ? Number(state.daily[0].date.slice(0, 4)) : 2026;
  const cutoff = state.locked_cutoff;
  const yearly = fiveYr ? deriveYearlyMonthlyProfiles(state.daily!) : null;
  // Calendar years on the x-axis: the 5 fixed bundle years, else the active year.
  const years = span === 5 ? Array.from({ length: 5 }, (_, i) => firstYear + i) : [activeYear(state)];
  const n = years.length * 12;
  const pts: YPt[] = [];
  years.forEach((yr, yi) => {
    for (let mi = 0; mi < 12; mi++) {
      // Raw demand: real per-year CPI averages for a 5-year bundle, else the
      // single monthly profile grown by the DPM annual rate.
      const rawCpi = yearly ? yearly.get(yr)?.[mi] ?? 0 : baseMonths[mi] * Math.pow(1 + growth, yi);
      const locked = isMonthLocked(yr, mi, cutoff);
      // Confirmed actuals are immune to the levers (managed = raw); only
      // projections (after the cutoff) respond to pricing.
      const live = locked ? rawCpi : liveDemandPct(rawCpi, state);
      const managed = locked ? rawCpi : managedDemandPct(live, state);
      pts.push({ live, managed, fee: feeAtPct(live, state), name: MONTH_NAMES[mi], year: yr, mi, locked });
    }
  });
  return { occTarget, span, firstYear, baseYear: firstYear, cutoff, years, n, pts };
}

function YearCurve() {
  const state = useStore();
  const dragging = useRef(false);
  // The managed line eases by chasing its target (responds to lever drags +
  // Let-Q-fix-this). The green tint is driven by how FLATTENED that line is vs
  // the raw forecast (see `greenness` below) — so manually flattening the curve
  // turns it green too, not just the Q button.
  const data = state ? buildYearData(state) : null;
  const animManaged = useAnimatedSeries(data ? data.pts.map((p) => p.managed) : []);
  if (!state || !data) return <div className="curve-stage" />;
  const { occTarget, span, baseYear, cutoff, years, n, pts } = data;

  const w = 1000;
  // Taller canvas than the cost view: with the explainer paragraph removed, the
  // zoom-out fills the freed vertical space (aspect closer to the stage's).
  const h = 760;
  const padL = 66; // wider left margin: %-tick + visitor-count stacked beneath it
  const padR = 28;
  const padT = 30;
  const padB = 52;
  const innerW = Math.max(1, w - padL - padR);
  const innerH = Math.max(1, h - padT - padB);

  const firstYear = baseYear;

  const peak = Math.max(occTarget, ...pts.map((p) => Math.max(p.live, p.managed)));
  const yMax = Math.ceil((peak * 1.12) / 20) * 20;

  const xAt = (i: number) => padL + ((i + 0.5) / n) * innerW;
  const yS = (v: number) => padT + (1 - v / yMax) * innerH;
  const baseY = yS(0);

  // Split into the locked (confirmed-actual) prefix and the open (projection) tail.
  const firstOpenIdx = pts.findIndex((p) => !p.locked);
  const openStart = firstOpenIdx < 0 ? pts.length : firstOpenIdx;
  const cutoffX = openStart > 0 && openStart < pts.length ? padL + (openStart / n) * innerW : null;

  // Displayed managed value — the smoothed chase toward each point's managed
  // target. Responds to lever drags (q off) AND the Let-Q-fix-this flatten,
  // easing both ways. Locked points have managed == live, so they sit still.
  const dispM = (i: number) => animManaged[i] ?? pts[i].managed;
  const manXY = pts.map((_p, i) => ({ x: xAt(i), y: yS(Math.min(yMax, dispM(i))) }));

  // Greenness — how much the displayed (animated) managed line has flattened
  // relative to the raw forecast bell across the projected months. 0 = tracks
  // the forecast (orange), 1 = fully flattened (green). Computed from the eased
  // values so the colour transitions in step with the line, and it works for
  // manual lever flattening just as well as the Let-Q-fix-this button.
  let liveMin = Infinity, liveMax = -Infinity, manMin = Infinity, manMax = -Infinity;
  for (let i = openStart; i < pts.length; i++) {
    const lv = pts[i].live;
    const mv = dispM(i);
    if (lv < liveMin) liveMin = lv;
    if (lv > liveMax) liveMax = lv;
    if (mv < manMin) manMin = mv;
    if (mv > manMax) manMax = mv;
  }
  const liveSpread = liveMax - liveMin;
  const manSpread = manMax - manMin;
  const flatten = liveSpread > 1 ? Math.max(0, Math.min(1, 1 - manSpread / liveSpread)) : 0;
  const greenness = Math.min(1, flatten * 1.3); // reach full green a touch early
  const lockedXY = manXY.slice(0, openStart);
  const openRawXY = pts.slice(openStart).map((p, j) => ({ x: xAt(openStart + j), y: yS(Math.min(yMax, p.live)) }));
  const manPath = smoothPath(manXY);
  const rawPath = smoothPath(openRawXY);
  const lockedPath = smoothPath(lockedXY);
  const areaPath =
    manPath + ` L ${xAt(n - 1).toFixed(1)},${baseY.toFixed(1)} L ${xAt(0).toFixed(1)},${baseY.toFixed(1)} Z`;


  const yStep = yMax > 250 ? 50 : 25;
  const yGrid: number[] = [];
  for (let v = 0; v <= yMax + 0.01; v += yStep) yGrid.push(v);

  const peakManaged = Math.max(...pts.map((p) => p.managed));
  const peakI = pts.findIndex((p) => p.managed === peakManaged);

  // ── Selected-day marker — sits ON the curve, draggable to pick a date ───────
  const markerISO =
    state.customDate || cutoff || `${years[Math.min(years.length - 1, 0)]}-06-15`;
  const mY = Number(markerISO.slice(0, 4));
  const mM = Number(markerISO.slice(5, 7));
  const mD = Number(markerISO.slice(8, 10));
  const mYearIdx = span === 5 ? Math.min(years.length - 1, Math.max(0, mY - firstYear)) : 0;
  const mLeap = (mY % 4 === 0 && mY % 100 !== 0) || mY % 400 === 0;
  const mDim = mM === 2 && mLeap ? 29 : DAYS_IN_MONTH[mM - 1] || 30;
  const monthFloat = mYearIdx * 12 + (mM - 1) + Math.min(0.999, (mD - 1) / mDim); // 0..n
  const lo = Math.min(n - 1, Math.max(0, Math.floor(monthFloat)));
  const hi = Math.min(n - 1, lo + 1);
  const tt = monthFloat - lo;
  // Marker rides the DISPLAYED (animated, managed) curve — so as you flatten the
  // year, the dot + its % flatten with it, matching the line you're dragging on.
  const markerManI = dispM(lo) * (1 - tt) + dispM(hi) * tt;
  const markerPct = Math.round(markerManI);
  const markerX = padL + (monthFloat / n) * innerW;
  const markerDotY = yS(Math.min(yMax, markerManI)); // sit on the curve being shown
  const markerLabel = `${mD} ${MONTH_NAMES[mM - 1]} ${mY}`; // short, no weekday
  const nearToday = cutoffX != null && Math.abs(markerX - cutoffX) < 40;
  const pillX = Math.min(w - padR - 58, Math.max(padL + 58, markerX));
  const pillY = Math.max(padT + 14, markerDotY - 26);

  // Drag anywhere on the chart to move the date marker (maps x → calendar date).
  const dateFromClientX = (svg: SVGSVGElement, clientX: number): string | null => {
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const sp = svg.createSVGPoint();
    sp.x = clientX;
    sp.y = 0;
    const vb = sp.matrixTransform(ctm.inverse());
    let frac = (vb.x - padL) / innerW;
    frac = Math.min(0.99999, Math.max(0, frac));
    const mf = frac * n;
    const yi = Math.min(years.length - 1, Math.floor(mf / 12));
    const within = mf - yi * 12;
    const mi = Math.min(11, Math.floor(within));
    const yr = years[yi];
    const leap = (yr % 4 === 0 && yr % 100 !== 0) || yr % 400 === 0;
    const dim = mi === 1 && leap ? 29 : DAYS_IN_MONTH[mi] || 30;
    const day = Math.min(dim, Math.max(1, Math.round((within - mi) * dim) + 1));
    return `${yr}-${String(mi + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };
  const onDragDown = (e: RPE<SVGSVGElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const d = dateFromClientX(e.currentTarget, e.clientX);
    if (d) setDate(d);
  };
  const onDragMove = (e: RPE<SVGSVGElement>) => {
    if (!dragging.current) return;
    const d = dateFromClientX(e.currentTarget, e.clientX);
    if (d) setDate(d);
  };
  const onDragUp = () => {
    dragging.current = false;
  };

  return (
    <div className="curve-stage">
      <svg
        className="curve-svg"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ cursor: "ew-resize", touchAction: "none" }}
        onPointerDown={onDragDown}
        onPointerMove={onDragMove}
        onPointerUp={onDragUp}
        onPointerCancel={onDragUp}
      >
        <defs>
          <linearGradient id="year-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3FB97A" stopOpacity="0.34" />
            <stop offset="55%" stopColor="#4FC98A" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#7FD9A8" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Compact legend (top-left). */}
        <text x={padL} y={padT - 14} textAnchor="start" className="year-band-label" style={{ fill: "var(--ink-mute)" }}>
          {lockedXY.length > 0 && (
            <>
              <tspan style={{ fill: "#2bb3a3", fontWeight: 600 }}>▬ actual</tspan>
              {"   "}
            </>
          )}
          <tspan style={{ fill: "var(--penalty)" }}>– – forecast</tspan>
          {"   "}
          <tspan style={{ fontWeight: 600 }}>▬ with Q</tspan>
        </text>

        {/* Horizontal gridlines — labelled with BOTH the capacity % and the actual
            visitor count it maps to (count = target capacity × %/100). */}
        {yGrid.map((v) => (
          <g key={"yg-" + v}>
            <line x1={padL} y1={yS(v)} x2={w - padR} y2={yS(v)} stroke="currentColor" opacity={v === 0 ? 0.18 : 0.07} />
            <text x={padL - 9} y={yS(v) - 1} textAnchor="end" className="curve-tick-label">
              {v}%
            </text>
            <text x={padL - 9} y={yS(v) + 9} textAnchor="end" className="curve-tick-count">
              {fmtCompactNum(Math.round((targetCapacity(state) * v) / 100))}
            </text>
          </g>
        ))}

        {/* X axis — month labels (1-yr) or year blocks with separators (5-yr) */}
        {span === 1
          ? pts.map((p, i) => (
              <g key={"mx-" + i}>
                <line x1={xAt(i)} y1={baseY} x2={xAt(i)} y2={baseY + 4} stroke="currentColor" opacity="0.2" />
                <text x={xAt(i)} y={baseY + 18} textAnchor="middle" className="curve-tick-label">
                  {p.name}
                </text>
              </g>
            ))
          : Array.from({ length: span }, (_, y) => (
              <g key={"yr-" + y}>
                {y > 0 && (
                  <line x1={padL + (y / span) * innerW} y1={padT} x2={padL + (y / span) * innerW} y2={baseY} stroke="currentColor" opacity="0.12" />
                )}
                <text x={padL + ((y + 0.5) / span) * innerW} y={baseY + 18} textAnchor="middle" className="curve-tick-label">
                  {baseYear + y}
                </text>
              </g>
            ))}

        {/* Occupancy-target reference line — hidden in the reset / no-pricing state */}
        {!state.pricing_off && (
          <g>
            <line x1={padL} y1={yS(occTarget)} x2={w - padR} y2={yS(occTarget)} stroke="#E3A93C" strokeWidth="1" strokeDasharray="3 4" opacity="0.75" />
            <g transform={`translate(${w - padR - 82}, ${yS(occTarget) - 9})`}>
              <rect x="0" y="0" width="80" height="18" rx="9" fill="#E3A93C" />
              <text x="40" y="12" textAnchor="middle" style={{ fill: "#1C1917", fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em" }}>
                TARGET {occTarget}%
              </text>
            </g>
          </g>
        )}

        {/* Green wash under the managed curve — fades in as the line flattens */}
        <path d={areaPath} fill="url(#year-fill)" opacity={greenness} />

        {/* Raw forecast bell curve (before pricing) — dashed */}
        <path d={rawPath} fill="none" style={{ stroke: "var(--penalty)" }} strokeWidth="2" strokeDasharray="5 4" opacity="0.6" strokeLinejoin="round" />

        {/* Managed curve — orange when it tracks the forecast, easing to green
            as it flattens (whether by manual levers or Let-Q-fix-this). */}
        <path
          d={manPath}
          fill="none"
          stroke={lerpColor("#E0763C", "#2FA866", greenness)}
          strokeWidth={2.5 + 0.5 * greenness}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Confirmed-actual segment (locked historical) — teal, drawn over the
            green so the pre-cutoff months read as immutable actuals. */}
        {lockedXY.length > 1 && (
          <path d={lockedPath} fill="none" stroke="#2bb3a3" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        )}

        {/* TODAY boundary — divides confirmed actuals from lever-influenced projection. */}
        {cutoffX != null && (
          <g>
            <line x1={cutoffX} y1={padT + 6} x2={cutoffX} y2={baseY} stroke="#2bb3a3" strokeWidth="1.25" strokeDasharray="3 3" opacity="0.85" />
            <g transform={`translate(${cutoffX}, ${padT + 2})`}>
              <rect x="-26" y="-2" width="52" height="15" rx="7" fill="#2bb3a3" />
              <text x="0" y="9" textAnchor="middle" style={{ fill: "#06302c", fontFamily: "var(--font-mono)", fontSize: 8.5, fontWeight: 700, letterSpacing: "0.08em" }}>
                TODAY
              </text>
            </g>
          </g>
        )}

        {/* Month dots on the managed curve (1-yr only; 60 dots is too dense at 5-yr) */}
        {span === 1 &&
          pts.map((p, i) => {
            const cy = yS(Math.min(yMax, dispM(i)));
            return (
              <g key={"md-" + i}>
                {cy - yS(Math.min(yMax, p.live)) > 8 && (
                  <line x1={xAt(i)} y1={yS(Math.min(yMax, p.live)) + 2} x2={xAt(i)} y2={cy - 3} style={{ stroke: "var(--penalty)" }} strokeWidth="1" strokeDasharray="2 2" opacity={0.45 * greenness} />
                )}
                <circle cx={xAt(i)} cy={cy} r="2.8" fill={lerpColor("#E0763C", "#2FA866", greenness)} />
              </g>
            );
          })}

        {/* Peak label (busiest managed point across the horizon) */}
        {peakI >= 0 && (
          <text
            x={Math.min(w - padR - 40, Math.max(padL + 40, xAt(peakI)))}
            y={yS(Math.min(yMax, dispM(peakI))) - 9}
            textAnchor="middle"
            className="year-band-label"
            style={{ fontWeight: 600 }}
          >
            {span === 5 ? `${pts[peakI].year} · ` : `${pts[peakI].name} · `}
            {Math.round(dispM(peakI))}% · {fmtEur(pts[peakI].fee)}
          </text>
        )}

        {/* Selected-day marker — a bold vertical line + ringed dot + pill so it's
            obvious WHERE along the timeline the day you're modelling sits. */}
        {/* Draggable date marker — the on-curve dot is the grab handle. */}
        <g style={{ pointerEvents: "none" }}>
          <line x1={markerX} y1={padT + 18} x2={markerX} y2={baseY} stroke="var(--ink)" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.55" />
          <circle cx={markerX} cy={markerDotY} r="7.5" fill="var(--panel)" stroke="var(--ink)" strokeWidth="2" />
          <circle cx={markerX} cy={markerDotY} r="3" style={{ fill: "var(--ink)" }} />
          {!nearToday && (
            <g transform={`translate(${pillX}, ${pillY})`}>
              <rect x="-54" y="-13" width="108" height="18" rx="9" style={{ fill: "var(--ink)" }} />
              <text x="0" y="0" textAnchor="middle" style={{ fill: "var(--ink-inverse)", fontFamily: "var(--font-mono)", fontSize: 9.5, fontWeight: 600, letterSpacing: "0.02em" }}>
                {markerLabel} · {markerPct}%
              </text>
            </g>
          )}
        </g>
      </svg>
    </div>
  );
}

/* ─── Decile bucket strip ───────────────────────────────────────────────── */

function BucketStrip() {
  const state = useStore();
  // Ease the bucket fees/bars in lockstep with the curve: same animated-fee
  // chase the CurveChart uses, so the strip flattens/adjusts with the curve
  // instead of snapping. The cap is smoothed too so bar widths don't jump.
  const dispFee = useAnimatedFee(state);
  const dispCap = useAnimatedSeries([state ? leverV(state, "max_fee_cap") : 0]);
  if (!state) return null;
  const cap = dispCap[0] ?? leverV(state, "max_fee_cap");
  const bucketPcts = [60, 80, 100, 120, 140, 160, 180, 200, 220, 240];
  return (
    <div className="bucket-strip">
      {bucketPcts.map((pct) => {
        const f = dispFee(pct);
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
      <header className="panel-header curve-head">
        <div className="curve-head-left">
          <div className="panel-title">
            {view === "cost"
              ? "Consumer cost curve"
              : state.pricing_off
                ? "Forecasted crowd · no pricing intervention"
                : `Steering the year toward ${state.occupancy_target ?? 100}% capacity`}
          </div>
          {view === "cost" && (
            <div className="panel-sub" style={{ marginTop: 4 }}>
              {`${Math.round(liveDemandPct(activeDay.demand_pct, state))}% of ${(targetCapacity(state) / 1000).toFixed(0)}k capacity · ${activeDay.date}`}
            </div>
          )}
        </div>

        {/* View toggle — centred between the graph modes (cost / 1-yr / 5-yr). */}
        <div className="curve-view-toggle" role="tablist" aria-label="Curve view">
          <button
            className={view === "cost" ? "on" : ""}
            onClick={() => setView("cost")}
            aria-pressed={view === "cost"}
          >
            Cost curve
          </button>
          <button
            className={view === "year" && (state.zoomSpan ?? 1) !== 5 ? "on" : ""}
            onClick={() => setZoomSpan(1)}
            aria-pressed={view === "year" && (state.zoomSpan ?? 1) !== 5}
          >
            1-year
          </button>
          <button
            className={view === "year" && state.zoomSpan === 5 ? "on" : ""}
            onClick={() => setZoomSpan(5)}
            aria-pressed={view === "year" && state.zoomSpan === 5}
          >
            5-year
          </button>
        </div>

        <div className="curve-legend">
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
        <YearCurve />
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
