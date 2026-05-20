import { NavLink } from "react-router-dom";
import { glassText } from "../../components/glass/glassStyles";

const items = [
  { to: "/day/wallet", label: "Wallet", icon: "◎" },
  { to: "/day/explore", label: "Explore", icon: "◇" },
  { to: "/day/map", label: "Map", icon: "◉" },
  { to: "/day/pay", label: "Pay", icon: "✦" },
  { to: "/day/recap", label: "Recap", icon: "▾" },
];

export function DayNav() {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: "10px 10px 22px",
        background: "rgba(3,16,12,0.78)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        zIndex: 95,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 4 }}>
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            style={({ isActive }) => ({
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              padding: "6px 0",
              textDecoration: "none",
              color: isActive ? glassText.gold : glassText.secondary,
              fontFamily: "'Inter Tight', sans-serif",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.02em",
            })}
          >
            {({ isActive }) => (
              <>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 14,
                    lineHeight: 1,
                    color: isActive ? glassText.gold : glassText.secondary,
                    textShadow: isActive ? "0 0 12px rgba(241,216,150,0.55)" : "none",
                  }}
                >
                  {it.icon}
                </span>
                <span>{it.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
