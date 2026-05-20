import { Link } from "react-router-dom";
import { StatusBar } from "../../components/StatusBar";
import { DayNav } from "./DayNav";
import { meshBackground, glassSurfaceMuted, glassText } from "../../components/glass/glassStyles";
import { dayTripperPersona, impactAllocations } from "../../data/dayTripper";
import { useDayTripper } from "../../context/DayTripperContext";

const sampleSpends = [
  { vendor: "Caffè Florian", amount: 9 },
  { vendor: "St Mark's Campanile", amount: 11 },
  { vendor: "Gelato · Suso", amount: 5 },
  { vendor: "Cantine Schiavi", amount: 12 },
];

const colors = ["#f1d896", "#5fae87", "#7faec7", "#c99066"];

export function DayRecap() {
  const { spends, qcashStart, qcashBalance } = useDayTripper();
  const realSpent = qcashStart - qcashBalance;
  const isSample = spends.length === 0;

  const displaySpends = isSample ? sampleSpends : spends.map((s) => ({ vendor: s.vendor, amount: s.amount }));
  const displaySpent = isSample
    ? sampleSpends.reduce((acc, s) => acc + s.amount, 0)
    : realSpent;

  return (
    <div className="phone-screen" style={{ ...meshBackground, color: glassText.primary }}>
      <StatusBar dark />
      <div
        className="no-scrollbar"
        style={{ height: "calc(100% - 44px)", overflowY: "auto", paddingBottom: 110 }}
      >
        <div style={{ padding: "12px 24px 0" }}>
          <div
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: "0.2em",
              color: glassText.gold,
              textTransform: "uppercase",
            }}
          >
            Recap · {dayTripperPersona.names}
          </div>
          <h1
            className="serif"
            style={{
              fontSize: 36,
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
              fontWeight: 600,
              margin: "10px 0 6px",
            }}
          >
            Your day
            <br />
            in Venice
          </h1>

          {isSample && (
            <div
              style={{
                marginTop: 10,
                fontSize: 11,
                color: glassText.tertiary,
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              ● Sample day · no payments made yet
            </div>
          )}

          {/* Summary numbers */}
          <div
            style={{
              ...glassSurfaceMuted,
              marginTop: 16,
              padding: "16px 18px",
              borderRadius: 16,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              gap: 12,
            }}
          >
            <div>
              <div
                className="mono"
                style={{ fontSize: 10, letterSpacing: "0.14em", color: glassText.tertiary, textTransform: "uppercase" }}
              >
                Spent
              </div>
              <div className="serif" style={{ fontSize: 36, color: glassText.gold, lineHeight: 1, marginTop: 4 }}>
                {displaySpent}
              </div>
              <div style={{ fontSize: 11, color: glassText.secondary, marginTop: 2 }}>QCash</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                className="mono"
                style={{ fontSize: 10, letterSpacing: "0.14em", color: glassText.tertiary, textTransform: "uppercase" }}
              >
                Places
              </div>
              <div className="serif" style={{ fontSize: 36, color: glassText.primary, lineHeight: 1, marginTop: 4 }}>
                {displaySpends.length}
              </div>
              <div style={{ fontSize: 11, color: glassText.secondary, marginTop: 2 }}>visited</div>
            </div>
          </div>

          {/* Spend list */}
          <div style={{ marginTop: 18 }}>
            <div
              className="mono"
              style={{
                fontSize: 10,
                letterSpacing: "0.18em",
                color: glassText.tertiary,
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              You spent it at
            </div>
            {displaySpends.map((s, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "10px 0",
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                  fontSize: 13,
                }}
              >
                <span style={{ color: glassText.primary }}>{s.vendor}</span>
                <span className="mono tnum" style={{ color: glassText.gold, fontWeight: 600 }}>
                  −{s.amount}
                </span>
              </div>
            ))}
          </div>

          {/* Impact allocations */}
          <div style={{ marginTop: 26 }}>
            <div
              className="mono"
              style={{
                fontSize: 10,
                letterSpacing: "0.18em",
                color: glassText.gold,
                textTransform: "uppercase",
              }}
            >
              Your €{dayTripperPersona.feePaidEUR} helped fund
            </div>
            <div style={{ marginTop: 10 }}>
              {/* Stacked horizontal bar */}
              <div
                style={{
                  display: "flex",
                  height: 14,
                  borderRadius: 999,
                  overflow: "hidden",
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.04)",
                  marginBottom: 14,
                }}
              >
                {impactAllocations.map((a, i) => (
                  <div
                    key={a.label}
                    style={{
                      width: `${a.pct}%`,
                      background: colors[i % colors.length],
                      opacity: 0.85,
                    }}
                  />
                ))}
              </div>

              {impactAllocations.map((a, i) => (
                <div
                  key={a.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 0",
                    borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: colors[i % colors.length],
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ flex: 1, fontSize: 13, color: glassText.primary, lineHeight: 1.3 }}>
                    {a.label}
                  </span>
                  <span
                    className="mono tnum"
                    style={{ fontSize: 12, color: glassText.tertiary, fontWeight: 600 }}
                  >
                    {a.pct}%
                  </span>
                </div>
              ))}
              <div
                style={{
                  fontSize: 10,
                  color: glassText.tertiary,
                  marginTop: 8,
                  fontFamily: "'JetBrains Mono', monospace",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                Illustrative · sourced figures TK
              </div>
            </div>
          </div>

          {/* Re-engagement nudge */}
          <div
            style={{
              ...glassSurfaceMuted,
              marginTop: 24,
              padding: "16px 18px",
              borderRadius: 16,
              border: "1px solid rgba(241,216,150,0.3)",
              background: "rgba(241,216,150,0.06)",
            }}
          >
            <div
              className="mono"
              style={{
                fontSize: 10,
                letterSpacing: "0.16em",
                color: glassText.gold,
                textTransform: "uppercase",
              }}
            >
              Loved it?
            </div>
            <div
              className="serif"
              style={{
                fontSize: 18,
                letterSpacing: "-0.01em",
                color: glassText.primary,
                marginTop: 4,
                lineHeight: 1.25,
              }}
            >
              Next time, stay a little longer — multi-day visitors unlock <b style={{ color: glassText.gold }}>3×</b> more QCash.
            </div>
            <Link
              to="/p2/onboarding"
              style={{
                display: "inline-block",
                marginTop: 12,
                padding: "10px 16px",
                borderRadius: 999,
                background: "linear-gradient(180deg, #fde7a3, #d4b87a)",
                color: "#3d2f12",
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 12,
                fontFamily: "'Inter Tight', sans-serif",
                boxShadow: "0 0 14px rgba(241,216,150,0.4), inset 0 1px 0 rgba(255,255,255,0.5)",
              }}
            >
              Explore the multi-day version →
            </Link>
          </div>

          {/* Share button (mock) */}
          <button
            onClick={() => {
              /* mock */
            }}
            style={{
              marginTop: 16,
              width: "100%",
              padding: "12px 16px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.06)",
              color: glassText.primary,
              fontFamily: "'Inter Tight', sans-serif",
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Share my Venice day
          </button>

          <div
            style={{
              marginTop: 18,
              fontSize: 10,
              color: glassText.tertiary,
              textAlign: "center",
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            ● Day Tripper · Project Q
          </div>
        </div>
      </div>
      <DayNav />
    </div>
  );
}
