import type { CSSProperties } from "react";

/** Shared glass aesthetic tokens — themed via CSS variables in index.css.
 *  The same objects work in both light and dark mode; switching is done by
 *  toggling [data-mode="light"] on the document element. */

export const meshBackground: CSSProperties = {
  background: `
    radial-gradient(ellipse 60% 40% at 78% 12%, var(--gx-bloom-1), transparent 60%),
    radial-gradient(ellipse 70% 50% at 18% 90%, var(--gx-bloom-2), transparent 60%),
    radial-gradient(ellipse 50% 60% at 50% 50%, var(--gx-bloom-3), transparent 70%),
    linear-gradient(180deg, var(--gx-bg-1) 0%, var(--gx-bg-2) 45%, var(--gx-bg-3) 100%)
  `,
  transition: "background 320ms ease",
};

export const glassSurface: CSSProperties = {
  background: "var(--gx-surface)",
  backdropFilter: "blur(24px) saturate(180%)",
  WebkitBackdropFilter: "blur(24px) saturate(180%)",
  border: "1px solid var(--gx-border)",
  boxShadow:
    "inset 0 1px 0 var(--gx-highlight), inset 0 -1px 0 var(--gx-highlight-bottom), 0 12px 40px var(--gx-shadow)",
  borderRadius: 22,
};

export const glassSurfaceMuted: CSSProperties = {
  background: "var(--gx-surface-muted)",
  backdropFilter: "blur(18px) saturate(140%)",
  WebkitBackdropFilter: "blur(18px) saturate(140%)",
  border: "1px solid var(--gx-border-muted)",
  boxShadow: "inset 0 1px 0 var(--gx-highlight)",
  borderRadius: 16,
};

export const goldBloom: CSSProperties = {
  background:
    "radial-gradient(circle, rgba(241,216,150,0.35) 0%, rgba(212,184,122,0.15) 40%, transparent 70%)",
  filter: "blur(8px)",
};

/** Text colors — string CSS values referencing the themed vars. */
export const glassText = {
  primary: "var(--gx-text-1)",
  secondary: "var(--gx-text-2)",
  tertiary: "var(--gx-text-3)",
  gold: "var(--gx-gold)",
  goldDeep: "var(--gx-gold-deep)",
};
