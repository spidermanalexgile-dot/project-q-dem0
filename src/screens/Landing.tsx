import { Link } from "react-router-dom";
import type { ReactNode, CSSProperties } from "react";
import { useDemoData } from "../data/demoData";

/* ----------------------- Tokens (Heritage palette) ----------------------- */

const T = {
  ink: "#0a1f1a",
  inkDeep: "#031410",
  deep: "#0a4d3c",
  deep2: "#0d5d49",
  gold: "#d4b87a",
  goldLight: "#f1d896",
  goldDeep: "#b89958",
  goldSoft: "#f5ecd6",
  paper: "#fdfbf5",
  cream: "#f7f4ec",
  textPrimary: "#fdfbf5",
  textMuted: "#c8d6cf",
  textDim: "#8aa097",
  textInk: "#14241f",
  textInk2: "#4d5a55",
  line: "rgba(212,184,122,0.15)",
  containerMax: 1100,
  pagePadX: 40,
};

/* ----------------------- Public landing page ----------------------------- */

export function Landing() {
  return (
    <div style={{ background: T.inkDeep, color: T.textPrimary, fontFamily: "'Inter Tight', sans-serif" }}>
      <Nav />
      <Hero />
      <BookingMoment />
      <WhatYouGet />
      <HowItWorks />
      <PartnerWall />
      <SocialProof />
      <ForCity />
      <FinalCTA />
      <Footer />
    </div>
  );
}

/* ----------------------- Nav --------------------------------------------- */

function Nav() {
  const { destinationName } = useDemoData();
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(3,16,12,0.78)",
        backdropFilter: "blur(18px) saturate(160%)",
        WebkitBackdropFilter: "blur(18px) saturate(160%)",
        borderBottom: "1px solid rgba(212,184,122,0.1)",
      }}
    >
      <Container style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 40px" }}>
        <Wordmark />
        <nav style={{ display: "flex", gap: 32, fontSize: 13, color: T.textMuted }}>
          <a href="#how" style={navLink}>How it works</a>
          <a href="#what" style={navLink}>What you get</a>
          <a href="#vendors" style={navLink}>Vendors</a>
          <a href="#queenstown" style={navLink}>For {destinationName}</a>
        </nav>
        <div style={{ display: "flex", gap: 10 }}>
          <Link to="/" style={navGhost}>← Demo index</Link>
          <a href="#download" style={navPrimary}>Get the app</a>
        </div>
      </Container>
    </header>
  );
}

const navLink: CSSProperties = { color: T.textMuted, textDecoration: "none", fontWeight: 500 };
const navGhost: CSSProperties = {
  padding: "8px 14px",
  border: "1px solid rgba(212,184,122,0.25)",
  borderRadius: 999,
  color: T.textMuted,
  textDecoration: "none",
  fontSize: 12,
  fontFamily: "'JetBrains Mono', monospace",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};
const navPrimary: CSSProperties = {
  padding: "9px 18px",
  background: T.gold,
  color: T.ink,
  borderRadius: 999,
  textDecoration: "none",
  fontWeight: 600,
  fontSize: 13,
};

function Wordmark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const map = { sm: { coin: 24, font: 16 }, md: { coin: 30, font: 20 }, lg: { coin: 38, font: 26 } } as const;
  const s = map[size];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span
        style={{
          width: s.coin,
          height: s.coin,
          borderRadius: 999,
          background: "radial-gradient(circle at 35% 30%, #fde7a3 0%, #d4b87a 55%, #8a6a2a 100%)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Fraunces', serif",
          fontWeight: 700,
          color: "#3d2f12",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5), 0 0 16px rgba(241,216,150,0.4)",
        }}
      >
        Q
      </span>
      <span style={{ fontFamily: "'Fraunces', serif", fontSize: s.font, letterSpacing: "-0.01em", color: T.textPrimary, fontWeight: 600 }}>
        Project Q
      </span>
    </div>
  );
}

/* ----------------------- Hero -------------------------------------------- */

function Hero() {
  const { destinationName, trip, landing } = useDemoData();
  return (
    <Section
      style={{
        position: "relative",
        minHeight: "94vh",
        display: "flex",
        alignItems: "center",
        background: T.inkDeep,
        overflow: "hidden",
      }}
    >
      {/* Background atmosphere */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse 60% 50% at 78% 14%, rgba(241,216,150,0.22), transparent 60%),
            radial-gradient(ellipse 70% 60% at 18% 92%, rgba(42,122,100,0.45), transparent 60%),
            radial-gradient(ellipse 50% 60% at 50% 50%, rgba(10,77,60,0.45), transparent 70%)
          `,
          pointerEvents: "none",
        }}
      />
      {/* Subtle grain */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "repeating-linear-gradient(180deg, rgba(255,255,255,0.015) 0 1px, transparent 1px 3px)",
          pointerEvents: "none",
        }}
      />

      <Container style={{ position: "relative", padding: "100px 40px" }}>
        <div className="mono" style={{ fontSize: 11, color: T.gold, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 18 }}>
          Now live in {destinationName} · expanding through 2027
        </div>
        <h1
          className="serif"
          style={{
            fontSize: 84,
            margin: 0,
            letterSpacing: "-0.035em",
            lineHeight: 1.0,
            fontWeight: 600,
            maxWidth: 900,
          }}
        >
          Your ${trip.feePaid} isn't a tax.
          <br />
          <span style={{ color: T.goldLight }}>It's seed money for your trip.</span>
        </h1>
        <p
          style={{
            fontSize: 19,
            color: T.textMuted,
            maxWidth: 640,
            marginTop: 28,
            lineHeight: 1.55,
          }}
        >
          Project Q turns the {destinationName} visitor levy into <b style={{ color: T.textPrimary }}>spendable QCash</b>, an AI trip guide, and a smarter way to travel — connected to every booking platform you already use.
        </p>

        <div style={{ marginTop: 38, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <a href="#download" style={primaryGoldBtn}>Get the app</a>
          <a href="#how" style={ghostBtn}>How it works</a>
          <AppStoreBadges />
        </div>

        {/* Tiny stat strip */}
        <div
          style={{
            marginTop: 64,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 14,
            maxWidth: 760,
          }}
        >
          {[
            { k: "200+", v: `${destinationName} vendors` },
            { k: "$2.4M", v: "fees returned to visitors YTD" },
            { k: "94%", v: "vendor adoption" },
            { k: "4.9", v: "average traveller rating" },
          ].map((s) => (
            <div key={s.v}>
              <div className="serif" style={{ fontSize: 30, fontWeight: 600, color: T.goldLight, letterSpacing: "-0.02em" }}>
                {s.k}
              </div>
              <div style={{ fontSize: 12, color: T.textDim, marginTop: 2 }}>{s.v}</div>
            </div>
          ))}
        </div>
      </Container>

      {/* Live capacity bar at the very bottom */}
      <div
        style={{
          position: "absolute",
          bottom: 24,
          left: 40,
          right: 40,
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          color: T.textDim,
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: "0.06em",
        }}
      >
        <span>{landing.capacityLine}</span>
        <span>v0.9 · projectq.travel</span>
      </div>
    </Section>
  );
}

const primaryGoldBtn: CSSProperties = {
  padding: "16px 28px",
  background: "linear-gradient(180deg, #fde7a3, #d4b87a)",
  color: "#0a1f1a",
  border: 0,
  borderRadius: 999,
  fontWeight: 600,
  fontSize: 15,
  textDecoration: "none",
  cursor: "pointer",
  boxShadow: "0 0 30px rgba(241,216,150,0.3), inset 0 1px 0 rgba(255,255,255,0.5)",
};

const ghostBtn: CSSProperties = {
  padding: "16px 28px",
  background: "transparent",
  color: T.textPrimary,
  border: "1px solid rgba(212,184,122,0.4)",
  borderRadius: 999,
  fontWeight: 600,
  fontSize: 15,
  textDecoration: "none",
  cursor: "pointer",
};

function AppStoreBadges() {
  return (
    <div style={{ display: "flex", gap: 8, marginLeft: 4 }}>
      <Badge label="App Store" sub="Download on the" />
      <Badge label="Google Play" sub="Get it on" />
    </div>
  );
}

function Badge({ label, sub }: { label: string; sub: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 12,
        color: T.textPrimary,
        minWidth: 130,
      }}
    >
      <div
        style={{
          width: 22,
          height: 22,
          background: "rgba(255,255,255,0.85)",
          borderRadius: 5,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          color: "#0a1f1a",
          fontWeight: 700,
          fontFamily: "'Fraunces', serif",
        }}
      >
        ▸
      </div>
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.05 }}>
        <span style={{ fontSize: 9, color: T.textDim, letterSpacing: "0.05em" }}>{sub}</span>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      </div>
    </div>
  );
}

/* ----------------------- Booking moment ---------------------------------- */

function BookingMoment() {
  const { destinationName } = useDemoData();
  return (
    <Section
      style={{
        position: "relative",
        background: "#04211c",
        borderTop: "1px solid rgba(212,184,122,0.12)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -120,
          left: "50%",
          transform: "translateX(-50%)",
          width: 900,
          height: 400,
          background: "radial-gradient(ellipse, rgba(241,216,150,0.18), transparent 70%)",
          pointerEvents: "none",
          filter: "blur(10px)",
        }}
      />
      <Container style={{ padding: "120px 40px", position: "relative" }}>
        <SectionEyebrow>The booking moment</SectionEyebrow>
        <h2
          className="serif"
          style={{
            fontSize: 56,
            margin: "12px 0 18px",
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
            fontWeight: 600,
            maxWidth: 760,
          }}
        >
          You've already paid. <br />
          <span style={{ color: T.goldLight }}>Now claim what's yours.</span>
        </h2>
        <p style={{ fontSize: 17, color: T.textMuted, lineHeight: 1.55, maxWidth: 640 }}>
          Book a {destinationName} trip on Booking.com, Airbnb, Expedia or any partner site. The visitor levy line-item is added at checkout — and the moment your booking confirms, we send a one-tap install link by email, SMS, and QR code.
        </p>

        {/* Split panel diagram */}
        <div
          style={{
            marginTop: 52,
            display: "grid",
            gridTemplateColumns: "1fr 60px 1fr",
            gap: 0,
            alignItems: "center",
            maxWidth: 1000,
          }}
        >
          <CheckoutMockup />
          <Arrow />
          <PhoneDownloadMockup />
        </div>

        {/* Big "download instantly" callout — CTA #2 */}
        <a
          href="#download"
          style={{
            marginTop: 52,
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            padding: "16px 22px",
            background: "linear-gradient(180deg, #fde7a3, #d4b87a)",
            color: T.ink,
            borderRadius: 999,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 15,
            boxShadow:
              "0 0 30px rgba(241,216,150,0.4), inset 0 1px 0 rgba(255,255,255,0.5), 0 8px 28px rgba(0,0,0,0.4)",
            transition: "transform 220ms ease",
          }}
        >
          <PulseDot />
          Download instantly after booking →
        </a>
        <div style={{ fontSize: 12, color: T.textDim, marginTop: 12 }}>
          One-tap install via SMS / email / QR. iOS &amp; Android.
        </div>
      </Container>
    </Section>
  );
}

function PulseDot() {
  return (
    <span
      style={{
        position: "relative",
        width: 10,
        height: 10,
        borderRadius: 999,
        background: "#0a4d3c",
        boxShadow: "0 0 0 4px rgba(10,77,60,0.4)",
      }}
    />
  );
}

function CheckoutMockup() {
  const { trip, qcash, bookingLineItem } = useDemoData();
  return (
    <div
      style={{
        background: T.paper,
        color: T.textInk,
        borderRadius: 14,
        padding: "20px 22px",
        boxShadow: "0 30px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,0,0,0.06)",
      }}
    >
      <div className="mono" style={{ fontSize: 10, color: "#8a948f", letterSpacing: "0.12em", textTransform: "uppercase" }}>
        Step 3 of 3 · Confirm & pay
      </div>
      <div className="serif" style={{ fontSize: 22, marginTop: 6, letterSpacing: "-0.02em", color: T.textInk, fontWeight: 600 }}>
        {trip.hotel} · {trip.dates.nights} nights
      </div>
      <div style={{ marginTop: 16, border: "1px solid #e7e0cf", borderRadius: 10 }}>
        {[
          { l: bookingLineItem.suiteLine, v: bookingLineItem.suiteAmount, muted: false },
          { l: "Service fee", v: bookingLineItem.serviceAmount, muted: true },
          { l: bookingLineItem.taxLabel, v: bookingLineItem.taxAmount, muted: true },
        ].map((row) => (
          <div
            key={row.l}
            style={{
              padding: "10px 14px",
              borderBottom: "1px solid #efe9d9",
              display: "flex",
              justifyContent: "space-between",
              fontSize: 13,
              color: row.muted ? "#4d5a55" : T.textInk,
            }}
          >
            <span>{row.l}</span>
            <span className="mono tnum">{row.v}</span>
          </div>
        ))}
        <div
          style={{
            padding: "12px 14px",
            background: T.goldSoft,
            borderTop: "2px solid #d4b87a",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -1,
              right: 12,
              fontSize: 9,
              color: T.ink,
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              background: T.gold,
              padding: "3px 8px",
              borderRadius: "0 0 6px 6px",
              fontWeight: 600,
            }}
          >
            Project Q
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Sustainability fee · Project Q</div>
              <div style={{ fontSize: 11, color: "#7a6a40", marginTop: 2 }}>$28 × {trip.dates.nights} · returned as Q${qcash.projection.current} in QCash</div>
            </div>
            <span className="mono tnum" style={{ fontSize: 13, fontWeight: 600 }}>${trip.feePaid}.00</span>
          </div>
        </div>
        <div style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>Total</span>
          <span className="serif tnum" style={{ fontSize: 22, fontWeight: 700 }}>{bookingLineItem.totalAmount}</span>
        </div>
      </div>
      <button
        style={{
          marginTop: 12,
          width: "100%",
          padding: "12px",
          background: T.deep,
          color: T.paper,
          border: 0,
          borderRadius: 999,
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        Confirm and pay
      </button>
    </div>
  );
}

function Arrow() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", color: T.gold }}>
      <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
        <path
          d="M6 22 L36 22 M28 14 L36 22 L28 30"
          stroke={T.gold}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className="mono"
        style={{
          fontSize: 9,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: T.textDim,
          marginTop: 8,
          textAlign: "center",
          maxWidth: 80,
        }}
      >
        Instant install link
      </span>
    </div>
  );
}

function PhoneDownloadMockup() {
  const { trip, qcash } = useDemoData();
  return (
    <div
      style={{
        background: "#000",
        borderRadius: 36,
        padding: 8,
        position: "relative",
        boxShadow: "0 30px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06) inset",
        margin: "0 auto",
        width: 240,
      }}
    >
      <div
        style={{
          width: "100%",
          aspectRatio: "393 / 852",
          borderRadius: 28,
          overflow: "hidden",
          background: T.inkDeep,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 8,
            left: "50%",
            transform: "translateX(-50%)",
            width: 80,
            height: 22,
            background: "#000",
            borderRadius: 999,
          }}
        />
        {/* Atmosphere */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `
              radial-gradient(ellipse 70% 50% at 70% 18%, rgba(241,216,150,0.25), transparent 65%),
              radial-gradient(ellipse 80% 60% at 20% 92%, rgba(42,122,100,0.55), transparent 65%)
            `,
          }}
        />
        <div style={{ position: "relative", padding: "60px 22px 30px", color: T.textPrimary }}>
          <div className="mono" style={{ fontSize: 8, letterSpacing: "0.18em", color: T.gold, textTransform: "uppercase" }}>
            Booking confirmed
          </div>
          <div className="serif" style={{ fontSize: 20, marginTop: 8, letterSpacing: "-0.02em", lineHeight: 1.15, fontWeight: 600 }}>
            Welcome, {trip.guest.name}. <br />
            <span style={{ color: T.goldLight }}>Q${qcash.projection.current} is waiting.</span>
          </div>
          <div style={{ marginTop: 18, fontSize: 11, color: T.textMuted, lineHeight: 1.5 }}>
            Your visitor fee has been converted into spendable QCash. Open Project Q to see your trip plan.
          </div>
          <button
            style={{
              marginTop: 22,
              width: "100%",
              padding: "11px",
              background: "linear-gradient(180deg, #fde7a3, #d4b87a)",
              color: T.ink,
              border: 0,
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 600,
              boxShadow: "0 0 16px rgba(241,216,150,0.4), inset 0 1px 0 rgba(255,255,255,0.5)",
            }}
          >
            Open Project Q
          </button>
          <div style={{ marginTop: 38, fontSize: 8, color: T.textDim, textAlign: "center", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em" }}>
            ● Auto-installed via your booking
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------- What you get ------------------------------------ */

function WhatYouGet() {
  const { landing } = useDemoData();
  return (
    <Section style={{ background: T.ink, padding: "120px 0" }} id="what">
      <Container style={{ padding: "0 40px" }}>
        <SectionEyebrow>What you get</SectionEyebrow>
        <h2
          className="serif"
          style={{
            fontSize: 52,
            margin: "12px 0 56px",
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
            fontWeight: 600,
            maxWidth: 720,
          }}
        >
          Three things, one app.
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {[
            {
              title: "QCash",
              copy: landing.vendorBlurbCopy,
              kicker: "Currency",
            },
            {
              title: "Ask Q",
              copy: "Your AI travel concierge. Plan your trip in plain English, ask anything, get answers grounded in real-time conditions and your itinerary.",
              kicker: "AI guide",
            },
            {
              title: "Live trip guide",
              copy: "Real-time map, pay-by-QR, day-by-day itinerary that adapts to weather, crowds, and your pace. Works offline once your trip is loaded.",
              kicker: "Day of",
            },
          ].map((c) => (
            <div
              key={c.title}
              style={{
                padding: "28px 26px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(212,184,122,0.18)",
                borderRadius: 22,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div className="mono" style={{ fontSize: 10, letterSpacing: "0.18em", color: T.gold, textTransform: "uppercase" }}>
                {c.kicker}
              </div>
              <h3 className="serif" style={{ fontSize: 30, margin: 0, letterSpacing: "-0.02em", fontWeight: 600 }}>
                {c.title}
              </h3>
              <p style={{ color: T.textMuted, fontSize: 14, lineHeight: 1.55, margin: 0 }}>{c.copy}</p>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}

/* ----------------------- How it works ------------------------------------ */

function HowItWorks() {
  return (
    <Section
      id="how"
      style={{
        background: T.inkDeep,
        padding: "120px 0",
        borderTop: "1px solid rgba(212,184,122,0.12)",
      }}
    >
      <Container style={{ padding: "0 40px" }}>
        <SectionEyebrow>How it works</SectionEyebrow>
        <h2
          className="serif"
          style={{
            fontSize: 52,
            margin: "12px 0 56px",
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
            fontWeight: 600,
            maxWidth: 760,
          }}
        >
          From booking to spending — four steps.
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 14,
            position: "relative",
          }}
        >
          {/* connector line */}
          <div
            style={{
              position: "absolute",
              top: 36,
              left: "12%",
              right: "12%",
              height: 1,
              background: "linear-gradient(90deg, transparent, rgba(212,184,122,0.3), rgba(212,184,122,0.3), transparent)",
              pointerEvents: "none",
            }}
          />
          {[
            { n: "01", title: "Book your trip", body: "On Booking.com, Airbnb, Expedia, or any partner site." , emphasized: false },
            { n: "02", title: "Pay the visitor fee", body: "It's added at checkout — no extra steps for you.", emphasized: false },
            { n: "03", title: "Download Project Q", body: "Auto-sent by SMS / email / QR the moment your booking confirms.", emphasized: true },
            { n: "04", title: "Spend QCash everywhere", body: "200+ partners. Pay with a single-use QR. AI plans the rest.", emphasized: false },
          ].map((s) => (
            <div
              key={s.n}
              style={{
                padding: "32px 22px 26px",
                background: s.emphasized
                  ? "linear-gradient(180deg, rgba(241,216,150,0.16), rgba(241,216,150,0.06))"
                  : "rgba(255,255,255,0.03)",
                border: s.emphasized
                  ? "1px solid rgba(241,216,150,0.5)"
                  : "1px solid rgba(212,184,122,0.18)",
                borderRadius: 18,
                position: "relative",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 999,
                  background: s.emphasized
                    ? "radial-gradient(circle at 35% 30%, #fde7a3 0%, #d4b87a 60%, #8a6a2a 100%)"
                    : "rgba(255,255,255,0.06)",
                  border: s.emphasized
                    ? "1px solid rgba(255,255,255,0.4)"
                    : "1px solid rgba(212,184,122,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "'Fraunces', serif",
                  fontSize: 18,
                  fontWeight: 600,
                  color: s.emphasized ? "#3d2f12" : T.gold,
                  letterSpacing: "-0.01em",
                  position: "relative",
                  zIndex: 1,
                  boxShadow: s.emphasized ? "0 0 24px rgba(241,216,150,0.55)" : "none",
                }}
              >
                {s.n}
              </div>
              <h3 className="serif" style={{ fontSize: 22, margin: "20px 0 8px", letterSpacing: "-0.02em", fontWeight: 600, color: T.textPrimary }}>
                {s.title}
              </h3>
              <p style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.5, margin: 0 }}>{s.body}</p>
              {s.emphasized && (
                <span
                  className="mono"
                  style={{
                    position: "absolute",
                    top: 14,
                    right: 14,
                    padding: "3px 8px",
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: T.ink,
                    background: T.gold,
                    borderRadius: 999,
                  }}
                >
                  Conversion
                </span>
              )}
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}

/* ----------------------- Partner wall ------------------------------------ */

function PartnerWall() {
  const { destinationName, landing } = useDemoData();
  const partners = landing.partners;

  return (
    <Section id="vendors" style={{ background: T.ink, padding: "120px 0" }}>
      <Container style={{ padding: "0 40px" }}>
        <SectionEyebrow>Where you can spend</SectionEyebrow>
        <h2
          className="serif"
          style={{
            fontSize: 52,
            margin: "12px 0 14px",
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
            fontWeight: 600,
            maxWidth: 720,
          }}
        >
          200+ {destinationName} businesses. <br />
          <span style={{ color: T.goldLight }}>One currency.</span>
        </h2>
        <p style={{ color: T.textMuted, fontSize: 16, maxWidth: 580, lineHeight: 1.55, marginBottom: 48 }}>
          Restaurants, cafés, adventure operators, hotels, boutique shops, even the gondola ticket office. Pay anywhere with a single-use QR.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 1,
            background: "rgba(212,184,122,0.18)",
            border: "1px solid rgba(212,184,122,0.18)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {partners.map((p) => (
            <div
              key={p}
              style={{
                padding: "26px 16px",
                background: T.ink,
                color: T.textPrimary,
                textAlign: "center",
                fontFamily: "'Fraunces', serif",
                fontSize: 17,
                letterSpacing: "-0.01em",
                fontWeight: 500,
              }}
            >
              {p}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 20, fontSize: 12, color: T.textDim, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "center" }}>
          + 175 more · refreshed weekly
        </div>
      </Container>
    </Section>
  );
}

/* ----------------------- Social proof ------------------------------------ */

function SocialProof() {
  const { landing } = useDemoData();
  const cards = landing.testimonials;

  return (
    <Section style={{ background: T.inkDeep, padding: "120px 0", borderTop: "1px solid rgba(212,184,122,0.12)" }}>
      <Container style={{ padding: "0 40px" }}>
        <SectionEyebrow>Social proof</SectionEyebrow>
        <h2
          className="serif"
          style={{
            fontSize: 52,
            margin: "12px 0 56px",
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
            fontWeight: 600,
            maxWidth: 720,
          }}
        >
          Tourists love it. Vendors love it. The council too.
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 16,
          }}
        >
          {cards.map((c) => (
            <div
              key={c.name}
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(212,184,122,0.18)",
                borderRadius: 22,
                padding: "28px 26px",
                display: "flex",
                flexDirection: "column",
                gap: 18,
              }}
            >
              <div className="mono" style={{ fontSize: 10, letterSpacing: "0.18em", color: T.gold, textTransform: "uppercase" }}>
                {c.tag}
              </div>
              <p
                className="serif"
                style={{
                  fontSize: 19,
                  letterSpacing: "-0.01em",
                  lineHeight: 1.4,
                  color: T.textPrimary,
                  margin: 0,
                  fontWeight: 500,
                }}
              >
                "{c.quote}"
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: "auto" }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 999,
                    background: c.bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: T.textPrimary,
                    fontFamily: "'Fraunces', serif",
                    fontWeight: 700,
                    fontSize: 14,
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4)",
                  }}
                >
                  {c.initials}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: T.textDim }}>{c.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}

/* ----------------------- For Queenstown ---------------------------------- */

function ForCity() {
  const { destinationName, landing } = useDemoData();
  return (
    <Section id="queenstown" style={{ background: T.ink, padding: "120px 0" }}>
      <Container style={{ padding: "0 40px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr 1fr",
            gap: 60,
            alignItems: "center",
          }}
        >
          <div>
            <SectionEyebrow>For {destinationName}</SectionEyebrow>
            <h2
              className="serif"
              style={{
                fontSize: 48,
                margin: "12px 0 18px",
                letterSpacing: "-0.03em",
                lineHeight: 1.05,
                fontWeight: 600,
              }}
            >
              Built with {destinationName},<br />
              <span style={{ color: T.goldLight }}>for {destinationName}.</span>
            </h2>
            <p style={{ fontSize: 16, color: T.textMuted, lineHeight: 1.55, marginBottom: 18 }}>
              {landing.forCityDescription}
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 24, flexWrap: "wrap" }}>
              <a href="#partners" style={ghostBtn}>For local businesses →</a>
              <a href="#officials" style={ghostBtn}>For council officials →</a>
            </div>
          </div>

          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(212,184,122,0.18)",
              borderRadius: 22,
              padding: 28,
            }}
          >
            <div className="mono" style={{ fontSize: 10, color: T.gold, letterSpacing: "0.18em", textTransform: "uppercase" }}>
              Live snapshot · today
            </div>
            <div className="serif" style={{ fontSize: 32, marginTop: 8, letterSpacing: "-0.02em", fontWeight: 600 }}>
              3,124 visitors are in town right now.
            </div>
            <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[
                { k: "78%", v: "of capacity", note: "+4% vs forecast" },
                { k: "Q$184k", v: "QCash circulating", note: "Q$23k retired today" },
                { k: "$2.4M", v: "fees collected · YTD", note: "67% to vendors" },
                { k: "412", v: "active vendors", note: "94% adoption" },
              ].map((s) => (
                <div key={s.v}>
                  <div className="serif" style={{ fontSize: 24, color: T.goldLight, fontWeight: 600 }}>
                    {s.k}
                  </div>
                  <div style={{ fontSize: 11, color: T.textMuted }}>{s.v}</div>
                  <div style={{ fontSize: 10, color: "#5fb8a6", marginTop: 2 }}>{s.note}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}

/* ----------------------- Final CTA --------------------------------------- */

function FinalCTA() {
  const { destinationName } = useDemoData();
  return (
    <Section
      id="download"
      style={{
        position: "relative",
        background: T.inkDeep,
        padding: "140px 0 120px",
        overflow: "hidden",
        borderTop: "1px solid rgba(212,184,122,0.12)",
      }}
    >
      {/* Massive gold bloom */}
      <div
        style={{
          position: "absolute",
          top: 30,
          left: "50%",
          transform: "translateX(-50%)",
          width: 1100,
          height: 600,
          background: "radial-gradient(ellipse, rgba(241,216,150,0.25), transparent 70%)",
          filter: "blur(20px)",
          pointerEvents: "none",
        }}
      />
      <Container style={{ padding: "0 40px", position: "relative", textAlign: "center" }}>
        <SectionEyebrow style={{ display: "inline-block" }}>Get Project Q</SectionEyebrow>
        <h2
          className="serif"
          style={{
            fontSize: 92,
            margin: "20px 0 24px",
            letterSpacing: "-0.04em",
            lineHeight: 0.98,
            fontWeight: 600,
            maxWidth: 900,
            marginInline: "auto",
          }}
        >
          {destinationName},
          <br />
          <span style={{ color: T.goldLight }}>end-to-end.</span>
        </h2>
        <p style={{ fontSize: 18, color: T.textMuted, maxWidth: 580, margin: "0 auto", lineHeight: 1.55 }}>
          The visitor levy is already on your booking. Open the app and turn it into a trip.
        </p>

        <div
          style={{
            marginTop: 36,
            display: "flex",
            justifyContent: "center",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <a
            href="#"
            style={{
              ...primaryGoldBtn,
              padding: "18px 30px",
              fontSize: 16,
              boxShadow: "0 0 40px rgba(241,216,150,0.45), inset 0 1px 0 rgba(255,255,255,0.5)",
            }}
          >
            Download instantly after booking →
          </a>
          <AppStoreBadges />
        </div>

        {/* Email capture */}
        <form
          onSubmit={(e) => e.preventDefault()}
          style={{
            marginTop: 36,
            display: "flex",
            justifyContent: "center",
            gap: 8,
            flexWrap: "wrap",
            maxWidth: 460,
            marginInline: "auto",
          }}
        >
          <input
            type="email"
            placeholder="Drop your email — get a link when you book"
            style={{
              flex: 1,
              minWidth: 260,
              padding: "14px 18px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(212,184,122,0.3)",
              borderRadius: 999,
              color: T.textPrimary,
              fontFamily: "'Inter Tight', sans-serif",
              fontSize: 14,
              outline: "none",
            }}
          />
          <button
            type="submit"
            style={{
              padding: "14px 22px",
              background: "transparent",
              border: "1px solid rgba(212,184,122,0.5)",
              color: T.gold,
              borderRadius: 999,
              fontFamily: "'Inter Tight', sans-serif",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Notify me
          </button>
        </form>
        <div style={{ marginTop: 12, fontSize: 11, color: T.textDim, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.06em" }}>
          No spam. One email when your booking confirms.
        </div>
      </Container>
    </Section>
  );
}

/* ----------------------- Footer ------------------------------------------ */

function Footer() {
  return (
    <footer style={{ background: "#020c09", padding: "60px 0 80px", borderTop: "1px solid rgba(212,184,122,0.1)" }}>
      <Container
        style={{
          padding: "0 40px",
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: 24,
          alignItems: "center",
        }}
      >
        <Wordmark size="sm" />
        <div style={{ display: "flex", gap: 24, fontSize: 12, color: T.textDim, flexWrap: "wrap" }}>
          <a href="#" style={{ color: T.textDim, textDecoration: "none" }}>Privacy</a>
          <a href="#" style={{ color: T.textDim, textDecoration: "none" }}>Terms</a>
          <a href="#" style={{ color: T.textDim, textDecoration: "none" }}>Contact</a>
          <a href="#partners" style={{ color: T.textDim, textDecoration: "none" }}>For Partners</a>
          <span style={{ color: "#3d4a45" }}>© 2027 Project Q</span>
        </div>
      </Container>
    </footer>
  );
}

/* ----------------------- Layout helpers ---------------------------------- */

function Container({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        maxWidth: T.containerMax,
        margin: "0 auto",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Section({ children, style, id }: { children: ReactNode; style?: CSSProperties; id?: string }) {
  return (
    <section id={id} style={style}>
      {children}
    </section>
  );
}

function SectionEyebrow({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      className="mono"
      style={{
        fontSize: 11,
        letterSpacing: "0.18em",
        color: T.gold,
        textTransform: "uppercase",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
