import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { StatusBar } from "../components/StatusBar";
import { useDemoData } from "../data/demoData";
import {
  meshBackground,
  glassSurface,
  glassSurfaceMuted,
  glassText,
} from "../components/glass/glassStyles";

export function Phase4TripSummary() {
  const navigate = useNavigate();
  const { tripSummary, destinationName, donationCauses } = useDemoData();
  const [photoBookOrdered, setPhotoBookOrdered] = useState(false);
  const [donated, setDonated] = useState(false);

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
          Trip complete · {tripSummary.date}
        </div>
        <h1
          className="serif"
          style={{
            fontSize: 30,
            margin: "8px 0 4px",
            letterSpacing: "-0.03em",
            color: glassText.primary,
            fontWeight: 600,
          }}
        >
          Your {destinationName}, in numbers.
        </h1>
        <div style={{ fontSize: 13, color: glassText.secondary }}>
          {tripSummary.nights} nights · {tripSummary.vendors} vendors · {tripSummary.km}km walked
        </div>

        {/* Hero — value unlocked + 3-stat grid as one glass slab */}
        <div
          style={{
            ...glassSurface,
            marginTop: 18,
            borderRadius: 22,
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* Top-edge light catch */}
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
          {/* Gold bloom */}
          <div
            style={{
              position: "absolute",
              top: -50,
              right: -40,
              width: 240,
              height: 200,
              background:
                "radial-gradient(ellipse, rgba(241,216,150,0.28), transparent 70%)",
              filter: "blur(14px)",
              pointerEvents: "none",
            }}
          />

          <div style={{ padding: "20px 22px 22px", position: "relative" }}>
            <div
              className="mono"
              style={{
                fontSize: 10,
                letterSpacing: "0.16em",
                color: glassText.gold,
                textTransform: "uppercase",
              }}
            >
              Value unlocked
            </div>
            <div
              className="serif"
              style={{
                fontSize: 28,
                marginTop: 8,
                letterSpacing: "-0.02em",
                lineHeight: 1.15,
                color: glassText.primary,
                fontWeight: 600,
              }}
            >
              ${tripSummary.paid} paid →{" "}
              <span
                style={{
                  color: glassText.gold,
                  textShadow: "0 0 20px rgba(241,216,150,0.4)",
                }}
              >
                ${tripSummary.unlocked}
              </span>{" "}
              in experiences
            </div>
          </div>

          {/* 3-stat row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              borderTop: "1px solid rgba(255,255,255,0.08)",
              position: "relative",
            }}
          >
            {[
              { k: `Q$${tripSummary.rebated}`, v: "rebated" },
              { k: `Q$${tripSummary.spent}`, v: "spent" },
              { k: `Q$${tripSummary.remaining}`, v: "remaining" },
            ].map((s, i) => (
              <div
                key={s.v}
                style={{
                  padding: "14px 8px",
                  textAlign: "center",
                  borderRight: i < 2 ? "1px solid rgba(255,255,255,0.06)" : "none",
                }}
              >
                <div
                  className="serif"
                  style={{
                    fontSize: 22,
                    fontWeight: 600,
                    color: glassText.gold,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {s.k}
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 10,
                    color: glassText.tertiary,
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    marginTop: 3,
                  }}
                >
                  {s.v}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Memory film CTA — buttons are independent, NOT wrapped in a single link */}
        <div
          style={{
            ...glassSurface,
            marginTop: 16,
            padding: 18,
            borderRadius: 18,
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
          <div
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: "0.16em",
              color: glassText.gold,
              textTransform: "uppercase",
            }}
          >
            Use Q$17 before they expire
          </div>
          <div
            className="serif"
            style={{
              fontSize: 22,
              marginTop: 8,
              letterSpacing: "-0.02em",
              lineHeight: 1.2,
              color: glassText.primary,
              fontWeight: 600,
            }}
          >
            Turn your 47 photos into a {destinationName} memory film.
          </div>
          <div
            style={{
              fontSize: 12,
              color: glassText.secondary,
              marginTop: 8,
              lineHeight: 1.5,
            }}
          >
            AI builds a 90-second cut from your trip — places, weather, soundtrack. Costs Q$15 (you'll have Q$2 left to donate).
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button
              onClick={() => navigate("/p4/memory")}
              style={{
                padding: "10px 16px",
                borderRadius: 999,
                border: "1px solid rgba(241,216,150,0.5)",
                background: "linear-gradient(180deg, #fde7a3, #d4b87a)",
                color: "#3d2f12",
                fontFamily: "'Inter Tight', sans-serif",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                boxShadow:
                  "0 0 16px rgba(241,216,150,0.4), inset 0 1px 0 rgba(255,255,255,0.6)",
              }}
            >
              Make my film · Q$15
            </button>
            <button
              onClick={() => setPhotoBookOrdered((v) => !v)}
              style={{
                padding: "10px 16px",
                borderRadius: 999,
                border: photoBookOrdered
                  ? "1px solid rgba(125,212,163,0.55)"
                  : "1px solid rgba(255,255,255,0.18)",
                background: photoBookOrdered
                  ? "rgba(125,212,163,0.12)"
                  : "rgba(255,255,255,0.06)",
                color: photoBookOrdered ? "#7ed4a3" : glassText.primary,
                fontFamily: "'Inter Tight', sans-serif",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                transition: "all 240ms ease",
              }}
            >
              {photoBookOrdered ? "Photo book ordered ✓" : "Photo book · Q$12"}
            </button>
          </div>
        </div>

        {/* Donate the remainder */}
        <button
          onClick={() => setDonated((v) => !v)}
          style={{
            ...glassSurfaceMuted,
            marginTop: 14,
            padding: 16,
            borderRadius: 16,
            display: "block",
            width: "100%",
            textAlign: "left",
            color: "inherit",
            fontFamily: "inherit",
            cursor: "pointer",
            border: donated
              ? "1px solid rgba(125,212,163,0.55)"
              : "1px solid rgba(255,255,255,0.1)",
            transition: "all 240ms ease",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: 14,
                  color: donated ? "#7ed4a3" : glassText.primary,
                }}
              >
                {donated ? "Donated · thank you ✓" : "Donate the remainder"}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: glassText.tertiary,
                  marginTop: 3,
                  lineHeight: 1.4,
                }}
              >
                {donationCauses}
              </div>
            </div>
            <span
              className="mono tnum"
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: donated ? "#7ed4a3" : glassText.gold,
                flexShrink: 0,
              }}
            >
              Q$2
            </span>
          </div>
        </button>

        {/* Come back link */}
        <Link
          to="/p4/comeback"
          style={{
            ...glassSurfaceMuted,
            display: "block",
            marginTop: 14,
            padding: 16,
            borderRadius: 16,
            textDecoration: "none",
            color: glassText.gold,
            fontSize: 13,
            fontWeight: 600,
            textAlign: "center",
            border: "1px solid rgba(241,216,150,0.35)",
          }}
        >
          See your "come back" offer →
        </Link>
      </div>
    </div>
  );
}
