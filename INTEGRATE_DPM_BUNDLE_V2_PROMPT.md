RUN-FOREVER + AUTONOMOUS MODE — Integrate Ollie's DPM v2 bundle (daily + CPI + shocks) into the Control Dashboard

Ollie's DPM has evolved. He now emits a four-CSV bundle per city/year run, not a single JSON. The Venice 2027 bundle is already in the repo at ./dpm-payloads/venice-2027/. Wire it into the dashboard with three new authority-facing surface elements — CPI on the active day, the capacity-pressure threshold visible on the curve, and a stress-test selector — keep everything backward-compatible with the v1 single-JSON loader, and deploy. Stay disciplined: the dashboard must remain one non-scrolling screen. Add value, not panels.

Repo: ~/project-q/app
Production: https://project-q-dem0.vercel.app
Bundle: ./dpm-payloads/venice-2027/

Operating rules:
1. .claude/settings.local.json pre-authorises every tool (bypassPermissions). Never request permission.
2. Long-running shells: nohup ... > /tmp/<svc>.log 2>&1 &.
3. Transient failures: retry 3x with sleep 5.
4. Every 10 min append a one-line status to ./STATUS.md.
5. Commit per logical chunk (names below).
6. Final step: git push origin main, wait 90s, curl -I production for 200 OK, append a section to WRAP_UP_CONTROL_DASHBOARD.md.

PREREQUISITES
- The control dashboard from ./CONTROL_DASHBOARD_BUILD_PROMPT.md must be in place.
- The v1 single-JSON loader integration from ./INTEGRATE_DPM_PROMPT.md must be in place (the integer-encoded exponent fix; the runtime upload UI).
- If either is incomplete, finish them first as blockers, then proceed.

================================================
WHAT'S IN THE BUNDLE (the source-of-truth files; read them before designing)

./dpm-payloads/venice-2027/
- ProjectQ_Venice_Daily_Prediction_2027.csv  — 365 daily rows: Date, Day, Week, Month, Base_Daily_Visitors, Growth_Factor, Predicted_Visitors_2027, Shock_Pct, Shock_Label, Adjusted_Visitors, CPI, Notes
- ProjectQ_Venice_Monthly_Summary_2027.csv   — 12 month rows + TOTAL: Month, Days, Total_Visitors_Predicted, Avg_Daily_Predicted, Peak_Day_Predicted, Min_Day_Predicted, Capacity_Breaches, Avg_Adj_CPI
- ProjectQ_Venice_Shock_Scenarios.csv        — 6 stress scenarios: Scenario, Duration_Days, Demand_Shock_Pct, Visitors_Lost, Revenue_Impact_USD, Avg_Daily_During_Shock, CPI_During_Shock
- ProjectQ_Venice_Assumptions.csv            — ~32 audit rows: Parameter, Value, Source, Confidence_0_100

Key derived facts (verified): 365 rows; 313 breach days (CPI ≥ 1.0); annual visitors 32.7M; peak day 2027-07-17 (Festa del Redentore) at CPI 4.09; trough 2027-01-05 at CPI 0.74; overall_run_confidence 58.

================================================
THE NEW CONCEPTS (and how they sit in the existing state)

1. **CPI (Capacity Pressure Index)** = `adjusted_visitors / sustainable_capacity_threshold`. >= 1.0 = breach. This is the authority's headline KPI for "is this day overloaded?"
2. **Sustainable capacity threshold** (52,111 /day for Venice — Bertocchi & Camatti TCC research) — distinct from the existing `capacity.target` (which is the curve's policy 100% anchor; Venice = 50,000). Both exist; both matter; do not conflate.
3. **Daily granularity** — 365 actual day predictions replace (but do NOT delete) the coarse 5-bucket `seasonal` rollup as the source for annual revenue.
4. **Shock scenarios** — 6 named what-ifs that overlay on the model, recomputing visitors / revenue / CPI under that disruption. This is Trevor's "let them try to break it" demo.
5. **Assumptions register** — each parameter with source + per-row confidence. Provides the credibility / audit trail Trevor cares about.

================================================
SCHEMA EXTENSIONS (additive, backward-compatible)

Extend the State type. All new fields are optional. v1 JSON payloads continue to work; CPI / stress / assumptions UI gracefully hides when the data isn't present.

```ts
type State = {
  // ... all existing v1 fields stay
  capacity: { target: number; unit: string; threshold?: number };  // threshold = CPI denominator

  daily?: Array<{
    date: string;                // ISO yyyy-mm-dd
    dow: string;                 // Day
    week: number;
    month: string;
    base_visitors: number;
    growth_factor: number;
    predicted_visitors: number;
    shock_pct: number;
    shock_label: string;
    adjusted_visitors: number;
    cpi: number;
    notes: string;
  }>;

  monthly?: Array<{              // 12 + TOTAL; use as-is when present, derive from daily otherwise
    month: string;               // "January" .. "December" | "TOTAL"
    days: number;
    total_visitors: number;
    avg_daily: number;
    peak_day: number;
    min_day: number;
    breaches: number;
    avg_cpi: number;
  }>;

  shocks?: Array<{
    id: string;                  // slugified from Scenario
    label: string;
    duration_days: number;
    demand_shock_pct: number;    // signed; -10 = -10% demand, +40 = +40%
    visitors_delta: number;      // signed (positive = lost in CSV; preserve original semantics — gained reported as negative)
    revenue_impact_usd: number;
    avg_daily_during: number;
    cpi_during: number;
  }>;

  assumptions?: Array<{ param: string; value: string; source: string; confidence: number }>;

  run_confidence?: number;       // overall confidence (e.g. 58); distinct from per-assumption confidence
  active_shock?: string | null;  // currently applied shock id, null = baseline
};
```

================================================
JOB 1 — Loader: extend to ingest the CSV bundle

- Add a CSV-bundle code path to the existing loader alongside the v1 single-JSON/markdown path. Detect a bundle by ANY of: (a) a .zip with the four expected filenames; (b) a folder drag-drop containing them; (c) a multi-file picker selection containing them. The loader peeks at filenames first, not at content.
- Write a tiny inline CSV parser (≈30–50 lines) that handles quoted fields containing commas (e.g. "5,880,000"). Do NOT add papaparse or any new dep.
- Parse each CSV into the schema fields above. Normalize:
  - The Shock_Scenarios column "Visitors_Lost" is signed: positive = visitors lost (negative shocks), negative = visitors gained (surge). Preserve that convention; do not flip.
  - The Shock_Scenarios column "Revenue_Impact_USD" is signed the same way (positive = revenue lost, negative = revenue gained).
  - For Monthly summary, the TOTAL row stays as a separate flag (don't include it as a 13th month).
- Fold the bundle into the same State the v1 loader produces. Specifically, when a bundle is loaded:
  - `capacity.threshold` ← parsed from Assumptions ("Sustainable_Capacity_Threshold" → 52111).
  - `daily`, `monthly`, `shocks`, `assumptions`, `run_confidence` populated.
  - The existing v1 fields (capacity.target, curve.*, levers, day_types, phase) — these are NOT in the v2 bundle. Resolve as follows:
    - First, if a sibling v1 JSON exists in the same folder (e.g. venice-2026.json or a payload.json), load it as the base, then layer the bundle on top.
    - Otherwise, fall back to the in-repo default v1 payload (Ollie's earlier venice-2026.json or the sample) and overlay the bundle's new fields.
    - Document this fallback chain in WRAP_UP and surface it visibly (e.g. a small note "Curve params: venice-2026.json · Daily data: venice-2027 bundle") so we know exactly which numbers came from where.
- Update the file-upload UI: accept .csv (multiple), .zip, plus the existing .json / .md. Folder drag-drop already triggers loadPayload — keep it; just route a folder containing the four CSVs through the bundle parser.
- Validation on bundle load: 365 ± 10 daily rows; daily Adjusted_Visitors sum within 1% of Monthly TOTAL.Total_Visitors_Predicted; capacity.threshold > 0; shocks have all required fields; assumptions has at least the threshold + base_year + growth keys. Validation failure → red toast, previous state stays loaded.
Commit chunk: dpm-csv-bundle-loader

================================================
JOB 2 — Calc engine: use daily granularity when present

- When `state.daily` is present, compute annual revenue by summing `daily[i].adjusted_visitors × feeAtPct(daily[i].cpi × 100 × scale)` across all 365 rows. (The fee curve is parameterised on capacity %, where 100% = capacity.target. The daily file expresses pressure as CPI = adjusted_visitors / threshold. Map cleanly: derive each day's % of target as `adjusted_visitors / capacity.target × 100`. Use that as the x-input to feeAtPct.)
- When `state.daily` is absent, retain the existing seasonal-bucket rollup for backward compat. This MUST be a transparent if/else, with a code comment marking the daily path as preferred.
- Active-day revenue uses the same single-day formula whether the active day comes from `day_types` (representative) or from a real `daily` row (when a user navigates by date — out of scope for this pass; just leave the day_types path).
- Active-day CPI: if a `daily` row exists with the same date as the active day, surface its CPI directly. Otherwise compute on the fly as `(day_type.demand_pct/100) × capacity.target / capacity.threshold`.
- Stress overlay: when `state.active_shock` is set, all live-displayed numbers reflect the scenario:
  - Active-day adjusted_visitors ← baseline × (1 + demand_shock_pct/100)
  - Day revenue ← visitors × fee at the new % of target
  - Annual revenue ← baseline annual + shock.revenue_impact_usd converted to EUR (use the EUR_USD_Rate from Assumptions; fall back 1.0 if missing). The CSV reports USD; the dashboard is EUR; convert.
  - CPI ← shock.cpi_during (for the duration of the scenario; the curve doesn't need to morph, just the active values).
- All calcs remain deterministic and pure. No LLM in the live loop.
Commit chunk: dpm-bundle-calc

================================================
JOB 3 — UI additions (minimal, three things)

**(a) CPI on the active-day callout**
- Extend the existing curve active-day callout to include a third line: `"CPI {n}"` where n is one decimal (e.g. "CPI 2.34"). Use a small colour-coded pill: green (<0.8 slack), neutral (0.8–1.0), ochre warn (1.0–1.5), penalty red (≥1.5).
- Tooltip on the pill: "Capacity Pressure Index — {adjusted_visitors} of {threshold} sustainable. {n}× threshold." If `daily` is loaded, also show the date and any Shock_Label from that row.

**(b) Capacity-pressure threshold marker on the curve**
- Add a subtle vertical reference line at `x = capacity.threshold / capacity.target × 100` (Venice: 52111/50000 = 104.2%). Style: stone-coloured, 1px, 30% opacity, dashed `2 4`. Small pill at the top: "CPI 1.0" mono 9px, stone faint.
- Hidden if `capacity.threshold` is undefined (v1-only payloads).
- This sits BETWEEN the existing TARGET (100%) and CEILING (200%) markers. Make sure the three labels don't collide — flip the CPI label position if needed.

**(c) Stress-test selector in the TopBar**
- A new dropdown placed to the right of the Modelling-day dropdown: `"Stress test: ▾"`. Options = `"Baseline"` + one entry per `state.shocks[]`. Selecting "Baseline" = `setActiveShock(null)`; selecting any other = `setActiveShock(id)`.
- When a non-baseline shock is active:
  - The active-day callout updates to show the post-shock CPI and visitor count.
  - The revenue cards' delta chips reflect the shock's impact vs. baseline.
  - A small earth-coloured banner (1 line, mono 11px) appears below the curve: `"⚠ Stress test active — {shock.label} · {duration_days}d · CPI {cpi_during}"`. Closes by selecting Baseline.
- Add to the command API: `setActiveShock(id | null)` — same write-to-store / re-render pattern as setLever. So the live pitch agent can verbalise "what if there's a flood" and trigger it.
- Hidden if `state.shocks` is empty.

**Tucked away (not on the main screen):**
- Add a small "ⓘ" affordance next to the confidence pill in the curve panel header. Click opens a slide-out side panel listing `state.assumptions[]` as a tidy table (Parameter / Value / Source / Confidence). Click outside or Esc closes. This is the "where do your numbers come from" answer when an authority probes.
- Display `run_confidence` ("58 / 100") as a smaller secondary number under the curve-panel confidence pill, only if present. Per-day data confidence is in the assumptions panel.

DO NOT add a monthly heat-strip, a daily bar chart, an assumptions sidebar that's always visible, or anything else outside the three above. Trevor's rule: the components of the minimum viable pitch are already many and complex — don't add what we don't need.

Commit chunk: dpm-bundle-ui-cpi-threshold-stress

================================================
JOB 4 — Verify + deploy

Local:
1. Boot dev (nohup npm run dev …; curl -I localhost:5173 → 200).
2. Confirm v1 path STILL works:
   - Default boot still loads Ollie's earlier ./dpm-payloads/venice-2026.json with confidence 42, no CPI/shocks/assumptions present, no new UI elements visible (degrade gracefully).
3. Load the v2 bundle:
   - Drag the ./dpm-payloads/venice-2027/ folder onto the window (or zip it and drop) → success toast.
   - Confidence pill shows 42 from the JSON merge AND run_confidence 58 as the secondary number.
   - Modelling day still shows the day_types from venice-2026.json (the merge keeps those).
   - CPI pill now visible on the active-day callout.
   - Capacity-threshold dashed line visible between TARGET and CEILING.
   - Stress test dropdown lists 6 scenarios.
4. CPI sanity check (proves the threshold + daily wiring):
   - With active day = peak_sat (200% demand): expected CPI ≈ (50000 × 2.0) / 52111 ≈ 1.92. Visible CPI pill should read "1.92" (or close — depending on whether daily lookup vs. computed path is used; both should land in the same ballpark).
   - With active day = dec_weekday (45% demand): CPI ≈ 0.43, green/slack pill.
5. Stress-test sanity check:
   - Select "Peak-season surge (Redentore + heatwave)" → banner appears, day revenue rises (positive surge), CPI on callout shifts to ~2.89 (per CSV).
   - Select "Pandemic-style shock" → annual revenue drops by ~€694M equivalent (808M USD / 1.1635), CPI drops to 0.34, banner shows "30d".
   - Select "Baseline" → all snaps back.
6. Verbal agent path:
   - In console: window.ProjectQ.setActiveShock('peak-season-surge-redentore-heatwave') (use the actual generated id) → state updates, banner appears, no errors.
   - window.ProjectQ.setActiveShock(null) → back to baseline.
7. Assumptions affordance:
   - Click the ⓘ next to confidence → side panel slides in with the ~32 assumption rows from the CSV, scrollable inside the panel only (the main screen still doesn't scroll). Esc / outside-click closes.
8. No-scroll check: at 1280×800 and 1920×1200, the main viewport DOES NOT scroll — even with the new banner, threshold marker, stress dropdown, and ⓘ. If something overflows, shrink something else.
9. npm run build clean, 0 TS errors.
10. Screenshots → ./review-screenshots/dpm-bundle-v2/ at both viewports, in both baseline and one stress-scenario state.

Deploy:
11. git add . && git commit -m "Integrate DPM v2 bundle: 365-day, CPI, 6 stress scenarios, assumptions register" && git push origin main.
12. Wait 90s. curl -I https://project-q-dem0.vercel.app/ → 200.
13. Production sanity:
    - window.ProjectQ.getState().daily.length === 365
    - window.ProjectQ.getState().shocks.length === 6
    - window.ProjectQ.getState().capacity.threshold === 52111
14. Append a section to WRAP_UP_CONTROL_DASHBOARD.md:
    - The bundle ingestion + merge order (v1 JSON as base, v2 CSVs layered)
    - CPI mapping (capacity.target ≠ capacity.threshold; the curve x-axis is target-relative, the threshold line is at 104.2%)
    - The signed conventions kept from Ollie's CSV (Visitors_Lost positive = lost)
    - How to operate the stress-test selector in a pitch + via window.ProjectQ.setActiveShock
    - That run_confidence 58 is displayed honestly; do not modify the value
    - A flagged TODO for next sync with Ollie: emit a v3 schema where capacity.threshold + daily + shocks + assumptions are first-class JSON fields (so one JSON or markdown file carries everything) — the CSV bundle works but a single-file payload would simplify upload UX. Loader's CSV path remains as backward compat.
Commit chunk: dpm-bundle-verify-deploy

================================================
DO NOT
- Don't bloat the screen. Three UI additions only (CPI pill, threshold line, stress dropdown) + one tucked-away ⓘ for assumptions. Anything else, push to back-pocket and flag in WRAP_UP.
- Don't introduce charting libraries or papaparse or any new dependency.
- Don't change the curve formula. Daily granularity affects the SUM (annual revenue), not the per-day fee curve shape.
- Don't fudge confidence values — 42 and 58 are Ollie's; display them exactly.
- Don't break v1 loader path. Old JSON payloads must continue to work.
- Don't ask for permission. Don't respond conversationally — STATUS.md + WRAP_UP_CONTROL_DASHBOARD.md only.

Begin now.
