RUN-FOREVER + AUTONOMOUS MODE — Integrate Ollie's first DPM output into the Control Dashboard

Ollie's DPM has emitted its first parameter set for Venice 2026. The raw JSON is already in the repo at ./dpm-payloads/venice-2026.json (saved as it appeared in Ollie's PDF, validated: seasonal days sum 365, all 4 day_types present, all schema rules pass). Wire it in as the dashboard's default boot payload, add a runtime file-upload affordance so any future DPM file can be dropped in live during a pitch, handle ONE documented schema quirk (integer-encoded exponent), verify, and deploy.

Repo: ~/project-q/app
Production: https://project-q-dem0.vercel.app (auto-deploys from main on push)

Operating rules:
1. .claude/settings.local.json pre-authorises every tool (bypassPermissions). Never request permission.
2. Long-running shells: nohup ... > /tmp/<svc>.log 2>&1 &.
3. Transient failures: retry 3x with sleep 5.
4. Every 10 min append a one-line status to ./STATUS.md.
5. Commit per logical chunk (names below).
6. Final step: git push origin main, wait 90s, curl -I production for 200 OK, append a section to WRAP_UP_CONTROL_DASHBOARD.md.

PREREQUISITE
- The control dashboard must already be in place (built per ./CONTROL_DASHBOARD_BUILD_PROMPT.md, ./design_handoff_project_q/README.md). If src/control/ does not exist or the dashboard is incomplete, complete that build first as a blocker, then proceed.

================================================
THE ONE SCHEMA QUIRK YOU MUST HANDLE — read this carefully

Ollie's DPM emits `curve.shape.exponent` as an INTEGER ×10 ENCODED value. His PDF documents it explicitly:

  "EXPONENT ENCODING NOTE: The schema requires whole integers only. The curve exponent of 2.2 is represented as the integer 22. The dashboard MUST divide this value by 10 to obtain the float 2.2 for the pricing function calculation."

So the JSON contains `"exponent": 22` and the dashboard must interpret it as `2.2`.

In the loader, handle BOTH the encoded form AND a future cleaner form in the same code path:
- If `curve.shape.exponent >= 10`: treat as ×10 encoded, divide by 10 before use.
- If `< 10`: treat as a direct float value (forward-compat for when the DPM schema is cleaned up).
This single rule is robust — no realistic fee curve uses an exponent >= 10.

Add a clear code comment at the normalization site pointing to this decision and reference Ollie's PDF documentation as the rationale. Surface it in WRAP_UP.

================================================
JOB 1 — Make Ollie's JSON the default boot payload
- Import ./dpm-payloads/venice-2026.json. Replace the prior sample/placeholder Venice payload as the default the dashboard loads at boot.
- After this change, opening `/` must show:
  - Location: Venice (label "Venice")
  - Capacity 50,000 visitors/day
  - Confidence pill: 42 (Ollie's actual confidence rating — do not round, do not embellish)
  - Curve: base €10 at 100%, cap €50, ceiling 200%
  - 4 day_types in the Modelling-day dropdown: Peak summer Saturday (Sat 1 Aug), Biennale weekday (Wed 27 May), December weekday (Wed 9 Dec), Carnival Saturday (Sat 14 Feb)
  - Phase Year 1, real_pay_cap €20
  - Shoulder rebate ON, €8 credit below 28% capacity
- Do NOT inline Ollie's values into component logic anywhere. Component code reads from the loaded payload only.
Commit chunk: integrate-ollie-dpm-default

================================================
JOB 2 — Loader: handle exponent encoding + accept both JSON and MD-with-JSON
- In the payload loader (state.ts or wherever loadPayload lives), normalize `curve.shape.exponent` immediately after parsing (the >=10 rule above).
- Confirm loadPayload accepts ALL THREE inputs and routes them through the same validation + normalization:
  1. A pre-parsed JSON object (programmatic / import).
  2. A raw JSON string.
  3. A markdown string containing a fenced ```json block (extract first ```json fence with a robust regex, parse contents).
- Validation rules from the design_handoff README still apply (seasonal days ~365, lever values in bounds, ceiling_pct > plateau_end_pct, max_fee_cap > base_fee_at_target, ≥1 day_type). On any failure, throw a clear error with which rule failed.
Commit chunk: dashboard-loader-exponent-normalize

================================================
JOB 3 — Runtime payload upload UI (the city-swap demo)
This is what makes Trevor's "remove Venice, drop in Dubrovnik in seconds" demo actually work.

- Add a discreet but accessible "Load DPM payload" affordance in the TopBar — a small icon button (an upload glyph) or a short label, placed near the location dropdown. It must look at home in the existing earth/Plex Mono aesthetic — minimal, restrained, NOT shouty.
- Click → opens a native file picker accepting .json and .md files.
- On select: read file content as text → call loadPayload(content) → validation runs.
- Success: inline toast/pill near the top bar, ~3.5s fade-out: "Payload loaded — {location.label} · confidence {n}". Tone-matched to existing UI.
- Failure: red-accented toast staying ~6s: "Payload error: {validation message}". Previous payload stays loaded (UI never enters a broken state).
- Keyboard shortcut: Cmd/Ctrl + O opens the same file picker (power user / pitch operator convenience).
- Drag-and-drop onto the dashboard window also triggers loadPayload — same code path.
Commit chunk: dashboard-runtime-payload-upload

================================================
JOB 4 — Verify
Local:
1. Boot dev server (nohup npm run dev > /tmp/dev.log 2>&1 &; wait 5s; curl -I localhost:5173 → 200).
2. Open `/` in headless Chrome. Confirm visually + via DOM:
   - Confidence pill shows "42"
   - Modelling-day dropdown contains all 4 day_types in Ollie's order
   - Active day defaults to peak_sat (Sat 1 Aug, 200% demand) — or the first day_type if state initialization picks that
3. Curve shape sanity check (proves exponent was decoded):
   - In console: `window.ProjectQ.getState().curve.shape.exponent` → must be 2.2, NOT 22
   - Compute: `window.ProjectQ.feeAtPct(150)` should be roughly between 18 and 32 (a clean exponent-2.2 curve from €10 base to €50 cap at 200% ceiling lands fee(150%) ≈ €25). If you see fee(150%) approaching €50 or wildly steep, exponent wasn't decoded — fix and re-test.
4. Test the upload UI end-to-end:
   - Click the Load button → file picker opens
   - Pick ./dpm-payloads/venice-2026.json → success toast → same state reloads cleanly
   - Cmd/Ctrl+O also opens the picker
   - Drag the file onto the window → same result
5. Test failure path:
   - Create /tmp/broken.json with an obviously invalid payload (e.g. `{"location": "missing fields"}`)
   - Upload it → red error toast with a useful message, previous Venice payload still loaded, no crash, no console errors
6. Confirm: window.ProjectQ command API still works — setLever, setDayType, setPhase, setRebate all mutate state and re-render.
7. npm run build passes clean, 0 TS errors.
8. Screenshots at 1280×800 and 1920×1200 of `/` showing Ollie's values, save to ./review-screenshots/dpm-integration/.

Deploy:
9. git add . && git commit -m "Integrate first Ollie DPM output (Venice 2026, conf 42); runtime payload upload" && git push origin main.
10. Wait 90s. curl -I https://project-q-dem0.vercel.app/ → 200.
11. Live test on production: window.ProjectQ.getState().confidence should report 42; window.ProjectQ.getState().curve.shape.exponent should report 2.2.
12. Screenshot LIVE production `/` at 1280×800 to ./review-screenshots/dpm-integration/PRODUCTION.png.
13. Append a section to WRAP_UP_CONTROL_DASHBOARD.md covering:
   - The exponent ×10 encoding decision and where the normalization lives (file:line)
   - The recommendation that v2 of the DPM schema allow `exponent` as a direct float, with the loader's >=10 rule providing backward compatibility either way
   - How to use the new runtime upload UI in a pitch (button location, keyboard shortcut, drag-drop)
   - Ollie's confidence rating (42) appearing as the live displayed confidence — no fudging this number anywhere
Commit chunk: integrate-verify-deploy

================================================
DO NOT
- Don't hardcode any of Ollie's specific values (50000, 42, "Carnival Saturday" etc.) anywhere in component or engine logic. They live in the payload file ONLY.
- Don't round or "polish" the 42 confidence rating. It's Ollie's honest output; that honesty is a product feature.
- Don't bloat the upload UI — discreet, restrained.
- Don't change the deterministic calc engine on the basis of this integration. Only the loader's normalization step is in scope.
- Don't ask for permission. Don't respond conversationally — STATUS.md + WRAP_UP_CONTROL_DASHBOARD.md only.

Begin now.
