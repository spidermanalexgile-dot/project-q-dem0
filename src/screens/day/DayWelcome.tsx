import { Link } from "react-router-dom";
import { StatusBar } from "../../components/StatusBar";
import { meshBackground, glassSurface, glassText } from "../../components/glass/glassStyles";
import { VeniceModeChip } from "../../components/VeniceModeChip";
import { dayTripperPersona } from "../../data/dayTripper";

export function DayWelcome() {
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
          Venice · Day Tripper
        </div>

        <div style={{ marginTop: 32 }}>
          <h1
            className="serif"
            style={{
              fontSize: 44,
              letterSpacing: "-0.03em",
              lineHeight: 1.02,
              fontWeight: 600,
              margin: 0,
              color: glassText.primary,
            }}
          >
            Here for
            <br />
            the day?
          </h1>
          <p
            style={{
              marginTop: 18,
              fontSize: 16,
              color: glassText.secondary,
              lineHeight: 1.5,
            }}
          >
            You paid <b style={{ color: glassText.gold }}>€{dayTripperPersona.feePaidEUR}</b> to
            visit Venice. Here&apos;s all <b style={{ color: glassText.gold }}>€{dayTripperPersona.feePaidEUR}</b> back
            — as QCash to spend today at 200+ local spots.
          </p>
        </div>

        {/* Coin glyph */}
        <div
          style={{
            ...glassSurface,
            margin: "28px auto 0",
            width: 200,
            height: 200,
            borderRadius: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: -10,
              background: "radial-gradient(circle, rgba(241,216,150,0.4), transparent 70%)",
              filter: "blur(14px)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "relative",
              width: 150,
              height: 150,
              borderRadius: 999,
              background: "radial-gradient(circle at 35% 30%, #fde7a3 0%, #d4b87a 60%, #8a6a2a 100%)",
              border: "2px solid rgba(255,255,255,0.55)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow:
                "inset 0 2px 0 rgba(255,255,255,0.55), 0 0 38px rgba(241,216,150,0.55), 0 6px 16px rgba(0,0,0,0.45)",
            }}
          >
            <div
              className="serif tnum"
              style={{
                fontSize: 38,
                fontWeight: 700,
                color: "#3d2f12",
                lineHeight: 1,
                letterSpacing: "-0.02em",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              Q{dayTripperPersona.qcashGranted.toFixed(2)}
            </div>
          </div>
        </div>

        <div
          className="mono"
          style={{
            textAlign: "center",
            marginTop: 16,
            fontSize: 11,
            letterSpacing: "0.16em",
            color: glassText.tertiary,
            textTransform: "uppercase",
          }}
        >
          No sign-up · tied to your arrival QR
        </div>

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
          <Link
            to="/day/start"
            style={{
              padding: "16px 22px",
              borderRadius: 999,
              background: "linear-gradient(180deg, #fde7a3, #d4b87a)",
              color: "#3d2f12",
              textDecoration: "none",
              fontWeight: 700,
              fontSize: 16,
              textAlign: "center",
              boxShadow: "0 0 22px rgba(241,216,150,0.45), inset 0 1px 0 rgba(255,255,255,0.55)",
              fontFamily: "'Inter Tight', sans-serif",
            }}
          >
            See my QCash →
          </Link>
          <Link
            to="/"
            style={{
              padding: "12px 22px",
              borderRadius: 999,
              background: "transparent",
              color: glassText.secondary,
              textDecoration: "none",
              fontWeight: 500,
              fontSize: 13,
              textAlign: "center",
              border: "1px solid rgba(255,255,255,0.12)",
              fontFamily: "'Inter Tight', sans-serif",
            }}
          >
            Maybe later
          </Link>
        </div>
      </div>
    </div>
  );
}
