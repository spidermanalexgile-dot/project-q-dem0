import { useState } from "react";
import { QCash } from "../components/QCash";
import { useDemoData } from "../data/demoData";
import { useDestination } from "../context/DestinationContext";
import { VeniceDayTouristChart } from "../components/VeniceDayTouristChart";

export function Phase1ExternalSite() {
  const { trip, bookingLineItem } = useDemoData();
  const { destination } = useDestination();
  const isVenice = destination === "venice";
  const [equityOpen, setEquityOpen] = useState(false);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#fff",
        fontFamily: "'Inter Tight', sans-serif",
        color: "#14241f",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Browser chrome */}
      <div
        style={{
          height: 36,
          background: "#ebe6da",
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
          gap: 8,
          borderBottom: "1px solid #d8d2c2",
        }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          <span style={{ width: 11, height: 11, borderRadius: 999, background: "#e06c5a" }} />
          <span style={{ width: 11, height: 11, borderRadius: 999, background: "#e3b04a" }} />
          <span style={{ width: 11, height: 11, borderRadius: 999, background: "#7ab87a" }} />
        </div>
        <div
          className="mono"
          style={{
            flex: 1,
            height: 22,
            background: "#fdfbf5",
            borderRadius: 6,
            marginLeft: 12,
            display: "flex",
            alignItems: "center",
            padding: "0 10px",
            fontSize: 11,
            color: "#8a948f",
          }}
        >
          booking-platform.com / {trip.destination.toLowerCase()} / checkout
        </div>
      </div>

      <div style={{ flex: 1, padding: "26px 32px", overflow: "auto" }}>
        <div className="mono" style={{ fontSize: 11, color: "#8a948f", letterSpacing: "0.12em", textTransform: "uppercase" }}>
          Step 3 of 3 · Confirm & pay
        </div>
        <h1 className="serif" style={{ fontSize: 30, margin: "10px 0 4px", letterSpacing: "-0.02em" }}>
          {trip.hotel}
        </h1>
        <div style={{ color: "#4d5a55", fontSize: 14 }}>{bookingLineItem.breadcrumb}</div>
        <div style={{ color: "#4d5a55", fontSize: 14, marginTop: 2 }}>
          {trip.dates.in} — {trip.dates.out} · {trip.guest.partySize} guest{trip.guest.partySize === 1 ? "" : "s"}
        </div>

        <div style={{ marginTop: 22, border: "1px solid #e7e0cf", borderRadius: 14, overflow: "hidden" }}>
          {[
            { label: bookingLineItem.suiteLine, amt: bookingLineItem.suiteAmount, muted: false },
            { label: "Cleaning fee", amt: bookingLineItem.cleaningAmount, muted: true },
            { label: "Service fee", amt: bookingLineItem.serviceAmount, muted: true },
            { label: bookingLineItem.taxLabel, amt: bookingLineItem.taxAmount, muted: true },
          ].map((row) => (
            <div
              key={row.label}
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid #efe9d9",
                display: "flex",
                justifyContent: "space-between",
                fontSize: 14,
                color: row.muted ? "#4d5a55" : "#14241f",
              }}
            >
              <span>{row.label}</span>
              <span className="mono tnum">{row.amt}</span>
            </div>
          ))}

          {/* THE LINE ITEM */}
          <div style={{ background: "#f5ecd6", padding: "16px 18px", borderTop: "2px solid #d4b87a" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  className="serif"
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    background: "linear-gradient(135deg,#f1d896,#b89958)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    color: "#4a3a18",
                    fontWeight: 700,
                  }}
                >
                  Q
                </span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Sustainability Fee · Project Q</div>
                  <div style={{ fontSize: 12, color: "#7a6a40", marginTop: 2 }}>
                    {bookingLineItem.sustainabilityLine}
                  </div>
                </div>
              </div>
              <span className="mono tnum" style={{ fontSize: 14, fontWeight: 600 }}>${trip.feePaid}.00</span>
            </div>
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, color: "#7a6a40" }}>Estimated QCash bonus you'll receive:</span>
              <QCash amount="≈ 95" size="sm" />
              <a
                style={{
                  marginLeft: "auto",
                  fontSize: 12,
                  color: "#0a4d3c",
                  fontWeight: 600,
                  textDecoration: "underline",
                  cursor: "pointer",
                }}
              >
                Learn more ›
              </a>
            </div>
          </div>

          <div style={{ padding: "16px 18px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 16, fontWeight: 600 }}>Total</span>
            <span className="mono tnum serif" style={{ fontSize: 22, fontWeight: 700 }}>{bookingLineItem.totalAmount}</span>
          </div>
        </div>

        <button
          style={{
            marginTop: 18,
            width: "100%",
            padding: "14px",
            background: "#0a4d3c",
            color: "#fdfbf5",
            border: 0,
            borderRadius: 999,
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Confirm and pay
        </button>

        {isVenice && (
          <div style={{ marginTop: 22 }}>
            <button
              onClick={() => setEquityOpen((v) => !v)}
              aria-expanded={equityOpen}
              aria-controls="equity-inline-panel"
              style={{
                width: "100%",
                padding: "14px 18px",
                background: "#fdfbf5",
                border: "1px solid #d4b87a",
                borderRadius: 12,
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontFamily: "inherit",
              }}
            >
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                <span
                  className="mono"
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.14em",
                    color: "#8a7340",
                    textTransform: "uppercase",
                  }}
                >
                  Equity view · Venice
                </span>
                <span style={{ fontSize: 14, color: "#14241f", fontWeight: 600, marginTop: 3 }}>
                  Where this fee fits — and who pays what
                </span>
              </span>
              <span
                aria-hidden
                style={{
                  fontSize: 20,
                  color: "#8a7340",
                  transition: "transform 240ms ease",
                  transform: equityOpen ? "rotate(180deg)" : "rotate(0deg)",
                }}
              >
                ⌄
              </span>
            </button>
            <div
              id="equity-inline-panel"
              style={{
                overflow: "hidden",
                maxHeight: equityOpen ? 1400 : 0,
                opacity: equityOpen ? 1 : 0,
                transition: "max-height 360ms ease, opacity 240ms ease, margin-top 240ms ease",
                marginTop: equityOpen ? 12 : 0,
              }}
            >
              <div
                style={{
                  background: "#0c1a17",
                  borderRadius: 14,
                  padding: 20,
                  border: "1px solid #1b2a26",
                }}
              >
                <VeniceDayTouristChart size={320} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
