import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  VENICE_DAY_TOURIST_SEGMENTS,
  VENICE_FEE_EUR,
  VENICE_EQUITY_SOURCE_NOTE,
  VERDICT_LABEL,
  VERDICT_DESCRIPTION,
  feePercentOf,
  type DayTouristSegment,
  type EquityVerdict,
} from "../data/veniceDayTourists";

/* ----- Palette derived from existing semantic tokens ---------------------- */
/* Verdicts map onto the dark-glass palette: gold for the proportional spine, */
/* green for fair share, warn-orange for heavy burden, bad-red for regressive.*/

const VERDICT_COLOR: Record<EquityVerdict, string> = {
  "fair-share": "var(--q-mid)",
  proportional: "var(--gx-gold-deep)",
  "heavy-burden": "var(--q-warn)",
  regressive: "var(--q-bad)",
};

/* Bright hex values used where alpha-blending via `${color}22` is required.
 * Mirrors --gx-gold (#f1d896), a brightened --q-mid, --q-warn, --q-bad. */
const VERDICT_COLOR_BRIGHT: Record<EquityVerdict, string> = {
  "fair-share": "#5fae87",
  proportional: "#f1d896",
  "heavy-burden": "#e09545",
  regressive: "#d76851",
};

/* ----- SVG geometry helpers ----------------------------------------------- */

const TAU = Math.PI * 2;

function polar(cx: number, cy: number, r: number, angleRad: number): [number, number] {
  return [cx + r * Math.cos(angleRad), cy + r * Math.sin(angleRad)];
}

/** Build an SVG arc path for a donut slice between two angles. */
function donutSlicePath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngle: number,
  endAngle: number,
): string {
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  const [x1, y1] = polar(cx, cy, rOuter, startAngle);
  const [x2, y2] = polar(cx, cy, rOuter, endAngle);
  const [x3, y3] = polar(cx, cy, rInner, endAngle);
  const [x4, y4] = polar(cx, cy, rInner, startAngle);
  return [
    `M ${x1} ${y1}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${x4} ${y4}`,
    "Z",
  ].join(" ");
}

/* ----- Layout: pre-compute each slice's angles + path --------------------- */

type Layout = {
  segment: DayTouristSegment;
  startAngle: number;
  endAngle: number;
  midAngle: number;
  path: string;
  hoverPath: string;
  color: string;
  colorBright: string;
};

function useLayout(width: number) {
  return useMemo(() => {
    const cx = width / 2;
    const cy = width / 2;
    const rOuter = width / 2 - 6;
    const rInner = width * 0.32;
    const rHover = rOuter + 8;

    const total = VENICE_DAY_TOURIST_SEGMENTS.reduce(
      (s, x) => s + x.percentOfDayTourists,
      0,
    );

    let cursor = -Math.PI / 2; // start at 12 o'clock
    const out: Layout[] = [];
    for (const segment of VENICE_DAY_TOURIST_SEGMENTS) {
      const sweep = (segment.percentOfDayTourists / total) * TAU;
      const startAngle = cursor;
      const endAngle = cursor + sweep;
      const midAngle = (startAngle + endAngle) / 2;
      out.push({
        segment,
        startAngle,
        endAngle,
        midAngle,
        path: donutSlicePath(cx, cy, rOuter, rInner, startAngle, endAngle),
        hoverPath: donutSlicePath(cx, cy, rHover, rInner, startAngle, endAngle),
        color: VERDICT_COLOR[segment.verdict],
        colorBright: VERDICT_COLOR_BRIGHT[segment.verdict],
      });
      cursor = endAngle;
    }
    return { cx, cy, rOuter, rInner, layouts: out };
  }, [width]);
}

/* ----- The component ------------------------------------------------------ */

type Props = {
  /** Visual size of the pie in px (square). Defaults to 360. */
  size?: number;
  /** Optional initial active segment id. Defaults to the most regressive. */
  initialActiveId?: string;
};

export function VeniceDayTouristChart({ size = 360, initialActiveId }: Props) {
  const { layouts } = useLayout(size);

  const defaultId =
    initialActiveId ??
    [...VENICE_DAY_TOURIST_SEGMENTS].sort(
      (a, b) => feePercentOf(b) - feePercentOf(a),
    )[0].id;

  const [hoverId, setHoverId] = useState<string | null>(null);
  const [lockedId, setLockedId] = useState<string>(defaultId);

  const activeId = hoverId ?? lockedId;
  const activeIndex = VENICE_DAY_TOURIST_SEGMENTS.findIndex(
    (s) => s.id === activeId,
  );
  const active = VENICE_DAY_TOURIST_SEGMENTS[activeIndex];

  const svgRef = useRef<SVGSVGElement | null>(null);

  /* keyboard: arrows cycle, Escape unlocks hover (or resets lock to default) */
  const onKey = useCallback(
    (e: React.KeyboardEvent<SVGSVGElement>) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        const next =
          VENICE_DAY_TOURIST_SEGMENTS[
            (activeIndex + 1) % VENICE_DAY_TOURIST_SEGMENTS.length
          ];
        setHoverId(null);
        setLockedId(next.id);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        const prev =
          VENICE_DAY_TOURIST_SEGMENTS[
            (activeIndex - 1 + VENICE_DAY_TOURIST_SEGMENTS.length) %
              VENICE_DAY_TOURIST_SEGMENTS.length
          ];
        setHoverId(null);
        setLockedId(prev.id);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setHoverId(null);
        setLockedId(defaultId);
      } else if (e.key === "Enter" || e.key === " ") {
        if (hoverId) {
          e.preventDefault();
          setLockedId(hoverId);
        }
      }
    },
    [activeIndex, defaultId, hoverId],
  );

  /* Also catch Escape at window level so it works even if focus drifted. */
  useEffect(() => {
    function onWindowKey(e: KeyboardEvent) {
      if (e.key === "Escape") setHoverId(null);
    }
    window.addEventListener("keydown", onWindowKey);
    return () => window.removeEventListener("keydown", onWindowKey);
  }, []);

  const feePct = feePercentOf(active);
  const verdictColor = VERDICT_COLOR_BRIGHT[active.verdict];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(280px, 1fr) minmax(260px, 1fr)",
        gap: 32,
        alignItems: "center",
      }}
      className="venice-equity-chart"
    >
      {/* Pie */}
      <div style={{ display: "flex", justifyContent: "center", position: "relative" }}>
        <svg
          ref={svgRef}
          width="100%"
          viewBox={`0 0 ${size} ${size}`}
          style={{ maxWidth: size, outline: "none" }}
          role="img"
          aria-label="Venice day-tourist segments by share of total; click a slice to see how the €40 sustainability fee lands on it."
          tabIndex={0}
          onKeyDown={onKey}
          onMouseLeave={() => setHoverId(null)}
        >
          <defs>
            <radialGradient id="venice-pie-bloom" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(241,216,150,0.20)" />
              <stop offset="70%" stopColor="rgba(241,216,150,0.04)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0)" />
            </radialGradient>
          </defs>

          {/* Subtle inner bloom behind the donut */}
          <circle cx={size / 2} cy={size / 2} r={size / 2 - 4} fill="url(#venice-pie-bloom)" />

          {/* Slices */}
          {layouts.map((l) => {
            const isActive = l.segment.id === activeId;
            const isHover = l.segment.id === hoverId;
            return (
              <g
                key={l.segment.id}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoverId(l.segment.id)}
                onClick={() => {
                  setLockedId(l.segment.id);
                  setHoverId(null);
                }}
              >
                <path
                  d={isHover || isActive ? l.hoverPath : l.path}
                  fill={isActive ? l.colorBright : l.color}
                  stroke="var(--gx-bg-1)"
                  strokeWidth={2}
                  style={{
                    transition: "d 160ms ease, fill 160ms ease",
                    filter: isActive
                      ? `drop-shadow(0 0 12px ${l.colorBright}aa)`
                      : "none",
                  }}
                  aria-label={`${l.segment.name}: ${l.segment.percentOfDayTourists}% of day tourists, ${VERDICT_LABEL[l.segment.verdict]}`}
                />
              </g>
            );
          })}

          {/* Centre label */}
          <g pointerEvents="none">
            <text
              x={size / 2}
              y={size / 2 - 10}
              textAnchor="middle"
              fontFamily="'JetBrains Mono', monospace"
              fontSize={10}
              letterSpacing="0.16em"
              fill="var(--gx-text-3)"
              style={{ textTransform: "uppercase" }}
            >
              Day tourists / yr
            </text>
            <text
              x={size / 2}
              y={size / 2 + 22}
              textAnchor="middle"
              fontFamily="'Fraunces', serif"
              fontSize={34}
              fontWeight={600}
              fill="var(--gx-text-1)"
              letterSpacing="-0.02em"
            >
              ≈ 25M
            </text>
            <text
              x={size / 2}
              y={size / 2 + 42}
              textAnchor="middle"
              fontFamily="'Inter Tight', sans-serif"
              fontSize={11}
              fill="var(--gx-text-3)"
            >
              7 segments · €{VENICE_FEE_EUR} flat fee
            </text>
          </g>
        </svg>
      </div>

      {/* Detail panel */}
      <div
        style={{
          background: "var(--gx-surface)",
          border: "1px solid var(--gx-border)",
          borderRadius: 18,
          padding: 22,
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          boxShadow: "inset 0 1px 0 var(--gx-highlight)",
          minHeight: 320,
        }}
        aria-live="polite"
      >
        <VerdictBadge verdict={active.verdict} />
        <div
          className="serif"
          style={{
            fontSize: 26,
            letterSpacing: "-0.02em",
            color: "var(--gx-text-1)",
            marginTop: 12,
            lineHeight: 1.15,
          }}
        >
          {active.name}
        </div>
        <div style={{ fontSize: 13, color: "var(--gx-text-2)", marginTop: 6, lineHeight: 1.5 }}>
          {active.descriptor}
        </div>

        <div
          style={{
            marginTop: 18,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          <StatCell
            label="Avg arrival cost"
            value={`€${active.avgArrivalCostEUR}`}
            sub={active.arrivalCostNote}
          />
          <StatCell
            label="€40 fee as share"
            value={`${feePct}%`}
            sub={feePctSub(feePct)}
            valueColor={verdictColor}
          />
        </div>

        <div
          style={{
            marginTop: 16,
            padding: "12px 14px",
            background: "var(--gx-surface-muted)",
            border: "1px solid var(--gx-border-muted)",
            borderRadius: 12,
            fontSize: 12.5,
            color: "var(--gx-text-2)",
            lineHeight: 1.5,
          }}
        >
          {VERDICT_DESCRIPTION[active.verdict]}
        </div>

        <FeeBar percent={feePct} color={verdictColor} />

        <div
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: "0.14em",
            color: "var(--gx-text-3)",
            textTransform: "uppercase",
            marginTop: 18,
          }}
        >
          {active.percentOfDayTourists}% of Venice day tourists · click slice or use arrow keys
        </div>
      </div>

      {/* Footnote (source) — spans both columns on wider viewports */}
      <div
        style={{
          gridColumn: "1 / -1",
          fontSize: 11,
          color: "var(--gx-text-3)",
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: "0.04em",
          marginTop: 8,
        }}
      >
        Source · {VENICE_EQUITY_SOURCE_NOTE}
      </div>

      {/* Single-column fallback for narrow viewports */}
      <style>{`
        @media (max-width: 720px) {
          .venice-equity-chart {
            grid-template-columns: 1fr !important;
            gap: 20px !important;
          }
        }
      `}</style>
    </div>
  );
}

/* ----- Sub-components ----------------------------------------------------- */

function feePctSub(pct: number): string {
  if (pct < 10) return "Barely a rounding error on arrival cost.";
  if (pct < 30) return "Noticeable but in line with trip spend.";
  if (pct < 100) return "A real budget hit without a rebate.";
  return "Several times what they paid to get here.";
}

function VerdictBadge({ verdict }: { verdict: EquityVerdict }) {
  const color = VERDICT_COLOR_BRIGHT[verdict];
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 12px",
        borderRadius: 999,
        background: `${color}22`,
        border: `1px solid ${color}66`,
        color,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        fontWeight: 600,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: color,
          boxShadow: `0 0 8px ${color}`,
        }}
      />
      {VERDICT_LABEL[verdict]}
    </div>
  );
}

function StatCell({
  label,
  value,
  sub,
  valueColor,
}: {
  label: string;
  value: string;
  sub: string;
  valueColor?: string;
}) {
  return (
    <div
      style={{
        background: "var(--gx-surface-muted)",
        border: "1px solid var(--gx-border-muted)",
        borderRadius: 12,
        padding: "12px 14px",
      }}
    >
      <div
        className="mono"
        style={{
          fontSize: 9.5,
          letterSpacing: "0.16em",
          color: "var(--gx-text-3)",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        className="serif tnum"
        style={{
          fontSize: 28,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: valueColor ?? "var(--gx-text-1)",
          marginTop: 2,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: "var(--gx-text-3)", marginTop: 4, lineHeight: 1.4 }}>
        {sub}
      </div>
    </div>
  );
}

/** A visual bar that pegs the fee-percent against a 0-100% axis,
 *  with an overflow indicator for regressive cases. */
function FeeBar({ percent, color }: { percent: number; color: string }) {
  const clamped = Math.min(percent, 100);
  const overflow = percent > 100;
  const trackStyle: CSSProperties = {
    position: "relative",
    height: 8,
    borderRadius: 999,
    background: "var(--gx-surface-muted)",
    border: "1px solid var(--gx-border-muted)",
    overflow: "hidden",
  };
  return (
    <div style={{ marginTop: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 10,
          color: "var(--gx-text-3)",
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          marginBottom: 6,
        }}
      >
        <span>Fee vs. arrival</span>
        <span>{overflow ? `${percent}% (off-scale)` : "0—100%"}</span>
      </div>
      <div style={trackStyle}>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            height: "100%",
            width: `${clamped}%`,
            background: `linear-gradient(90deg, ${color}88, ${color})`,
            boxShadow: overflow ? `0 0 12px ${color}` : "none",
            transition: "width 240ms ease",
          }}
        />
        {overflow && (
          <div
            style={{
              position: "absolute",
              top: -2,
              right: 0,
              bottom: -2,
              width: 4,
              background: color,
              boxShadow: `0 0 8px ${color}`,
            }}
          />
        )}
      </div>
    </div>
  );
}
