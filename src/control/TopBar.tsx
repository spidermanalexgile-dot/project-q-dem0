import { useEffect, useRef, useState } from "react";
import { useStore } from "./useStore";
import { setDayType, setPhase, loadPayload, getState } from "./state";

type Toast = { kind: "ok" | "err"; msg: string } | null;

export function TopBar() {
  const state = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<Toast>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(kind: "ok" | "err", msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ kind, msg });
    // Success fades quickly; errors linger so the operator can read them.
    toastTimer.current = setTimeout(() => setToast(null), kind === "ok" ? 3500 : 6000);
  }

  /**
   * Single code path for every runtime payload source (button, Cmd/Ctrl+O,
   * drag-drop). Reads the file as text and hands the raw string to loadPayload,
   * which parses .json or .md-with-fenced-json, validates, and normalizes the
   * integer-encoded curve exponent. On any failure the previous payload stays
   * loaded — loadPayload throws before it mutates the store — so the UI never
   * enters a broken state.
   */
  async function handleFile(file: File | null | undefined) {
    if (!file) return;
    try {
      const text = await file.text();
      loadPayload(text);
      const s = getState();
      showToast(
        "ok",
        `Payload loaded — ${s?.location.label ?? "?"} · confidence ${s?.confidence ?? "?"}`,
      );
    } catch (err) {
      showToast(
        "err",
        `Payload error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  function openPicker() {
    fileRef.current?.click();
  }

  // Pitch-operator conveniences: Cmd/Ctrl+O opens the picker; dropping a
  // .json/.md file anywhere on the dashboard window loads it (same code path).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "o" || e.key === "O")) {
        e.preventDefault();
        openPicker();
      }
    }
    function onDragOver(e: DragEvent) {
      e.preventDefault();
    }
    function onDrop(e: DragEvent) {
      e.preventDefault();
      void handleFile(e.dataTransfer?.files?.[0]);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  if (!state) return null;
  const activeDay =
    state.day_types.find((d) => d.id === state.activeDay) || state.day_types[0];
  const year = state.phase.year;

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true" />
          <div>
            <div className="brand-name">Project Q</div>
            <div className="brand-sub">Authority Control · v0.4</div>
          </div>
        </div>

        <div className="tb-context">
          <div className="tb-field">
            <div className="tb-label">Location</div>
            <div className="tb-location-row">
              <div className="tb-select">
                <select
                  value={state.location.id}
                  onChange={() => {
                    /* placeholder for loadPayload(otherCity) */
                  }}
                >
                  <option value={state.location.id}>{state.location.label}</option>
                  <option value="dubrovnik" disabled>
                    Dubrovnik (load payload)
                  </option>
                  <option value="barcelona" disabled>
                    Barcelona (load payload)
                  </option>
                </select>
              </div>
              <button
                type="button"
                className="tb-upload"
                onClick={openPicker}
                title="Load DPM payload  ·  ⌘/Ctrl+O  ·  or drag a .json / .md file in"
                aria-label="Load DPM payload"
              >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path
                    d="M8 10.2V2.6M8 2.6 5 5.6M8 2.6l3 3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M2.6 10v2.4a1 1 0 0 0 1 1h8.8a1 1 0 0 0 1-1V10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <input
                ref={fileRef}
                type="file"
                className="tb-file-input"
                accept=".json,.md,application/json,text/markdown"
                onChange={(e) => {
                  void handleFile(e.target.files?.[0]);
                  // Allow re-selecting the same file to fire onChange again.
                  e.target.value = "";
                }}
              />
            </div>
          </div>

          <div className="tb-divider" />

          <div className="tb-field">
            <div className="tb-label">Modelling day</div>
            <div className="tb-select">
              <select
                value={state.activeDay}
                onChange={(e) => setDayType(e.target.value)}
              >
                {state.day_types.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label} · {d.date}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="tb-divider" />

          <div className="tb-field">
            <div className="tb-label">Demand</div>
            <div className="tb-demand-chip">{activeDay.demand_pct}%</div>
          </div>
        </div>

        <div className="tb-field tb-field-right">
          <div className="tb-label">Deployment phase</div>
          <div className="phase-toggle" role="tablist" aria-label="Deployment year">
            {[1, 2, 3].map((y) => (
              <button
                key={y}
                className={y === year ? "on" : ""}
                onClick={() => setPhase(y as 1 | 2 | 3)}
                aria-pressed={y === year}
              >
                YR&nbsp;{y}
              </button>
            ))}
          </div>
        </div>
      </header>

      {toast && (
        <div
          className={"qctl-payload-toast " + toast.kind}
          role="status"
          aria-live="polite"
        >
          {toast.msg}
        </div>
      )}
    </>
  );
}
