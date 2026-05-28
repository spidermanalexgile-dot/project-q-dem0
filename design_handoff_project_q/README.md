# Handoff: Project Q — Venice Authority Control Dashboard

## Overview

This is the **live pitch instrument** for selling Project Q (dynamic tourism pricing) to city decision-makers — bureaucrats, not technologists. One person holds it open during the meeting. They pull levers; the consumer cost curve redraws and the day/annual revenue figures update **instantly**. The goal of the UI is to make a non-technical decision-maker feel **smart, in control, and impressed by the speed** — every change resolves on screen in ≤10s (target: instant).

This is the **authority/control** experience — NOT the consumer-facing app.

The product answer this UI delivers: *"What do I control, and what revenue + crowd outcome results when I move it?"*

---

## About the Design Files

The files in this bundle are **design references built in HTML/JSX prototype form** — they show the intended look, behaviour, layout, and architecture. They are **not production code to ship directly**.

Your task is to **recreate this design in the target codebase's existing environment** (React/Next, Vue, SvelteKit, etc.) using its established patterns, component library, and conventions. If no codebase exists yet, **React + TypeScript + Vite** is a sensible default — the prototype maps onto it 1:1.

Treat `state.js` and the architectural contract in this README as the source of truth — the UI is a thin shell over a deterministic calc engine, and that separation matters more than any visual detail.

---

## Fidelity

**High-fidelity.** Colours, typography, spacing, curve shape, and interactions are final. Recreate pixel-faithfully using your codebase's existing primitives. The visual DNA (warm earth palette, Outfit + IBM Plex Mono, grain overlay, gradient curve) is intentional and matches the rest of the Project Q product surface.

---

## The One Rule

**Single screen, no scrolling. Ever.** Landscape, sized for a monitor or iPad. Everything visible at once. Designed for ~1280×800 minimum, scales gracefully up to ~1920×1200.

**All figures in EUR (€). Whole integers only. No decimals, no cents.**

---

## Architecture — Read This First

The UI is a **cockpit, not a data source**. It holds **zero hardcoded city data**.

Every number — capacity, fees, curve shape, demand profile, revenue, day-types, confidence — is supplied at runtime by an external **DPM (Dynamic Pricing Model)**. The DPM is the brain (heavy offline estimation per city, lives elsewhere); this UI is the instant, deterministic display + control surface that reads the DPM's output and reacts.

Two architectural consequences the build **must** honour:

### 1. Swap the data, swap the city.

Loading a different DPM payload turns a Venice pitch into a Dubrovnik pitch in seconds, with **zero UI code changes**.

### 2. One source of truth, many writers.

A single state store drives everything on screen. It can be mutated by:
- **(a)** the human moving a lever
- **(b)** an external live agent during the pitch translating speech → lever changes
- **(c)** loading a new DPM payload

Any mutation → instant recompute → re-render. The human and the agent call the **same** commands.

This is what enables Trevor's "they protest, the solution's on screen in 10 seconds" demo, and the verbal-control demo, with no rebuild between cities.

---

## DPM Data Contract (the input the UI reads)

In production the DPM emits a **Markdown file** with a machine-readable block (YAML front-matter or a fenced ` ```json ` block) carrying the parameters, plus human-readable narrative the UI may optionally surface. The UI parses the structured block and renders whatever it declares.

The current prototype loads `payload-venice.js` directly — replace that with a markdown/JSON loader in production.

**Canonical shape** (Venice example shown — none of these values are special-cased in UI logic):

```yaml
location: { id: venice, label: "Venice", currency: EUR }
capacity: { target: 50000, unit: "visitors/day" }   # 100% anchor
confidence: 40                                       # DPM confidence %

curve:
  base_fee_at_target: 10        # € at 100%
  max_fee_cap: 50               # € asymptote
  ceiling_pct: 200              # where curve goes near-vertical
  shape: { plateau_end_pct: 100, exponent: 2.2 }

shoulder_rebate:
  enabled: true
  credit: 8                     # € Q-Cash credit
  applies_below_pct: 28         # below this capacity %, visitors receive credit

levers:                         # which levers to expose + bounds + current value
  - { id: target_capacity, min: 20000, max: 120000, step: 1000, value: 50000 }
  - { id: base_fee,        min: 0,     max: 50,     step: 1,    value: 10 }
  - { id: max_fee_cap,     min: 10,    max: 200,    step: 5,    value: 50 }
  - { id: ceiling_pct,     min: 120,   max: 250,    step: 5,    value: 200 }

day_types:
  - { id: peak_sat,    label: "Peak summer Saturday", date: "Sat 17 Jun", demand_pct: 200 }
  - { id: dec_weekday, label: "December weekday",     date: "Tue 5 Dec",  demand_pct: 45 }
  # ... more day types

phase: { year: 1, real_pay_cap: 20 }

seasonal:                       # weighting used for annual rollup
  - { days: 30, demand_pct: 200 }
  - { days: 50, demand_pct: 150 }
  # ... etc, days must sum to ~365
```

**Validation rules** (enforce these on payload load):
- `days` in `seasonal` should sum to ~365
- All `levers[].value` must be within `[min, max]`
- At least one `day_types` entry required
- `ceiling_pct > plateau_end_pct`
- `max_fee_cap > base_fee_at_target`

---

## Live Control / Agent API

Expose a documented command API on the running app (currently on `window.ProjectQ`) so an **external live agent (voice or text) can drive the screen during the pitch, identically to the human**.

In a production framework, expose this either:
- As an imperative handle (`window.ProjectQ` is fine — pitch tooling is the only consumer)
- Or as a `useProjectQ()` hook with `dispatch()` for in-React consumers

### Commands (must all exist, signatures must match)

| Method | Args | Behaviour |
|---|---|---|
| `loadPayload(payload)` | DPM payload object (or parsed markdown) | Replace entire state. Triggers full re-render. |
| `setLever(id, value)` | `id: string, value: number` | Clamps to `[min, max]`, mutates lever, recomputes. No-op if unchanged. |
| `setDayType(id)` | `id: string` | Switch the modelled day. |
| `setPhase(year)` | `1 \| 2 \| 3` | Year 1 = capped & gentle (real pay ~€20, rest as Q-Cash); Years 2–3 escalate. Updates `phase.real_pay_cap`. |
| `setRebate(enabled)` | `boolean` | Toggle shoulder-season rebate. |
| `getState()` | — | Returns full current state (so agent can read back & confirm). |
| `subscribe(fn)` | `fn(state)` | Returns unsubscribe. UI uses this to re-render. |
| `compute()` | — | Returns derived `{ activeDay, dayRevenue, annualRevenue, prevDayRev, prevAnnualRev, fee, pay, qcash }`. |
| `feeAtPct(pct)`, `payAtPct(pct)`, `qcashAtPct(pct)`, `dayRevenue(demandPct)`, `annualRevenue()` | — | Pure calc helpers, exposed for the agent to read back. |

### Agent example
Agent hears *"cap it at thirty euros, ceiling one-eighty"* during the pitch:
```js
window.ProjectQ.setLever('max_fee_cap', 30);
window.ProjectQ.setLever('ceiling_pct', 180);
```
Curve and revenue figures recompute and re-render in <100ms.

---

## Calc Engine (Deterministic)

**Critical rule (Trevor's): NO LLM math in the live loop.** The DPM (offline) does the heavy estimation/web-search work and ships parameters. The UI does the **instant deterministic display arithmetic** that turns those parameters + current lever values into the curve and revenue figures.

See `state.js` — all calc functions are pure, side-effect-free, integer-rounded for display.

### Fee curve formula

```
feeAtPct(pct):
  if rebate.enabled AND pct < rebate.applies_below_pct:
    return -rebate.credit                    // credit zone, negative fee
  if pct <= plateau_end_pct:                 // 100% by default
    return base_fee
  if pct >= ceiling_pct:
    return max_fee_cap
  t  = (pct - plateau_end_pct) / (ceiling_pct - plateau_end_pct)   // 0..1
  tp = t ^ exponent                           // exponent=2.2 default
  return base_fee + (max_fee_cap - base_fee) * tp
```

### Pay vs. Q-Cash split

```
payAtPct(pct)   = min(feeAtPct(pct), phase.real_pay_cap)
qcashAtPct(pct) = max(0, feeAtPct(pct) - phase.real_pay_cap)
```

### Revenue

```
dayRevenue(demandPct) = target_capacity * (demandPct/100) * feeAtPct(demandPct)
annualRevenue        = Σ over seasonal[]:  days * dayRevenue(demand_pct)
```

### Delta tracking

Before any mutation: snapshot `__lastDayRev` / `__lastAnnualRev` into `__prevDayRev` / `__prevAnnualRev`. After mutation: recompute & store new "last". UI renders a `▲ +€xxx` chip showing `current - prev`. Chip auto-fades after 3.5s (back to "no change") to keep the screen calm between protests.

---

## Screen Layout (single viewport, three zones)

```
┌───────────────────────────────────────────────────────────────────────┐
│  TOP BAR:  [logo] Project Q                                            │
│            Location ▾  ·  Modelling day ▾  ·  Demand %    YR 1·2·3   │
├───────────────────────────────────────────┬───────────────────────────┤
│                                             │  REVENUE  (always-on)    │
│        CONSUMER COST CURVE                  │  ┌────────────────────┐  │
│        (hero visual, ~60% width)            │  │ TOTAL DAY REVENUE  │  │
│                                             │  │   € 385,000        │  │
│   €  fee                                    │  │   ▲ +€120k          │  │
│   │            ╱ exponential               │  └────────────────────┘  │
│   │      ____╱   tail                       │  ┌────────────────────┐  │
│   │  ___/  plateau                          │  │ TOTAL ANNUAL REV   │  │
│   │ / credit                                │  │   € 47,200,000     │  │
│   └──────────────── capacity %              │  │   ▲ +€8.1M          │  │
│      50%   100%(target)   200%(ceiling)     │  └────────────────────┘  │
│                                             │                          │
│   [decile strip: per-10% fee buckets]       │  LEVERS                  │
│                                             │  Target capacity   ──●   │
│                                             │  Base fee at 100%  ──●   │
│                                             │  Max-fee cap       ────● │
│                                             │  Capacity ceiling  ──●   │
│                                             │  Shoulder rebate   [on]  │
└─────────────────────────────────────────────┴──────────────────────────┘
```

### Grid
- Root: `grid-template-rows: auto 1fr` (top bar + main).
- Main: `grid-template-columns: minmax(0, 1.55fr) minmax(360px, 1fr)` (curve + right rail).
- Right rail: `grid-template-rows: auto 1fr` (revenue + levers).
- Outer padding: `clamp(12px, 1.6vh, 20px) clamp(14px, 1.6vw, 24px)`.
- Gap between major panels: `clamp(10px, 1.2vw, 18px)`.

---

## Component Specs

### 1. TOP BAR

Single horizontal bar, three regions:

**Left (brand):**
- `28×28` rounded square logo mark — radial gradient (ochre top-left, sage bottom-right, earth base), 9px border-radius
- "Project Q" — Outfit 600, ~16px
- "Authority Control · v0.4" — IBM Plex Mono, 10.5px, uppercase, letter-spacing 0.12em, mute colour

**Centre (context selectors):**
- **Location** dropdown (currently shows "Venice"; "Dubrovnik" and "Barcelona" disabled until payloads exist)
- **Modelling day** dropdown — lists every `day_types[]` entry as `"{label} · {date}"`
- **Demand** read-only chip — shows active day's `demand_pct` as `200%`
- All three: tiny mono uppercase label above (`tb-label` style), styled `<select>` below with custom chevron

**Right (deployment phase):**
- Segmented control / pill toggle with three options: **YR 1**, **YR 2**, **YR 3**
- Active state: solid earth-coloured background, stone text
- Inactive: transparent, mute text, hover lifts to ink
- Mono 11.5px, letter-spacing 0.08em

### 2. CONSUMER COST CURVE (hero)

The single most important element. Cinematic, premium-feeling chart. Drawn as one SVG with `viewBox="0 0 1000 580"` that scales with CSS.

**Axes:**
- X: capacity %, range `20% → 250%`. Ticks at `20, 50, 100, 150, 200, 250`. Hairline ticks below baseline.
- Y: fee in €. Auto-scaled to `[-credit-4, max_fee_cap + max(8, cap*0.1)]`. Gridlines at €20 intervals (€10 when cap is small). Labels left-aligned, mono.

**Layers (back to front):**

1. **Horizontal gridlines** — `currentColor` at 7% opacity (zero-line at 18%)
2. **Real-pay cap dashed line** — teal `#54C9B5`, `stroke-dasharray="2 4"`, 60% opacity. Labelled `"Real pay cap · €N"` in teal mono. Hidden if `realPayCap >= cap`.
3. **X tick marks** at the bottom
4. **Q-Cash band** — teal polygon between fee curve and pay-line, only where `fee > realPayCap`. Fill `#54C9B5` @ 18% opacity.
5. **Filled area under fee curve** — vertical gradient (penalty orange @ 20% top → transparent), warm wash
6. **Credit zone** (when rebate on) — sage rect from x=20% to `applies_below_pct`, height = credit amount below zero. Bold sage line at top of rect. Vertical dashed connector at the threshold up to the zero-line. Label `"Shoulder credit −€8"` inside.
7. **Pay-line** — out-of-pocket cost. `#1C1917`, 1.5px, dashed `5 5`, 42% opacity.
8. **Fee curve glow** — same path as #9 but `stroke-width: 4`, 35% opacity, `filter: url(#soft-glow)` (3px gaussian)
9. **Fee curve** — main hero stroke. `url(#curve-grad)` gradient (sage → ochre → penalty, left to right). 3.5px, rounded caps/joins.
10. **Target marker (100%)** — vertical ochre dashed line + small pill at top with `"TARGET"` in earth mono 10px, 600 weight, letter-spacing 0.12em
11. **Ceiling marker** — vertical penalty-orange dashed line + pill `"CEILING"` in stone mono
12. **Active day dot** — at `(demand_pct, feeAtPct(demand_pct))`. Three concentric circles: r=14 earth @ 6% halo, r=7 solid earth, r=3 stone centre.
13. **Active day callout** — earth-coloured pill, 138×36, placed top-right of dot (flips left if it'd overflow). First line: `"AT 200% CAPACITY"` ochre mono 9px uppercase. Second line: `"Fee €50 · pay €20"` (pay clause teal, only if `fee > realPayCap`).

**Curve panel header:**
- Title: "Consumer cost curve"
- Sub: `"{demand_pct}% of target · {date}"`
- Right: legend (Credit / Fee / Q-Cash swatches) + model confidence pill (`● Model confidence 40%`, ochre dot with glow ring)

**Filter `soft-glow`** for the curve halo:
```svg
<filter id="soft-glow" x="-20%" y="-20%" width="140%" height="140%">
  <feGaussianBlur stdDeviation="3" />
</filter>
```

### 3. DECILE STRIP (optional, below curve)

10 small cards in a row showing per-decile fee. Hideable via Tweak.

Each card:
- `60%, 80%, 100%, 120%, ..., 240%` capacity bucket
- Top: pct label in mono 9px mute
- Middle: `€N` fee in mono ~12px, tabular-nums
- Bottom: thin coloured bar, width proportional to `fee/cap` ratio
- Colour-coded: credit → sage; ratio<0.3 → muted; 0.3–0.7 → ochre warn; >0.7 → penalty high

### 4. REVENUE PANEL (top-right)

Two stacked cards in a column (flex-column inside the rail), always visible.

**Card structure:**
- Background: `--panel-strong` with a soft radial glow in corner (day = top-left ochre; annual = bottom-right teal)
- Border 1px `--hairline`, radius 16px, padding ~14×16
- Three rows (space-between):
  - **Label**: mono 10px uppercase letter-spacing 0.16em mute (e.g. "Total day revenue")
  - **Figure**: IBM Plex Mono 500, `clamp(30px, 3.4vw, 44px)`, tabular-nums, letter-spacing -0.02em. `€` symbol slightly muted, then digits. `white-space: nowrap`.
  - **Foot**: rev-note (mono 10px mute, e.g. "Sat 17 Jun" / "365-day rollup") + delta chip

**Delta chip:**
- Pill, padding 3×9, border-radius 999px, mono 11px, tabular-nums
- Up (positive): `rgba(157,186,119,0.16)` bg, `#4d6a2b` text, ▲ icon
- Down: `rgba(224,118,60,0.16)` bg, `#a14416` text, ▼ icon
- Zero / no change: `rgba(28,25,23,0.05)` bg, soft-ink text, 50% opacity, "— no change"
- Compact format: `+€120k`, `+€8.1M`, `+€2B`. Fade-out animation after 3.5s.

### 5. LEVERS PANEL (bottom-right)

List of 4 sliders + 1 toggle row. Each lever:

```
┌─────────────────────────────────────────┐
│  Target capacity                 50,000 │   <- label + value chip (right-aligned)
│  100% anchor                            │   <- meta line, mono 9.5px uppercase
│  ━━━━━●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │   <- slider with gradient fill behind
│  20k                              120k  │   <- mono tick labels
└─────────────────────────────────────────┘
```

- Lever label: Outfit 500 13px
- Sub-label (meta): mono 9.5px uppercase letter-spacing 0.08em, mute
- Value chip: mono 13.5px, 500, on solid earth bg, stone text, padding 3×10, radius 8px, min-width 78px right-aligned. **Flashes ochre/earth for 350ms** on change (visual confirmation of the action).
- Slider: custom-styled `input[type=range]`
  - Track: 6px tall, `rgba(28,25,23,0.08)` bg, rounded
  - Fill (gradient): `linear-gradient(90deg, sage, ochre)`, width = (value-min)/(max-min)
  - Thumb: 18×18 stone-coloured circle, 2px earth border, soft shadow
  - Ticks: min and max labels in mono 9.5px below

**Lever metadata** (drives label / sub / format / tick text):

| id | label | sub | suffix/prefix | ticks |
|---|---|---|---|---|
| `target_capacity` | Target capacity | 100% anchor | `/day` suffix; comma-formatted | "20k" / "120k" |
| `base_fee` | Base fee at target | Fee at 100% | `€` prefix | "€0" / "€50" |
| `max_fee_cap` | Max-fee cap | Asymptote of curve | `€` prefix | "€10" / "€200" |
| `ceiling_pct` | Capacity ceiling | Where curve goes near-vertical | `%` suffix | "120%" / "250%" |

### 6. SHOULDER REBATE ROW

Below the sliders. Dashed-border rounded box, sage tint background.

- Left: "Shoulder-season recirculation" (Outfit 500, 12.5px) + "Below 28% capacity · €8 Q-Cash to local business" (mono 10px uppercase mute)
- Right: iOS-style toggle switch, 36×20. On = sage, knob shifted right.

> **Microcopy rule:** Never "we give tourists money." Always **"recirculating peak-season funds into local business during shoulder season."**

---

## Design Tokens

### Colours

```css
--earth:    #1C1917   /* primary ink, dark accents */
--stone:    #F2ECE3   /* inverted ink for dark contexts */
--sage:     #9DBA77   /* credit zone, positive deltas, gradient start */
--ochre:    #E3A93C   /* target marker, gradient mid, value chip */
--teal:     #54C9B5   /* Q-Cash band, real-pay cap */
--penalty:  #E0763C   /* ceiling marker, gradient end, negative deltas */

/* Working tokens */
--canvas:         #EEE7DB   /* page background */
--panel:          #FBF6EC   /* panel base */
--panel-strong:   #FFFDF6   /* card / lever value bg */
--ink:            var(--earth)
--ink-mute:       rgba(28,25,23,0.62)
--ink-soft:       rgba(28,25,23,0.42)
--hairline:       rgba(28,25,23,0.10)
--hairline-strong:rgba(28,25,23,0.18)
```

### Curve gradient

```
0%   → sage     #9DBA77
38%  → ochre    #E3A93C
80%  → penalty  #E0763C
100% → penalty  #E0763C
```

### Typography

- **Display**: `Outfit` (Google Fonts), weights 400/500/600/700
- **Mono**: `IBM Plex Mono` (Google Fonts), weights 400/500/600
- Feature settings on body: `font-feature-settings: "ss01", "ss02"`
- Tabular-nums applied to all `.rev-figure`, `.bucket-fee`, `.lever-value`, and curve labels

### Radii

- Panels: 22px
- Cards / chips: 16px
- Buttons / small elements: 10px
- Pills / switches: 999px

### Shadows

```css
--shadow-panel:
  0 1px 0 rgba(255,255,255,0.7) inset,
  0 1px 2px rgba(28,25,23,0.05),
  0 12px 28px -16px rgba(28,25,23,0.18);

--shadow-curve: 0 18px 40px -22px rgba(224,118,60,0.55);
/* The curve also uses an SVG drop-shadow filter for the warm glow under it */
```

### Spacing scale

`clamp(8px, 1vh, 14px)` for tight vertical gaps, `clamp(10px, 1.2vw, 18px)` for major panel gaps, `clamp(14px, 1.8vh, 22px) clamp(16px, 1.6vw, 24px)` for panel padding. All breakpoint-fluid by design — the dashboard adapts smoothly between 1280px and 1920px without media queries.

### Texture

Subtle multiply-blended noise overlay covers the whole page (SVG `feTurbulence` filter, fractalNoise, baseFreq 0.9, opacity 0.5). Plus three soft radial glows behind everything (ochre top-left, teal top-right, sage bottom-right) — gives the warm institutional canvas feel. See `body::before` and `body::after` in `styles.css`.

---

## Interactions & Behaviour

### Lever change
1. User drags slider (or agent calls `setLever`)
2. State store mutates, clamped to `[min, max]`
3. Calc engine recomputes derived state
4. All subscribers re-render
5. Lever value chip flashes ochre for 350ms (visual ack)
6. Revenue cards' delta chips show `▲ +€xxx`, fade to "no change" after 3.5s
7. Curve redraws — fully deterministic, instantaneous

### Day-type switch
- Top-bar dropdown change → `setDayType(id)` → curve's active dot moves, callout updates, revenue cards recompute, "Demand %" chip in top bar updates

### Phase switch
- Pill toggle change → `setPhase(year)` → updates `phase.real_pay_cap` (Year 1 → €20, Year 2 → €60, Year 3 → €150)
- Real-pay cap dashed line in curve moves, Q-Cash band re-bounds, pay-line redraws

### Rebate toggle
- Switch click → `setRebate(bool)` → credit zone shows/hides on curve, curve sample skips the discontinuity below threshold when on

### Performance budget
- Target: every mutation → re-render in <100ms (well under the brief's 10s ceiling)
- Curve is a single SVG `<path>` with ~230 sample points (1° resolution). Plenty fast.

---

## State Management

The prototype uses a **vanilla observable store** (`state.js`) with `subscribe()`. Reimplement in your codebase as:

- **React**: a `useSyncExternalStore` hook around the same store, or a Zustand/Jotai store, or React Context with a reducer
- **Vue**: a Pinia store, or `reactive()` + `provide/inject`
- **Svelte**: a writable store

**Required state shape** (see `state.js` for full TypeScript-like outline):

```ts
type State = {
  location: { id: string; label: string; currency: string };
  capacity: { target: number; unit: string };
  confidence: number;
  curve: {
    base_fee_at_target: number;
    max_fee_cap: number;
    ceiling_pct: number;
    shape: { plateau_end_pct: number; exponent: number };
  };
  shoulder_rebate: { enabled: boolean; credit: number; applies_below_pct: number };
  levers: Array<{ id: string; min: number; max: number; step?: number; value: number }>;
  day_types: Array<{ id: string; label: string; date: string; demand_pct: number }>;
  phase: { year: 1 | 2 | 3; real_pay_cap: number };
  seasonal: Array<{ days: number; demand_pct: number }>;

  // UI-internal
  activeDay: string;             // id of active day_type
  __lastDayRev: number;
  __lastAnnualRev: number;
  __prevDayRev: number;
  __prevAnnualRev: number;
};
```

**Critical**: keep mutations to the store going through the documented commands (`setLever`, `setDayType`, etc.). Don't let components mutate state directly. The "one source, many writers" property is what makes the agent integration work.

---

## Out of Scope for v1 (back-pocket items — do NOT build into MVP)

These were mentioned in the brief; note them but keep the pitch screen clean.

- Voice dictation control (UI listens to microphone directly)
- iPad-remote split-view (decision-maker on iPad, projection on monitor)
- Authority onboarding agent ("fresh-iPhone setup")

The `ProjectQ` command API is the integration hook all three will attach to later.

---

## Assets

- **Fonts**: Outfit + IBM Plex Mono via Google Fonts. Self-host in production.
- **Logo**: Drawn inline as a CSS radial gradient (`.brand-mark`). Replace with the real Project Q mark when one exists.
- **No raster images.** The grain texture is an inline SVG `feTurbulence` data-URI; the warm glows are CSS radial gradients. Everything else is SVG and CSS.

---

## Files in This Bundle

| File | Purpose |
|---|---|
| `Venice Authority Control.html` | Entry HTML — loads fonts, React, Babel, and all scripts |
| `styles.css` | All CSS — tokens, layout, panels, curve, levers, dark theme |
| `state.js` | **Calc engine + observable store + window.ProjectQ API.** The architectural core. |
| `payload-venice.js` | Sample DPM payload for Venice. Reference shape for the data contract. |
| `curve.jsx` | `CurveChart`, `BucketStrip`, `CurvePanel` React components |
| `controls.jsx` | `TopBar`, `RevenuePanel`, `LeversPanel`, `DeltaChip` React components |
| `app.jsx` | Root composition, boot sequence (`loadPayload` → render), Tweaks wiring |
| `tweaks-banel.jsx` | Visual variant panel (theme, curve stroke style, decile toggle) — **prototype-only**, do not port |

Read `state.js` first. Then look at `payload-venice.js` to understand the contract. Then the JSX files for visual implementation. CSS last.

---

## Notes on Recreating

- **Don't rebuild the Tweaks panel.** It's a prototyping affordance for showing visual options to the client. Ship one finalised look.
- **Don't hardcode any Venice values.** If you find yourself typing `50000` or `"Venice"` anywhere outside the payload loader, stop. The whole point of the architecture is that loading a Dubrovnik payload "just works."
- **Keep the calc engine pure.** No `Math.random()`, no Date.now, no I/O. Same inputs → same outputs, always. This is what lets the live agent read back state and confirm changes deterministically.
- **Respect the no-scroll rule.** If the design grows, something else has to shrink. Don't add overflow.
- **Whole euros only.** No cents, ever. Round at display time, not in the calc engine.

---

## Open Questions for the Implementer

Worth confirming with the product owner before building:

1. Should `loadPayload()` accept a markdown string with a fenced JSON block (per the DPM spec), or always pre-parsed JSON? Prototype takes pre-parsed; production likely needs the parser too.
2. Where does the second/third city payload come from at runtime — bundled, fetched from a backend, dropped via file input? The Location dropdown is currently a placeholder.
3. Should the delta chip show "since session start" instead of "since last move"? Brief is ambiguous; prototype shows per-move.
4. The agent integration — is it a WebSocket, a postMessage from a sibling iframe, or a local IPC? Affects how `ProjectQ` is exposed (window vs. an explicit transport).
