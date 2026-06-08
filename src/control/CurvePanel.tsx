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
import { fmtEur, fmtNumber } from "./format";

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

function YearCurve() {
  const state = useStore();
  const dragging = useRef(false);
  if (!state) return <div className="curve-stage" />;

  const w = 1000;
  // Taller canvas than the cost view: with the explainer paragraph removed, the
  // zoom-out fills the freed vertical space (aspect closer to the stage's).
  const h = 760;
  const padL = 56;
  const padR = 28;
  const padT = 30;
  const padB = 52;
  const innerW = Math.max(1, w - padL - padR);
  const innerH = Math.max(1, h - padT - padB);

  const occTarget = state.occupancy_target ?? 100;
  const span = state.zoomSpan === 5 ? 5 : 1;
  const growth = annualGrowthRate(state);
  const baseMonths = monthlyDemandProfile(state);
  const fiveYr = !!state.daily && state.daily.length > 400;
  const firstYear = state.daily && state.daily[0] ? Number(state.daily[0].date.slice(0, 4)) : 2026;
  const baseYear = firstYear; // x-axis anchor — 2024 for the 5-year bundle
  const cutoff = state.locked_cutoff;
  const yearly = fiveYr ? deriveYearlyMonthlyProfiles(state.daily!) : null;

  // Calendar years on the x-axis: the 5 fixed bundle years, else the active year.
  const years = span === 5 ? Array.from({ length: 5 }, (_, i) => firstYear + i) : [activeYear(state)];
  const n = years.length * 12;

  type YPt = { live: number; managed: number; fee: number; name: string; year: number; mi: number; locked: boolean };
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

  const peak = Math.max(occTarget, ...pts.map((p) => Math.max(p.live, p.managed)));
  const yMax = Math.ceil((peak * 1.12) / 20) * 20;

  const xAt = (i: number) => padL + ((i + 0.5) / n) * innerW;
  const yS = (v: number) => padT + (1 - v / yMax) * innerH;
  const baseY = yS(0);

  // Split into the locked (confirmed-actual) prefix and the open (projection) tail.
  const firstOpenIdx = pts.findIndex((p) => !p.locked);
  const openStart = firstOpenIdx < 0 ? pts.length : firstOpenIdx;
  const cutoffX = openStart > 0 && openStart < pts.length ? padL + (openStart / n) * innerW : null;

  const manXY = pts.map((p, i) => ({ x: xAt(i), y: yS(Math.min(yMax, p.managed)) }));
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
  const markerLiveI = pts[lo].live * (1 - tt) + pts[hi].live * tt;
  const markerPct = Math.round(markerLiveI);
  const markerX = padL + (monthFloat / n) * innerW;
  const markerDotY = yS(Math.min(yMax, markerLiveI)); // sit on the predicted-crowd line
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

        {/* Horizontal gridlines + %-axis ticks */}
        {yGrid.map((v) => (
          <g key={"yg-" + v}>
            <line x1={padL} y1={yS(v)} x2={w - padR} y2={yS(v)} stroke="currentColor" opacity={v === 0 ? 0.18 : 0.07} />
            <text x={padL - 10} y={yS(v) + 4} textAnchor="end" className="curve-tick-label">
              {v}%
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

        {/* Warm wash under the managed curve */}
        <path d={areaPath} fill="url(#year-fill)" />

        {/* Raw forecast bell curve (before pricing) — dashed */}
        <path d={rawPath} fill="none" style={{ stroke: "var(--penalty)" }} strokeWidth="2" strokeDasharray="5 4" opacity="0.6" strokeLinejoin="round" />

        {/* Managed curve (after pricing) — solid green hero line */}
        <path d={manPath} fill="none" stroke="#2FA866" strokeWidth="2.75" strokeLinejoin="round" strokeLinecap="round" />

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
            const cy = yS(Math.min(yMax, p.managed));
            return (
              <g key={"md-" + i}>
                {cy - yS(Math.min(yMax, p.live)) > 8 && (
                  <line x1={xAt(i)} y1={yS(Math.min(yMax, p.live)) + 2} x2={xAt(i)} y2={cy - 3} style={{ stroke: "var(--penalty)" }} strokeWidth="1" strokeDasharray="2 2" opacity="0.45" />
                )}
                <circle cx={xAt(i)} cy={cy} r="2.8" fill="#2FA866" />
              </g>
            );
          })}

        {/* Peak label (busiest managed point across the horizon) */}
        {peakI >= 0 && (
          <text
            x={Math.min(w - padR - 40, Math.max(padL + 40, xAt(peakI)))}
            y={yS(Math.min(yMax, peakManaged)) - 9}
            textAnchor="middle"
            className="year-band-label"
            style={{ fontWeight: 600 }}
          >
            {span === 5 ? `${baseYear + pts[peakI].year} · ` : `${pts[peakI].name} · `}
            {Math.round(peakManaged)}% · {fmtEur(pts[peakI].fee)}
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
