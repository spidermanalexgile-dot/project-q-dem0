import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { StatusBar } from "../../components/StatusBar";
import { DayNav } from "./DayNav";
import { meshBackground, glassSurface, glassSurfaceMuted, glassText } from "../../components/glass/glassStyles";
import { VeniceModeChip } from "../../components/VeniceModeChip";
import { dayTripperSpots, type DayTripperSpot } from "../../data/dayTripper";
import { useDayTripper } from "../../context/DayTripperContext";

function tokenFor(vendor: string, amount: number) {
  const r = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `qcash:${vendor.toLowerCase().replace(/\s+/g, "-")}:${amount.toFixed(0)}:${r}`;
}

/** Parse the displayed price-range string and pick a representative integer
 *  amount in QCash (lower end + 1 for a realistic "one item" feel). */
function pickAmount(spot: DayTripperSpot): number {
  const m = spot.qcashPriceRange.match(/(\d+)/);
  if (!m) return 8;
  const low = parseInt(m[1], 10);
  return Math.max(1, low + 1);
}

const TTL = 30;

export function DayPay() {
  const navigate = useNavigate();
  const { qcashBalance, selectedSpotId, recordSpend, spends } = useDayTripper();

  const spot: DayTripperSpot | undefined = useMemo(() => {
    if (selectedSpotId) return dayTripperSpots.find((s) => s.id === selectedSpotId);
    return dayTripperSpots.find((s) => s.id === "caffe-florian");
  }, [selectedSpotId]);

  const vendorName = spot?.name ?? "Caffè Florian";
  const baseAmount = spot ? pickAmount(spot) : 9;
  const amount = Math.min(baseAmount, Math.max(1, qcashBalance));

  const [token, setToken] = useState(() => tokenFor(vendorName, amount));
  const [ttl, setTtl] = useState(TTL);
  const [status, setStatus] = useState<"idle" | "confirming" | "done">("idle");

  useEffect(() => {
    setToken(tokenFor(vendorName, amount));
    setTtl(TTL);
    setStatus("idle");
  }, [vendorName, amount]);

  useEffect(() => {
    if (status !== "idle") return;
    const id = setInterval(() => {
      setTtl((t) => {
        if (t <= 1) {
          setToken(tokenFor(vendorName, amount));
          return TTL;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [status, vendorName, amount]);

  function confirm() {
    if (qcashBalance < amount) return;
    setStatus("confirming");
    setTimeout(() => {
      recordSpend({ spotId: spot?.id ?? null, vendor: vendorName, amount });
      setStatus("done");
    }, 800);
  }

  const after = Math.max(0, qcashBalance - amount);

  return (
    <div className="phone-screen" style={{ ...meshBackground, color: glassText.primary }}>
      <StatusBar dark />
      <VeniceModeChip target="multi-day" />
      <div
        className="no-scrollbar"
        style={{ height: "calc(100% - 44px)", overflowY: "auto", paddingBottom: 110 }}
      >
        <div style={{ padding: "16px 22px 12px", display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              width: 30,
              height: 30,
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.06)",
              color: glassText.primary,
              cursor: "pointer",
              fontFamily: "'Inter Tight', sans-serif",
              fontSize: 14,
            }}
          >
            ←
          </button>
          <div
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: "0.2em",
              color: glassText.gold,
              textTransform: "uppercase",
            }}
          >
            Pay with QCash
          </div>
        </div>

        <div style={{ textAlign: "center", padding: "0 22px" }}>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: glassText.tertiary,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            {vendorName}
          </div>

          <div style={{ position: "relative", marginTop: 14, display: "inline-block" }}>
            <div
              style={{
                position: "absolute",
                inset: -30,
                background: "radial-gradient(circle, rgba(241,216,150,0.25) 0%, transparent 65%)",
                filter: "blur(16px)",
                pointerEvents: "none",
              }}
            />
            <div
              className="serif tnum"
              style={{
                position: "relative",
                fontSize: 72,
                fontWeight: 600,
                letterSpacing: "-0.04em",
                color: glassText.gold,
                lineHeight: 1,
                textShadow: "0 0 28px rgba(241,216,150,0.45), 0 1px 0 rgba(255,255,255,0.15)",
              }}
            >
              {amount} QCash
            </div>
          </div>
          <div style={{ fontSize: 12, color: glassText.secondary, marginTop: 8 }}>
            Show this to pay · single-use
          </div>
        </div>

        <div
          style={{
            ...glassSurface,
            margin: "20px auto 0",
            width: 220,
            height: 220,
            padding: 16,
            borderRadius: 22,
            position: "relative",
            transition: "opacity 200ms",
            opacity: status === "confirming" ? 0.4 : 1,
          }}
        >
          {status === "done" ? (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: 999,
                  background: "radial-gradient(circle at 35% 30%, #fde7a3 0%, #d4b87a 60%, #8a6a2a 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 0 36px rgba(241,216,150,0.7), inset 0 2px 0 rgba(255,255,255,0.5)",
                }}
              >
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
                  <path d="M4 12 l5 5 L20 6" stroke="#fdfbf5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                background: "rgba(253,251,245,0.95)",
                borderRadius: 12,
                padding: 8,
                position: "relative",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)",
              }}
            >
              <QRCodeSVG
                value={token}
                size={172}
                bgColor="transparent"
                fgColor="#0a1f1a"
                level="M"
                style={{ display: "block", margin: "0 auto" }}
              />
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%,-50%)",
                  width: 38,
                  height: 38,
                  borderRadius: 999,
                  background: "radial-gradient(circle at 35% 30%, #fde7a3 0%, #d4b87a 60%, #8a6a2a 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "'Fraunces', serif",
                  fontWeight: 700,
                  color: "#3d2f12",
                  boxShadow: "0 0 0 5px rgba(253,251,245,0.95), 0 0 14px rgba(241,216,150,0.45)",
                }}
              >
                Q
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: "12px 22px 0", textAlign: "center" }}>
          <div style={{ fontSize: 12, color: glassText.tertiary }}>
            {status === "done"
              ? "Paid · settled instantly"
              : `Single-use · expires in ${ttl}s`}
          </div>
        </div>

        <div style={{ padding: "16px 22px 0" }}>
          <div
            style={{
              ...glassSurfaceMuted,
              padding: "14px 16px",
              borderRadius: 16,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                className="mono"
                style={{ fontSize: 10, color: glassText.tertiary, letterSpacing: "0.12em", textTransform: "uppercase" }}
              >
                After this
              </div>
              <div className="serif" style={{ fontSize: 22, color: glassText.gold }}>
                Q{after} left
              </div>
            </div>
            {status === "done" ? (
              <div style={{ display: "flex", gap: 8 }}>
                <Link
                  to="/day/explore"
                  style={{
                    padding: "10px 14px",
                    borderRadius: 999,
                    border: "1px solid rgba(255,255,255,0.18)",
                    background: "rgba(255,255,255,0.06)",
                    color: glassText.primary,
                    fontFamily: "'Inter Tight', sans-serif",
                    fontWeight: 600,
                    fontSize: 12,
                    textDecoration: "none",
                  }}
                >
                  Back to explore
                </Link>
                <Link
                  to="/day/recap"
                  style={{
                    padding: "10px 14px",
                    borderRadius: 999,
                    border: "1px solid rgba(241,216,150,0.5)",
                    background: "linear-gradient(180deg, #fde7a3, #d4b87a)",
                    color: "#3d2f12",
                    fontFamily: "'Inter Tight', sans-serif",
                    fontWeight: 700,
                    fontSize: 12,
                    textDecoration: "none",
                  }}
                >
                  Day so far →
                </Link>
              </div>
            ) : (
              <button
                onClick={confirm}
                disabled={status !== "idle" || qcashBalance < amount}
                style={{
                  padding: "12px 18px",
                  fontFamily: "'Inter Tight', sans-serif",
                  fontWeight: 700,
                  fontSize: 13,
                  borderRadius: 999,
                  border: "1px solid rgba(241,216,150,0.5)",
                  background:
                    qcashBalance < amount
                      ? "rgba(255,255,255,0.1)"
                      : "linear-gradient(180deg, #fde7a3, #d4b87a)",
                  color: qcashBalance < amount ? glassText.tertiary : "#3d2f12",
                  cursor: status === "idle" && qcashBalance >= amount ? "pointer" : "default",
                  boxShadow:
                    qcashBalance < amount
                      ? "none"
                      : "0 0 18px rgba(241,216,150,0.4), inset 0 1px 0 rgba(255,255,255,0.55)",
                }}
              >
                {status === "confirming" ? "…" : qcashBalance < amount ? "No QCash" : "Confirm pay"}
              </button>
            )}
          </div>
          {spends.length > 0 && status !== "done" && (
            <div
              style={{
                marginTop: 14,
                fontSize: 11,
                color: glassText.tertiary,
                textAlign: "center",
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              {spends.length} payment{spends.length === 1 ? "" : "s"} today
            </div>
          )}
        </div>
      </div>
      <DayNav />
    </div>
  );
}
