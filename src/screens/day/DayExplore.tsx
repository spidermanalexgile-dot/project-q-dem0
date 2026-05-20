import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { StatusBar } from "../../components/StatusBar";
import { DayNav } from "./DayNav";
import { meshBackground, glassSurfaceMuted, glassText } from "../../components/glass/glassStyles";
import {
  dayTripperSpots,
  dayTripperVibes,
  vibeTypeMap,
  type DayTripperSpot,
  type DayTripperSpotType,
} from "../../data/dayTripper";
import { useDayTripper } from "../../context/DayTripperContext";

const typeLabel: Record<DayTripperSpotType, string> = {
  food: "Food",
  sight: "Sight",
  experience: "Experience",
  viewpoint: "Viewpoint",
  shopping: "Shop",
  transport: "Transport",
};

const typeGlyph: Record<DayTripperSpotType, string> = {
  food: "◆",
  sight: "▲",
  experience: "✦",
  viewpoint: "◉",
  shopping: "◇",
  transport: "↔",
};

export function DayExplore() {
  const navigate = useNavigate();
  const { vibe, setVibe, setSelectedSpotId } = useDayTripper();

  const visibleSpots = useMemo(() => {
    let list = [...dayTripperSpots];
    if (vibe) {
      const allowed = new Set(vibeTypeMap[vibe]);
      list = list.filter((s) => allowed.has(s.type));
    }
    return list.sort((a, b) => a.walkMinutesFromSanMarco - b.walkMinutesFromSanMarco);
  }, [vibe]);

  function navigateTo(spot: DayTripperSpot) {
    setSelectedSpotId(spot.id);
    navigate(`/day/map?spot=${spot.id}`);
  }

  function payAt(spot: DayTripperSpot) {
    setSelectedSpotId(spot.id);
    navigate("/day/pay");
  }

  return (
    <div className="phone-screen" style={{ ...meshBackground, color: glassText.primary }}>
      <StatusBar dark />
      <div
        className="no-scrollbar"
        style={{ height: "calc(100% - 44px)", overflowY: "auto", overflowX: "hidden", paddingBottom: 110 }}
      >
        <div style={{ padding: "12px 24px 0" }}>
          <div
            className="mono"
            style={{ fontSize: 10, letterSpacing: "0.2em", color: glassText.tertiary, textTransform: "uppercase" }}
          >
            Today near you
          </div>
          <h1
            className="serif"
            style={{
              fontSize: 28,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              fontWeight: 600,
              margin: "8px 0 4px",
            }}
          >
            {vibe ? vibe : "Closest to you first"}
          </h1>
          <div style={{ fontSize: 13, color: glassText.secondary }}>
            {visibleSpots.length} spots · walking distance from San Marco
          </div>
        </div>

        {/* Vibe filter row */}
        <div
          className="no-scrollbar"
          style={{
            display: "flex",
            gap: 8,
            overflowX: "auto",
            padding: "16px 24px 4px",
          }}
        >
          <VibeChip
            label="All"
            active={vibe === null}
            onClick={() => setVibe(null)}
          />
          {dayTripperVibes.map((v) => (
            <VibeChip key={v} label={v} active={vibe === v} onClick={() => setVibe(v)} />
          ))}
        </div>

        {/* Cards */}
        <div style={{ padding: "8px 24px 0", display: "flex", flexDirection: "column", gap: 10 }}>
          {visibleSpots.map((s) => (
            <SpotCard
              key={s.id}
              spot={s}
              onNavigate={() => navigateTo(s)}
              onPay={() => payAt(s)}
            />
          ))}
          {visibleSpots.length === 0 && (
            <div
              style={{
                padding: 28,
                textAlign: "center",
                color: glassText.tertiary,
                fontSize: 13,
              }}
            >
              No spots match. Try a different vibe.
            </div>
          )}
        </div>
      </div>
      <DayNav />
    </div>
  );
}

function VibeChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 14px",
        borderRadius: 999,
        border: active ? "1px solid rgba(241,216,150,0.6)" : "1px solid rgba(255,255,255,0.18)",
        background: active ? "rgba(241,216,150,0.18)" : "rgba(255,255,255,0.06)",
        color: active ? glassText.gold : glassText.primary,
        fontFamily: "'Inter Tight', sans-serif",
        fontWeight: 600,
        fontSize: 12,
        cursor: "pointer",
        whiteSpace: "nowrap",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      {label}
    </button>
  );
}

function SpotCard({
  spot,
  onNavigate,
  onPay,
}: {
  spot: DayTripperSpot;
  onNavigate: () => void;
  onPay: () => void;
}) {
  return (
    <div
      style={{
        ...glassSurfaceMuted,
        borderRadius: 16,
        padding: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "radial-gradient(circle at 35% 30%, rgba(241,216,150,0.4), rgba(212,184,122,0.15) 70%)",
            border: "1px solid rgba(241,216,150,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: glassText.gold,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          {typeGlyph[spot.type]}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              color: glassText.primary,
              fontWeight: 600,
              fontFamily: "'Inter Tight', sans-serif",
            }}
          >
            {spot.name}
          </div>
          <div
            className="mono"
            style={{
              fontSize: 10,
              color: glassText.tertiary,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginTop: 2,
            }}
          >
            {typeLabel[spot.type]} · {spot.walkMinutesFromSanMarco} min walk · {spot.qcashPriceRange}
          </div>
          <div style={{ fontSize: 12, color: glassText.secondary, marginTop: 6, lineHeight: 1.4 }}>
            {spot.blurb}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          onClick={onNavigate}
          style={{
            flex: 1,
            padding: "10px 14px",
            borderRadius: 999,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.06)",
            color: glassText.primary,
            fontFamily: "'Inter Tight', sans-serif",
            fontWeight: 600,
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Navigate
        </button>
        <button
          onClick={onPay}
          style={{
            flex: 1,
            padding: "10px 14px",
            borderRadius: 999,
            border: "1px solid rgba(241,216,150,0.5)",
            background: "linear-gradient(180deg, #fde7a3, #d4b87a)",
            color: "#3d2f12",
            fontFamily: "'Inter Tight', sans-serif",
            fontWeight: 700,
            fontSize: 12,
            cursor: "pointer",
            boxShadow: "0 0 14px rgba(241,216,150,0.35), inset 0 1px 0 rgba(255,255,255,0.5)",
          }}
        >
          Pay here
        </button>
      </div>
    </div>
  );
}
