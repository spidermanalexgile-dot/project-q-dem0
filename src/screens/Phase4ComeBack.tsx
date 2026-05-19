import { StatusBar } from "../components/StatusBar";
import { Icon } from "../components/Icon";
import { useDemoData } from "../data/demoData";
import {
  meshBackground,
  glassSurface,
  glassSurfaceMuted,
  glassText,
} from "../components/glass/glassStyles";

export function Phase4ComeBack() {
  const { destinationName } = useDemoData();
  return (
    <div className="phone-screen" style={{ ...meshBackground, color: glassText.primary }}>
      <StatusBar dark />
      <div
        className="no-scrollbar"
        style={{ padding: "8px 22px 30px", height: "calc(100% - 44px)", overflow: "auto" }}
      >
        <div
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: "0.18em",
            color: glassText.tertiary,
            textTransform: "uppercase",
          }}
        >
          3 weeks since you left · April push
        </div>
        <h1
          className="serif"
          style={{
            fontSize: 26,
            margin: "8px 0 18px",
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
            color: glassText.primary,
            fontWeight: 600,
          }}
        >
          {destinationName} is empty next month.{" "}
          <span style={{ color: glassText.gold }}>We saved you a deal.</span>
        </h1>

        {/* Hero deal card */}
        <div
          style={{
            ...glassSurface,
            borderRadius: 22,
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* Top-edge highlight */}
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
              zIndex: 2,
            }}
          />
          {/* Scenic strip with overlay */}
          <div
            className="img-placeholder scenic"
            style={{
              height: 130,
              filter: "saturate(0.85) brightness(0.85)",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(180deg, rgba(3,16,12,0.1) 0%, rgba(3,16,12,0.55) 100%)",
              }}
            />
          </div>

          <div style={{ padding: 18, position: "relative" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div
                className="serif"
                style={{
                  fontSize: 18,
                  letterSpacing: "-0.01em",
                  color: glassText.primary,
                  fontWeight: 600,
                }}
              >
                Same trip · April 20–25
              </div>
              <span
                className="mono"
                style={{
                  background: "linear-gradient(180deg, #fde7a3, #d4b87a)",
                  color: "#3d2f12",
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: 999,
                  letterSpacing: "0.14em",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55)",
                  flexShrink: 0,
                }}
              >
                52% OFF FEE
              </span>
            </div>

            <div
              style={{
                ...glassSurfaceMuted,
                marginTop: 14,
                padding: 12,
                borderRadius: 12,
                fontSize: 12,
                color: glassText.secondary,
                lineHeight: 1.5,
              }}
            >
              You did 9 of 11 things last trip in{" "}
              <b style={{ color: glassText.gold }}>indoor / off-peak conditions</b> — 90% of your itinerary works in shoulder season.
            </div>

            <div
              style={{
                marginTop: 14,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 12,
              }}
            >
              <div>
                <div
                  className="mono"
                  style={{
                    fontSize: 10,
                    color: glassText.tertiary,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                  }}
                >
                  Sustainability fee
                </div>
                <div
                  className="serif"
                  style={{
                    fontSize: 22,
                    fontWeight: 600,
                    color: glassText.primary,
                    marginTop: 2,
                  }}
                >
                  <s style={{ color: glassText.tertiary }}>$140</s>{" "}
                  <span style={{ color: glassText.gold }}>$67</span>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  className="mono"
                  style={{
                    fontSize: 10,
                    color: glassText.tertiary,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                  }}
                >
                  Projected QCash
                </div>
                <div
                  className="serif"
                  style={{
                    fontSize: 22,
                    fontWeight: 600,
                    color: glassText.gold,
                    marginTop: 2,
                    textShadow: "0 0 16px rgba(241,216,150,0.4)",
                  }}
                >
                  ≈ Q$58
                </div>
              </div>
            </div>

            <button
              style={{
                width: "100%",
                marginTop: 16,
                padding: "13px 18px",
                borderRadius: 999,
                border: "1px solid rgba(241,216,150,0.5)",
                background: "linear-gradient(180deg, #fde7a3, #d4b87a)",
                color: "#3d2f12",
                fontFamily: "'Inter Tight', sans-serif",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
                boxShadow:
                  "0 0 20px rgba(241,216,150,0.4), inset 0 1px 0 rgba(255,255,255,0.6)",
              }}
            >
              Lock April rate
            </button>
          </div>
        </div>

        {/* Project Q traveller card */}
        <div
          style={{
            ...glassSurfaceMuted,
            marginTop: 16,
            padding: 16,
            borderRadius: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icon.Sparkle />
            <div style={{ fontSize: 13, fontWeight: 600, color: glassText.primary }}>
              You're a Project Q traveller now
            </div>
          </div>
          <div
            style={{
              fontSize: 12,
              color: glassText.secondary,
              marginTop: 8,
              lineHeight: 1.5,
            }}
          >
            Heading to Dubrovnik or Venice next? Your QCash credit (Q$2) and traveller profile carry over. We'll project your fee in those cities too.
          </div>
        </div>
      </div>
    </div>
  );
}
