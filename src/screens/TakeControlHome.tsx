import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatusBar } from "../components/StatusBar";

const personas = {
  joe: {
    name: "Joe",
    q: "42",
    trip: "Queenstown · Day 3",
    action: "Lunch",
    advice: "Patagonia Chocolates is a 3-min walk. Use Q$8 — your full lunch is covered.",
    targetPin: "patagonia",
  },
  cruise: {
    name: "Margaret",
    q: "28",
    trip: "Day-pass · 6h left",
    action: "Lunch",
    advice: "You have 6 hours before your ship leaves. Ferg Burger has a 47-min queue — Patagonia is ready right now.",
    targetPin: "patagonia",
  },
  retiree: {
    name: "Eleanor",
    q: "56",
    trip: "Queenstown · Day 2",
    action: "Lunch",
    advice: "It's lunchtime. The hotel is 8 minutes away. Or use Q$8 at Patagonia Chocolates around the corner.",
    targetPin: "patagonia",
  },
} as const;

type PersonaKey = keyof typeof personas;

export function TakeControlHome() {
  const navigate = useNavigate();
  const [persona, setPersona] = useState<PersonaKey>("joe");
  const p = personas[persona];

  function exit() {
    navigate(-1);
  }

  // Esc key exits Take Control mode.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        exit();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="phone-screen" style={{ background: "#fdfbf5" }}>
      <StatusBar />
      <div style={{ padding: "12px 24px 24px", height: "calc(100% - 44px)", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 14, color: "#4d5a55" }}>Hi {p.name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              className="mono"
              style={{
                background: "#0a4d3c",
                color: "#fdfbf5",
                fontSize: 10,
                fontWeight: 600,
                padding: "4px 8px",
                borderRadius: 6,
                letterSpacing: "0.08em",
              }}
            >
              TAKE CONTROL
            </span>
            {/* Visible exit affordance — also bound to the Esc key */}
            <button
              onClick={exit}
              aria-label="Exit Take Control mode"
              title="Exit (Esc)"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "5px 10px 5px 8px",
                fontSize: 11,
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                background: "transparent",
                color: "#4d5a55",
                border: "1px solid #e7e0cf",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              <span aria-hidden style={{ fontSize: 13, lineHeight: 1 }}>×</span>
              Exit
            </button>
          </div>
        </div>

        <div
          style={{
            marginTop: 18,
            padding: "20px 22px",
            borderRadius: 18,
            background: "linear-gradient(160deg,#0a4d3c,#1a3d33)",
            color: "#fdfbf5",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 13, color: "#a8b8af" }}>You have</div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 4, marginTop: 4 }}>
            <span className="serif" style={{ fontSize: 22, color: "#d4b87a" }}>Q$</span>
            <span
              className="serif"
              style={{
                fontSize: 80,
                fontWeight: 600,
                color: "#f1d896",
                letterSpacing: "-0.04em",
                lineHeight: 1,
              }}
            >
              {p.q}
            </span>
          </div>
          <div style={{ fontSize: 13, color: "#c8d6cf", marginTop: 6 }}>to spend in {p.trip.split(" · ")[0]}</div>
        </div>

        <div style={{ marginTop: 20 }}>
          <div className="serif" style={{ fontSize: 24, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
            It's {p.action.toLowerCase()}time.
          </div>
          <div style={{ fontSize: 16, color: "#4d5a55", marginTop: 8, lineHeight: 1.5 }}>{p.advice}</div>
        </div>

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={() => navigate(`/p3/map?pin=${p.targetPin}`)}
            style={{
              width: "100%",
              padding: "20px",
              background: "#0a4d3c",
              color: "#fdfbf5",
              border: 0,
              borderRadius: 14,
              fontSize: 18,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Yes, take me there
          </button>
          <button
            onClick={() => navigate("/p3/trip")}
            style={{
              width: "100%",
              padding: "20px",
              background: "transparent",
              color: "#0a4d3c",
              border: "2px solid #e7e0cf",
              borderRadius: 14,
              fontSize: 18,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Show me something else
          </button>
          <button
            onClick={() => navigate("/p3/home")}
            style={{
              width: "100%",
              padding: "16px",
              background: "transparent",
              color: "#4d5a55",
              border: 0,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            🎙 Talk to Q instead
          </button>
        </div>

        {/* Persona switcher (demo only) */}
        <div style={{ marginTop: 14, display: "flex", gap: 8, justifyContent: "center" }}>
          {(Object.keys(personas) as PersonaKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setPersona(k)}
              style={{
                padding: "4px 10px",
                fontSize: 11,
                borderRadius: 999,
                border: "1px solid #e7e0cf",
                background: persona === k ? "#0a4d3c" : "transparent",
                color: persona === k ? "#fdfbf5" : "#4d5a55",
                cursor: "pointer",
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {personas[k].name}
            </button>
          ))}
        </div>

        <div
          style={{
            marginTop: 10,
            fontSize: 10,
            color: "#8a948f",
            textAlign: "center",
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          Press Esc to exit
        </div>
      </div>
    </div>
  );
}
