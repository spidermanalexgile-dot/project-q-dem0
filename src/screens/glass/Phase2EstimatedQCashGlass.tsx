import { Link } from "react-router-dom";
import { StatusBar } from "../../components/StatusBar";
import { Icon } from "../../components/Icon";
import { trip, qcash, vendors } from "../../data/demoData";
import { meshBackground, glassSurface, glassSurfaceMuted, glassText } from "../../components/glass/glassStyles";

export function Phase2EstimatedQCashGlass() {
  const projectionPct = (qcash.projection.current / qcash.projection.ceiling) * 100;

  return (
    <div className="phone-screen" style={{ ...meshBackground, color: glassText.primary }}>
      <StatusBar dark />

      <div
        className="no-scrollbar"
        style={{ padding: "16px 22px 100px", height: "calc(100% - 44px)", overflow: "auto" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div
            className="mono"
            style={{ fontSize: 10, letterSpacing: "0.14em", color: glassText.tertiary, textTransform: "uppercase" }}
          >
            Your trip · {trip.countdownDays} days away
          </div>
          <Icon.Sparkle />
        </div>
        <h1 className="serif" style={{ fontSize: 28, margin: "6px 0 4px", letterSpacing: "-0.02em", color: glassText.primary }}>
          {trip.destination}
        </h1>
        <div style={{ fontSize: 13, color: glassText.secondary }}>
          {trip.dates.in} — {trip.dates.out} · {trip.hotel.split(" ")[0]}
        </div>

        {/* Hero QCash glass card */}
        <div
          style={{
            ...glassSurface,
            position: "relative",
            marginTop: 16,
            padding: "22px 22px 20px",
            borderRadius: 24,
            overflow: "hidden",
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
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)",
              pointerEvents: "none",
            }}
          />
          {/* Gold radial bloom top-right */}
          <div
            style={{
              position: "absolute",
              top: -40,
              right: -50,
              width: 200,
              height: 200,
              borderRadius: 999,
              background: "radial-gradient(circle, rgba(241,216,150,0.45), transparent 70%)",
              filter: "blur(8px)",
              pointerEvents: "none",
            }}
          />

          <div
            className="mono"
            style={{
              fontSize: 11,
              color: glassText.tertiary,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              position: "relative",
            }}
          >
            Projected QCash · locks 24h before arrival
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 10, position: "relative" }}>
            <span className="serif" style={{ fontSize: 18, color: glassText.goldDeep }}>Q$</span>
            <span
              className="serif"
              style={{
                fontSize: 60,
                fontWeight: 600,
                color: glassText.gold,
                letterSpacing: "-0.03em",
                lineHeight: 1,
                textShadow: "0 0 30px rgba(241,216,150,0.5), 0 1px 0 rgba(255,255,255,0.15)",
              }}
            >
              {qcash.projection.current}
            </span>
            <span style={{ fontSize: 13, color: glassText.tertiary, marginLeft: 8 }}>
              of ${trip.feePaid} paid
            </span>
          </div>

          <div
            style={{
              marginTop: 14,
              height: 6,
              background: "rgba(255,255,255,0.08)",
              borderRadius: 999,
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.06)",
              position: "relative",
            }}
          >
            <div
              style={{
                width: `${projectionPct}%`,
                height: "100%",
                background: "linear-gradient(90deg, #d4b87a, #f1d896)",
                boxShadow: "0 0 12px rgba(241,216,150,0.6)",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 8,
              fontSize: 11,
              color: glassText.tertiary,
              position: "relative",
            }}
          >
            <span>Floor: Q${qcash.projection.floor}</span>
            <span>Today: Q${qcash.projection.current}</span>
            <span>Ceiling: Q${qcash.projection.ceiling}</span>
          </div>
          <div
            style={{
              marginTop: 14,
              fontSize: 13,
              color: glassText.secondary,
              lineHeight: 1.5,
              position: "relative",
            }}
          >
            Bookings are tracking <b style={{ color: glassText.gold }}>14% below capacity</b> for your week — your projected rebate ticked up Q$8 since Tuesday.
          </div>
        </div>

        {/* Pre-book CTA */}
        <div
          style={{
            ...glassSurfaceMuted,
            marginTop: 16,
            padding: 16,
            borderRadius: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icon.Sparkle size={16} />
            <span style={{ fontWeight: 600, fontSize: 14, color: glassText.primary }}>
              De-risk your QCash · pre-book now
            </span>
          </div>
          <div style={{ fontSize: 13, color: glassText.secondary, marginTop: 6, lineHeight: 1.45 }}>
            Spend up to <b>Q$71</b> early on Skyline, Bungy, K-Jet & 27 more vendors. Some are running pre-arrival multipliers right now.
          </div>
          <div className="no-scrollbar" style={{ marginTop: 12, display: "flex", gap: 8, overflowX: "auto" }}>
            {vendors.slice(0, 4).map((v) => (
              <Link
                key={v.id}
                to="/p2/prebook"
                style={{
                  flex: "0 0 130px",
                  borderRadius: 12,
                  overflow: "hidden",
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.04)",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div
                  style={{
                    height: 64,
                    background: "linear-gradient(135deg, rgba(241,216,150,0.2), rgba(42,122,100,0.3))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    color: glassText.tertiary,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                  }}
                >
                  {v.img}
                </div>
                <div style={{ padding: "8px 10px" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: glassText.primary }}>{v.name}</div>
                  <div style={{ fontSize: 11, color: glassText.gold, fontWeight: 600 }}>
                    {v.deal || v.multiplier || v.category}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
