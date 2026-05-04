type QCashSize = "xs" | "sm" | "md" | "lg" | "xl" | "xxl";

const sizes: Record<QCashSize, { coin: number; font: number; pad: string; gap: number }> = {
  xs: { coin: 12, font: 12, pad: "2px 6px 2px 4px", gap: 4 },
  sm: { coin: 14, font: 13, pad: "3px 8px 3px 5px", gap: 5 },
  md: { coin: 16, font: 15, pad: "4px 10px 4px 6px", gap: 6 },
  lg: { coin: 22, font: 22, pad: "6px 14px 6px 8px", gap: 8 },
  xl: { coin: 36, font: 44, pad: "10px 22px 10px 12px", gap: 12 },
  xxl: { coin: 56, font: 72, pad: "14px 28px 14px 18px", gap: 16 },
};

type Props = {
  amount: string | number;
  size?: QCashSize;
  style?: "solid" | "outline";
};

export function QCash({ amount, size = "md", style = "solid" }: Props) {
  const s = sizes[size];
  const isOutline = style === "outline";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: s.gap,
        background: isOutline ? "transparent" : "rgba(212,184,122,0.14)",
        border: isOutline ? "1px solid rgba(184,153,88,0.35)" : "1px solid rgba(184,153,88,0.25)",
        borderRadius: 999,
        padding: s.pad,
        fontFamily: "'Inter Tight', sans-serif",
        fontWeight: 600,
        fontSize: s.font,
        color: "#4a3a18",
        fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.01em",
      }}
    >
      <span
        style={{
          width: s.coin,
          height: s.coin,
          borderRadius: 999,
          background: "linear-gradient(135deg,#f1d896 0%,#d4b87a 50%,#b89958 100%)",
          boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.5)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Fraunces', serif",
          fontSize: s.coin * 0.62,
          color: "#4a3a18",
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        Q
      </span>
      <span>{amount}</span>
    </span>
  );
}
