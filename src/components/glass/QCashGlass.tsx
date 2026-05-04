type Size = "xs" | "sm" | "md" | "lg" | "xl" | "xxl";

const sizes: Record<Size, { coin: number; font: number; pad: string; gap: number }> = {
  xs: { coin: 12, font: 12, pad: "2px 8px 2px 4px", gap: 5 },
  sm: { coin: 14, font: 13, pad: "3px 10px 3px 5px", gap: 6 },
  md: { coin: 16, font: 15, pad: "4px 12px 4px 6px", gap: 7 },
  lg: { coin: 22, font: 22, pad: "6px 16px 6px 8px", gap: 9 },
  xl: { coin: 36, font: 44, pad: "10px 24px 10px 12px", gap: 14 },
  xxl: { coin: 56, font: 72, pad: "14px 32px 14px 18px", gap: 18 },
};

type Props = {
  amount: string | number;
  size?: Size;
  /** Use on dark backgrounds (default) vs light backgrounds */
  tone?: "dark" | "light";
};

/**
 * Glass capsule QCash pill — translucent capsule, gold core glowing through.
 * Designed for dark mesh backgrounds where backdrop-blur has something to blur.
 */
export function QCashGlass({ amount, size = "md", tone = "dark" }: Props) {
  const s = sizes[size];
  const onDark = tone === "dark";
  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        gap: s.gap,
        background: onDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.55)",
        border: onDark ? "1px solid rgba(255,255,255,0.18)" : "1px solid rgba(255,255,255,0.7)",
        borderRadius: 999,
        padding: s.pad,
        fontFamily: "'Inter Tight', sans-serif",
        fontWeight: 600,
        fontSize: s.font,
        color: onDark ? "#f1d896" : "#3d2f12",
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.01em",
        backdropFilter: "blur(16px) saturate(160%)",
        WebkitBackdropFilter: "blur(16px) saturate(160%)",
        boxShadow: onDark
          ? "inset 0 1px 0 rgba(255,255,255,0.25), 0 1px 2px rgba(0,0,0,0.25)"
          : "inset 0 1px 0 rgba(255,255,255,0.8), 0 1px 2px rgba(0,0,0,0.08)",
      }}
    >
      <span
        style={{
          position: "relative",
          width: s.coin,
          height: s.coin,
          borderRadius: 999,
          background: "radial-gradient(circle at 35% 30%, #fde7a3 0%, #d4b87a 50%, #8a6a2a 100%)",
          boxShadow: `
            inset 0 0 0 1px rgba(255,255,255,0.4),
            inset 0 1px 0 rgba(255,255,255,0.6),
            0 0 ${Math.max(8, s.coin * 0.6)}px rgba(241,216,150,0.55)
          `,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Fraunces', serif",
          fontSize: s.coin * 0.62,
          color: "#3d2f12",
          fontWeight: 700,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        Q
      </span>
      <span>{amount}</span>
    </span>
  );
}
