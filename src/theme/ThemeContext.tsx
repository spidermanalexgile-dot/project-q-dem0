import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";

export type Mode = "dark" | "light";

type ThemeCtx = {
  mode: Mode;
  setMode: (m: Mode) => void;
  toggle: () => void;
};

const Ctx = createContext<ThemeCtx>({
  mode: "dark",
  setMode: () => {},
  toggle: () => {},
});

const STORAGE_KEY = "q-mode";

function readInitial(): Mode {
  if (typeof window === "undefined") return "dark";
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* ignore */
  }
  return "dark";
}

function applyMode(mode: Mode) {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.mode = mode;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>(readInitial);

  // Apply on mount + whenever local state changes
  useEffect(() => {
    applyMode(mode);
  }, [mode]);

  // Cross-iframe + cross-tab sync via the storage event
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return;
      const v = e.newValue;
      if (v === "light" || v === "dark") setModeState(v);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setMode = useCallback((m: Mode) => {
    setModeState(m);
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    setMode(mode === "dark" ? "light" : "dark");
  }, [mode, setMode]);

  return <Ctx.Provider value={{ mode, setMode, toggle }}>{children}</Ctx.Provider>;
}

export function useThemeMode() {
  return useContext(Ctx);
}

/* ---------- UI: pill toggle --------------------------------------------- */

export function ThemeModeToggle() {
  const { mode, toggle } = useThemeMode();
  const isDark = mode === "dark";

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 14px",
        borderRadius: 999,
        border: "1px solid var(--gx-border)",
        background: "var(--gx-surface)",
        color: "var(--gx-text-1)",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        cursor: "pointer",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        boxShadow: "inset 0 1px 0 var(--gx-highlight)",
        transition: "all 240ms ease",
      }}
    >
      {/* Icon */}
      <span style={{ width: 14, height: 14, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        {isDark ? (
          // Moon
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M11.5 8.2 a4.5 4.5 0 1 1 -5.7 -5.7 a5 5 0 0 0 5.7 5.7 Z"
              fill="var(--gx-gold)"
              stroke="var(--gx-gold)"
              strokeWidth="0.5"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          // Sun
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="2.6" fill="var(--gx-gold)" />
            <g stroke="var(--gx-gold)" strokeWidth="1.2" strokeLinecap="round">
              <path d="M7 1 v1.6 M7 11.4 v1.6 M1 7 h1.6 M11.4 7 h1.6 M2.7 2.7 l1.1 1.1 M10.2 10.2 l1.1 1.1 M2.7 11.3 l1.1 -1.1 M10.2 3.8 l1.1 -1.1" />
            </g>
          </svg>
        )}
      </span>
      <span>{isDark ? "Dark" : "Light"}</span>
    </button>
  );
}
