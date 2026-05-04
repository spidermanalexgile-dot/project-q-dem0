import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  scale?: number;
};

/**
 * Just the iPhone bezel — no full-page wrapper. Use inside a parent layout
 * (like the walkthrough storyboard) where multiple phones stack/grid.
 * IOSFrame is the full-page version; this is the embeddable one.
 */
export function PhoneFrame({ children, scale = 1 }: Props) {
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
        {children}
      </div>
    </div>
  );
}
