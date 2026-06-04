import { useEffect, useRef, useState } from "react";
import { useStore } from "./useStore";
import {
  setDayType,
  setDemand,
  setDate,
  setOccupancyTarget,
  setActiveShock,
  targetCapacity,
  liveDemandPct,
  loadPayload,
  loadBundle,
  getState,
} from "./state";
import { isBundleFilenames } from "./bundle";

type Toast = { kind: "ok" | "err"; msg: string } | null;

type TopBarProps = {
  dark: boolean;
  onToggleDark: () => void;
};

export function TopBar({ dark, onToggleDark }: TopBarProps) {
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
   * multi-file picker, folder/zip drag-drop). Detects the DPM v2 four-CSV bundle
   * by FILENAMES first; otherwise treats a single file as a v1 JSON/MD payload.
   * On any failure the previous state stays loaded (loadBundle/loadPayload throw
   * before mutating the store) and a red toast explains why.
   */
  async function handleFiles(input: File[] | FileList | null | undefined) {
    const files = input ? Array.from(input) : [];
    if (files.length === 0) return;
    try {
      // v2 bundle: a folder / multi-select containing the four CSVs.
      if (isBundleFilenames(files.map((f) => f.name))) {
        const named = await Promise.all(
          files.map(async (f) => ({ name: f.name, text: await f.text() })),
        );
        loadBundle(named);
        const s = getState();
        showToast(
          "ok",
          `DPM v2 bundle loaded — ${s?.daily?.length ?? 0} daily rows · ${s?.shocks?.length ?? 0} stress scenarios · run confidence ${s?.run_confidence ?? "?"}`,
        );
        return;
      }
      // A .zip — without a zip dependency we can only read uncompressed entries;
      // guide the operator to the folder / multi-CSV path otherwise.
      const zip = files.find((f) => /\.zip$/i.test(f.name));
      if (zip) {
        throw new Error(
          "Zipped bundle can't be read in-browser without a new dependency — drop the venice-2027 folder, or select the four CSVs together.",
        );
      }
      // v1 single-file payload (JSON / MD).
      const text = await files[0].text();
      loadPayload(text);
      const s = getState();
      showToast(
        "ok",
        `Payload loaded — ${s?.location.label ?? "?"} · confidence ${s?.confidence ?? "?"}`,
      );
    } catch (err) {
      showToast(
        "err",
        `Load error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  function openPicker() {
    fileRef.current?.click();
  }

  // Pitch-operator conveniences: Cmd/Ctrl+O opens the picker; dropping a payload
  // (single JSON/MD, the four CSVs, or the bundle FOLDER) anywhere loads it.
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
    // Walk a dropped folder's entries (webkitGetAsEntry) to collect its files;
    // fall back to the flat dataTransfer.files list for plain multi-file drops.
    async function collectDropped(dt: DataTransfer | null): Promise<File[]> {
      if (!dt) return [];
      const items = dt.items;
      const roots: FileSystemEntry[] = [];
      if (items && items.length) {
        for (let i = 0; i < items.length; i++) {
          const entry = (items[i] as DataTransferItem & {
            webkitGetAsEntry?: () => FileSystemEntry | null;
          }).webkitGetAsEntry?.();
          if (entry) roots.push(entry);
        }
      }
      if (!roots.length) return Array.from(dt.files || []);
      const out: File[] = [];
      const walk = async (entry: FileSystemEntry): Promise<void> => {
        if (entry.isFile) {
          const file = await new Promise<File>((res, rej) =>
            (entry as FileSystemFileEntry).file(res, rej),
          );
          out.push(file);
        } else if (entry.isDirectory) {
          const reader = (entry as FileSystemDirectoryEntry).createReader();
          const batch = await new Promise<FileSystemEntry[]>((res) =>
            reader.readEntries(res, () => res([])),
          );
          for (const e of batch) await walk(e);
        }
      };
      for (const r of roots) await walk(r);
      return out.length ? out : Array.from(dt.files || []);
    }
    function onDrop(e: DragEvent) {
      e.preventDefault();
      void collectDropped(e.dataTransfer).then((files) => handleFiles(files));
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!state) return null;
  const selectedDay =
    state.day_types.find((d) => d.id === state.activeDay) || state.day_types[0];
  const isCustom = state.customDemand != null;
  // Baseline modelled demand: the typed free-form value, else the preset day's.
  const demand = isCustom ? (state.customDemand as number) : selectedDay.demand_pct;
  const targetCap = targetCapacity(state);
  // Live demand % is the baseline rebased by the chosen target capacity; the
  // headcount = the forecast crowd for that day (independent of target — fewer
  // "slots" just makes the same crowd a higher % of capacity).
  const liveDemand = Math.round(liveDemandPct(demand, state));
  const baseline = state.capacity.baseline || targetCap;
  const dayHeadcount = Math.round((baseline * demand) / 100);
  const fmtPeople = (n: number) =>
    n >= 1000 ? (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1).replace(/\.0$/, "") + "k" : String(n);

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
                multiple
                accept=".json,.md,.csv,.zip,application/json,text/markdown,text/csv,application/zip"
                onChange={(e) => {
                  void handleFiles(e.target.files);
                  // Allow re-selecting the same file(s) to fire onChange again.
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
                value={isCustom ? "__custom" : state.activeDay}
                onChange={(e) => setDayType(e.target.value)}
              >
                {isCustom && (
                  <option value="__custom">
                    {state.customDate ? "Calendar day" : "Custom demand"} · {demand}%
                  </option>
                )}
                {state.day_types.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label} · {d.date}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Stress-test selector — only when the bundle's shocks are loaded. */}
          {state.shocks && state.shocks.length > 0 && (
            <>
              <div className="tb-divider" />
              <div className="tb-field">
                <div className="tb-label">Stress test</div>
                <div className={"tb-select" + (state.active_shock ? " custom" : "")}>
                  <select
                    value={state.active_shock ?? "__baseline"}
                    onChange={(e) =>
                      setActiveShock(e.target.value === "__baseline" ? null : e.target.value)
                    }
                    aria-label="Apply a stress-test scenario"
                  >
                    <option value="__baseline">Baseline</option>
                    {state.shocks.map((sh) => (
                      <option key={sh.id} value={sh.id}>
                        {sh.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          <div className="tb-divider" />

          <div className="tb-field">
            <div className="tb-label">Pick a date</div>
            <div className={"tb-date-input" + (state.customDate ? " custom" : "")}>
              <input
                type="date"
                value={state.customDate ?? ""}
                onChange={(e) => setDate(e.target.value === "" ? null : e.target.value)}
                aria-label="Model a specific calendar date"
              />
            </div>
          </div>

          <div className="tb-divider" />

          <div className="tb-field">
            <div className="tb-label">
              Crowd level · {liveDemand}% ({fmtPeople(dayHeadcount)})
              <span
                className="tb-help"
                tabIndex={0}
                role="note"
                aria-label="What is crowd level? It's how busy the day is versus a normal day. 100 percent is a normal day, 200 percent is twice as crowded, 50 percent is half-empty. The headcount shown is target capacity times this level."
                title="How busy the day is vs. a normal day. 100% = a normal day · 200% = twice as crowded · 50% = half-empty. The figure shown is the actual visitors that day = target capacity × this level."
              >
                ?
              </span>
            </div>
            <div className={"tb-demand-input" + (isCustom ? " custom" : "")}>
              <input
                type="number"
                min={0}
                max={400}
                step={5}
                value={demand}
                onChange={(e) => {
                  const v = e.target.value;
                  setDemand(v === "" ? null : Number(v));
                }}
                aria-label="Crowd level percentage versus a normal day"
              />
              <span className="tb-demand-suffix">%</span>
            </div>
          </div>

          <div className="tb-divider" />

          <div className="tb-field">
            <div className="tb-label">
              Occupancy target
              <span
                className="tb-help"
                tabIndex={0}
                role="note"
                aria-label="Occupancy target: the share of capacity the city wants to hold. Setting it auto-tunes the fees to deter crowds above it."
                title="The occupancy the authority wants to hold (% of capacity). Setting it auto-tunes the fees to deter crowds above it — e.g. 80% prices the busy days down toward 80%."
              >
                ?
              </span>
            </div>
            <div className={"tb-demand-input" + (state.occupancy_target !== 100 ? " custom" : "")}>
              <input
                type="number"
                min={10}
                max={200}
                step={5}
                value={state.occupancy_target}
                onChange={(e) => {
                  const v = e.target.value;
                  setOccupancyTarget(v === "" ? null : Number(v));
                }}
                aria-label="Desired occupancy as a percentage of capacity"
              />
              <span className="tb-demand-suffix">%</span>
            </div>
          </div>

        </div>

        <div className="tb-field tb-field-right">
          <div className="tb-label">Theme</div>
          <button
            type="button"
            className="tb-upload tb-theme"
            onClick={onToggleDark}
            title={dark ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            aria-pressed={dark}
          >
            {dark ? (
              // Sun glyph (click → light)
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="8" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
                <path
                  d="M8 1.2v1.8M8 13v1.8M1.2 8H3M13 8h1.8M3.2 3.2l1.3 1.3M11.5 11.5l1.3 1.3M12.8 3.2l-1.3 1.3M4.5 11.5l-1.3 1.3"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              // Moon glyph (click → dark)
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path
                  d="M13.4 9.6A5.4 5.4 0 0 1 6.4 2.6a5.4 5.4 0 1 0 7 7Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
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
