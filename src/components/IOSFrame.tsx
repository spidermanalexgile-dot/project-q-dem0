import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Background outside the frame */
  pageBg?: string;
};

/**
 * iPhone bezel — 393x852 reference frame from the design bundle.
 * The screen content fills the inner area; status bar is included by the screen.
 */
export function IOSFrame({ children, pageBg = "#1a1a1a" }: Props) {
  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background: pageBg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        style={{
          width: 393,
          height: 852,
          background: "#000",
          borderRadius: 54,
          padding: 12,
          position: "relative",
          boxShadow: "0 30px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08) inset",
          flexShrink: 0,
        }}
      >
        {/* Inner screen */}
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 42,
            overflow: "hidden",
            background: "var(--q-paper)",
            position: "relative",
          }}
        >
          {/* Dynamic Island */}
          <div
            style={{
              position: "absolute",
              top: 10,
              left: "50%",
              transform: "translateX(-50%)",
              width: 120,
              height: 32,
              background: "#000",
              borderRadius: 999,
              zIndex: 100,
              pointerEvents: "none",
            }}
          />
          {children}
        </div>
      </div>
    </div>
  );
}
