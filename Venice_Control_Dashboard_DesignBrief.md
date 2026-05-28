# Project Q — Venice Authority Control Dashboard
## Claude Design Brief (non-scrolling, single-screen)

### What this is
The instrument used **during the live pitch** to a city jurisdiction (Venice first). The person holding it is a **bureaucrat or decision-maker, not a technologist**. They pull levers; the pricing curve and the revenue figures react instantly. The entire goal is to make them feel **smart, in control, and impressed by the speed** — every change they make resolves on screen in **≤10 seconds**, ideally instantly.

This is the *authority/control* experience — NOT the consumer app. It answers: **"What do I control, and what revenue and crowd outcome results when I move it?"**

### The one rule
**One dynamic screen. No scrolling. Ever.** Landscape, sized for a monitor or iPad. Everything visible at once. **All figures in EUR (€). Whole integers only — no decimals, no cents.**

---

### Architecture: a data-agnostic shell (read this first)
This UI is a **cockpit, not a data source. It holds zero hardcoded city data.** Every number — capacity, fees, curve shape, demand, revenue, day-types, confidence — is supplied at runtime by the **DPM** (the dynamic pricing model being built separately). The DPM is the brain (heavy, offline estimation per city); this UI is the instant, deterministic display + control surface that reads the DPM's output and reacts.

Two consequences the build must honour:
1. **Swap the data, swap the city.** Loading a different DPM payload turns a Venice pitch into a Dubrovnik pitch in seconds, with zero UI code changes.
2. **One source of truth, many writers.** A single state store drives everything on screen. It can be mutated by (a) the human moving a lever, (b) a **live agent** during the pitch translating speech into lever changes, or (c) loading a new DPM payload. Any mutation → instant recompute → re-render. The human and the agent call the *same* commands.

Any specific numbers in this brief (50,000, €10, etc.) are **development placeholders from a sample payload only** — clearly marked, never baked into UI logic.

### DPM data contract (the input the UI reads)
The DPM emits a **Markdown file** with a machine-readable block (YAML front-matter or a fenced ```json block) carrying the parameters, plus human-readable narrative the UI may optionally surface. The UI parses the structured block and renders whatever it declares. Proposed shape:

```yaml
location: { id: venice, label: "Venice", currency: EUR }
capacity: { target: 50000, unit: "visitors/day" }   # 100% anchor
confidence: 40                                        # DPM confidence %
curve:
  base_fee_at_target: 10        # € at 100%
  max_fee_cap: 50               # € asymptote
  ceiling_pct: 200              # where it goes near-vertical
  shape: { plateau_end_pct: 100, exponent: 2 }
  # OR: sampled points [{pct, fee}, ...] the DPM computed directly
shoulder_rebate: { enabled: true, credit: 8, applies_below_pct: 28 }
levers:                          # which levers to expose + bounds + current value
  - { id: target_capacity, min: 20000, max: 120000, value: 50000 }
  - { id: base_fee,        min: 0,     max: 50,     value: 10 }
  - { id: max_fee_cap,     min: 10,    max: 500,    value: 50 }
  - { id: ceiling_pct,     min: 120,   max: 250,    value: 200 }
day_types:
  - { id: peak_sat,    label: "Peak summer weekend", demand_pct: 200 }
  - { id: dec_weekday, label: "December weekday",     demand_pct: 45 }
revenue:                         # DPM may precompute, or UI computes from demand × curve
  day: { peak_sat: 385000, dec_weekday: 60000 }
  annual: 47200000
phase: { year: 1, real_pay_cap: 20 }
```

Nothing about Venice is special-cased. A different city's payload (different levers, day-types, capacity) renders without touching UI code.

### Live control + agent interface
Expose a documented command API on the running app (e.g. on `window.ProjectQ`) so an **external live agent (voice or text) can drive the screen during the pitch, identically to the human**:
- `loadPayload(md | json)` — swap the city / reload DPM output
- `setLever(id, value)` — agent hears "cap it at thirty euros" → `setLever('max_fee_cap', 30)`
- `setDayType(id)` — switch the modelled day
- `setPhase(year)` — Year 1 / 2 / 3
- `getState()` — return full current state (so the agent can read back and confirm)

Every call mutates the single state store → deterministic recompute → re-render, in ≤10s (target: instant). The on-screen sliders are simply one more writer to this same API. This is what makes Trevor's "they protest, the solution's on screen in 10 seconds" — and the verbal-control demo — possible with no rebuild.

---

### Screen layout (single viewport, three zones)

```
┌───────────────────────────────────────────────────────────────────────┐
│  TOP BAR:  Project Q · [Venice ▾ location]   Modelling: [Sat 17 Jun ▾]  │
│            Day-type: Peak summer weekend     Deployment: [Yr 1 ·2 ·3]    │
├──────────────────────────────────────────────┬────────────────────────┤
│                                                │   REVENUE  (always-on) │
│        THE CONSUMER COST CURVE                 │  ┌──────────────────┐  │
│        (hero visual, ~60% width)               │  │ TOTAL DAY REVENUE│  │
│                                                │  │   € 385,000      │  │
│   €  fee                                       │  │   ▲ +€120k        │  │
│   │            ╱ exponential                   │  └──────────────────┘  │
│   │      ____╱   tail                          │  ┌──────────────────┐  │
│   │  ___/  flat plateau                        │  │ TOTAL ANNUAL REV │  │
│   │ /credit                                    │  │   € 47,200,000   │  │
│   └─────────────────────────── capacity %      │  │   ▲ +€8.1M        │  │
│      50%   100%(target)   200%  250%(ceiling)  │  └──────────────────┘  │
│                                                │                        │
│                                                │   LEVERS               │
│                                                │  Target capacity  ───● │
│                                                │  Base fee at 100% ──●  │
│                                                │  Max-fee cap      ────●│
│                                                │  Capacity ceiling ──●  │
│                                                │  Shoulder rebate  [on] │
└────────────────────────────────────────────────┴────────────────────────┘
```

---

### The levers (right rail — the bureaucrat's controls)
Each is a slider or stepper. Moving any one **redraws the curve and recomputes both revenue boxes instantly.** Which levers appear, their ranges, and their starting values **all come from the DPM payload** — the list below is just the Venice sample. The same lever is also settable by the live agent via `setLever()`.

1. **Target capacity** — the optimal visitors/day = the 100% anchor. Default 50,000 (Venice). Range 20k–120k.
2. **Base fee at target** — the fee charged at exactly 100% capacity. Default €10. Range €0–€50.
3. **Max-fee cap** — the most the city will ever levy on a single visitor. Default €50 (Year 1) → up to €500 (later years). This is the ceiling the exponential tail flattens into.
4. **Capacity ceiling** — the % at which the city wants effectively zero additional visitors (curve goes near-vertical here). Default 200%. Range 120%–250%.
5. **Shoulder-season rebate** — toggle + amount. When on, the first N% of capacity receives Q-Cash credit (negative fee) to pull demand into quiet periods. Framed as recirculation, never "giving money."
6. **Deployment phase (Year 1 / 2 / 3)** — top-bar toggle. Year 1 is capped and gentle (max real pay ~€20, rest as Q-Cash); Years 2–3 escalate as the model earns trust and data.

> The decision-maker must be able to say *"cap it at €30, ceiling at 180%"* mid-sentence and watch it happen. Build for "every protest answered in 10 seconds."

---

### The revenue panel (top-right, always visible)
- **Total Day Revenue** — for the modelled day (e.g. "€385,000 — Sat 17 Jun").
- **Total Annual Revenue** — projected across the year.
- Both **recompute on every lever change** and show a **delta chip** (▲ +€120k) versus the previous state so the impact of each tweak is unmissable.
- **Deterministic calc engine behind these — never LLM math.** A function collates the levers and outputs exact figures.

---

### The Consumer Cost Curve (hero visual)
- **X-axis: capacity %**, shown **50% → 250%** (kill the old 0–350% scale). Mark **100% = target** and the **ceiling** clearly.
- **Y-axis: fee in €**, whole integers.
- **Shape:** a **flat plateau** through normal demand (≈40–100%), then **rising**, then **near-exponential** approaching the ceiling, flattening into the max-fee cap.
- **Credit zone** (optional, when shoulder rebate is on): below a threshold the fee goes negative — render as a distinct band, labelled as local recirculation, not "we pay you."
- **Q-Cash band:** the gap between fee-charged and pay-after-QCash, shaded (keep from existing demo).
- **Markers:** target (100%), ceiling, and a couple of representative booking positions.
- Everything **redraws live** as levers move.

Optional supporting strip (only if it fits without scrolling): a **whole-euro bucket row** — "first 10% pay €10 · next 10% €12 · …" — to make the curve concrete for a non-technical viewer.

---

### Calc model (deterministic relationships)
**Split of responsibility:** the **DPM** (offline) produces the city's model *parameters* and demand profile — the heavy estimation/web-search work — and ships them in the payload. The **UI** does the **instant, deterministic display arithmetic** that turns those parameters + the current lever values into the curve and the revenue figures as levers move. No LLM math in the live loop (Trevor's rule).

Reuse the engine from the existing demo (`fee()`/`charge()`/`pay()`), reparameterised so the **levers + payload** are the inputs:
- Base fee anchors the curve at 100%.
- Max-fee cap sets the asymptote.
- Capacity ceiling sets where the curve steepens to near-vertical.
- Target capacity scales the visitor counts that drive revenue (revenue = Σ across the demand distribution × fee at each position).
- Annual revenue = day model rolled across a seasonal demand profile.
All exact, instant, integer-rounded for display.

---

### Visual system (carry over from the existing file — keep this DNA)
- Palette: `--earth #1C1917`, `--stone #F2ECE3`, `--sage #9DBA77`, `--ochre #E3A93C`, `--teal #54C9B5`, `--penalty #E0763C`.
- Type: **Outfit** (display) + **IBM Plex Mono** (figures).
- Texture: subtle grain overlay, rounded 16–22px panels, soft radial background glows, drop-shadowed curve with the gradient stroke.
- Tone: calm, premium, "Cadillac of a solution" — not a busy spreadsheet.

### Microcopy / framing rules
- Never "we give tourists money." Always **"recirculating peak-season funds into local business during shoulder season."**
- Whole euros only. EUR symbol.
- Keep language bureaucrat-simple — no jargon, no confidence-score noise on this screen.

### Out of scope for v1 (back pocket — do NOT build into the MVP screen)
- Voice dictation control, iPad-remote split-view, the authority onboarding agent ("fresh-iPhone setup"). These come later; note them but keep the pitch screen clean.

### Location-swappable
Achieved entirely through the data contract: **`loadPayload()` with Dubrovnik's DPM file regenerates the whole screen** — capacity, curve, levers, day-types, revenue — with no UI code changes. No Venice values hardcoded in the UI layer. This is the same mechanism Ollie's DPM uses to drop its model into the skeleton.
