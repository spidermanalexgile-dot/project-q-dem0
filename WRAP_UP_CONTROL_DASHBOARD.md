# Wrap-up · Venice Authority Control Dashboard

**Date:** 2026-05-28 (UTC)
**Branch:** main
**HEAD at deploy:** c6f0ec4

The deployed app's front door is now the **Venice Authority Control
Dashboard** — the live pitch instrument for selling Project Q dynamic
tourism pricing to city decision-makers. The entire tourist demo is
preserved, fully reachable at `/tourist`.

Production: https://project-q-dem0.vercel.app/

## Commit-by-commit timeline

1. **daa5770** — Add Claude Design handoff bundle + Venice pitch reference docs.
   Brought `design_handoff_project_q/` (state.js, payload-venice.js, curve.jsx,
   controls.jsx, app.jsx, styles.css, README, the HTML entry) plus
   `Venice_Control_Dashboard_DesignBrief.md`, `CONTROL_DASHBOARD_BUILD_PROMPT.md`,
   `MEETING_PREP_Venice_Tourism.md`, `DPM_Instructions_for_Ollie.md` into the
   repo as durable source-of-truth references.

2. **bb2fb37** — `dashboard-calc-engine`: typed TS port of state.js
   (`src/control/state.ts`). Pure calc engine (feeAtPct, payAtPct,
   qcashAtPct, dayRevenue, annualRevenue), observable store, full
   window.ProjectQ command API with signatures matching the README's
   command table. Payload validation on load (seasonal ~365, lever bounds,
   ceiling > plateau, max_fee_cap > base, ≥1 day_type). `loadPayload`
   accepts pre-parsed payloads, JSON strings, and markdown with a fenced
   ```json block.

3. **96c270b** — `dashboard-components`: pixel-faithful TS components
   wired via `useSyncExternalStore`. TopBar (brand mark, three centred
   selectors, YR 1/2/3 pill toggle), CurvePanel (hero SVG with the full
   layer stack from the README + flip-aware callout, decile strip),
   RevenuePanel (two stacked cards with delta chips that auto-fade after
   3.5s), LeversPanel (four sliders with 350ms ochre value-chip flash
   on change + the shoulder-rebate row with the exact microcopy).

4. **2b514fc** — `dashboard-styles`: full styles.css port scoped under
   `.qctl-root` so the warm-earth theme doesn't bleed into the tourist
   demo (dark glass) or vice versa. Google-Fonts Outfit + IBM Plex Mono,
   three warm radial glows, grain overlay (feTurbulence data URI), the
   grid layout with clamp()-driven spacing that adapts 1280→1920 without
   media queries.

5. **335ef3f** — `dashboard-routing`: mounted `<ControlDashboard />` at
   `/`, relocated `<DemoIndex />` to `/tourist`. Every old route is
   preserved (`/walkthrough`, `/landing`, `/p1/*`, `/p2/*`, `/p3/*`,
   `/p4/*`, `/day/*`, `/takecontrol`). Internal "All screens" back-links
   updated to `/tourist`; the DayGuard's Queenstown-redirect now lands at
   `/tourist`. Small "Tourist demo →" footer link in the dashboard for
   quick access during a pitch.

6. **c6f0ec4** — `dashboard-verify-deploy`: local screenshots at the two
   target viewports (1280×800, 1920×1200), post-API screenshot showing
   the dashboard after the brief's exact verification calls, and an API
   result log. No console errors; all figures whole-integer EUR; no
   scroll bars at either viewport.

## Judgment calls

- **State pattern.** The brief allowed `useSyncExternalStore` *or* the
  repo's existing pattern. Picked `useSyncExternalStore` since React 18
  is on, but the store mutates state in place (matching state.js, so the
  agent reads back the same object reference between calls). Snapshot
  comparison via Object.is would never re-render, so I expose a
  monotonic `getStoreVersion()` as the snapshot — components subscribe to
  the version bump but read live state directly. Keeps the "one source,
  many writers" property intact and the agent integration matches the
  prototype's API exactly.

- **CSS scoping.** The handoff CSS targets `body` and `#root` globally.
  Routing the dashboard onto `/` alongside the tourist demo (which has
  its own dark-glass system) meant the styles needed scoping; everything
  is namespaced under `.qctl-root` and applied via a fixed-position
  full-viewport container. Tourist routes are untouched.

- **Did NOT port the Tweaks panel.** The README explicitly excludes it
  ("prototype-only, do not port") and the brief repeated the rule. The
  curve uses the canonical gradient stroke from the brief.

- **City selector.** Dubrovnik / Barcelona are present in the Location
  dropdown but disabled (per the README spec) — they'll become live the
  moment Ollie's DPM emits a payload for either.

- **Decimal-stripping in the value chip and revenue figures** — done at
  display via `fmtNumber`/`fmtCompactEur`/`fmtEur`. The calc engine
  itself stays in full precision; rounding lives only in the formatters,
  per the brief.

## How I resolved the README's four "Open Questions for the Implementer"

1. **Should `loadPayload()` accept a markdown string with a fenced JSON
   block, or always pre-parsed JSON?** — Both. The TS `loadPayload`
   detects strings, runs a `/```json[\s\S]*?```/` regex extraction, and
   falls back to parsing a bare JSON object if no fence is present.
   Pre-parsed `Payload` objects still go through validation unchanged.
   Single entry point, two surface forms, identical behaviour after parse.

2. **Where does the second/third city payload come from at runtime —
   bundled, fetched, or file-input?** — The Location dropdown is wired
   but disabled until payloads exist. The recommended drop-in is a
   fetched markdown file from the DPM's output bucket; in the meantime
   any caller (agent, console, future File picker) can call
   `window.ProjectQ.loadPayload(otherPayload)` and the dashboard
   re-renders against the new city in <100ms.

3. **Should the delta chip show "since session start" or "since last
   move"?** — Kept the prototype's per-move semantic, with the 3.5s
   auto-fade, because that matches the pitch beat ("they protest, you
   move a lever, the chip shows the delta, conversation moves on").
   Session-start tracking would survive across multiple lever moves and
   make the chip into a running total — useful for analysis, not for a
   pitch. Easy to add later by snapshotting `__lastDayRev` /
   `__lastAnnualRev` once at boot and never updating them.

4. **Agent transport (WebSocket / postMessage / IPC)?** — Used the
   `window.ProjectQ` global surface (the README's "fine for pitch
   tooling" option). The whole API is synchronous and idempotent, so a
   future agent transport can wrap it with whatever IPC layer it needs:
   the agent process calls `window.ProjectQ.setLever(id, v)`; we never
   needed an async channel because there's no remote round-trip.

## Driving the screen via window.ProjectQ during a pitch

```js
// Replace the city entirely
window.ProjectQ.loadPayload(payload);          // payload or markdown string

// Move levers (clamped to [min, max])
window.ProjectQ.setLever('target_capacity', 65000);
window.ProjectQ.setLever('base_fee', 12);
window.ProjectQ.setLever('max_fee_cap', 80);
window.ProjectQ.setLever('ceiling_pct', 180);

// Switch the modelled day
window.ProjectQ.setDayType('shoulder');

// Switch deployment phase (Year 1 = €20 cap, Year 2 = €60, Year 3 = €150)
window.ProjectQ.setPhase(2);

// Toggle shoulder rebate
window.ProjectQ.setRebate(true);

// Read back state / derived values
window.ProjectQ.getState();
window.ProjectQ.compute();
window.ProjectQ.feeAtPct(180);
window.ProjectQ.dayRevenue(145);
window.ProjectQ.annualRevenue();
```

## What Ollie's DPM must emit to plug in

A markdown file (or any string the loader can ingest) containing a fenced
```json block with this shape:

```json
{
  "location": { "id": "dubrovnik", "label": "Dubrovnik", "currency": "EUR" },
  "capacity": { "target": 25000, "unit": "visitors/day" },
  "confidence": 38,
  "curve": {
    "base_fee_at_target": 12,
    "max_fee_cap": 60,
    "ceiling_pct": 180,
    "shape": { "plateau_end_pct": 100, "exponent": 2.2 }
  },
  "shoulder_rebate": { "enabled": true, "credit": 6, "applies_below_pct": 30 },
  "levers": [
    { "id": "target_capacity", "min": 10000, "max": 60000,  "step": 1000, "value": 25000 },
    { "id": "base_fee",        "min": 0,     "max": 50,     "step": 1,    "value": 12 },
    { "id": "max_fee_cap",     "min": 10,    "max": 200,    "step": 5,    "value": 60 },
    { "id": "ceiling_pct",     "min": 120,   "max": 250,    "step": 5,    "value": 180 }
  ],
  "day_types": [
    { "id": "peak_sat",    "label": "Peak summer Saturday", "date": "Sat 22 Jul", "demand_pct": 210 },
    { "id": "shoulder",    "label": "Shoulder Sunday",      "date": "Sun 15 Oct", "demand_pct": 80  }
  ],
  "phase": { "year": 1, "real_pay_cap": 20 },
  "seasonal": [
    { "days": 30,  "demand_pct": 200 },
    { "days": 50,  "demand_pct": 150 },
    { "days": 80,  "demand_pct": 110 },
    { "days": 90,  "demand_pct": 80  },
    { "days": 65,  "demand_pct": 50  },
    { "days": 50,  "demand_pct": 22  }
  ]
}
```

Validation rules the loader enforces:
- `seasonal[].days` must sum to ~365 (window 360–370)
- every `levers[].value` must satisfy `min ≤ value ≤ max`
- `curve.ceiling_pct > curve.shape.plateau_end_pct`
- `curve.max_fee_cap > curve.base_fee_at_target`
- at least one `day_types[]` entry

Anything else (narrative text, source attribution, confidence rationale) is
ignored by the dashboard but useful in the markdown surrounds for human
review.

## Verification artefacts

`./review-screenshots/control-dashboard/`:

- `dashboard-1280x800.png` — root, default Venice payload, 1280×800
- `dashboard-1920x1200.png` — same payload, 1920×1200 (no scroll)
- `dashboard-after-api-1280x800.png` — after running the README's exact
  verification calls (`setLever('max_fee_cap',30)`, `setLever('ceiling_pct',180)`,
  `setDayType('dec_weekday')`, `setPhase(3)`) — curve redrawn, top bar showing
  "December weekday · Tue 5 Dec · 45%", YR 3 active, revenue figures updated
- `tourist-index-1280x800.png` — `/tourist` still rendering the tourist demo
- `walkthrough-1280x800.png` — `/walkthrough` preserved
- `PRODUCTION.png` — live production capture of `/` after deploy
- `_api_result.json` — snapshot of `getState()` after the API exercise
- `_console_errors.txt` — empty (no console errors during the exercise)

## Tests / checks performed

- `npm run build` — clean, 0 TS errors
- Local dev returns 200 for `/`, `/tourist`, `/walkthrough`, `/day/welcome`,
  `/p3/trip`
- Production returns 200 for `/`, `/tourist`, `/walkthrough`, `/day/welcome`,
  `/p3/trip`
- `window.ProjectQ` exposed at boot, all commands callable, no console errors
- Mutations re-render in under 100ms (well under the brief's 10s ceiling)
- 1280×800 and 1920×1200 fit without scroll bars
- Tourist demo unchanged: all routes (`/p1/*`, `/p2/*`, `/p3/*`, `/p4/*`,
  `/day/*`, `/landing`, `/takecontrol`, `/walkthrough`) still load

---

## DPM Integration — Ollie's first output (Venice 2026)

**Date:** 2026-05-29 (UTC)
**Chunks:** integrate-ollie-dpm-default · dashboard-loader-exponent-normalize · dashboard-runtime-payload-upload · integrate-verify-deploy

Ollie's first DPM parameter set for Venice 2026 is now the dashboard's default
boot payload, and any future DPM file can be dropped in live during a pitch.

### What shipped
- **Default boot payload** is imported verbatim from `dpm-payloads/venice-2026.json`
  (see `src/control/payload-venice.ts`). No Ollie value (50000, 42, "Carnival
  Saturday", …) is inlined in component or engine logic — every figure is read
  from the loaded payload. The old placeholder Venice sample was removed.
- **Runtime upload** affordance in the TopBar (next to the Location dropdown):
  a small upload glyph that opens a native `.json` / `.md` picker, plus
  **Cmd/Ctrl+O** and **drag-and-drop anywhere on the window**, all routing through
  the same `loadPayload()` path.

### The exponent ×10 encoding decision (the one documented schema quirk)
Ollie's DPM emits `curve.shape.exponent` as an **integer ×10-encoded** value. His
PDF "EXPONENT ENCODING NOTE" states the schema permits whole integers only, so the
curve exponent **2.2 is written as the integer 22**, and the dashboard must divide
by 10 before the pricing calc uses it.

- **Where it lives:** `src/control/state.ts` — `normalizeCurveExponent()` at
  **state.ts:254**, invoked inside `loadPayload()` at **state.ts:267** (immediately
  after the defensive deep-clone, before any pricing calc reads the value).
- **The rule (robust to both forms, in one code path):**
  - `exponent >= 10` → treated as ×10-encoded → divided by 10 (e.g. `22 → 2.2`)
  - `exponent <  10` → treated as a direct float → used as-is
  No realistic fee curve uses an exponent ≥ 10, so the disambiguation is safe.
- **Proof it decoded:** live `window.ProjectQ.getState().curve.shape.exponent`
  returns **2.2** (not 22), and `feeAtPct(150)` returns **€18.71** — the smooth
  exponent-2.2 curve from €10 base to €50 cap. (Had the value stayed 22, the curve
  would sit flat near €10 until the ceiling then jump to €50 — i.e. fee(150%) ≈ €10,
  obviously wrong.)

### Recommendation for DPM schema v2
Allow `curve.shape.exponent` to be emitted as a **direct float** (e.g. `2.2`). The
loader's `>= 10` rule already provides **backward compatibility either way**: legacy
×10-encoded payloads (`22`) keep decoding to `2.2`, and cleaned-up payloads carrying
`2.2` pass through untouched. No dashboard change is required when the schema is
cleaned up — the same single code path handles both.

### Using the runtime upload in a pitch ("remove Venice, drop in Dubrovnik in seconds")
- **Button:** the upload glyph in the TopBar, immediately right of the **Location**
  dropdown. Click it to open a file picker (`.json` or `.md` with a fenced ```json``` block).
- **Keyboard:** **Cmd+O** (macOS) / **Ctrl+O** (Windows/Linux) opens the same picker.
- **Drag-and-drop:** drag a DPM `.json`/`.md` file anywhere onto the dashboard window.
- **Feedback:** on success, a sage toast — *"Payload loaded — {location} · confidence {n}"* —
  fades after ~3.5s; on failure, a red toast — *"Payload error: {which rule failed}"* —
  stays ~6s and the **previous payload remains loaded** (the UI never enters a broken
  state). Validation enforces the design-handoff rules (seasonal days ≈365, lever
  bounds, ceiling > plateau, cap > base, ≥1 day type).

### Ollie's confidence rating: 42 (shown live, verbatim)
The confidence pill renders **"Model confidence 42%"** — Ollie's actual, honest DPM
output. It is **not rounded, padded, or embellished** anywhere; that honesty is a
product feature. Confirmed locally and on production via
`window.ProjectQ.getState().confidence → 42`.

### Verification (local, headless Chrome)
`node scripts-verify-dpm.mjs` against the dev server confirmed:
- confidence **42**; capacity **50,000**; 4 day_types in Ollie's order
  (Peak summer Saturday · Sat 1 Aug → Biennale weekday · Wed 27 May → December
  weekday · Wed 9 Dec → Carnival Saturday · Sat 14 Feb); active day defaults to
  `peak_sat` (200%).
- `curve.shape.exponent` **2.2**; `feeAtPct(150)` **€18.71** (within 18–32).
- Upload OK toast, upload error toast (broken payload → "requires at least one
  day_type"), previous Venice/42 state survives the error, command API
  (`setLever`/`setDayType`/`setPhase`/`setRebate`) all mutate + re-render,
  **0 console errors**.
- `npm run build` passes clean (0 TS errors). Screenshots at 1280×800 and
  1920×1200 saved under `review-screenshots/dpm-integration/`.
