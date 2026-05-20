import { Link } from "react-router-dom";
import { useDemoData } from "../data/demoData";
import { DestinationToggle } from "../components/DestinationToggle";
import { useDestination } from "../context/DestinationContext";

/* ------------------------------------------------------------- */
/*  Layout tokens                                                 */
/* ------------------------------------------------------------- */

const TOKENS = {
  pageBg: "var(--gx-app-bg)",
  pagePadX: 24,
  headerPadTop: 60,
  headerPadBottom: 24,
  sectionsPadTop: 60,
  sectionsPadBottom: 80,
  footerMaxWidth: 720,

  sectionGap: 96,
  rowGap: 40,
  captionMarginBottom: 18,

  eyebrow: { size: 10, tracking: "0.18em", color: "var(--gx-text-3)" },
  title: { size: 22, color: "var(--gx-text-1)" },

  phoneScale: 0.78,
  desktopScale: 0.8,
};

/* ------------------------------------------------------------- */
/*  Iframe-based phone & desktop frames                           */
/* ------------------------------------------------------------- */

function IframeMobile({ path, title }: { path: string; title: string }) {
  const scale = TOKENS.phoneScale;
  const innerW = 369;
  const innerH = 828;
  return (
    <div
      style={{
        width: 393 * scale,
        height: 852 * scale,
        background: "#000",
        borderRadius: 54 * scale,
        padding: 12 * scale,
        position: "relative",
        boxShadow: "0 30px 80px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.04) inset",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 42 * scale,
          overflow: "hidden",
          background: "var(--q-paper)",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 10 * scale,
            left: "50%",
            transform: "translateX(-50%)",
            width: 120 * scale,
            height: 32 * scale,
            background: "#000",
            borderRadius: 999,
            zIndex: 100,
            pointerEvents: "none",
          }}
        />
        <iframe
          src={path}
          title={title}
          loading="lazy"
          style={{
            width: innerW,
            height: innerH,
            border: 0,
            display: "block",
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        />
      </div>
    </div>
  );
}

function IframeDesktop({ path, title }: { path: string; title: string }) {
  const scale = TOKENS.desktopScale;
  const w = 1100;
  const h = 720;
  return (
    <div
      style={{
        width: w * scale,
        height: h * scale,
        margin: "0 auto",
        borderRadius: 14,
        overflow: "hidden",
        boxShadow: "0 30px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)",
        background: "#fff",
      }}
    >
      <iframe
        src={path}
        title={title}
        loading="lazy"
        style={{
          width: w,
          height: h,
          border: 0,
          display: "block",
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------- */
/*  Captions                                                     */
/* ------------------------------------------------------------- */

function Caption({ phase, name }: { phase: string; name: string }) {
  return (
    <div style={{ marginBottom: TOKENS.captionMarginBottom, textAlign: "center" }}>
      <div
        className="mono"
        style={{
          fontSize: TOKENS.eyebrow.size,
          letterSpacing: TOKENS.eyebrow.tracking,
          color: TOKENS.eyebrow.color,
          textTransform: "uppercase",
        }}
      >
        {phase}
      </div>
      <div
        className="serif"
        style={{
          fontSize: TOKENS.title.size,
          color: TOKENS.title.color,
          marginTop: 4,
          letterSpacing: "-0.01em",
        }}
      >
        {name}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- */
/*  Sections — chronological, single-frame each (Glass only).    */
/* ------------------------------------------------------------- */

type Section = { phase: string; name: string; path: string; desktop?: boolean; veniceOnly?: boolean };

const sections: Section[] = [
  { phase: "Phase 1 · Booking", name: "Sustainability fee at checkout · 6 months out", path: "/p1/checkout", desktop: true },
  { phase: "Phase 1 · Booking", name: "projectq.travel · personalized landing", path: "/p1/landing", desktop: true },
  { phase: "Phase 1 · Booking · Venice", name: "Equity chart · who actually pays €40?", path: "/p1/equity", desktop: true, veniceOnly: true },

  { phase: "Venice · Day Tripper", name: "Welcome · the hook", path: "/day/welcome", veniceOnly: true },
  { phase: "Venice · Day Tripper", name: "Quick start · one vibe question", path: "/day/start", veniceOnly: true },
  { phase: "Venice · Day Tripper", name: "Wallet · 40 QCash, expires tonight", path: "/day/wallet", veniceOnly: true },
  { phase: "Venice · Day Tripper", name: "Explore · today near you", path: "/day/explore", veniceOnly: true },
  { phase: "Venice · Day Tripper", name: "Map · walkable, walking routes", path: "/day/map", veniceOnly: true },
  { phase: "Venice · Day Tripper", name: "Pay with QCash", path: "/day/pay", veniceOnly: true },
  { phase: "Venice · Day Tripper", name: "Recap · your day & impact", path: "/day/recap", veniceOnly: true },

  { phase: "Phase 2 · Pre-arrival", name: "Onboarding · what gets you out of bed?", path: "/p2/onboarding" },
  { phase: "Phase 2 · Pre-arrival", name: "Projected QCash home", path: "/p2/home" },
  { phase: "Phase 2 · Pre-arrival", name: "Pre-book Skyline Gondola", path: "/p2/prebook" },

  { phase: "Phase 3 · In-town", name: "Trip · the guided home", path: "/p3/trip" },
  { phase: "Phase 3 · In-town · Take Control mode", name: "Trip · simplified for older travellers", path: "/takecontrol" },
  { phase: "Phase 3 · In-town", name: "Ask Q · the chat", path: "/p3/home" },
  { phase: "Phase 3 · In-town", name: "Wallet · your QCash", path: "/p3/wallet" },
  { phase: "Phase 3 · In-town", name: "Pay with QCash", path: "/p3/pay" },
  { phase: "Phase 3 · In-town", name: "Live map · real Queenstown", path: "/p3/map" },

  { phase: "Phase 4 · Departure", name: "Trip summary · your Queenstown in numbers", path: "/p4/summary" },
  { phase: "Phase 4 · Departure", name: "Memory film viewer", path: "/p4/memory" },
  { phase: "Phase 4 · Departure", name: "Come back · 3 weeks later", path: "/p4/comeback" },
];

/* ------------------------------------------------------------- */

export function Walkthrough() {
  const { walkthroughSubtitle } = useDemoData();
  const { destination } = useDestination();
  const visibleSections = sections.filter(
    (s) => !s.veniceOnly || destination === "venice",
  );
  return (
    <div
      style={{
        minHeight: "100vh",
        background: TOKENS.pageBg,
        color: "var(--gx-text-1)",
        position: "relative",
      }}
    >
      {/* Top-right destination toggle, fixed */}
      <div style={{ position: "fixed", top: 20, right: 20, zIndex: 1000 }}>
        <DestinationToggle />
      </div>

      {/* Header */}
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: `${TOKENS.headerPadTop}px ${TOKENS.pagePadX}px ${TOKENS.headerPadBottom}px`,
          textAlign: "center",
        }}
      >
        <div
          className="mono"
          style={{
            fontSize: 11,
            letterSpacing: "0.18em",
            color: "var(--gx-text-3)",
            textTransform: "uppercase",
          }}
        >
          Project Q · Tourist UX · Full Walkthrough
        </div>
        <h1
          className="serif"
          style={{
            fontSize: 56,
            margin: "12px 0 6px",
            letterSpacing: "-0.03em",
            lineHeight: 1.02,
            fontWeight: 600,
            color: "var(--gx-text-1)",
          }}
        >
          The whole journey, one scroll.
        </h1>
        <p
          style={{
            fontSize: 16,
            color: "var(--gx-text-2)",
            maxWidth: 640,
            margin: "0 auto",
            lineHeight: 1.5,
          }}
        >
          {walkthroughSubtitle} <b>Each phone is a live, isolated mini-app</b> — click around inside any one without losing the others.
        </p>
        <div style={{ marginTop: 22, display: "inline-flex", gap: 8 }}>
          <Link
            to="/"
            style={{
              padding: "8px 16px",
              fontSize: 12,
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              borderRadius: 999,
              background: "var(--gx-surface)",
              color: "var(--gx-text-1)",
              textDecoration: "none",
              border: "1px solid var(--gx-border)",
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
            }}
          >
            ← All screens
          </Link>
        </div>
      </div>

      {/* Sections */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: TOKENS.sectionGap,
          padding: `${TOKENS.sectionsPadTop}px ${TOKENS.pagePadX}px ${TOKENS.sectionsPadBottom}px`,
        }}
      >
        {visibleSections.map((s, i) => (
          <section key={i}>
            <Caption phase={s.phase} name={s.name} />
            <div style={{ display: "flex", justifyContent: "center" }}>
              {s.desktop ? (
                <IframeDesktop path={s.path} title={s.name} />
              ) : (
                <IframeMobile path={s.path} title={s.name} />
              )}
            </div>
          </section>
        ))}
      </div>

      {/* Summary footer */}
      <div
        style={{
          maxWidth: TOKENS.footerMaxWidth,
          margin: "0 auto",
          padding: `0 ${TOKENS.pagePadX}px ${TOKENS.sectionsPadBottom}px`,
        }}
      >
        <div
          style={{
            background: "var(--gx-surface)",
            border: "1px solid var(--gx-border)",
            borderRadius: 18,
            padding: 28,
            textAlign: "center",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
            boxShadow: "inset 0 1px 0 var(--gx-highlight)",
          }}
        >
          <div
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: "0.18em",
              color: "var(--gx-text-3)",
              textTransform: "uppercase",
            }}
          >
            End of journey
          </div>
          <div
            className="serif"
            style={{
              fontSize: 24,
              marginTop: 10,
              letterSpacing: "-0.02em",
              lineHeight: 1.2,
              color: "var(--gx-text-1)",
            }}
          >
            That's the full Project Q tourist journey.
            <br />
            <span style={{ color: "var(--gx-gold-deep)" }}>
              {visibleSections.length} screens · 4 phases · one persona, end-to-end
            </span>
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--gx-text-2)",
              marginTop: 12,
              lineHeight: 1.5,
            }}
          >
            Every phone above is loaded as its own iframe — tap any button or pin and the click stays inside that frame.
          </div>
          <div
            style={{
              marginTop: 18,
              display: "flex",
              gap: 10,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <Link
              to="/p3/trip"
              style={{
                padding: "12px 22px",
                background: "linear-gradient(180deg, #fde7a3, #d4b87a)",
                color: "#3d2f12",
                borderRadius: 999,
                textDecoration: "none",
                fontWeight: 600,
                fontSize: 14,
                boxShadow: "0 0 20px rgba(241,216,150,0.4), inset 0 1px 0 rgba(255,255,255,0.55)",
              }}
            >
              Open the live demo →
            </Link>
            <Link
              to="/"
              style={{
                padding: "12px 22px",
                background: "transparent",
                color: "var(--gx-text-1)",
                borderRadius: 999,
                textDecoration: "none",
                fontWeight: 600,
                fontSize: 14,
                border: "1px solid var(--gx-border)",
              }}
            >
              All screens index
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
