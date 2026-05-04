import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatusBar } from "../components/StatusBar";
import { Icon } from "../components/Icon";

export function Phase2PreBook() {
  const navigate = useNavigate();
  const [locked, setLocked] = useState(false);

  return (
    <div className="phone-screen">
      <StatusBar />
      <div style={{ padding: "8px 22px 0", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => navigate(-1)}>
        <Icon.Back />
        <div style={{ fontWeight: 600, fontSize: 15 }}>Skyline Gondola + Luge</div>
      </div>
      <div className="img-placeholder scenic" style={{ height: 180, margin: "12px 22px 0", borderRadius: 16 }}>
        <span style={{ color: "rgba(255,255,255,0.4)", fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>GONDOLA · BOB'S PEAK</span>
      </div>
      <div style={{ padding: "16px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div className="serif" style={{ fontSize: 22, letterSpacing: "-0.01em" }}>Skyline Gondola + 5 Luge rides</div>
            <div style={{ fontSize: 12, color: "#4d5a55" }}>Family of 4 · Tue 17 Mar, 2:30pm</div>
          </div>
          <span
            className="mono"
            style={{
              background: "#f5ecd6",
              color: "#7a6a40",
              fontSize: 11,
              fontWeight: 600,
              padding: "4px 8px",
              borderRadius: 6,
            }}
          >
            1.5× QCash
          </span>
        </div>

        <div style={{ marginTop: 18, padding: 16, background: "#f7f4ec", borderRadius: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#4d5a55" }}>
            <span>Standard price</span>
            <span className="mono tnum">$240.00</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 8 }}>
            <span>QCash applied (1.5× bonus)</span>
            <span className="mono tnum" style={{ color: "#b89958", fontWeight: 600 }}>− Q$60 ($90 value)</span>
          </div>
          <div style={{ height: 1, background: "#e7e0cf", margin: "12px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>You pay</span>
            <span className="mono tnum serif" style={{ fontSize: 26, fontWeight: 600 }}>$150.00</span>
          </div>
        </div>

        <div style={{ marginTop: 12, padding: 12, background: "#e8f0eb", borderRadius: 12, fontSize: 12, color: "#0a4d3c", lineHeight: 1.5 }}>
          <b>Heads up:</b> Pre-spending Q$60 reserves it from your projected balance. If your final rebate lands below Q$60, the gap stays interest-free.
        </div>

        <button
          className={locked ? "btn btn-gold" : "btn btn-primary"}
          style={{ width: "100%", marginTop: 16 }}
          onClick={() => setLocked(true)}
          disabled={locked}
        >
          {locked ? "Locked in ✓" : "Lock it in"}
        </button>
      </div>
    </div>
  );
}
