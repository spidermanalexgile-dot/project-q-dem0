import { useEffect, useRef, useState } from "react";
import { useStore } from "./useStore";
import {
  setDate,
  setActiveShock,
  activeDayType,
  activeAdjustedVisitors,
  activeManagedVisitors,
  activeCPI,
  capacityThreshold,
  suggestSustainableLevers,
  loadPayload,
  loadBundle,
  getState,
} from "./state";
import { isBundleFilenames } from "./bundle";
import { fmtNumber } from "./format";
import { formatISO } from "./dateutil";
import { AssistantPanel } from "./AnalystPanel";

type Toast = { kind: "ok" | "err"; msg: string } | null;

/** Step an ISO date by whole days. Pure (built from explicit Y/M/D, never
 *  Date.now), so it's safe in this UI handler. */
function stepISO(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return dt.toISOString().slice(0, 10);
}

type TopBarProps = {
  dark: boolean;
  onToggleDark: () => void;
  /** Lets the embedded mic flip the theme by voice ("dark mode"). */
  onSetDark: (dark: boolean) => void;
};

export function TopBar({ dark, onToggleDark, onSetDark }: TopBarProps) {
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

  // The selected day (driven by the date picker, else the default preset) and
  // its PROJECTED forecast headcount — the figure we highlight. `managed` is the
  // post-pricing crowd; `threshold` is the sustainable capacity (CPI 1.0).
  const activeDay = activeDayType(state);
  const projected = Math.round(activeAdjustedVisitors(state));
  const managed = Math.round(activeManagedVisitors(state));
  const threshold = capacityThreshold(state);
  const cpi = activeCPI(state);
  // Colour the highlight by whether the MANAGED (post-pricing) crowd stays at the
  // sustainable line — so "Suggest levers" visibly turns it green. Falls back to
  // raw CPI bands on v1 payloads that carry no threshold.
  const ratio = threshold && threshold > 0 ? managed / threshold : null;
  const cpiClass =
    ratio != null
      ? ratio <= 1.05
        ? " slack"
        : ratio <= 1.4
          ? " warn"
          : " over"
      : cpi == null
        ? ""
        : cpi < 0.8
          ? " slack"
          : cpi < 1.0
            ? ""
            : cpi < 1.5
              ? " warn"
              : " over";

  function handleSuggest() {
    const pct = suggestSustainableLevers();
    showToast(
      "ok",
      threshold
        ? `Levers tuned — holding the peak near ${pct}% of capacity (sustainable ${fmtNumber(threshold)}/day · CPI 1.0).`
        : `Levers tuned to hold ${pct}% occupancy.`,
    );
  }

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
          {/* Hidden input retained so ⌘/Ctrl+O + drag-drop still load payloads
              and the DPM v2 bundle (the visible Location selector was removed). */}
          <input
            ref={fileRef}
            type="file"
            className="tb-file-input"
            multiple
            accept=".json,.md,.csv,.zip,application/json,text/markdown,text/csv,application/zip"
            onChange={(e) => {
              void handleFiles(e.target.files);
              e.target.value = "";
            }}
          />

          {/* Innovative day selector — a stepper + calendar pill that shows the
              day in plain language; clicking opens the native picker. */}
          <div className="tb-field">
            <div className={"tb-dayselect" + (state.customDate ? " custom" : "")}>
              <button
                type="button"
                className="tb-day-step"
                onClick={() => state.customDate && setDate(stepISO(state.customDate, -1))}
                disabled={!state.customDate}
                aria-label="Previous day"
              >
                ‹
              </button>
              <div className="tb-dayselect-main">
                <svg className="tb-day-cal" viewBox="0 0 16 16" aria-hidden="true">
                  <rect x="2" y="3" width="12" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M2 6.4h12M5.2 1.8v2.4M10.8 1.8v2.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                <span className="tb-dayselect-text">
                  {state.customDate ? formatISO(state.customDate) : activeDay.date}
                </span>
                <input
                  type="date"
                  className="tb-dayselect-native"
                  value={state.customDate ?? ""}
                  onChange={(e) => setDate(e.target.value === "" ? null : e.target.value)}
                  aria-label="Pick a day"
                />
              </div>
              <button
                type="button"
                className="tb-day-step"
                onClick={() => state.customDate && setDate(stepISO(state.customDate, 1))}
                disabled={!state.customDate}
                aria-label="Next day"
              >
                ›
              </button>
            </div>
          </div>

          <div className="tb-divider" />

          {/* AI assistant mic — relocated here, next to the date. */}
          <div className="tb-field tb-field-mic">
            <AssistantPanel inline onSetDark={onSetDark} />
          </div>

          <div className="tb-divider" />

          {/* Projected visitors — just the number (no label / caption), with the
              sustainable read-out only when the v2 bundle is loaded. */}
          <div className="tb-field tb-projected">
            <div className="tb-projected-row">
              <div className={"tb-projected-figure" + cpiClass}>{fmtNumber(projected)}</div>
              <div className="tb-projected-meta">
                {threshold != null && (
                  <span className="tb-projected-sub">
                    after pricing {fmtNumber(managed)} · sustainable {fmtNumber(threshold)}/day
                    {cpi != null ? ` · CPI ${cpi.toFixed(2)}` : ""}
                  </span>
                )}
                <button
                  type="button"
                  className="tb-suggest"
                  onClick={handleSuggest}
                  title="Let Q auto-tune the fee levers so the managed crowd is held at the sustainable capacity (CPI 1.0)"
                >
                  Let Q fix this
                </button>
              </div>
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
        </div>

        <div className="tb-field tb-field-right">
          <div className="tb-right-actions">
          <button
            type="button"
            className="tb-upload"
            onClick={openPicker}
            title="Load a DPM payload or the v2 CSV bundle  ·  ⌘/Ctrl+O  ·  or drag files in"
            aria-label="Load DPM payload or bundle"
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
