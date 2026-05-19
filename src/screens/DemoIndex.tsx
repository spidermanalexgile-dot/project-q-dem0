import { Link } from "react-router-dom";
import { meshBackground } from "../components/glass/glassStyles";
import { useDemoData } from "../data/demoData";
import { DestinationToggle } from "../components/DestinationToggle";

const screens = [
  {
    phase: "Phase 3 · In-town (the hero)",
    surface: "mobile",
    items: [
      { to: "/p3/trip", label: "Trip · guided walkthrough ★" },
      { to: "/p3/home", label: "Ask Q · chat" },
      { to: "/p3/wallet", label: "Wallet · QCash" },
      { to: "/p3/pay", label: "Pay · QR" },
      { to: "/p3/map", label: "Map · Queenstown" },
    ],
  },
  {
    phase: "Phase 2 · Pre-arrival",
    surface: "mobile",
    items: [
      { to: "/p2/onboarding", label: "Onboarding" },
      { to: "/p2/home", label: "Projected QCash" },
      { to: "/p2/prebook", label: "Pre-book Skyline" },
    ],
  },
  {
    phase: "Phase 1 · Booking",
    surface: "desktop",
    items: [
      { to: "/p1/checkout", label: "Booking line item" },
      { to: "/p1/landing", label: "projectq.travel · in-app" },
      { to: "/landing", label: "projectq.travel · public ★" },
    ],
  },
  {
    phase: "Phase 4 · Departure",
    surface: "mobile",
    items: [
      { to: "/p4/summary", label: "Trip summary" },
      { to: "/p4/memory", label: "Memory film" },
      { to: "/p4/comeback", label: "Come back" },
    ],
  },
  {
    phase: "Take Control",
    surface: "mobile",
    items: [{ to: "/takecontrol", label: "Take Control · home" }],
  },
];

export function DemoIndex() {
  const { demoIndexSubtitle } = useDemoData();
  return (
    <div
      style={{
        minHeight: "100vh",
        ...meshBackground,
        color: "var(--gx-text-1)",
        padding: "60px 40px",
        position: "relative",
      }}
    >
      {/* Top-right destination toggle */}
      <div style={{ position: "fixed", top: 20, right: 20, zIndex: 1000 }}>
        <DestinationToggle />
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              className="mono"
              style={{
                fontSize: 11,
                letterSpacing: "0.18em",
                color: "var(--gx-gold)",
                textTransform: "uppercase",
              }}
            >
              Project Q · Tourist UX · Demo
            </div>
            <h1
              className="serif"
              style={{
                fontSize: 56,
                margin: "12px 0 6px",
                letterSpacing: "-0.03em",
                lineHeight: 1.02,
                color: "var(--gx-text-1)",
                fontWeight: 600,
              }}
            >
              Pick a screen.
            </h1>
            <p
              style={{
                fontSize: 15,
                color: "var(--gx-text-2)",
                maxWidth: 580,
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              {demoIndexSubtitle}
            </p>
          </div>
          <Link
            to="/walkthrough"
            style={{
              padding: "10px 18px",
              background: "linear-gradient(180deg, #fde7a3, #d4b87a)",
              color: "#3d2f12",
              borderRadius: 999,
              textDecoration: "none",
              fontWeight: 600,
              fontSize: 13,
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              boxShadow: "0 0 16px rgba(241,216,150,0.35), inset 0 1px 0 rgba(255,255,255,0.55)",
            }}
          >
            Full walkthrough →
          </Link>
        </div>

        <div
          style={{
            marginTop: 40,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 20,
          }}
        >
          {screens.map((group) => (
            <div
              key={group.phase}
              style={{
                background: "var(--gx-surface)",
                border: "1px solid var(--gx-border)",
                borderRadius: 16,
                padding: 20,
                backdropFilter: "blur(20px) saturate(180%)",
                WebkitBackdropFilter: "blur(20px) saturate(180%)",
                boxShadow: "inset 0 1px 0 var(--gx-highlight)",
              }}
            >
              <div
                className="mono"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.14em",
                  color: "var(--gx-gold)",
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}
              >
                {group.phase}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {group.items.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    style={{
                      padding: "12px 14px",
                      background: "var(--gx-surface-muted)",
                      borderRadius: 10,
                      color: "var(--gx-text-1)",
                      textDecoration: "none",
                      fontSize: 14,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      border: "1px solid var(--gx-border-muted)",
                    }}
                  >
                    <span>{item.label}</span>
                    <span style={{ color: "var(--gx-text-3)", fontSize: 11 }}>{group.surface}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 40,
            fontSize: 11,
            color: "var(--gx-text-3)",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          ● Live demo · No backend · No real money
        </div>
      </div>
    </div>
  );
}
