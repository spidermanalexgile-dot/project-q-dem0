import { useEffect, useState } from "react";
import { TopBar } from "./TopBar";
import { CurvePanel } from "./CurvePanel";
import { RevenuePanel } from "./RevenuePanel";
import { LeversPanel } from "./LeversPanel";
import { installGlobalApi, loadPayload, loadBundle, getState } from "./state";
import { startSync } from "./sync";
import { initServerVoice } from "./speech";
import { PAYLOAD_VENICE } from "./payload-venice";
import { VENICE_5YR_BUNDLE } from "./payload-venice-5yr";
import "./control.css";

const THEME_KEY = "qctl-theme";

/**
 * Venice Authority Control Dashboard — the live pitch instrument.
 * Single screen, no scroll. Loads the Venice payload at boot via loadPayload();
 * everything on screen reads from the single store via useSyncExternalStore.
 */
export function ControlDashboard() {
  const [booted, setBooted] = useState<boolean>(() => !!getState());
  const [dark, setDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem(THEME_KEY) === "dark";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    installGlobalApi();
    initServerVoice(); // detect the secure /api/tts proxy (production)
    startSync(); // mirror lever changes to/from the iPad console
    if (!getState()) {
      // v1 payload sets the curve + lever defaults; the 5-year bundle layers the
      // 2024–2028 daily/monthly/shock/assumption data (and locked actuals) on top.
      loadPayload(PAYLOAD_VENICE);
      try {
        loadBundle(VENICE_5YR_BUNDLE);
      } catch (err) {
        console.error("5-year bundle failed to load at boot:", err);
      }
    }
    setBooted(true);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
    } catch {
      /* storage unavailable — theme just won't persist */
    }
  }, [dark]);

  if (!booted) return null;

  return (
    <div className={"qctl-root" + (dark ? " dark" : "")}>
      <TopBar
        dark={dark}
        onToggleDark={() => setDark((d) => !d)}
        onSetDark={(d) => setDark(d)}
      />
      <main className="qctl-main">
        <CurvePanel />
        <div className="qctl-right-rail">
          <RevenuePanel />
          <LeversPanel />
        </div>
      </main>
    </div>
  );
}
