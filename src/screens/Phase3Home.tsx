import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { StatusBar } from "../components/StatusBar";
import { Icon } from "../components/Icon";
import { QCash } from "../components/QCash";
import { useDemoData, type ChatMessage } from "../data/demoData";

export function Phase3Home() {
  const navigate = useNavigate();
  const { initialChat, cannedReplies, qcash, destinationName } = useDemoData();
  const [messages, setMessages] = useState<ChatMessage[]>(initialChat);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  // Reset chat when destination switches so the persona/copy stays consistent.
  useEffect(() => {
    setMessages(initialChat);
  }, [initialChat]);

  function send() {
    if (!input.trim()) return;
    const userMsg: ChatMessage = { id: `u${Date.now()}`, from: "user", text: input.trim() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setIsTyping(true);
    setTimeout(() => {
      const reply = cannedReplies[Math.floor(Math.random() * cannedReplies.length)];
      setIsTyping(false);
      setMessages((m) => [...m, { id: `q${Date.now()}`, from: "q", text: reply }]);
    }, 1200 + Math.random() * 800);
  }

  return (
    <div className="phone-screen" style={{ background: "#f7f4ec" }}>
      <StatusBar />

      {/* Header */}
      <div style={{ padding: "6px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              background: "linear-gradient(135deg,#f1d896,#b89958)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "'Fraunces', serif",
              fontSize: 14,
              fontWeight: 700,
              color: "#4a3a18",
            }}
          >
            Q
          </span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Ask Q · {destinationName}</div>
            <div style={{ fontSize: 10, color: "#3d7a5a", display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: "#3d7a5a" }} />
              Live · knows your trip
            </div>
          </div>
        </div>
        <Link to="/p3/wallet" style={{ textDecoration: "none" }}>
          <QCash amount={qcash.balance} size="sm" />
        </Link>
      </div>

      {/* Chat scroll */}
      <div
        ref={scrollRef}
        className="no-scrollbar"
        style={{ padding: "14px 20px 90px", overflow: "auto", height: "calc(100% - 130px)" }}
      >
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              display: "flex",
              justifyContent: m.from === "q" ? "flex-start" : "flex-end",
              marginBottom: 10,
            }}
          >
            <div
              style={{
                maxWidth: "82%",
                padding: "10px 14px",
                borderRadius: m.from === "q" ? "4px 16px 16px 16px" : "16px 4px 16px 16px",
                background: m.from === "q" ? "#fff" : "#0a4d3c",
                color: m.from === "q" ? "#14241f" : "#fdfbf5",
                fontSize: 14,
                lineHeight: 1.4,
                border: m.from === "q" ? "1px solid #efe9d9" : "none",
              }}
            >
              {m.text}
            </div>
          </div>
        ))}

        {/* Plan card (rendered when message has plan) */}
        {messages.map(
          (m) =>
            m.plan && (
              <div
                key={`plan-${m.id}`}
                className="slidefade"
                style={{ background: "#fff", border: "1px solid #efe9d9", borderRadius: 16, padding: 14, marginTop: 4, marginBottom: 12 }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div className="serif" style={{ fontSize: 17, letterSpacing: "-0.01em" }}>{m.plan.title}</div>
                  <span className="mono" style={{ fontSize: 11, color: "#8a948f" }}>{m.plan.meta}</span>
                </div>
                {m.plan.stops.map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, marginTop: 10, padding: "8px 0", borderTop: i ? "1px solid #f3eedd" : "none" }}>
                    <div className="mono" style={{ width: 44, fontSize: 11, color: "#8a948f", paddingTop: 2 }}>{s.time}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: "#4d5a55", marginTop: 1 }}>{s.note}</div>
                    </div>
                    <QCash amount={s.q} size="xs" />
                  </div>
                ))}
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1, fontSize: 13, padding: "10px" }}
                    onClick={() => navigate("/p3/map")}
                  >
                    Add to my day
                  </button>
                  <button className="btn btn-ghost" style={{ fontSize: 13, padding: "10px 14px" }}>Tweak</button>
                </div>
              </div>
            )
        )}

        {isTyping && (
          <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 10 }}>
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "4px 16px 16px 16px",
                background: "#fff",
                border: "1px solid #efe9d9",
                display: "flex",
                gap: 4,
                alignItems: "center",
              }}
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: "#8a948f",
                    animation: `bounce 1.2s ${i * 0.15}s infinite ease-in-out`,
                  }}
                />
              ))}
              <style>{`@keyframes bounce { 0%, 80%, 100% { transform: translateY(0); opacity: 0.5; } 40% { transform: translateY(-3px); opacity: 1; } }`}</style>
            </div>
          </div>
        )}
      </div>

      {/* Composer + bottom nav */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "10px 16px 28px",
          background: "linear-gradient(to top, #f7f4ec 70%, transparent)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#fff",
            border: "1px solid #e7e0cf",
            borderRadius: 999,
            padding: "6px 6px 6px 16px",
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ask Q anything…"
            style={{ flex: 1, border: 0, outline: 0, fontSize: 14, fontFamily: "inherit", background: "transparent" }}
          />
          <button
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              border: 0,
              background: "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <Icon.Mic />
          </button>
          <button
            onClick={send}
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              border: 0,
              background: "#0a4d3c",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <Icon.Send />
          </button>
        </div>
        <BottomNav active="home" />
      </div>
    </div>
  );
}

export function BottomNav({ active }: { active: "home" | "map" | "wallet" | "trip" }) {
  const items = [
    { key: "home", to: "/p3/home", icon: Icon.Home, label: "Ask Q" },
    { key: "map", to: "/p3/map", icon: Icon.Map, label: "Map" },
    { key: "wallet", to: "/p3/wallet", icon: Icon.Wallet, label: "Wallet" },
    { key: "trip", to: "/p3/trip", icon: Icon.Trip, label: "Trip" },
  ] as const;
  return (
    <div style={{ display: "flex", justifyContent: "space-around", marginTop: 14, fontSize: 10, color: "#4d5a55" }}>
      {items.map((it) => {
        const isActive = it.key === active;
        const color = isActive ? "#0a4d3c" : "#4d5a55";
        return (
          <Link
            key={it.key}
            to={it.to}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              color,
              fontWeight: isActive ? 600 : 400,
              textDecoration: "none",
            }}
          >
            <it.icon color={color} />
            {it.label}
          </Link>
        );
      })}
    </div>
  );
}
