import { useEffect, useState } from "react";
import { useStore } from "../control/useStore";
import { LeversPanel } from "../control/LeversPanel";
import { RevenuePanel } from "../control/RevenuePanel";
import {
  installGlobalApi,
  loadPayload,
  loadBundle,
  getState,
  setDate,
  setView,
  setZoomSpan,
  suggestSustainableLevers,
  resetLevers,
  activeDayType,
} from "../control/state";
import { startSync } from "../control/sync";
import { formatISO } from "../control/dateutil";
import { PAYLOAD_VENICE } from "../control/payload-venice";
import { VENICE_5YR_BUNDLE } from "../control/payload-venice-5yr";
import "../control/control.css";
import "./ipad.css";

const THEME_KEY = "qctl-theme";

function stepISO(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return dt.toISOString().slice(0, 10);
}

/**
 * iPad lever console — a second screen (add-to-home-screen PWA) that drives the
 * SAME model as the web dashboard. Every lever move is pushed through /api/sync,
 * so the projected web view updates live. Reuses the exact themed panels.
 */
export function IpadControl() {
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
    if (!getState()) {
      loadPayload(PAYLOAD_VENICE);
      try {
        loadBundle(VENICE_5YR_BUNDLE);
      } catch (err) {
        console.error("5-year bundle failed to load:", err);
      }
    }
    startSync();
    setBooted(true);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
    } catch {
      /* storage unavailable */
    }
  }, [dark]);

  const state = useStore();
  if (!booted || !state) return null;

  const day = activeDayType(state);
  const qOn = !!state.q_fixed;
  const span = state.zoomSpan ?? 1;
  const isCost = state.view === "cost";

  return (
    <div className={"qctl-root ipad-root" + (dark ? " dark" : "")}>
      <header className="ipad-head">
        <div className="ipad-brand">
          <div className="brand-mark" aria-hidden="true" />
          <div>
            <div className="brand-name">Project Q</div>
            <div className="brand-sub">Lever Console · iPad</div>
          </div>
        </div>

        <div className="ipad-dayselect">
          <button
            className="ipad-day-step"
            onClick={() => state.customDate && setDate(stepISO(state.customDate, -1))}
            disabled={!state.customDate}
            aria-label="Previous day"
          >
            ‹
          </button>
          <div className="ipad-day-main">
            <span>{state.customDate ? formatISO(state.customDate) : day.date}</span>
            <input
              type="date"
              className="ipad-day-native"
              value={state.customDate ?? ""}
              onChange={(e) => setDate(e.target.value === "" ? null : e.target.value)}
              aria-label="Pick a day"
            />
          </div>
          <button
            className="ipad-day-step"
            onClick={() => state.customDate && setDate(stepISO(state.customDate, 1))}
            disabled={!state.customDate}
            aria-label="Next day"
          >
            ›
          </button>
        </div>

        <div className="ipad-head-right">
          <button
            className={"tb-suggest ipad-q" + (qOn ? " active" : "")}
            onClick={() => (qOn ? resetLevers() : suggestSustainableLevers())}
          >
            {qOn ? "✓ Q is managing" : "Let Q fix this"}
          </button>
          <button
            className="ipad-theme"
            onClick={() => setDark((d) => !d)}
            aria-label="Toggle theme"
          >
            {dark ? "☀" : "☾"}
          </button>
        </div>
      </header>

      <div className="ipad-views">
        <div className="curve-view-toggle" role="tablist" aria-label="Chart view">
          <button className={isCost ? "on" : ""} onClick={() => setView("cost")} aria-pressed={isCost}>
            Cost curve
          </button>
          <button className={!isCost && span !== 5 ? "on" : ""} onClick={() => setZoomSpan(1)} aria-pressed={!isCost && span !== 5}>
            1-year
          </button>
          <button className={!isCost && span === 5 ? "on" : ""} onClick={() => setZoomSpan(5)} aria-pressed={!isCost && span === 5}>
            5-year
          </button>
        </div>
        <span className="ipad-views-hint">drives the web display →</span>
      </div>

      <main className="ipad-main">
        <div className="ipad-col ipad-col-levers">
          <LeversPanel />
        </div>
        <div className="ipad-col ipad-col-readouts">
          <RevenuePanel />
        </div>
      </main>

      <div className="ipad-sync-note">live · changes mirror to the web view</div>
    </div>
  );
}
