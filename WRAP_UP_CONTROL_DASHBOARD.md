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

### Deploy confirmation
Pushed to `main` (HEAD `676b052`); Vercel auto-deployed. Production
**https://project-q-dem0.vercel.app/** returns **HTTP 200**. Live readback via the
command API confirms the new build is serving:

```
window.ProjectQ.getState().confidence            → 42
window.ProjectQ.getState().curve.shape.exponent  → 2.2
window.ProjectQ.feeAtPct(150)                     → 18.71
```

Confidence pill on production reads **"Model confidence 42%"**; 0 page errors.
Live screenshot saved to `review-screenshots/dpm-integration/PRODUCTION.png`.

---

## Dashboard UX changes (2026-05-29)

Four operator-requested changes, deployed to production.

### 1. Lever max bounds raised dramatically
The slider upper bounds are widened in the DPM payload (`dpm-payloads/venice-2026.json`),
not in code:
| Lever | old max | new max | step |
|---|---|---|---|
| `target_capacity` | 120,000 | **1,000,000** | 5,000 |
| `base_fee` | 50 | **500** | 1 |
| `max_fee_cap` | 200 | **2,000** | 10 |
| `ceiling_pct` | 250 | **1,000** | 10 |

Slider tick labels are now **derived from each lever's payload `min`/`max`**
(`fmtCompactNum` in `src/control/format.ts`, used by `LeversPanel.tsx`) rather than
hardcoded, so bounds travel with the payload — a future city's DPM file sets its own
ranges with no code change. Bounds stay payload-driven; nothing is inlined.

### 2. Dark mode
- Toggle button in the TopBar (sun/moon glyph, shares the upload-button styling).
- `.qctl-root.dark` in `control.css` overrides only the **working** colour tokens
  (canvas/panel/ink/hairline + a flipped `--ink-inverse`); the brand accents
  (sage/ochre/teal/penalty) are unchanged so the curve reads identically.
- Curve active-dot, pay-line and callout now use `var(--ink)` / `var(--ink-inverse)`
  so they invert cleanly in both themes; the multiply grain overlay is dropped in dark.
- Preference persists to `localStorage` (`qctl-theme`).

### 3. "Zoom out" annual demand profile
A whole-year view toggled from the curve-panel header (**Cost curve ⇄ Zoom out · year**).
`YearCurve` in `CurvePanel.tsx` lays the DPM `seasonal[]` bands across a 365-day axis as
a load-duration curve — sorted by demand, each band coloured by the fee that demand level
charges and labelled `{demand}% · {days}d · {fee}` — so a glance shows how much of the year
sits at each demand/fee level. Reads the same store; no engine change.

### 4. Year 1/2/3 deployment-phase toggle removed
The YR 1·2·3 segmented control is gone from the TopBar. `setPhase` remains exported on
`window.ProjectQ` (and `phase.real_pay_cap` still drives the real-pay-cap line) for
backward compatibility with the live-agent command API — only the UI affordance was removed.

---

## Dashboard tweaks (2026-05-30)

- **Lever max bounds lowered** (in `dpm-payloads/venice-2026.json`):
  target_capacity 1,000,000 → **350,000**, base_fee 500 → **100**,
  max_fee_cap 2,000 → **1,000**, ceiling_pct 1,000 → **300%**. Ticks still derive
  from the payload bounds.
- **Removed the left-hand €-axis number labels** on the cost curve (they read as a
  mislabel against the actual fee values). Horizontal gridlines are kept; the
  euro values are carried by the curve markers and the active-day callout.
- **Modelling day is now free-form.** The Demand field is an editable `%` input —
  type any value and the curve dot, callout and revenue recompute from it. Backed
  by `state.customDemand`, which overrides the selected `day_type` everywhere via
  `activeDayType()`; choosing a preset day from the dropdown clears the override.
  New `setDemand(pct | null)` command added to the `window.ProjectQ` API (clamped
  0–400%). Verified live: typing 175 → demand 175; picking December weekday →
  reverts to 45%.

---

## Calendar date picker (2026-05-30)

The operator can now model **any specific calendar date**, not just the preset day
types or a raw demand %.

- A native **date input** sits in the TopBar (Modelling-day group). Pick any date
  and the dashboard models that day.
- The demand % for the chosen date is **interpolated deterministically from the
  DPM's own `day_type` date anchors** (each carries a date + `demand_pct`): an
  anchor date resolves to its exact demand; a date between two anchors blends
  linearly; the Dec→Jan boundary wraps. No demand is invented — only Ollie's DPM
  values are blended. Verified live: 1 Aug → 200%, 9 Dec → 45%, 27 May → 130%,
  14 Feb → 160%, 1 Jul → 167% (between Biennale 130% and Peak 200%).
- New deterministic `src/control/dateutil.ts` (Sakamoto weekday + day-of-year,
  **no `Date.now`, no `Math.random`, no timezone reads**) keeps the live-agent
  read-back property intact.
- `state.customDate` holds the picked ISO date; it drives the whole dashboard via
  `activeDayType()` (callout shows e.g. "Calendar day · Sat 1 Aug 2026 · 200%").
  New `setDate(iso | null)` command on `window.ProjectQ`. Choosing a preset day or
  typing a raw % clears the date; `setDate(null)` reverts.

---

## Remove shoulder rebate + voice control (2026-05-30)

### Shoulder-season recirculation retired
The feature is fully removed from the product surface:
- The rebate toggle row is gone from the Levers panel; the credit zone and the
  "Credit" legend swatch are gone from the cost curve.
- `loadPayload()` **force-disables** `shoulder_rebate.enabled` on every load, so no
  payload (legacy or uploaded) can re-introduce the credit zone.
- `setRebate()` is kept on the `window.ProjectQ` API for backward compatibility but
  is now a no-op (the rebate stays off). Verified live: rebate row count 0, credit
  legend count 0, `setRebate(true)` leaves it disabled, and fee at 10% is €10 (base)
  instead of a −€8 credit.

### Voice control mode + audible confirmations (first integration)
Speak commands to drive the dashboard; it applies the change **and speaks a
confirmation back**.
- **`voice.ts`** — pure, deterministic parser (`interpretCommand`) + a shared
  executor (`executeVoiceCommand`). Handles levers, free-form demand, day types,
  curve view, and theme. Understands digit forms ("30,000", "600", "1.2m") and
  spoken numbers ("fifty thousand", "two hundred").
- **`VoiceControl.tsx`** — a mic toggle pinned bottom-right (Web Speech API
  `SpeechRecognition`). It shows the recognized transcript and **speaks the
  confirmation** via `SpeechSynthesis`. Example: asking to lower target capacity
  speaks *"Target capacity successfully lowered to 30,000."* Other confirmations:
  *"Max-fee cap successfully raised to 600 euro."*, *"Now modelling December
  weekday, 45 percent of target."*, *"Showing the annual demand profile."*
- The curve view was lifted into the store (`state.view` + `setView`) so voice (and
  the live agent) can switch the hero chart.
- **`window.ProjectQ.voiceCommand(transcript)`** exposes the same parse→apply→confirm
  path as a return-string API — used by the live agent and by the headless test
  (no microphone needed). Browser support: Chrome/Edge/Safari (Web Speech API);
  where unavailable the mic button hides but `voiceCommand` still works.

---

## Voice refinements (2026-05-30)

Three follow-ups to the first voice integration.

### Softer, more feminine voice
`pickFemaleVoice()` scores the browser's installed voices and prefers known soft
female voices (Samantha, Victoria, Serena, Aria, Google UK English Female, …),
then any voice advertising "female", avoiding obviously male voices. Delivery was
softened: `rate 0.95`, `pitch 1.35`, `volume 0.9`.

### Fixed the continuous command-repeat
The confirmation spoken aloud was being picked up by the microphone and re-run as
a fresh command — an endless loop. Fixed with a self-hearing guard: while speaking
(and for ~700 ms after) `speakingRef`/`muteUntil` are set, and `handleTranscript()`
drops any result heard during that window or that echoes the last confirmation.
Recognition still auto-restarts on silence for session continuity, but it can no
longer re-trigger its own reply.

### Every control is voice-reachable, including the date picker
`parseSpokenDate()` (in `dateutil.ts`) understands ISO ("2026-08-01"), "August 1st",
"9th of December", "first of July" (ordinal words), and an optional explicit year.
New `date` and `reset` voice intents; `setDate` is wired into the shared executor
and `window.ProjectQ.voiceCommand`. Spoken dates interpolate demand from the DPM
day_type anchors exactly like the picker (e.g. "first of July" → 1 Jul 2026, 167%).
Full coverage now: levers, free-form demand, day types, **calendar date**, reset,
curve view, and theme. Verified live: 15/15 commands, 0 console errors.

---

## Voice sensitivity + warmth (2026-05-30)

### Stay silent on unrecognized audio
Continuous recognition transcribes *everything* the mic hears — a phone buzz,
background chatter — and the assistant was speaking "sorry, didn't catch that" at
each one. `tryVoiceCommand()` now returns a `{ recognized, reply }` pair, and
`VoiceControl` only speaks when `recognized` is true. Unrecognized audio is dropped
silently and never changes state. `window.ProjectQ.voiceCommand` keeps its string
API via a thin wrapper. Verified live: 5 noise phrases leave state unchanged; real
commands still apply and confirm.

### Warmer, less harsh voice
`pickFemaleVoice()` now prefers warm neural/premium female voices (Samantha / Siri /
Ava, Microsoft *Natural, Google) and explicitly skips harsh or novelty voices
(Zira, eSpeak, Compact, Zarvox, …). Prosody softened: pitch **1.35 → 1.05** (high
pitch read as tinny/harsh on legacy voices), rate 0.95, volume 0.85. The exact voice
still depends on what's installed in the pitch machine's browser/OS; the preference
list picks the best available and avoids the robotic ones.

---

## Voice no-repeat (decisive) + graph/demand clarity (2026-05-30)

### Voice now speaks exactly once
Earlier guards only *ignored* self-heard audio while the mic stayed live. The
decisive fix: the microphone is **physically stopped** before a confirmation is
spoken and only restarted in the utterance's `onend` (plus a length-estimated
safety timer in case `onend` is dropped). `recognition.onend` no longer
auto-restarts while `suspended`, so the assistant is genuinely deaf while it talks
and cannot hear or repeat its own reply. Added transcript dedupe (same result
within 2.5 s ignored). Verified live: noise stays silent, real commands apply once.

### Zoom-out graph made legible for non-technical viewers
It was a load-duration curve — accurate but opaque. Now:
- Retitled **"How busy the city is across the year"**, sub *"365 days grouped
  busiest → quietest · taller = more crowded"*.
- Each band reads in plain English: **Very busy / Busy / Normal / Quiet / Very
  quiet**, with the number of days and the fee on those days.
- Axis captions ("↑ How busy — 100% = normal day", "Days of the year, busiest →
  quietest"), plus a one-paragraph explainer beneath the chart.

### "Demand %" explained
The top-bar field is renamed **"Crowd level"** with a hover **"?"** explainer:
*how busy the day is vs. a normal day — 100% = a normal day, 200% = twice as
crowded, 50% = half-empty; higher crowds = higher fee.* The cost-curve sub-line
now reads "X% of a normal day".

---

## Voice routing fix + sustainability fee (2026-05-30)

### Voice no longer "transfixed on target capacity"
`target_capacity` carried greedy bare keywords ("target", "capacity", "visitors")
and the matcher returned the FIRST lever whose keyword appeared — so almost any
phrase collapsed onto target capacity. Now every matching phrase is scored by
**specificity** (multi-word and longer phrases score higher) and the highest
scorer wins: "capacity ceiling" → ceiling_pct, "fee cap" → max_fee_cap, "base fee"
→ base_fee, "target capacity" → target_capacity. Ambiguous or mis-heard input with
no clear control + number returns null and the assistant stays silent instead of
defaulting to a lever. Verified live: each command hits its intended control,
target capacity is untouched unless explicitly named, and 4 ambiguous phrases
("the target", "capacity", "increase it to 500", …) change nothing.

### "Sustainability fee if booked today"
A new headline number at the top of the revenue rail: the per-visitor fee at the
crowd level currently being modelled — `d.fee(activeDay.demand_pct)` — with a
"per visitor · N% of a normal day · {date}" note. It reads from the store and
recomputes instantly as levers, crowd level, or the modelled date change (e.g.
€50 at a 200% peak-summer-Saturday day). Whole euros, matches the rest of the UI.

---

## Apple-glass dark mode (2026-05-30)

Replaced the warm-brown dark palette with a cool, neutral **glassmorphism** theme:
- Deep slate canvas (`#0b0d12`) with a subtle deep-space gradient and vivid blurred
  colour blobs behind everything (blue / teal / violet / faint amber) — this is what
  makes the frosting read.
- The top bar, panels, revenue/sustainability cards, toasts and the voice button are
  now **translucent frosted glass**: `backdrop-filter: saturate(180%) blur(22px)`,
  thin light borders and an inner top highlight (Apple-style).
- Cooled the card corner-glows and component tints (sliders, toggles, chips, selects,
  date/upload fields) off brown onto white-alpha; the sustainability-fee card gets a
  blue/teal wash. Brand accent colours (ochre fee curve, teal Q-Cash, penalty orange)
  and the entire light theme are unchanged.

Verified live (1440×900, 2× DPR) in both the cost-curve and annual views; layout
holds, no scroll, 0 console errors. Note: the frosted glass uses `backdrop-filter`,
supported by all current Chrome/Edge/Safari/Firefox.

---

## Levers box fit (2026-05-30)

Adding the "Sustainability fee if booked today" card made the revenue panel taller,
and the right-rail grid (`auto 1fr`) only handed the leftover space to the Levers
panel — so its last slider (Capacity ceiling) and the 120% / 1000% tick labels were
clipped by the panel's `overflow: hidden`. Fixed by flipping the rail to
`grid-template-rows: minmax(0, 1fr) auto`: the **Levers box always gets its full
natural height** and the Revenue panel flexes into the remaining space (also dropped
the `levers-list { flex: 1 }` stretch). Verified live that all four sliders + their
tick labels are fully visible with no document scroll at both 1280×800
(panel bottom 787 ≤ 800) and 1440×900 (886 ≤ 900).

---

## Analyst agent + revenue-figure fit (2026-05-30)

### Deterministic in-UI analyst (no LLM)
`analyst.ts` + `AnalystPanel.tsx` add a pure reasoning layer over the SAME calc
engine — honouring "no LLM math in the live loop". Two capabilities:
- **Explain** — *"why is Feb 2nd's demand 139%?"* names the two DPM anchor days the
  value is interpolated between ("December weekday — 45%, 55 days before" /
  "Carnival Saturday — 160%, 12 days after"), the blend weight (82% of the way) and
  the result. *"why is the fee on August 1st?"* explains plateau / exponent curve /
  ceiling. Truthful — every number comes from the live model, nothing invented.
- **Goal-seek** — *"raise January revenue by €3M by changing the base fee"* runs a
  bisection solver over the chosen lever against a real per-day → per-month (or
  annual) revenue model, returns the exact lever value and the **honest achieved
  delta**, with a one-click **Apply** button (calls `setLever`). Handles annual and
  any named month, "by"/"to", raise/lower, and reports when a target is out of a
  lever's range. Verified live: Jan +€3M → base fee €12 (+€3.32M); Apply moved base
  fee 10→17 and annual revenue +€106.6M.
- Chat UI: floating "Analyst" button (bottom-right, **Cmd/Ctrl+J**), suggestion
  chips, frosted-glass dark styling. Exposed as `window.ProjectQ.askAnalyst(q)`.

### Revenue figures no longer clip
Shrunk the revenue card figures (`rev-figure` clamp 44 → 32px) and the
sustainability-fee figure so large euro values (e.g. €353,340,503) always fit;
verified no figure/label/note overflows its card.

---

## Analyst v2 — comparison, revenue explain, voice (2026-05-30)

Three upgrades to the deterministic analyst (still no LLM):
- **Compare levers** — *"what's the cheapest way to add €80M to annual revenue?"*
  solves all four levers against the goal, ranks by closeness-then-smallest-move,
  names the cheapest (e.g. Max-fee cap €50 → €70, lands €433.76M) with an Apply
  button, and lists the alternatives with where each lands. When the ask is smaller
  than one lever step (e.g. €3M against €353M annual) it says so honestly and shows
  the closest, instead of a misleading no-op.
- **Explain revenue** — *"why is annual revenue so high?"* breaks the total into the
  DPM seasonal bands (visitors × fee × days, sorted by contribution);
  *"explain January's revenue"* gives the per-day sum with a worked mid-month
  example. Every figure is from the live engine.
- **Spoken answers** — new shared `speech.ts` (warm female voice picker +
  `speak`/`cancelSpeech`) reads a condensed summary of each analyst reply aloud; a
  speaker toggle in the panel header (persisted to `localStorage`) mutes it.

Verified live: big-target comparison ranks levers + Apply; small-target honesty;
annual + monthly revenue breakdowns; speaker toggle present and speaking; originals
(why-demand anchors, goal-seek + Apply moving the engine) intact; 0 console errors.

---

## Zoom-out graph label overlap fix (2026-05-31)

The annual ("zoom out") view crammed three label sets into the top-left — the band
labels floated ABOVE each band and collided with the y-axis caption and the
modelled-day line label. Cleaned up:
- **Band labels** (Very busy / Busy / … + "N days · fee") now sit **inside** each
  step (below its top line), only when the step is tall and wide enough.
- The **modelled-day caption** moved to a **fixed top-left slot** above the plot,
  with a small dot where the line meets the y-axis — so it never lands on a band.
- Removed the redundant "↑ How busy" y-axis caption (the % gridlines + panel header
  already convey it).

Verified with a bounding-box collision sweep across demand **30% → 200%** at both
1280×800 and 1920×1200, light and dark, **on production**: zero text overlaps.

---

## Demand-response zoom-out (2026-05-31)

The annual ("zoom out") view was a static load-duration curve the levers didn't
touch. It now models the whole point of dynamic pricing — **higher fees deter peak
crowds and flatten the year toward 100% capacity**.

- New deterministic `managedDemandPct()` in state.ts:
  `managed = 100 + (raw − 100) · e^(−fee / DEMAND_REF_EUR)` (ref €30). The fee, set
  from the day's forecast demand, compresses that day's deviation from 100% — peak
  days carry the top fee so they compress most; quiet days near the base fee barely
  move. Exposed on `window.ProjectQ.managedDemandPct`.
- The chart draws the **raw forecast** as a faint dashed line and the **managed**
  outcome as the solid bands, with drop-arrows and a "% flatter → 100%" badge;
  retitled "Flattening the year toward 100%" with a demand-response explainer.
- Raising **base fee** / **max-fee cap**, or lowering the **ceiling**, all flatten
  the curve toward target. Verified monotonic (live): spread-from-100
  **18.5 → 8.2 → 4.9 → 4.2**, peak day **119% → 100%**.
- Band labels rebuilt to a width/room-aware single label so they never overlap
  even when flattened bands cluster near 100%; modelled-day caption moved to the
  bottom-left. Collision-swept across 8 lever combos at 1280 & 1920 on production:
  0 overlaps.

---

## Occupancy target + auto-tune (2026-05-31)

The authority can now set the occupancy it wants to hold (e.g. *"Venice wants 80%
today"*) and the fee levers **auto-tune** to deter crowds above it and steer the
year toward it.

- `state.occupancy_target` (default 100). `managedDemandPct` now flattens toward the
  target: `managed = target + (raw − target) · e^(−fee/REF)`; `occupancyTarget()`
  getter exposed on `window.ProjectQ`.
- `setOccupancyTarget(pct)`: solves the fee the busiest forecast day needs to settle
  at the target and sets `max_fee_cap` (clamped), lowering the `ceiling` if the peak
  wouldn't otherwise reach the cap fee. Verified live: target 80 → peak day **81%**,
  target 60 → **61%**. `null` resets to 100%.
- **Voice command:** *"we only want 80% capacity today"* / *"hold occupancy at 70
  percent"* → occupancy intent (guarded so it never grabs the `target_capacity`
  lever — confirmed a normal "set target capacity to 70,000" still routes correctly),
  with a spoken confirmation. Also on `window.ProjectQ.setOccupancyTarget` + `voiceCommand`.
- **UI:** a *"Occupancy target"* field in the TopBar (with a ? explainer); the
  zoom-out TARGET line and title now follow the chosen target ("Steering the year
  toward N% capacity"), so the managed curve visibly settles on the target line.

Modelling note: the deterrence strength uses `DEMAND_REF_EUR` (€30) — the same
price-sensitivity assumption as the demand-response curve; it calibrates when the
DPM ships an elasticity figure.

---

## Unified assistant + suggest (2026-05-31)

### Voice control and the analyst are now one feature
Merged `VoiceControl` into the analyst as a single **Project Q Assistant** panel:
- One floating "Assistant" button (or **Cmd/Ctrl+J**) opens a chat with the **mic
  built into the input row**. Talk or type — either works.
- Direct commands ("set base fee to 20", "we only want 80% capacity", "dark mode")
  are recognized and **auto-applied**; questions ("why is…", "suggest…", "cheapest
  way to…") go to the analyst. Questions always beat command-matching, so
  "why is Feb 2nd's demand…" returns the analysis rather than being read as a date
  command.
- The same warm female voice reads replies aloud (speaker toggle in the header);
  the mic is physically muted while it speaks, so it never hears/repeats itself.
- The standalone voice button + bubble were removed.

### New: "suggest lever settings for this day and explain"
The analyst recommends concrete `base_fee` / `max_fee_cap` / `ceiling_pct` values
that settle the modelled day on the occupancy target, with a plain-English rationale
("Peak summer Saturday is forecast at 200% — 100 points over your 100% target… set
Max-fee cap → €120, Capacity ceiling → 200%, Base fee → €10… settles it at ~100%"),
and a **one-click Apply that moves all the levers at once** (`AnalystAction` now
supports `setLevers[]`). If the day is already under target it advises keeping fees
gentle rather than over-penalising. Verified live alongside control commands,
occupancy, and questions in the same box; occupancy + demand regressions still pass;
0 console errors.

---

## Background voice assistant + ElevenLabs (2026-05-31)

### Voice-only, out of the way
The assistant is now a small **mic orb pinned bottom-left** — clear of the curve,
levers and revenue panels (it used to sit bottom-right and crowd the levers). It's
voice-only: **no text box, no chat log**. Tap it (or **⌘/Ctrl+J**) to start
listening, then just talk; it runs in the background, replies **audibly**, and a
compact status pill shows only what it heard / said (auto-fades). A pulsing ring
signals it's live. A suggested lever change is **auto-applied by voice** — no click.
Commands apply, questions are answered; it stays silent on background noise.

### Upgrading the voice — ElevenLabs
`speak()` uses **ElevenLabs** premium TTS when a key is configured, otherwise the
warm built-in browser voice (so it's never silent). Enable it from the console:
```js
window.ProjectQ.setVoiceApiKey("YOUR_ELEVENLABS_KEY", "optional-voice-id")
```
(persists to `localStorage` `qctl-eleven-key` / `qctl-eleven-voice`; pass `null` to
clear). It streams `eleven_turbo_v2` MP3 and falls back to the browser voice on any
error or quota issue. `usingPremiumVoice()` reports which engine is active.
**Security:** a key embedded in the browser is visible in dev-tools — fine for a
local pitch demo, but for production route TTS through a small server proxy that
holds the key and returns the audio.

---

## Day capacity rendering (2026-05-31)

Surfaced Venice's actual capacity in plain numbers, and switched the Capacity
ceiling lever from a bare percentage to a visitor count.

- **Top bar** now shows the day capacity: the Location field reads
  *"Location · 50k visitors/day"* (target capacity) and the Crowd-level field reads
  *"Crowd level · 100k today"* — the real headcount for the modelled day
  (target capacity × today's crowd level, e.g. 50,000 × 200% = 100,000 on a peak
  Saturday).
- **Capacity ceiling lever** now displays an absolute count — *100,000/day* at 200%
  of a 50,000 target — with its tick bounds converted to people (60k / 150k) and the
  original percentage kept in the sub-line (*"Crowd limit · 200% of target"*) for
  context. The stored lever value remains a percentage, so the cost-curve math, the
  slider, and voice commands ("set capacity ceiling to 250") are unchanged. Verified
  live: ceiling 150% → "75,000/day", voice still applies, occupancy + demand
  regressions pass, 0 console errors.

---

## Realistic capacity bounds (2026-05-31)

The lever upper bounds were wildly unrealistic for Venice — target capacity slid to
350,000 and the ceiling to 300% (≈150k+), giving 400k+ figures. Venice's highest-ever
recorded daily footfall is ~110,000, so the DPM payload bounds were rebased around it:
- `target_capacity` max **350,000 → 70,000** (step 1,000)
- `max_fee_cap` max **€1,000 → €150** (step 5)
- `ceiling_pct` max **300% → 220%** — 220% of the 50,000 target = **110,000/day**, the
  real record; default 200% = 100,000/day
- `base_fee` max **€100 → €50**

So the Capacity-ceiling slider now tops out at exactly Venice's record (110k) and nothing
reads 400k+. Values only — engine and UI logic unchanged. The occupancy auto-tune
(lands the peak day's cap at 140, within the new €150 max) and the demand-response
regressions still pass; 0 console errors. Verified live: ceiling ticks 60k / **110k**.

---

## Female-only premium voices (2026-05-31)

**On the Claude API question:** the Claude / Anthropic API is **text-only** — it has
no text-to-speech, so there's no "Claude voice" to connect. For a better voice the
right engine is **ElevenLabs**, which is what the app wires up.

The premium voice is now **strictly female**:
- A curated catalogue of 7 named female ElevenLabs voices — Rachel (warm·calm·pro),
  Bella, Elli, Charlotte (British·elegant), Matilda (warm·mature), Grace, Lily.
- `window.ProjectQ.listVoices()` returns them (name + note); `setVoice("Charlotte")`
  switches by name; `setVoiceApiKey(key, "Charlotte")` enables + sets in one call.
- **Every** voice selection is resolved through the female catalogue — a name, a
  curated id, or anything unknown/male all map to a female voice (unknown → default
  Rachel), so the assistant can **never** speak in a male voice. The browser
  fallback also strongly prefers female voices.

Verified live: 7 female voices listed, set-by-name resolves correctly, "David" →
Rachel fallback, clear works, 0 errors.

### How to enable a premium female voice
```js
window.ProjectQ.listVoices()                                  // see the options
window.ProjectQ.setVoiceApiKey("YOUR_ELEVENLABS_KEY", "Charlotte")  // enable
window.ProjectQ.setVoice("Matilda")                           // switch anytime
```
(In-browser key is dev-tools visible — fine for a local pitch; proxy server-side for
production.)

---

## Secure server voice proxy / Option B (2026-05-31)

The proper, secure ElevenLabs setup — the key never reaches the browser.
- **`api/tts.ts`** (Vercel edge function) reads the key from the server env var
  `ELEVENLABS_API_KEY`. `GET /api/tts` → `{ ok }` health probe; `POST {text,voiceId}`
  → streams `audio/mpeg`. Hardened: only the curated female voice ids are accepted,
  800-char cap, `no-store`. The key name is **absent from the client bundle**.
- **`speech.ts`** `speak()` now prefers the secure proxy: probes `GET /api/tts` once
  on boot (`initServerVoice`), then per reply tries **proxy → client-side key →
  browser voice**, falling through on any failure so it's never silent.
  `window.ProjectQ.voiceStatus()` reports the engine (`server-proxy` / `client-key`
  / `browser`).
- Verified live: `/api/tts` GET returns `{"ok":false}` (proxy deployed, key not set
  yet — correct), the voice API + 7 female voices still work, 0 console errors. In
  dev the probe falls back cleanly to the browser voice.

### Setup (do this once)
1. **elevenlabs.io → Profile → API key** — copy it.
2. **Vercel → your project → Settings → Environment Variables** → add
   `ELEVENLABS_API_KEY = <your key>`, scope **Production** (NO `VITE_` prefix — that
   keeps it server-only).
3. **Redeploy** (Deployments → Redeploy, or push any commit).
4. Done — the dashboard auto-detects `/api/tts`; the assistant speaks in the premium
   female voice for **all** visitors, key never exposed. Verify in the console:
   `window.ProjectQ.voiceStatus()` should report `engine: "server-proxy"`. Pick a
   voice with `window.ProjectQ.setVoice("Charlotte")`. It can never be male (server
   allowlist + female default).

---

## Voice proxy: env-var name + free-plan finding (2026-05-31)

After the user added the key and redeployed, `/api/tts` still reported `{ok:false}`.
A safe `?debug=1` health diagnostic (env var NAMES only, never values) revealed:
1. **Edge runtime** didn't expose `process.env` reliably → switched `api/tts.ts` to a
   **Node** serverless function (`process.env.ELEVENLABS_API_KEY` now resolves).
2. The Vercel var was named **`ElevenLabs_API_Key`**, but env names are
   case-sensitive — it didn't match `ELEVENLABS_API_KEY`. Added `findElevenKey()`
   which accepts `ELEVENLABS_API_KEY` / `ELEVEN_API_KEY` or any env name normalising
   to contain "eleven" + "key", so the existing var now works as-is. After this the
   probe returns `{ok:true, keyLength:51}`.
3. A real POST then returned ElevenLabs **402 `paid_plan_required`**: *"Free users
   cannot use library voices via the API."* So the curated premium voices need a
   **paid ElevenLabs plan** (Starter ~$5/mo). The key + proxy are correct; only the
   plan blocks it.

Resilience added: a runtime proxy failure (402/403/5xx) now disables the proxy for
the session and falls straight to the warm browser voice, so the assistant is never
silent and doesn't retry a failing round-trip on every reply. `voiceStatus()` and
`usingPremiumVoice()` reflect the disabled state. The `?debug=1` endpoint returns
only names/lengths (no secret) for future setup checks.

**To get the premium ElevenLabs voice working:** upgrade the ElevenLabs account to
any paid tier (Starter is enough) — no code change needed. To stay free, point the
proxy at a voice in your own "My Voices" (free accounts can use those via the API).
