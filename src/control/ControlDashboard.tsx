import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TopBar } from "./TopBar";
import { CurvePanel } from "./CurvePanel";
import { RevenuePanel } from "./RevenuePanel";
import { LeversPanel } from "./LeversPanel";
import { installGlobalApi, loadPayload, getState } from "./state";
import { PAYLOAD_VENICE } from "./payload-venice";
import "./control.css";

/**
 * Venice Authority Control Dashboard — the live pitch instrument.
 * Single screen, no scroll. Loads the Venice payload at boot via loadPayload();
 * everything on screen reads from the single store via useSyncExternalStore.
 */
export function ControlDashboard() {
  const [booted, setBooted] = useState<boolean>(() => !!getState());

  useEffect(() => {
    installGlobalApi();
    if (!getState()) {
      loadPayload(PAYLOAD_VENICE);
    }
    setBooted(true);
  }, []);

  if (!booted) return null;

  return (
    <div className="qctl-root">
      <TopBar />
      <main className="qctl-main">
        <CurvePanel />
        <div className="qctl-right-rail">
          <RevenuePanel />
          <LeversPanel />
        </div>
      </main>
      <Link to="/tourist" className="qctl-tourist-link">
        Tourist demo →
      </Link>
    </div>
  );
}
