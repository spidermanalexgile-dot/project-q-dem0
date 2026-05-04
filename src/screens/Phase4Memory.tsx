import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatusBar } from "../components/StatusBar";
import { Icon } from "../components/Icon";
import {
  meshBackground,
  glassSurface,
  glassSurfaceMuted,
  glassText,
} from "../components/glass/glassStyles";

const SEGMENTS = 9;

export function Phase4Memory() {
  const navigate = useNavigate();
  const [segment, setSegment] = useState(2);
  const [progress, setProgress] = useState(0);
  const [shared, setShared] = useState(false);
  const [saved, setSaved] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          setSegment((s) => (s + 1) % SEGMENTS);
          return 0;
        }
        return p + 4;
      });
    }, 200);
    return () => clearInterval(id);
  }, [paused]);

  function handleShare() {
    setShared(true);
    setTimeout(() => setShared(false), 2400);
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2400);
  }

  return (
    <div className="phone-screen" style={{ ...meshBackground, color: glassText.primary }}>
      <StatusBar dark />
      <div
        style={{
          height: "calc(100% - 44px)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Hero — scenic with overlay gradient + caption */}
        <div
          className="img-placeholder scenic"
          style={{
            height: 320,
            position: "relative",
            // Tint the scenic placeholder to feel cohesive with the dark mesh
            filter: "saturate(0.85) brightness(0.85)",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(3,16,12,0.15) 0%, rgba(3,16,12,0.55) 60%, rgba(3,16,12,0.95) 100%)",
            }}
          />
          {/* Soft gold light wash from upper right */}
          <div
            style={{
              position: "absolute",
              top: -40,
              right: -40,
              width: 240,
              height: 200,
              background:
                "radial-gradient(ellipse, rgba(241,216,150,0.18), transparent 70%)",
              filter: "blur(14px)",
              pointerEvents: "none",
            }}
          />

          <div
            style={{
              position: "absolute",
              top: 16,
              left: 16,
              right: 16,
              display: "flex",
              alignItems: "center",
              gap: 10,
              zIndex: 5,
            }}
          >
            {/* Back chevron — always available, glass circle */}
            <button
              onClick={() => navigate(-1)}
              aria-label="Back"
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.22)",
                background: "rgba(3,16,12,0.6)",
                color: glassText.primary,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                backdropFilter: "blur(20px) saturate(180%)",
                WebkitBackdropFilter: "blur(20px) saturate(180%)",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.28), 0 6px 16px rgba(0,0,0,0.45)",
                flexShrink: 0,
              }}
            >
              <Icon.Back color={glassText.primary} size={16} />
            </button>

            {/* Pause / Play toggle */}
            <button
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? "Play" : "Pause"}
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.22)",
                background: "rgba(3,16,12,0.6)",
                color: glassText.primary,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                backdropFilter: "blur(20px) saturate(180%)",
                WebkitBackdropFilter: "blur(20px) saturate(180%)",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.28), 0 6px 16px rgba(0,0,0,0.45)",
                flexShrink: 0,
              }}
            >
              {paused ? (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 2 L11 7 L3 12 Z" fill={glassText.primary} />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="3" y="2" width="3" height="10" fill={glassText.primary} />
                  <rect x="8" y="2" width="3" height="10" fill={glassText.primary} />
                </svg>
              )}
            </button>

            <span
              className="mono"
              style={{
                ...glassSurfaceMuted,
                padding: "6px 12px",
                borderRadius: 999,
                fontSize: 10,
                color: glassText.gold,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              0{segment + 1} / 09 · Lake Wakatipu
            </span>
            <span
              className="mono tnum"
              style={{
                ...glassSurfaceMuted,
                padding: "6px 12px",
                borderRadius: 999,
                fontSize: 10,
                color: glassText.primary,
                letterSpacing: "0.06em",
                marginLeft: "auto",
              }}
            >
              0:42 / 1:30
            </span>
          </div>

          <div style={{ position: "absolute", bottom: 24, left: 20, right: 20 }}>
            <div
              className="mono"
              style={{
                fontSize: 10,
                color: glassText.gold,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                fontWeight: 600,
              }}
            >
              17 Mar · 8°C · Mist
            </div>
            <div
              className="serif"
              style={{
                fontSize: 28,
                marginTop: 6,
                letterSpacing: "-0.02em",
                lineHeight: 1.15,
                color: glassText.primary,
                fontWeight: 600,
                textShadow: "0 1px 0 rgba(0,0,0,0.4)",
              }}
            >
              "The lake was completely glass that morning."
            </div>
          </div>
        </div>

        {/* Below — controls on dark mesh */}
        <div style={{ padding: "20px 22px", flex: 1, display: "flex", flexDirection: "column" }}>
          {/* Progress segments */}
          <div style={{ display: "flex", gap: 6, marginBottom: 22 }}>
            {Array.from({ length: SEGMENTS }).map((_, i) => {
              const done = i < segment;
              const current = i === segment;
              const pct = current ? progress : done ? 100 : 0;
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: 3,
                    borderRadius: 2,
                    background: "rgba(255,255,255,0.1)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: "100%",
                      background: "linear-gradient(90deg, #d4b87a, #f1d896)",
                      boxShadow: current ? "0 0 8px rgba(241,216,150,0.5)" : "none",
                      transition: "width 200ms linear",
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* AI built-by-Q chip */}
          <div
            style={{
              ...glassSurface,
              padding: "14px 16px",
              borderRadius: 16,
              display: "flex",
              alignItems: "center",
              gap: 12,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: "10%",
                right: "10%",
                height: 1,
                background:
                  "linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)",
                pointerEvents: "none",
              }}
            />
            <Icon.Sparkle />
            <div style={{ fontSize: 12, color: glassText.secondary, lineHeight: 1.5 }}>
              Built by Q from your photos, weather data, and the route you walked.{" "}
              <span style={{ color: glassText.gold, fontWeight: 600 }}>Q$15 used.</span>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button
              onClick={handleShare}
              style={{
                flex: 1,
                padding: "13px 16px",
                borderRadius: 999,
                border: "1px solid rgba(241,216,150,0.5)",
                background: shared
                  ? "rgba(241,216,150,0.18)"
                  : "linear-gradient(180deg, #fde7a3, #d4b87a)",
                color: shared ? glassText.gold : "#3d2f12",
                fontFamily: "'Inter Tight', sans-serif",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
                boxShadow: shared
                  ? "inset 0 1px 0 rgba(255,255,255,0.2)"
                  : "0 0 18px rgba(241,216,150,0.4), inset 0 1px 0 rgba(255,255,255,0.6)",
                transition: "all 240ms ease",
              }}
            >
              {shared ? "Link copied ✓" : "Share trip film"}
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: "13px 18px",
                borderRadius: 999,
                border: saved
                  ? "1px solid rgba(125,212,163,0.55)"
                  : "1px solid rgba(255,255,255,0.18)",
                background: saved ? "rgba(125,212,163,0.12)" : "rgba(255,255,255,0.06)",
                color: saved ? "#7ed4a3" : glassText.primary,
                fontFamily: "'Inter Tight', sans-serif",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                transition: "all 240ms ease",
              }}
            >
              {saved ? "Saved ✓" : "Save"}
            </button>
          </div>

          {/* Forward link to next phase 4 step */}
          <button
            onClick={() => navigate("/p4/comeback")}
            style={{
              marginTop: 14,
              padding: "10px",
              background: "transparent",
              border: 0,
              color: glassText.tertiary,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            Continue ›
          </button>
        </div>
      </div>
    </div>
  );
}
