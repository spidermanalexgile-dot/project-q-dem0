import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { StatusBar } from "../../components/StatusBar";
import { Icon } from "../../components/Icon";
import { payTransaction, qcash } from "../../data/demoData";
import { meshBackground, glassSurface, glassSurfaceMuted, glassText } from "../../components/glass/glassStyles";

function makeToken() {
  const r = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `qcash:${payTransaction.vendor.toLowerCase().replace(/\s+/g, "-")}:${payTransaction.amount.toFixed(2)}:${r}`;
}

export function Phase3PayGlass() {
  const navigate = useNavigate();
  const [token, setToken] = useState(() => makeToken());
  const [ttl, setTtl] = useState(payTransaction.ttlSeconds);
  const [status, setStatus] = useState<"idle" | "confirming" | "done">("idle");

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

  function confirm() {
    setStatus("confirming");
    setTimeout(() => setStatus("done"), 900);
    setTimeout(() => navigate("/p3/wallet"), 2200);
  }

  const after = (qcash.balance - payTransaction.amount).toFixed(2);

  return (
    <div className="phone-screen" style={{ ...meshBackground, color: glassText.primary }}>
      <StatusBar dark />

      <div style={{ padding: "20px 24px", height: "calc(100% - 44px)", display: "flex", flexDirection: "column", position: "relative" }}>
        <div
          style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", color: glassText.primary }}
          onClick={() => navigate(-1)}
        >
          <Icon.Close color={glassText.primary} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>Pay with QCash</span>
        </div>

        <div style={{ marginTop: 32, textAlign: "center" }}>
          <div
            className="mono"
            style={{ fontSize: 12, color: glassText.tertiary, letterSpacing: "0.1em", textTransform: "uppercase" }}
          >
            {payTransaction.vendor} · {payTransaction.pos}
          </div>

          {/* Big numeral with gold halo */}
          <div style={{ position: "relative", marginTop: 18, display: "inline-block" }}>
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
                fontSize: 86,
                fontWeight: 600,
                letterSpacing: "-0.04em",
                color: glassText.gold,
                lineHeight: 1,
                textShadow: "0 0 28px rgba(241,216,150,0.45), 0 1px 0 rgba(255,255,255,0.15)",
              }}
            >
              Q${payTransaction.amount.toFixed(2)}
            </div>
          </div>

          <div style={{ fontSize: 13, color: glassText.secondary, marginTop: 10 }}>{payTransaction.items}</div>
        </div>

        {/* QR in glass shell */}
        <div
          style={{
            ...glassSurface,
            alignSelf: "center",
            marginTop: 32,
            width: 232,
            height: 232,
            padding: 18,
            borderRadius: 24,
            position: "relative",
            transition: "opacity 200ms",
            opacity: status === "confirming" ? 0.4 : 1,
          }}
        >
          {status === "done" ? (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: 999,
                  background: "radial-gradient(circle at 35% 30%, #fde7a3 0%, #d4b87a 60%, #8a6a2a 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 0 40px rgba(241,216,150,0.7), inset 0 2px 0 rgba(255,255,255,0.5)",
                }}
              >
                <Icon.Check size={44} color="#fdfbf5" />
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
              <QRCodeSVG value={token} size={180} bgColor="transparent" fgColor="#0a1f1a" level="M" style={{ display: "block", margin: "0 auto" }} />
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%,-50%)",
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  background: "radial-gradient(circle at 35% 30%, #fde7a3 0%, #d4b87a 60%, #8a6a2a 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "'Fraunces', serif",
                  fontWeight: 700,
                  color: "#3d2f12",
                  boxShadow: "0 0 0 5px rgba(253,251,245,0.95), 0 0 16px rgba(241,216,150,0.5)",
                }}
              >
                Q
              </div>
            </div>
          )}
        </div>

        <div style={{ marginTop: "auto", paddingBottom: 20, textAlign: "center" }}>
          <div style={{ fontSize: 12, color: glassText.tertiary }}>
            {status === "done"
              ? "Paid · settled instantly"
              : `Single-use · expires in ${ttl}s · settles vendor instantly`}
          </div>

          <div
            style={{
              ...glassSurfaceMuted,
              marginTop: 16,
              padding: "14px 20px",
              borderRadius: 16,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ textAlign: "left" }}>
              <div
                className="mono"
                style={{ fontSize: 11, color: glassText.tertiary, letterSpacing: "0.1em", textTransform: "uppercase" }}
              >
                After this
              </div>
              <div className="serif" style={{ fontSize: 22, color: glassText.gold }}>
                Q${after} left
              </div>
            </div>
            <button
              onClick={confirm}
              disabled={status !== "idle"}
              style={{
                padding: "12px 20px",
                fontFamily: "'Inter Tight', sans-serif",
                fontWeight: 600,
                fontSize: 14,
                borderRadius: 999,
                border: "1px solid rgba(241,216,150,0.5)",
                background: "linear-gradient(180deg, #fde7a3, #d4b87a)",
                color: "#3d2f12",
                cursor: status === "idle" ? "pointer" : "default",
                boxShadow: "0 0 20px rgba(241,216,150,0.45), inset 0 1px 0 rgba(255,255,255,0.6)",
              }}
            >
              {status === "done" ? "Paid ✓" : status === "confirming" ? "…" : "Confirm pay"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
