RUN-FOREVER + AUTONOMOUS MODE — Rebuild the deployed app as the Venice Authority Control Dashboard

Goal: replace the front door of the deployed Project Q web app with the Venice Authority Control Dashboard — the live pitch instrument for selling dynamic tourism pricing to city decision-makers. A complete Claude Design handoff bundle is ALREADY in the repo at ./design_handoff_project_q/. Recreate that design faithfully in this existing Vite + React 18 + TypeScript codebase, make it the new root experience, preserve the existing tourist demo non-destructively, and deploy.

Repo: ~/project-q/app
Production: https://project-q-dem0.vercel.app (auto-deploys from main on push)

Operating rules:
1. .claude/settings.local.json pre-authorises every tool (bypassPermissions). Never request permission.
2. Long-running shells: nohup ... > /tmp/<svc>.log 2>&1 &.
3. Transient failures: retry 3x with sleep 5.
4. Every 10 min append a one-line status to ./STATUS.md: [ISO ts] · <step> · <git short HEAD>.
5. Commit per logical chunk (names below).
6. Final step: git push origin main, wait 90s, curl -I production for 200 OK, write PRODUCTION_URL.md and WRAP_UP_CONTROL_DASHBOARD.md.

READ FIRST, in this order — THE BUNDLE IS THE SPEC, follow it:
- ./design_handoff_project_q/README.md — full architecture + visual + behaviour spec. SOURCE OF TRUTH.
- ./design_handoff_project_q/state.js — calc engine + observable store + window.ProjectQ command API. The architectural core; port faithfully.
- ./design_handoff_project_q/payload-venice.js — sample DPM payload = the data contract.
- ./design_handoff_project_q/curve.jsx, controls.jsx, app.jsx — components to recreate as .tsx.
- ./design_handoff_project_q/styles.css — tokens + layout; port last.
Do NOT port ./design_handoff_project_q/tweaks-panel.jsx (prototype-only, explicitly excluded in the README).

Target environment: this repo's existing Vite + React 18 + TypeScript. The README says React+TS+Vite maps 1:1 — use the repo's existing patterns and conventions. tsc strict is on and the build runs `tsc -b && vite build`, so eliminate every unused import/var or the build fails.

================================================
JOB 1 — Routing: dashboard at root, preserve the tourist demo
- Today `/` renders DemoIndex (the tourist demo). RELOCATE the entire existing tourist demo to a `/tourist` prefix (or simplest: keep all existing tourist routes exactly as they are and just move the index from `/` to `/tourist`). NOTHING gets deleted; every old route (`/walkthrough`, `/p1/*`, `/p2/*`, `/p3/*`, `/p4/*`, `/day/*`, `/landing`, `/takecontrol`) must still work.
- Make `/` render the new <ControlDashboard />.
- Keep the existing vercel.json SPA rewrite (all paths → index.html). Do not remove it.
Commit chunk: dashboard-routing

================================================
JOB 2 — Port the calc engine + store + command API (state.js → TypeScript)
- Recreate state.js as a typed module (e.g. src/control/state.ts) with the State type from the README, all pure calc helpers (feeAtPct, payAtPct, qcashAtPct, dayRevenue, annualRevenue), the observable store (subscribe), and the FULL window.ProjectQ command API (loadPayload, setLever, setDayType, setPhase, setRebate, getState, subscribe, compute, plus the pure read-back helpers). Signatures must match the README's command table exactly.
- Keep the engine pure: no Math.random, no Date.now, no I/O. Same inputs → same outputs. Round at display time only; whole euros, never cents.
- Enforce the payload validation rules from the README on load (seasonal days ~365, lever values within bounds, ceiling_pct > plateau_end_pct, max_fee_cap > base_fee_at_target, ≥1 day_type).
- Expose window.ProjectQ on boot — the live agent and the verbal-control demo depend on it.
Commit chunk: dashboard-calc-engine

================================================
JOB 3 — Recreate the components as .tsx
- Port curve.jsx (CurveChart, BucketStrip, CurvePanel), controls.jsx (TopBar, RevenuePanel, LeversPanel, DeltaChip), and app.jsx (root composition + boot: loadPayload(venice) → render) to TypeScript components under src/control/.
- Wire components to the store via useSyncExternalStore (or the repo's existing state pattern). Components must NEVER mutate state directly — only via the documented commands ("one source, many writers" — this is what makes the agent integration work).
- Honour every spec detail in the README: the SVG curve layers (gridlines, real-pay cap dashed line, Q-Cash band, filled gradient area, credit zone, pay-line, glow, fee curve, target + ceiling markers, active-day dot + flip-aware callout), the decile strip, revenue cards with delta chips that fade after 3.5s, lever value-chip ochre flash (350ms), shoulder-rebate row + the exact microcopy.
Commit chunk: dashboard-components

================================================
JOB 4 — Styles, tokens, single-screen no-scroll layout
- Port styles.css: design tokens, the grid (rows auto/1fr; cols minmax(0,1.55fr)/minmax(360px,1fr)), panels, curve, levers, warm earth palette, Outfit + IBM Plex Mono (Google Fonts link is fine for now), grain overlay, the three radial glows.
- Enforce THE ONE RULE: single screen, NO scrolling, at 1280×800 minimum, scaling gracefully to 1920×1200. If something overflows, shrink something else — never add scroll/overflow.
- EUR symbol, whole integers everywhere.
Commit chunk: dashboard-styles

================================================
JOB 5 — Payload / data-agnostic wiring
- Dashboard loads the Venice payload at boot via loadPayload(). NO Venice values hardcoded anywhere in component or engine logic — if you ever type 50000 or "Venice" outside the payload file, stop and fix it.
- loadPayload must accept EITHER a pre-parsed JSON object OR a markdown string containing a fenced ```json block (parse it out). This is the DPM contract; the production DPM will emit the markdown form.
- Location dropdown: Venice active; Dubrovnik / Barcelona present but disabled until payloads exist.
Commit chunk: dashboard-payload-loader

================================================
JOB 6 — Verify + deploy
Local:
1. nohup npm run dev > /tmp/dev.log 2>&1 & ; wait 5s; curl -I http://localhost:5173 (expect 200).
2. npm run build — must pass clean, 0 TS errors.
3. Headless Chrome screenshots at 1280×800 and 1920×1200 of `/`. Save to ./review-screenshots/control-dashboard/.
4. In headless Chrome console, exercise the API and confirm no errors + visible recompute:
   window.ProjectQ.setLever('max_fee_cap',30);
   window.ProjectQ.setLever('ceiling_pct',180);
   window.ProjectQ.setDayType('dec_weekday');
   window.ProjectQ.setPhase(3);
   window.ProjectQ.getState();
5. Confirm: no scrolling at either viewport; all figures EUR whole-integers; old tourist routes still load (spot-check `/tourist` and `/walkthrough`).
Deploy:
6. git add . && git commit -m "Rebuild root as Venice Authority Control Dashboard; preserve tourist demo at /tourist" && git push origin main.
7. Wait 90s. curl -I https://project-q-dem0.vercel.app/ (200). curl -I https://project-q-dem0.vercel.app/walkthrough (200 — tourist demo preserved).
8. Headless screenshot LIVE production `/` at 1280×800 → ./review-screenshots/control-dashboard/PRODUCTION.png.
9. Write PRODUCTION_URL.md and WRAP_UP_CONTROL_DASHBOARD.md (commit-by-commit timeline; judgment calls; how you resolved the README's four "Open Questions for the Implementer"; how to drive the screen via window.ProjectQ during a pitch; exactly what Ollie's DPM must emit to plug in).
Commit chunk: dashboard-verify-deploy

================================================
DO NOT
- Don't delete the existing tourist demo — relocate it to /tourist, keep every route reachable.
- Don't port the tweaks panel.
- Don't hardcode any city values outside the payload.
- Don't add scrolling. Don't use decimals/cents. Don't put LLM math in the live loop.
- Don't introduce a new state library if useSyncExternalStore over the ported observable store works.
- Don't ask for permission for any tool call. Don't respond conversationally — report only via STATUS.md and WRAP_UP_CONTROL_DASHBOARD.md.

Begin now.
