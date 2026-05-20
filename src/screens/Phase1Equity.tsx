import { Link } from "react-router-dom";
import { meshBackground } from "../components/glass/glassStyles";
import { VeniceDayTouristChart } from "../components/VeniceDayTouristChart";
import { DestinationToggle } from "../components/DestinationToggle";
import { useDestination } from "../context/DestinationContext";
import { VENICE_FEE_EUR } from "../data/veniceDayTourists";

export function Phase1Equity() {
  const { destination, setDestination } = useDestination();
  const isVenice = destination === "venice";

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        ...meshBackground,
        color: "var(--gx-text-1)",
        fontFamily: "'Inter Tight', sans-serif",
        overflow: "auto",
        position: "relative",
      }}
    >
      <div style={{ position: "absolute", top: 18, right: 18, zIndex: 5 }}>
        <DestinationToggle />
      </div>

      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "44px 36px 56px" }}>
        <div
          className="mono"
          style={{
            fontSize: 11,
            letterSpacing: "0.2em",
            color: "var(--gx-gold)",
            textTransform: "uppercase",
          }}
        >
          Phase 1 · Booking · Equity lens · Venice
        </div>
        <h1
          className="serif"
          style={{
            fontSize: 46,
            margin: "12px 0 10px",
            letterSpacing: "-0.03em",
            lineHeight: 1.04,
            fontWeight: 600,
            color: "var(--gx-text-1)",
          }}
        >
          One €{VENICE_FEE_EUR} fee.
          <br />
          <span style={{ color: "var(--gx-gold)" }}>Seven very different arrivals.</span>
        </h1>
        <p
          style={{
            fontSize: 15,
            color: "var(--gx-text-2)",
            maxWidth: 640,
            lineHeight: 1.55,
            margin: 0,
          }}
        >
          A flat sustainability fee at the booking moment is only honest if we&apos;re honest
          about who pays it. Venice receives roughly 25 million day visitors a year, arriving
          on radically different budgets. Each slice below is one segment of that population
          — hover or click to see how the €{VENICE_FEE_EUR} fee actually lands.
        </p>

        {isVenice ? (
          <div style={{ marginTop: 32 }}>
            <VeniceDayTouristChart size={360} />
          </div>
        ) : (
          <SwitchToVeniceCard
            onSwitch={() => setDestination("venice")}
          />
        )}

        <div
          style={{
            marginTop: 36,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
          <LegendCard
            color="#5fae87"
            label="Fair share"
            rule="Fee < 10% of arrival cost"
          />
          <LegendCard
            color="#f1d896"
            label="Proportional"
            rule="10–30% of arrival cost"
          />
          <LegendCard
            color="#e09545"
            label="Heavy burden"
            rule="30–100% of arrival cost"
          />
          <LegendCard
            color="#d76851"
            label="Regressive"
            rule="Fee > arrival cost itself"
          />
        </div>

        <div
          style={{
            marginTop: 36,
            padding: 22,
            borderRadius: 16,
            background: "var(--gx-surface-muted)",
            border: "1px solid var(--gx-border-muted)",
            boxShadow: "inset 0 1px 0 var(--gx-highlight)",
          }}
        >
          <div
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: "0.18em",
              color: "var(--gx-text-3)",
              textTransform: "uppercase",
            }}
          >
            Why this matters at the booking moment
          </div>
          <div
            style={{
              fontSize: 14,
              color: "var(--gx-text-2)",
              lineHeight: 1.6,
              marginTop: 10,
            }}
          >
            The chart isn&apos;t an argument against the fee — Venice needs the revenue, and
            the cruise and city-break segments will barely notice it. It is an argument for
            the <span style={{ color: "var(--gx-gold)" }}>QCash rebate</span> that follows:
            the same €40 that&apos;s a rounding error on a cruise cabin is rent money for a
            backpacker on an €8 regional train. The rebate is what keeps the cheapest
            day-trippers whole — and the chart is how we surface that intentionally instead
            of burying it on page 4 of a council white-paper.
          </div>
        </div>

        <div style={{ marginTop: 30, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link
            to="/p1/checkout"
            style={{
              padding: "10px 18px",
              background: "linear-gradient(180deg, #fde7a3, #d4b87a)",
              color: "#3d2f12",
              borderRadius: 999,
              textDecoration: "none",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            See the booking line item →
          </Link>
          <Link
            to="/walkthrough"
            style={{
              padding: "10px 18px",
              background: "transparent",
              color: "var(--gx-text-1)",
              borderRadius: 999,
              textDecoration: "none",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 600,
              border: "1px solid var(--gx-border)",
            }}
          >
            Full walkthrough
          </Link>
        </div>
      </div>
    </div>
  );
}

function SwitchToVeniceCard({ onSwitch }: { onSwitch: () => void }) {
  return (
    <div
      style={{
        marginTop: 32,
        padding: 32,
        borderRadius: 18,
        background: "var(--gx-surface)",
        border: "1px solid var(--gx-border)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        boxShadow: "inset 0 1px 0 var(--gx-highlight)",
        textAlign: "center",
      }}
    >
      <div
        className="mono"
        style={{
          fontSize: 10,
          letterSpacing: "0.18em",
          color: "var(--gx-text-3)",
          textTransform: "uppercase",
        }}
      >
        Venice-only view
      </div>
      <div
        className="serif"
        style={{
          fontSize: 24,
          marginTop: 8,
          letterSpacing: "-0.02em",
          color: "var(--gx-text-1)",
        }}
      >
        This equity chart is part of the Venice scenario.
      </div>
      <div style={{ fontSize: 14, color: "var(--gx-text-2)", marginTop: 8, maxWidth: 480, margin: "8px auto 0" }}>
        Queenstown has its own equity story (heavily skewed to fly-in arrivals)
        and the segments don&apos;t map across cleanly. Switch destination to see it.
      </div>
      <button
        onClick={onSwitch}
        style={{
          marginTop: 18,
          padding: "12px 22px",
          background: "linear-gradient(180deg, #fde7a3, #d4b87a)",
          color: "#3d2f12",
          border: 0,
          borderRadius: 999,
          fontWeight: 600,
          fontSize: 14,
          cursor: "pointer",
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        Switch to Venice
      </button>
    </div>
  );
}

function LegendCard({ color, label, rule }: { color: string; label: string; rule: string }) {
  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: 12,
        background: "var(--gx-surface-muted)",
        border: "1px solid var(--gx-border-muted)",
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 999,
          background: color,
          boxShadow: `0 0 10px ${color}aa`,
          marginTop: 5,
          flexShrink: 0,
        }}
      />
      <div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--gx-text-1)",
            letterSpacing: "-0.01em",
          }}
        >
          {label}
        </div>
        <div
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: "0.1em",
            color: "var(--gx-text-3)",
            textTransform: "uppercase",
            marginTop: 4,
          }}
        >
          {rule}
        </div>
      </div>
    </div>
  );
}
