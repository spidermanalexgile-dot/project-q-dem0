import { Link } from "react-router-dom";
import { StatusBar } from "../components/StatusBar";
import { BottomNav } from "./Phase3Home";
import { useCountUp } from "../components/useCountUp";
import { useDemoData, type LedgerEntry } from "../data/demoData";
import { meshBackground, glassText } from "../components/glass/glassStyles";
import { VeniceModeChip } from "../components/VeniceModeChip";

export function Phase3Wallet() {
  const { qcash, ledger } = useDemoData();
  return (
    <div className="phone-screen" style={{ ...meshBackground, color: glassText.primary }}>
      <StatusBar dark />
      <VeniceModeChip target="day-tripper" />

      <div
        className="no-scrollbar"
        style={{ height: "calc(100% - 44px)", overflowY: "auto", overflowX: "hidden" }}
      >
        <div style={{ padding: "12px 24px 120px", display: "flex", flexDirection: "column", gap: 0 }}>
          {/* Top — small Pay pill */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div
              className="mono"
              style={{
                fontSize: 10,
                letterSpacing: "0.18em",
                color: glassText.tertiary,
                textTransform: "uppercase",
              }}
            >
              Wallet
            </div>
            <Link
              to="/p3/pay"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                borderRadius: 999,
                border: "1px solid rgba(241,216,150,0.45)",
                background: "rgba(255,255,255,0.06)",
                color: glassText.gold,
                textDecoration: "none",
                fontFamily: "'Inter Tight', sans-serif",
                fontWeight: 600,
                fontSize: 12,
                backdropFilter: "blur(20px) saturate(180%)",
                WebkitBackdropFilter: "blur(20px) saturate(180%)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25), inset 0 0 14px rgba(241,216,150,0.18)",
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  background: glassText.gold,
                  boxShadow: "0 0 10px rgba(241,216,150,0.85)",
                }}
              />
              Pay with QCash
            </Link>
          </div>

          {/* Massive number */}
          <BalanceDisplay value={qcash.balance} />

          {/* Glass divider */}
          <div
            style={{
              height: 1,
              background:
                "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 50%, transparent 100%)",
              margin: "32px 0 28px",
            }}
          />

          {/* Ledger */}
          <div
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: "0.18em",
              color: glassText.tertiary,
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            Recent activity
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            {ledger.map((t: LedgerEntry, i: number) => (
              <LedgerRow entry={t} isFirst={i === 0} key={t.id} />
            ))}
          </div>

          <div
            style={{
              marginTop: 28,
              fontSize: 10,
              color: glassText.tertiary,
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              textAlign: "center",
            }}
          >
            Locked · expires {qcash.expiresAt}
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "12px 16px 28px",
          background: "rgba(3,16,12,0.7)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <BottomNav active="wallet" />
      </div>
    </div>
  );
}

/* ---------- Balance display with count-up ---------- */

function BalanceDisplay({ value }: { value: number }) {
  const animated = useCountUp(value, 1200);
  return (
    <div
      style={{
        textAlign: "center",
        marginTop: 64,
        marginBottom: 8,
        position: "relative",
      }}
    >
      {/* Subtle gold bloom */}
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
        style={{
          fontFamily: "'Inter Tight', sans-serif",
          fontSize: 13,
          letterSpacing: "0.04em",
          color: glassText.tertiary,
          fontWeight: 500,
          position: "relative",
        }}
      >
        QCash
      </div>
      <div
        className="serif tnum"
        style={{
          fontSize: 104,
          fontWeight: 600,
          letterSpacing: "-0.05em",
          color: glassText.primary,
          lineHeight: 1,
          marginTop: 8,
          fontVariantNumeric: "tabular-nums",
          textShadow: "0 0 38px rgba(241,216,150,0.28), 0 1px 0 rgba(255,255,255,0.12)",
          position: "relative",
        }}
      >
        {animated.toFixed(2)}
      </div>
    </div>
  );
}

/* ---------- Ledger row ---------- */

function LedgerRow({ entry, isFirst }: { entry: LedgerEntry; isFirst: boolean }) {
  const sign = entry.amount >= 0 ? "+" : "−";
  const formatted = `${sign}${Math.abs(entry.amount).toFixed(2)}`;
  const color = entry.type === "earn" ? "#7ed4a3" : "rgba(241,216,150,0.55)";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "16px 0",
        borderTop: isFirst ? "none" : "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            color: glassText.primary,
            fontWeight: 500,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {entry.name}
        </div>
        <div
          className="mono"
          style={{
            fontSize: 10,
            color: glassText.tertiary,
            letterSpacing: "0.06em",
            marginTop: 2,
          }}
        >
          {entry.time}
        </div>
      </div>
      <div
        className="mono tnum"
        style={{
          fontSize: 16,
          fontWeight: 600,
          color,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {formatted}
      </div>
    </div>
  );
}
