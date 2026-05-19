import { useDemoData } from "../data/demoData";

export function Phase1Landing() {
  const { trip, qcash, bookingWelcome } = useDemoData();
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#0a1f1a",
        color: "#fdfbf5",
        fontFamily: "'Inter Tight', sans-serif",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 80% 60% at 70% 30%, rgba(212,184,122,0.18), transparent 60%), radial-gradient(ellipse at 20% 90%, rgba(42,122,100,0.4), transparent 60%)",
        }}
      />

      <div style={{ position: "relative", padding: "30px 40px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: 999,
              background: "linear-gradient(135deg,#f1d896,#b89958)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "'Fraunces', serif",
              fontWeight: 700,
              color: "#1a1a1a",
            }}
          >
            Q
          </span>
          <span className="serif" style={{ fontSize: 20, letterSpacing: "-0.01em" }}>Project Q</span>
        </div>
        <div style={{ display: "flex", gap: 28, fontSize: 13, color: "#c8d6cf" }}>
          <span>How it works</span><span>Locations</span><span>Vendors</span><span>FAQ</span>
        </div>
      </div>

      <div style={{ position: "relative", padding: "60px 40px 0", maxWidth: 720 }}>
        <div className="mono" style={{ fontSize: 11, letterSpacing: "0.18em", color: "#d4b87a", textTransform: "uppercase" }}>
          {bookingWelcome.eyebrow}
        </div>
        <h1
          className="serif"
          style={{
            fontSize: 58,
            lineHeight: 1.02,
            margin: "16px 0 18px",
            letterSpacing: "-0.03em",
            fontWeight: 600,
          }}
        >
          Your ${trip.feePaid} isn't a tax.
          <br />
          <span style={{ color: "#d4b87a" }}>It's seed money for your trip.</span>
        </h1>
        <p style={{ fontSize: 16, color: "#c8d6cf", lineHeight: 1.5, maxWidth: 560 }}>
          {bookingWelcome.rationale}
        </p>

        <div style={{ marginTop: 28, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(212,184,122,0.4)",
              borderRadius: 16,
              padding: "14px 20px",
            }}
          >
            <div className="mono" style={{ fontSize: 11, color: "#a8b8af", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Projected QCash
            </div>
            <div className="serif" style={{ fontSize: 36, fontWeight: 600, color: "#f1d896", marginTop: 4 }}>Q${qcash.projection.current}</div>
            <div style={{ fontSize: 11, color: "#a8b8af" }}>{bookingWelcome.effectiveLine}</div>
          </div>
          <button
            style={{
              padding: "16px 26px",
              background: "#d4b87a",
              color: "#0a1f1a",
              border: 0,
              borderRadius: 999,
              fontWeight: 600,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            Download the Q app →
          </button>
        </div>
      </div>

      <div style={{ position: "absolute", bottom: 24, left: 40, right: 40, display: "flex", gap: 32, fontSize: 12, color: "#8aa097" }}>
        <span>{bookingWelcome.liveCapacity}</span>
        <span style={{ marginLeft: "auto" }}>FAQ · Why is my fee this much? · How is QCash calculated?</span>
      </div>
    </div>
  );
}
