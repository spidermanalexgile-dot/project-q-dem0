import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { StatusBar } from "../components/StatusBar";
import { Icon } from "../components/Icon";
import { useFadeUpOnView } from "../components/useFadeUpOnView";
import {
  meshBackground,
  glassSurface,
  glassSurfaceMuted,
  glassText,
} from "../components/glass/glassStyles";
import {
  todayPlan,
  tomorrowPreview,
  tripProgress,
  nowSnapshot,
  qcash,
  payTransaction,
  type TripDayItem,
} from "../data/demoData";

/* ---------- Trip page ---------- */

export function Phase3Trip() {
  const [paySheetOpen, setPaySheetOpen] = useState(false);

  return (
    <div className="phone-screen" style={{ ...meshBackground, color: glassText.primary }}>
      <StatusBar dark />

      <div
        className="no-scrollbar"
        style={{ height: "calc(100% - 44px)", overflowY: "auto", overflowX: "hidden" }}
      >
        <div style={{ padding: "10px 22px 140px", display: "flex", flexDirection: "column", gap: 18 }}>
          <Eyebrow />
          <NowCard />
          <TodaySection />
          <QCashTodayCard onShowPay={() => setPaySheetOpen(true)} />
          <TomorrowAccordion />
          <TripProgressAccordion />
          <EndTripDemoCard />
          <Footer />
        </div>
      </div>

      <FloatingAskQ />
      {paySheetOpen && <PaySheet onClose={() => setPaySheetOpen(false)} />}
    </div>
  );
}

/* ---------- Eyebrow ---------- */

function Eyebrow() {
  return (
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
        Trip · Day {tripProgress.dayNumber} of {tripProgress.totalDays}
      </div>
      <div
        className="mono"
        style={{ fontSize: 10, letterSpacing: "0.14em", color: glassText.gold, display: "flex", alignItems: "center", gap: 6 }}
      >
        <span style={{ width: 6, height: 6, borderRadius: 999, background: glassText.gold, boxShadow: "0 0 8px rgba(241,216,150,0.8)" }} />
        QUEENSTOWN
      </div>
    </div>
  );
}

/* ---------- Now card ---------- */

function NowCard() {
  const { ref, style: fade } = useFadeUpOnView<HTMLDivElement>();
  const navigate = useNavigate();
  return (
    <div ref={ref} style={fade}>
      <div
        style={{
          ...glassSurface,
          padding: "22px 22px 20px",
          borderRadius: 24,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <TopHighlight />
        {/* subtle gold bloom */}
        <div
          style={{
            position: "absolute",
            top: -50,
            right: -40,
            width: 200,
            height: 200,
            borderRadius: 999,
            background: "radial-gradient(circle, rgba(241,216,150,0.32), transparent 70%)",
            filter: "blur(10px)",
            pointerEvents: "none",
          }}
        />

        <div
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: "0.16em",
            color: glassText.tertiary,
            textTransform: "uppercase",
            position: "relative",
          }}
        >
          Right now
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 10,
            marginTop: 8,
            position: "relative",
          }}
        >
          <span
            className="serif"
            style={{
              fontSize: 38,
              fontWeight: 600,
              letterSpacing: "-0.03em",
              color: glassText.primary,
              lineHeight: 1,
            }}
          >
            {nowSnapshot.time}
          </span>
          <span style={{ fontSize: 13, color: glassText.secondary }}>
            {nowSnapshot.location} · {nowSnapshot.weatherLabel}
          </span>
        </div>

        <div
          style={{
            marginTop: 18,
            paddingTop: 16,
            borderTop: "1px solid rgba(255,255,255,0.1)",
            position: "relative",
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
            Up next
          </div>
          <div
            className="serif"
            style={{
              fontSize: 26,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: glassText.primary,
              marginTop: 6,
              lineHeight: 1.15,
            }}
          >
            {nowSnapshot.upNext.name}
          </div>
          <div style={{ fontSize: 13, color: glassText.secondary, marginTop: 4 }}>
            {nowSnapshot.upNext.when} · {nowSnapshot.upNext.walkMinutes} min walk · Q${nowSnapshot.upNext.qcash}
          </div>

          <button
            onClick={() => navigate(`/p3/map?pin=${nowSnapshot.upNext.pinId}`)}
            style={{
              marginTop: 18,
              width: "100%",
              padding: "16px 22px",
              borderRadius: 999,
              border: "1px solid rgba(241,216,150,0.5)",
              background: "linear-gradient(180deg, #fde7a3, #d4b87a)",
              color: "#3d2f12",
              fontFamily: "'Inter Tight', sans-serif",
              fontWeight: 600,
              fontSize: 16,
              cursor: "pointer",
              boxShadow:
                "0 0 24px rgba(241,216,150,0.45), inset 0 1px 0 rgba(255,255,255,0.6)",
            }}
          >
            Start walking
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Today section ---------- */

function TodaySection() {
  const { ref, style: fade } = useFadeUpOnView<HTMLDivElement>();
  // Auto-expand the "next" item by default for a guided feel.
  const initialExpanded = todayPlan.find((i) => i.status === "next")?.id ?? null;
  const [expandedId, setExpandedId] = useState<string | null>(initialExpanded);

  return (
    <div ref={ref} style={fade}>
      <SectionHeading label="Today" sub="5 stops · weather-aware" />
      <div
        style={{
          ...glassSurfaceMuted,
          padding: "4px 0",
          borderRadius: 18,
        }}
      >
        {todayPlan.map((item, i) => (
          <TimelineRow
            key={item.id}
            item={item}
            isLast={i === todayPlan.length - 1}
            expanded={expandedId === item.id}
            onToggle={() =>
              setExpandedId((cur) => (cur === item.id ? null : item.id))
            }
          />
        ))}
      </div>
    </div>
  );
}

function TimelineRow({
  item,
  isLast,
  expanded,
  onToggle,
}: {
  item: TripDayItem;
  isLast: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isDone = item.status === "done";
  const isNext = item.status === "next";
  const isOptional = item.status === "optional";

  // Color treatment per status
  const dotColor = isDone
    ? "rgba(125,212,163,0.8)"
    : isNext
    ? glassText.gold
    : isOptional
    ? "rgba(255,255,255,0.3)"
    : "rgba(255,255,255,0.5)";

  const titleColor = isDone ? glassText.tertiary : glassText.primary;

  return (
    <div
      style={{
        padding: "14px 18px",
        borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.06)",
        cursor: isDone ? "default" : "pointer",
      }}
      onClick={() => !isDone && onToggle()}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        {/* Time + dot column */}
        <div style={{ width: 50, flexShrink: 0, position: "relative" }}>
          <div
            className="mono tnum"
            style={{
              fontSize: 11,
              color: isDone ? glassText.tertiary : glassText.secondary,
              letterSpacing: "0.04em",
            }}
          >
            {item.time}
          </div>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: dotColor,
              marginTop: 6,
              boxShadow: isNext ? "0 0 10px rgba(241,216,150,0.7)" : "none",
            }}
          />
        </div>

        {/* Body */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              className="serif"
              style={{
                fontSize: 17,
                letterSpacing: "-0.01em",
                color: titleColor,
                textDecoration: isDone ? "line-through" : "none",
                textDecorationColor: isDone ? "rgba(255,255,255,0.25)" : undefined,
                lineHeight: 1.2,
              }}
            >
              {item.name}
            </div>
            {isNext && (
              <span
                className="mono"
                style={{
                  fontSize: 9,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "#3d2f12",
                  background: glassText.gold,
                  padding: "2px 8px",
                  borderRadius: 999,
                  fontWeight: 600,
                }}
              >
                NEXT
              </span>
            )}
            {isDone && <Icon.Check size={14} color="rgba(125,212,163,0.9)" />}
          </div>
          <div
            style={{
              fontSize: 12,
              color: glassText.tertiary,
              marginTop: 2,
            }}
          >
            {item.short}
          </div>

          {/* Expandable body */}
          <div
            style={{
              maxHeight: expanded ? 200 : 0,
              opacity: expanded ? 1 : 0,
              overflow: "hidden",
              transition: "max-height 320ms ease, opacity 220ms ease 80ms",
            }}
          >
            <div style={{ paddingTop: 12 }}>
              <div style={{ fontSize: 13, color: glassText.secondary, lineHeight: 1.5 }}>
                {item.long}
              </div>
              {item.action && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    /* purely demo — no nav for non-walk actions */
                  }}
                  style={{
                    marginTop: 12,
                    padding: "10px 16px",
                    borderRadius: 999,
                    border: "1px solid rgba(255,255,255,0.18)",
                    background: "rgba(255,255,255,0.06)",
                    color: glassText.primary,
                    fontFamily: "'Inter Tight', sans-serif",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: "pointer",
                    backdropFilter: "blur(10px)",
                    WebkitBackdropFilter: "blur(10px)",
                  }}
                >
                  {item.action}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right meta — only shown when not expanded, to avoid clutter */}
        {!expanded && (
          <div style={{ flexShrink: 0, alignSelf: "center", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
            {item.qcash !== undefined && (
              <span
                className="mono tnum"
                style={{
                  fontSize: 11,
                  color: isDone ? glassText.tertiary : glassText.gold,
                  fontWeight: 600,
                }}
              >
                Q${item.qcash}
              </span>
            )}
            {item.walkMinutes !== undefined && (
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  color: glassText.tertiary,
                  letterSpacing: "0.06em",
                }}
              >
                {item.walkMinutes}m
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- QCash today ---------- */

function QCashTodayCard({ onShowPay }: { onShowPay: () => void }) {
  const { ref, style: fade } = useFadeUpOnView<HTMLDivElement>();
  const navigate = useNavigate();
  return (
    <div ref={ref} style={fade}>
      <SectionHeading label="Your QCash today" />
      <div
        style={{
          ...glassSurface,
          padding: "24px 22px",
          borderRadius: 24,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <TopHighlight />
        {/* gold bloom centered */}
        <div
          style={{
            position: "absolute",
            top: -40,
            left: "50%",
            transform: "translateX(-50%)",
            width: 240,
            height: 200,
            background: "radial-gradient(ellipse, rgba(241,216,150,0.32), transparent 70%)",
            filter: "blur(14px)",
            pointerEvents: "none",
          }}
        />

        <div style={{ position: "relative", textAlign: "center" }}>
          <button
            onClick={() => navigate("/p3/wallet")}
            style={{
              background: "transparent",
              border: 0,
              padding: 0,
              cursor: "pointer",
              fontFamily: "inherit",
              color: "inherit",
            }}
            aria-label="Open wallet"
          >
            <div style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
              <span
                className="serif"
                style={{ fontSize: 24, color: glassText.goldDeep, fontWeight: 600 }}
              >
                Q$
              </span>
              <span
                className="serif tnum"
                style={{
                  fontSize: 88,
                  fontWeight: 600,
                  letterSpacing: "-0.04em",
                  color: glassText.gold,
                  lineHeight: 1,
                  textShadow: "0 0 30px rgba(241,216,150,0.5), 0 1px 0 rgba(255,255,255,0.15)",
                }}
              >
                {qcash.balance}
              </span>
            </div>
          </button>

          <div
            style={{
              fontSize: 14,
              color: glassText.secondary,
              marginTop: 10,
              lineHeight: 1.5,
              maxWidth: 280,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            to spend today. Pay anywhere with the gold pill.
          </div>

          <button
            onClick={onShowPay}
            style={{
              marginTop: 20,
              padding: "13px 24px",
              borderRadius: 999,
              border: "1px solid rgba(241,216,150,0.45)",
              background: "rgba(255,255,255,0.06)",
              color: glassText.gold,
              fontFamily: "'Inter Tight', sans-serif",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.25), inset 0 0 18px rgba(241,216,150,0.18), 0 4px 14px rgba(0,0,0,0.25)",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: glassText.gold,
                boxShadow: "0 0 10px rgba(241,216,150,0.85)",
              }}
            />
            Show pay code
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Tomorrow accordion ---------- */

function TomorrowAccordion() {
  const { ref, style: fade } = useFadeUpOnView<HTMLDivElement>();
  const [open, setOpen] = useState(false);
  return (
    <div ref={ref} style={fade}>
      <Accordion
        eyebrow="Tomorrow"
        title={tomorrowPreview.headline}
        sub={tomorrowPreview.date}
        open={open}
        onToggle={() => setOpen((o) => !o)}
      >
        <div style={{ fontSize: 13, color: glassText.secondary, lineHeight: 1.5 }}>
          {tomorrowPreview.detail}
        </div>
        <div
          style={{
            marginTop: 12,
            display: "flex",
            gap: 14,
            fontSize: 12,
            color: glassText.tertiary,
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          <span>{tomorrowPreview.walkMinutes}m walk</span>
          <span>Q${tomorrowPreview.qcash} applied</span>
          <span style={{ color: glassText.gold }}>1.5×</span>
        </div>
      </Accordion>
    </div>
  );
}

/* ---------- Trip progress accordion ---------- */

function TripProgressAccordion() {
  const { ref, style: fade } = useFadeUpOnView<HTMLDivElement>();
  const [open, setOpen] = useState(false);
  const segments = Array.from({ length: tripProgress.totalDays }, (_, i) => i + 1);
  return (
    <div ref={ref} style={fade}>
      <Accordion
        eyebrow="The rest of your trip"
        title={`Day ${tripProgress.dayNumber} of ${tripProgress.totalDays}`}
        sub={`${tripProgress.daysLeft} days left in Queenstown`}
        open={open}
        onToggle={() => setOpen((o) => !o)}
      >
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          {segments.map((d) => {
            const done = d < tripProgress.dayNumber;
            const today = d === tripProgress.dayNumber;
            return (
              <div
                key={d}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 2,
                  background: done
                    ? "rgba(125,212,163,0.55)"
                    : today
                    ? glassText.gold
                    : "rgba(255,255,255,0.12)",
                  boxShadow: today ? "0 0 8px rgba(241,216,150,0.5)" : "none",
                }}
              />
            );
          })}
        </div>
        <div style={{ fontSize: 13, color: glassText.secondary, lineHeight: 1.5, marginTop: 14 }}>
          {tripProgress.message}
        </div>
      </Accordion>
    </div>
  );
}

/* ---------- End Trip (demo affordance) ---------- */

function EndTripDemoCard() {
  const navigate = useNavigate();
  const { ref, style: fade } = useFadeUpOnView<HTMLDivElement>();
  return (
    <div ref={ref} style={fade}>
      <div
        style={{
          ...glassSurfaceMuted,
          padding: "18px 20px",
          borderRadius: 18,
          display: "flex",
          alignItems: "center",
          gap: 14,
          border: "1px dashed rgba(241,216,150,0.35)",
          position: "relative",
        }}
      >
        <span
          className="mono"
          style={{
            position: "absolute",
            top: -8,
            left: 16,
            fontSize: 9,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#3d2f12",
            background: "linear-gradient(180deg, #fde7a3, #d4b87a)",
            padding: "2px 8px",
            borderRadius: 999,
            fontWeight: 600,
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55)",
          }}
        >
          Demo
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="serif"
            style={{
              fontSize: 17,
              letterSpacing: "-0.01em",
              color: glassText.primary,
              lineHeight: 1.2,
            }}
          >
            End trip
          </div>
          <div
            style={{
              fontSize: 12,
              color: glassText.tertiary,
              marginTop: 3,
              lineHeight: 1.4,
            }}
          >
            Skip ahead to the Phase 4 departure flow — trip summary, memory film, come-back offer.
          </div>
        </div>

        <button
          onClick={() => navigate("/p4/summary")}
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
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
          }}
        >
          End trip →
        </button>
      </div>
    </div>
  );
}

/* ---------- Footer ---------- */

function Footer() {
  return (
    <div
      style={{
        textAlign: "center",
        fontSize: 11,
        color: glassText.tertiary,
        fontFamily: "'JetBrains Mono', monospace",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        marginTop: 8,
      }}
    >
      That's everything · scroll back any time
    </div>
  );
}

/* ---------- Helpers ---------- */

function SectionHeading({ label, sub }: { label: string; sub?: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        marginBottom: 10,
        padding: "0 4px",
      }}
    >
      <h2
        className="serif"
        style={{
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: glassText.primary,
          margin: 0,
        }}
      >
        {label}
      </h2>
      {sub && (
        <span
          className="mono"
          style={{
            fontSize: 10,
            color: glassText.tertiary,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          {sub}
        </span>
      )}
    </div>
  );
}

function TopHighlight() {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: "8%",
        right: "8%",
        height: 1,
        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)",
        pointerEvents: "none",
      }}
    />
  );
}

function Accordion({
  eyebrow,
  title,
  sub,
  open,
  onToggle,
  children,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        ...glassSurface,
        borderRadius: 22,
        overflow: "hidden",
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          padding: "20px 22px",
          background: "transparent",
          border: 0,
          color: "inherit",
          textAlign: "left",
          cursor: "pointer",
          fontFamily: "inherit",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: "0.18em",
              color: glassText.tertiary,
              textTransform: "uppercase",
            }}
          >
            {eyebrow}
          </div>
          <div
            className="serif"
            style={{
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: glassText.primary,
              marginTop: 4,
              lineHeight: 1.2,
            }}
          >
            {title}
          </div>
          {sub && (
            <div style={{ fontSize: 12, color: glassText.tertiary, marginTop: 3 }}>{sub}</div>
          )}
        </div>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "transform 220ms ease",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 4 L6 8 L10 4" stroke={glassText.secondary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>

      <div
        style={{
          maxHeight: open ? 400 : 0,
          opacity: open ? 1 : 0,
          overflow: "hidden",
          transition: "max-height 320ms ease, opacity 220ms ease 60ms",
        }}
      >
        <div
          style={{
            padding: "0 22px 22px",
            borderTop: open ? "1px solid rgba(255,255,255,0.08)" : "none",
            paddingTop: open ? 16 : 0,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/* ---------- Floating Ask Q ---------- */

function FloatingAskQ() {
  return (
    <Link
      to="/p3/home"
      style={{
        position: "absolute",
        bottom: 24,
        right: 18,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 16px 10px 12px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.18)",
        color: glassText.primary,
        textDecoration: "none",
        fontFamily: "'Inter Tight', sans-serif",
        fontWeight: 600,
        fontSize: 13,
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.25), 0 8px 24px rgba(0,0,0,0.35)",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: glassText.gold,
          boxShadow: "0 0 10px rgba(241,216,150,0.9)",
        }}
      />
      Ask Q
    </Link>
  );
}

/* ---------- Pay sheet (modal) ---------- */

function makeToken() {
  const r = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `qcash:${payTransaction.vendor.toLowerCase().replace(/\s+/g, "-")}:${payTransaction.amount.toFixed(2)}:${r}`;
}

function PaySheet({ onClose }: { onClose: () => void }) {
  const [token, setToken] = useState(() => makeToken());
  const [ttl, setTtl] = useState(payTransaction.ttlSeconds);
  const [status, setStatus] = useState<"idle" | "confirming" | "done">("idle");
  const [mounted, setMounted] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // animate-in next frame
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (status !== "idle") return;
    const id = setInterval(() => {
      setTtl((t) => {
        if (t <= 1) {
          setToken(makeToken());
          return payTransaction.ttlSeconds;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [status]);

  function dismiss() {
    setMounted(false);
    setTimeout(onClose, 260);
  }

  function confirm() {
    setStatus("confirming");
    setTimeout(() => setStatus("done"), 900);
    setTimeout(dismiss, 1700);
  }

  const after = (qcash.balance - payTransaction.amount).toFixed(2);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      {/* Backdrop */}
      <div
        onClick={dismiss}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(3,16,12,0.55)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          opacity: mounted ? 1 : 0,
          transition: "opacity 240ms ease",
        }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        style={{
          position: "relative",
          width: "100%",
          maxHeight: "92%",
          borderRadius: "28px 28px 0 0",
          ...meshBackground,
          color: glassText.primary,
          padding: "16px 22px 28px",
          transform: mounted ? "translateY(0)" : "translateY(100%)",
          transition: "transform 280ms cubic-bezier(0.22, 1, 0.36, 1)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderBottom: 0,
          boxShadow: "0 -20px 60px rgba(0,0,0,0.5)",
          overflow: "hidden",
        }}
      >
        {/* Drag handle */}
        <div
          style={{
            width: 40,
            height: 4,
            borderRadius: 999,
            background: "rgba(255,255,255,0.25)",
            margin: "0 auto 10px",
          }}
        />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: glassText.tertiary,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            Pay with QCash
          </div>
          <button
            onClick={dismiss}
            aria-label="Close"
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.06)",
              color: glassText.primary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <Icon.Close color={glassText.primary} size={16} />
          </button>
        </div>

        <div style={{ marginTop: 10, textAlign: "center" }}>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: glassText.tertiary,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            {payTransaction.vendor} · {payTransaction.pos}
          </div>
          <div style={{ position: "relative", marginTop: 12, display: "inline-block" }}>
            <div
              style={{
                position: "absolute",
                inset: -24,
                background: "radial-gradient(circle, rgba(241,216,150,0.28) 0%, transparent 65%)",
                filter: "blur(14px)",
                pointerEvents: "none",
              }}
            />
            <div
              className="serif tnum"
              style={{
                position: "relative",
                fontSize: 64,
                fontWeight: 600,
                letterSpacing: "-0.04em",
                color: glassText.gold,
                lineHeight: 1,
                textShadow: "0 0 24px rgba(241,216,150,0.4)",
              }}
            >
              Q${payTransaction.amount.toFixed(2)}
            </div>
          </div>
          <div style={{ fontSize: 12, color: glassText.secondary, marginTop: 8 }}>
            {payTransaction.items}
          </div>
        </div>

        {/* QR */}
        <div
          style={{
            ...glassSurface,
            alignSelf: "center",
            margin: "20px auto 0",
            width: 200,
            height: 200,
            padding: 14,
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
                  width: 72,
                  height: 72,
                  borderRadius: 999,
                  background:
                    "radial-gradient(circle at 35% 30%, #fde7a3 0%, #d4b87a 60%, #8a6a2a 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow:
                    "0 0 30px rgba(241,216,150,0.7), inset 0 2px 0 rgba(255,255,255,0.5)",
                }}
              >
                <Icon.Check size={38} color="#fdfbf5" />
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
              }}
            >
              <QRCodeSVG
                value={token}
                size={156}
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
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  background:
                    "radial-gradient(circle at 35% 30%, #fde7a3 0%, #d4b87a 60%, #8a6a2a 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "'Fraunces', serif",
                  fontWeight: 700,
                  color: "#3d2f12",
                  boxShadow:
                    "0 0 0 4px rgba(253,251,245,0.95), 0 0 14px rgba(241,216,150,0.5)",
                }}
              >
                Q
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            fontSize: 11,
            color: glassText.tertiary,
            textAlign: "center",
            marginTop: 12,
          }}
        >
          {status === "done"
            ? "Paid · settled instantly"
            : `Single-use · expires in ${ttl}s · settles vendor instantly`}
        </div>

        <div
          style={{
            ...glassSurfaceMuted,
            marginTop: 14,
            padding: "12px 18px",
            borderRadius: 16,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div
              className="mono"
              style={{
                fontSize: 10,
                color: glassText.tertiary,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
              }}
            >
              After this
            </div>
            <div className="serif" style={{ fontSize: 20, color: glassText.gold }}>
              Q${after} left
            </div>
          </div>
          <button
            onClick={confirm}
            disabled={status !== "idle"}
            style={{
              padding: "11px 18px",
              fontFamily: "'Inter Tight', sans-serif",
              fontWeight: 600,
              fontSize: 13,
              borderRadius: 999,
              border: "1px solid rgba(241,216,150,0.5)",
              background: "linear-gradient(180deg, #fde7a3, #d4b87a)",
              color: "#3d2f12",
              cursor: status === "idle" ? "pointer" : "default",
              boxShadow:
                "0 0 18px rgba(241,216,150,0.45), inset 0 1px 0 rgba(255,255,255,0.6)",
            }}
          >
            {status === "done" ? "Paid ✓" : status === "confirming" ? "…" : "Confirm pay"}
          </button>
        </div>
      </div>
    </div>
  );
}
