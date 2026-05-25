import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { StatusBar } from "../../components/StatusBar";
import { DayNav } from "./DayNav";
import { meshBackground, glassSurfaceMuted, glassText } from "../../components/glass/glassStyles";
import { VeniceModeChip } from "../../components/VeniceModeChip";
import { useCountUp } from "../../components/useCountUp";
import { useDayTripper } from "../../context/DayTripperContext";
import { dayTripperPersona } from "../../data/dayTripper";

function msUntilEndOfDay(): number {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return Math.max(0, end.getTime() - now.getTime());
}

function formatCountdown(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function DayWallet() {
  const { qcashBalance, qcashStart, spends } = useDayTripper();
  const animated = useCountUp(qcashBalance, 900);
  const [ms, setMs] = useState<number>(msUntilEndOfDay());
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setMs(msUntilEndOfDay()), 1000);
    return () => clearInterval(id);
  }, []);

  const spent = qcashStart - qcashBalance;

  return (
    <div className="phone-screen" style={{ ...meshBackground, color: glassText.primary }}>
      <StatusBar dark />
      <VeniceModeChip target="multi-day" />
      <div
        className="no-scrollbar"
        style={{ height: "calc(100% - 44px)", overflowY: "auto", overflowX: "hidden", paddingBottom: 110 }}
      >
        <div style={{ padding: "12px 24px 0" }}>
          <div
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
          >
            <div
              className="mono"
              style={{ fontSize: 10, letterSpacing: "0.2em", color: glassText.tertiary, textTransform: "uppercase" }}
            >
              Wallet
            </div>
            <div
              className="mono"
              style={{
                fontSize: 10,
                letterSpacing: "0.16em",
                color: glassText.gold,
                textTransform: "uppercase",
              }}
            >
              {dayTripperPersona.names}
            </div>
          </div>

          {/* Big balance */}
          <div style={{ textAlign: "center", marginTop: 36, position: "relative" }}>
            <div
              style={{
                position: "absolute",
                top: -30,
                left: "50%",
                transform: "translateX(-50%)",
                width: 280,
                height: 220,
                background: "radial-gradient(ellipse, rgba(241,216,150,0.22), transparent 70%)",
                filter: "blur(20px)",
                pointerEvents: "none",
              }}
            />
            <div
              style={{ fontSize: 13, color: glassText.tertiary, fontWeight: 500, position: "relative" }}
            >
              QCash
            </div>
            <div
              className="serif tnum"
              style={{
                fontSize: 84,
                fontWeight: 600,
                letterSpacing: "-0.05em",
                color: glassText.primary,
                lineHeight: 1,
                marginTop: 6,
                fontVariantNumeric: "tabular-nums",
                textShadow: "0 0 38px rgba(241,216,150,0.3), 0 1px 0 rgba(255,255,255,0.12)",
                position: "relative",
              }}
            >
              {animated.toFixed(2)}
            </div>
            {spent > 0 && (
              <div
                className="mono"
                style={{
                  marginTop: 10,
                  fontSize: 11,
                  color: glassText.secondary,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                — {spent.toFixed(2)} spent today
              </div>
            )}
          </div>

          {/* Expiry strip */}
          <div
            style={{
              ...glassSurfaceMuted,
              marginTop: 24,
              padding: "14px 16px",
              borderRadius: 16,
              border: "1px solid rgba(241,216,150,0.3)",
              background: "rgba(241,216,150,0.08)",
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
              Expires 11:59pm tonight
            </div>
            <div
              className="tnum"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 22,
                fontWeight: 600,
                color: glassText.primary,
                marginTop: 4,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatCountdown(ms)}
            </div>
            <div style={{ fontSize: 12, color: glassText.secondary, marginTop: 6, lineHeight: 1.4 }}>
              Spend it before your boat/train leaves at {dayTripperPersona.departBy}.
            </div>
          </div>

          {/* Primary CTA */}
          <Link
            to="/day/explore"
            style={{
              display: "block",
              marginTop: 18,
              padding: "14px 22px",
              borderRadius: 999,
              background: "linear-gradient(180deg, #fde7a3, #d4b87a)",
              color: "#3d2f12",
              textDecoration: "none",
              fontWeight: 700,
              fontSize: 15,
              textAlign: "center",
              boxShadow: "0 0 20px rgba(241,216,150,0.4), inset 0 1px 0 rgba(255,255,255,0.55)",
              fontFamily: "'Inter Tight', sans-serif",
            }}
          >
            Find places near me →
          </Link>

          {/* How QCash works */}
          <button
            onClick={() => setExpanded((s) => !s)}
            style={{
              marginTop: 16,
              width: "100%",
              ...glassSurfaceMuted,
              borderRadius: 14,
              padding: "12px 16px",
              color: glassText.primary,
              textAlign: "left",
              cursor: "pointer",
              fontFamily: "'Inter Tight', sans-serif",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600 }}>How QCash works</span>
            <span style={{ color: glassText.tertiary, fontSize: 14 }}>{expanded ? "−" : "+"}</span>
          </button>
          {expanded && (
            <div
              style={{
                marginTop: 10,
                padding: "12px 16px",
                fontSize: 13,
                color: glassText.secondary,
                lineHeight: 1.5,
                background: "rgba(255,255,255,0.03)",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              QCash is your €{dayTripperPersona.feePaidEUR} sustainability fee, returned as
              spendable credit at 200+ Venice businesses today. Show the QR to pay — the merchant
              gets settled instantly. Unspent QCash expires at midnight.
            </div>
          )}

          {/* Tiny recent spend list when there's been activity */}
          {spends.length > 0 && (
            <div style={{ marginTop: 22 }}>
              <div
                className="mono"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.18em",
                  color: glassText.tertiary,
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                Today
              </div>
              {spends.slice().reverse().map((s) => (
                <div
                  key={s.id}
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
                    −{s.amount.toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <DayNav />
    </div>
  );
}
