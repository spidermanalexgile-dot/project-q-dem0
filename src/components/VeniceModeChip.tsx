import { Link } from "react-router-dom";
import { useDestination } from "../context/DestinationContext";
import { glassText } from "./glass/glassStyles";

type Target = "day-tripper" | "multi-day";
type Variant = "floating" | "inline";

const LABEL: Record<Target, string> = {
  "day-tripper": "Day Tripper",
  "multi-day": "Multi-day",
};

const ROUTE: Record<Target, string> = {
  "day-tripper": "/day/welcome",
  "multi-day": "/p3/trip",
};

/**
 * Small "switch Venice mode" chip — visible only when destination is Venice.
 * `target` describes the mode the chip offers (i.e. the mode you switch TO).
 *
 * Variants:
 *   - "floating" (default): absolute pill in the top-right of the phone screen
 *   - "inline": fits next to other eyebrow / header text
 */
export function VeniceModeChip({
  target,
  variant = "floating",
  top = 52,
  right = 14,
}: {
  target: Target;
  variant?: Variant;
  top?: number;
  right?: number;
}) {
  const { destination } = useDestination();
  if (destination !== "venice") return null;

  const shared = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    border: "1px solid rgba(241,216,150,0.45)",
    background: "rgba(241,216,150,0.12)",
    color: glassText.gold,
    fontFamily: "'Inter Tight', sans-serif",
    fontWeight: 600,
    fontSize: 11,
    letterSpacing: "0.02em",
    textDecoration: "none",
    backdropFilter: "blur(20px) saturate(180%)",
    WebkitBackdropFilter: "blur(20px) saturate(180%)",
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.25), inset 0 0 12px rgba(241,216,150,0.15), 0 4px 12px rgba(0,0,0,0.35)",
  } as const;

  const inline = {
    ...shared,
    padding: "5px 10px",
    borderRadius: 999,
  };

  const floating = {
    ...shared,
    position: "absolute" as const,
    top,
    right,
    padding: "7px 12px",
    borderRadius: 999,
    zIndex: 96,
  };

  return (
    <Link to={ROUTE[target]} style={variant === "inline" ? inline : floating}>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: glassText.gold,
          boxShadow: "0 0 8px rgba(241,216,150,0.85)",
        }}
      />
      {LABEL[target]} →
    </Link>
  );
}
