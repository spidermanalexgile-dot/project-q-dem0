import { useEffect, useState } from "react";
import { TopBar } from "./TopBar";
import { CurvePanel } from "./CurvePanel";
import { RevenuePanel } from "./RevenuePanel";
import { LeversPanel } from "./LeversPanel";
import { AssistantPanel } from "./AnalystPanel";
import { installGlobalApi, loadPayload, getState } from "./state";
import { initServerVoice } from "./speech";
import { PAYLOAD_VENICE } from "./payload-venice";
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
    if (!getState()) {
      loadPayload(PAYLOAD_VENICE);
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
      <TopBar dark={dark} onToggleDark={() => setDark((d) => !d)} />
      <main className="qctl-main">
        <CurvePanel />
        <div className="qctl-right-rail">
          <RevenuePanel />
          <LeversPanel />
        </div>
      </main>
      <AssistantPanel onSetDark={(d) => setDark(d)} />
    </div>
  );
}
