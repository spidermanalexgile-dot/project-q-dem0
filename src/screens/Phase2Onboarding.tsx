import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatusBar } from "../components/StatusBar";

const TAGS = ["Adventure", "Wineries", "Hiking", "Fine dining", "Spa & slow", "Nightlife", "Family-friendly", "Local food", "Photography", "Skiing"];

export function Phase2Onboarding() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>(["Adventure", "Wineries", "Hiking", "Family-friendly", "Local food"]);

  function toggle(t: string) {
    setSelected((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));
  }

  return (
    <div className="phone-screen" style={{ background: "#0a4d3c", color: "#fdfbf5" }}>
      <StatusBar dark />
      <div style={{ padding: "30px 28px 0", height: "calc(100% - 44px)", display: "flex", flexDirection: "column" }}>
        <div className="mono" style={{ fontSize: 10, letterSpacing: "0.18em", color: "#d4b87a", textTransform: "uppercase" }}>
          03 of 06 · A few questions
        </div>
        <h2 className="serif" style={{ fontSize: 32, lineHeight: 1.05, margin: "14px 0 8px", letterSpacing: "-0.02em" }}>
          What gets you out of bed on holiday?
        </h2>
        <p style={{ fontSize: 14, color: "#c8d6cf", margin: 0 }}>Q tailors your trip to what you love. Tap all that apply.</p>

        <div style={{ marginTop: 24, display: "flex", flexWrap: "wrap", gap: 8 }}>
          {TAGS.map((t) => {
            const on = selected.includes(t);
            return (
              <button
                key={t}
                onClick={() => toggle(t)}
                style={{
                  padding: "10px 16px",
                  borderRadius: 999,
                  fontSize: 14,
                  fontWeight: 500,
                  background: on ? "#d4b87a" : "transparent",
                  color: on ? "#0a1f1a" : "#fdfbf5",
                  border: on ? "1px solid #d4b87a" : "1px solid rgba(255,255,255,0.2)",
                  cursor: "pointer",
                }}
              >
                {t}
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: "auto", paddingBottom: 30 }}>
          <div style={{ display: "flex", gap: 4, marginBottom: 18 }}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <span
                key={i}
                style={{
                  flex: 1,
                  height: 3,
                  borderRadius: 2,
                  background: i <= 2 ? "#d4b87a" : "rgba(255,255,255,0.2)",
                }}
              />
            ))}
          </div>
          <button className="btn btn-gold" style={{ width: "100%" }} onClick={() => navigate("/p2/home")}>
            Continue
          </button>
          <div style={{ textAlign: "center", marginTop: 12, fontSize: 13, color: "#a8b8af" }}>Skip — I'll personalize later</div>
        </div>
      </div>
    </div>
  );
}
