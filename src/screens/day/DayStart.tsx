import { useNavigate } from "react-router-dom";
import { StatusBar } from "../../components/StatusBar";
import { meshBackground, glassSurfaceMuted, glassText } from "../../components/glass/glassStyles";
import { VeniceModeChip } from "../../components/VeniceModeChip";
import { dayTripperVibes, type DayTripperVibe } from "../../data/dayTripper";
import { useDayTripper } from "../../context/DayTripperContext";

export function DayStart() {
  const navigate = useNavigate();
  const { setVibe } = useDayTripper();

  function pick(v: DayTripperVibe | null) {
    setVibe(v);
    navigate("/day/wallet");
  }

  return (
    <div className="phone-screen" style={{ ...meshBackground, color: glassText.primary }}>
      <StatusBar dark />
      <VeniceModeChip target="multi-day" />
      <div
        style={{
          height: "calc(100% - 44px)",
          padding: "20px 24px 32px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: "0.2em",
            color: glassText.gold,
            textTransform: "uppercase",
          }}
        >
          One quick question
        </div>
        <h1
          className="serif"
          style={{
            fontSize: 32,
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
            fontWeight: 600,
            margin: "12px 0 6px",
            color: glassText.primary,
          }}
        >
          What&apos;s your Venice
          <br />
          vibe today?
        </h1>
        <p style={{ fontSize: 14, color: glassText.secondary, lineHeight: 1.5, margin: 0 }}>
          Tap one — we&apos;ll sort what&apos;s near you. Skip if you want it all.
        </p>

        <div
          style={{
            marginTop: 32,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          {dayTripperVibes.map((v) => (
            <button
              key={v}
              onClick={() => pick(v)}
              style={{
                ...glassSurfaceMuted,
                padding: "26px 14px",
                borderRadius: 18,
                color: glassText.primary,
                textAlign: "left",
                cursor: "pointer",
                fontFamily: "'Inter Tight', sans-serif",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <span
                style={{
                  fontSize: 22,
                  color: glassText.gold,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {vibeIcon(v)}
              </span>
              <span
                className="serif"
                style={{
                  fontSize: 17,
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                  marginTop: 6,
                }}
              >
                {v}
              </span>
              <span style={{ fontSize: 11, color: glassText.tertiary, marginTop: 2 }}>
                {vibeHint(v)}
              </span>
            </button>
          ))}
        </div>

        <div style={{ marginTop: "auto", textAlign: "center" }}>
          <button
            onClick={() => pick(null)}
            style={{
              background: "transparent",
              border: 0,
              color: glassText.tertiary,
              fontFamily: "'Inter Tight', sans-serif",
              fontSize: 13,
              textDecoration: "underline",
              cursor: "pointer",
              padding: 8,
            }}
          >
            Skip — show me everything
          </button>
        </div>
      </div>
    </div>
  );
}

function vibeIcon(v: DayTripperVibe): string {
  switch (v) {
    case "Food & wine": return "◆";
    case "Sights & history": return "▲";
    case "Hidden Venice": return "◇";
    case "Just wandering": return "●";
  }
}

function vibeHint(v: DayTripperVibe): string {
  switch (v) {
    case "Food & wine": return "Cicchetti · spritz · gelato";
    case "Sights & history": return "Basilicas · museums · views";
    case "Hidden Venice": return "Bàcari · shops · craft";
    case "Just wandering": return "Mix it up";
  }
}
