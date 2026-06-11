RUN-FOREVER + AUTONOMOUS MODE — Add a shared "Control / Equity Index" tab nav across both top bars

Goal: make the existing Equity Console at /equity reachable via a top-of-screen tab from the Control Dashboard at /, with the same nav mirrored back on the equity page. Same theme, no new behaviour, no rearchitecture. Minimal disruption — the rule is "add navigation, change nothing else." Then deploy.

Repo: ~/project-q/app
Production: https://project-q-dem0.vercel.app

Operating rules:
1. .claude/settings.local.json pre-authorises every tool (bypassPermissions). Never request permission.
2. Long-running shells: nohup ... > /tmp/<svc>.log 2>&1 &.
3. Transient failures: retry 3x with sleep 5.
4. Every 10 min append a one-line status to ./STATUS.md.
5. Commit per logical chunk (names below).
6. Final step: git push origin main, wait 90s, curl -I production for 200 OK on both / and /equity, append a short section to WRAP_UP_CONTROL_DASHBOARD.md.

WHAT EXISTS NOW (do not change unless this prompt explicitly says so)
- src/App.tsx: routes "/" → <ControlDashboard /> and "/equity" → <EquityConsole />, catch-all redirects to /.
- src/control/TopBar.tsx: the dashboard's top bar — brand mark, location, modelling day, demand chip, stress-test selector, deployment-phase pills, theme toggle, payload upload, voice mic.
- src/equity/EquityConsole.tsx: standalone dark-glass equity board with its own engine, store, agent, audit trail, advisor dock.
- src/equity/equity.css + src/control/control.css: each page styles its own surface.
- The dashboard has a dark/light theme toggle (TopBar receives dark + onToggleDark + onSetDark props).

PRINCIPLE
"Least disruptive" means: every existing feature on each page works the same after this change. The ONLY visible new thing is a small two-pill segmented nav at the top of each page that switches between them.

================================================
JOB 1 — Build the shared nav component

Create src/components/SectionTabs.tsx (or src/control/SectionTabs.tsx — pick whichever import graph keeps the dashboard and equity sides cleanly importing it):

- Pure presentational + routing component. Uses react-router-dom's NavLink.
- Renders exactly two pills, in this order:
    "Control"           → href "/"
    "Equity Index"      → href "/equity"
- Visual: segmented control. Each pill is mono 11.5–12px, uppercase, letter-spacing ~0.08em. Active pill = solid earth-coloured bg, stone text. Inactive = transparent, mute text, hover lifts to ink.
- Use existing CSS tokens (--earth, --stone, --ink-mute, --hairline) only — no new colours.
- Pills sit inside a thin rounded container with 1px --hairline border, radius 999px, padding 4px. Mirrors the existing deployment-phase YR-1/2/3 pill pattern in TopBar — make it look like a sibling element.
- Accept an optional `className` prop for placement tweaks.
- Reduced-motion: respect prefers-reduced-motion for any transition.

Commit chunk: equity-shared-tabs-component

================================================
JOB 2 — Place the nav in both top bars

(a) Dashboard TopBar (src/control/TopBar.tsx)
- Insert <SectionTabs /> immediately after the brand mark on the LEFT, before the centre region (location / modelling day / stress-test). It should feel like part of the brand block ("Project Q · Authority Control" + the section switcher).
- Adjust the existing topbar grid so the brand region absorbs the tabs without pushing the centre or right regions around. If the layout is `grid-template-columns: auto 1fr auto`, the tabs join the left column.
- Touch nothing else in this file: not the location dropdown, not the modelling-day selector, not the stress-test dropdown, not the deployment-phase pills, not the theme toggle, not the payload upload, not the mic. NONE of those move or change.

(b) Equity Console (src/equity/EquityConsole.tsx)
- The Equity Console doesn't currently have a top bar of the dashboard's kind. Add a minimal header band at the top of its render tree (NOT a full TopBar — just a thin horizontal strip) containing:
    - The same brand mark used in the dashboard TopBar (28×28 logo + "Project Q" wordmark + small mono caption "Equity Index · v0.x" — mirror the dashboard's pattern at lower visual weight, since equity already has its own hero "Equity index /100" panel).
    - <SectionTabs /> on the same row.
    - The existing dashboard theme toggle, IF the equity store/page can share theme state cleanly (see Job 3). Otherwise omit and let the equity page run in its current default theme.
- The strip uses the same height, padding, and hairline border as the dashboard's TopBar so the two pages feel like one product.
- Do NOT restructure the rest of EquityConsole. The hero "Equity index" panel, the stakeholder chart, the decision rail, the Circle-of-Viewpoints, the advisor dock — all stay exactly where they are.

Commit chunk: equity-tab-placement

================================================
JOB 3 — Theme consistency

The dashboard has a dark/light toggle. The equity page is currently dark-glass.

- If the dark/light theme is held in a shared place (a context or a `data-theme` attribute on `<html>` or `<body>`), wire the equity page to read it so toggling on either page applies to both. Persist to localStorage under the existing key (whatever the dashboard already uses).
- If the equity console hardcodes dark in its CSS, do the smallest change possible to make it follow the same theme attribute (e.g. `[data-theme="light"] .qeq-...` overrides for the small set of tokens that need to flip — background, ink, hairlines). Lean on the existing palette tokens; don't invent new ones.
- If wiring the toggle into the equity page risks regressions in time, fall back to: omit the theme toggle on the equity header, but ensure the equity page still inherits the body-level theme so switching on the dashboard and then navigating to /equity shows the matching theme. State this fallback clearly in WRAP_UP.

Commit chunk: equity-theme-sync

================================================
JOB 4 — Verify + deploy

Local:
1. nohup npm run dev > /tmp/dev.log 2>&1 & ; wait 5s; curl -I http://localhost:5173 → 200.
2. npm run build clean, 0 TS errors.
3. Headless Chrome at 1280×800 and 1920×1200, capture:
   - / with "Control" tab active (the existing dashboard untouched)
   - /equity with "Equity Index" tab active (existing console untouched, plus the new header strip)
   - Both views in dark theme and light theme (if Job 3 wired the equity to the toggle)
   Save to ./review-screenshots/equity-tab/.
4. Click-through check:
   - From /, click "Equity Index" → URL becomes /equity, page renders the EquityConsole.
   - From /equity, click "Control" → URL becomes /, dashboard renders.
   - Back-button works in both directions (NavLink + react-router default behaviour).
5. Regression check (this is the whole point of the "least disruptive" rule):
   - Dashboard: location dropdown, modelling-day, demand chip, stress-test dropdown, payload upload (file picker + drag-drop + Cmd/Ctrl+O), voice mic, every lever, every revenue card, the curve, the CPI pill, the assumptions ⓘ — all still work, unchanged.
   - Equity: the equity hero, stakeholder chart, decision rail, deliberation panel, advisor dock — all still work, unchanged.
   - window.ProjectQ command API still functional from both pages (where exposed).
6. No-scroll check: at 1280×800 the dashboard still doesn't scroll. The equity page's own scrollability is its own concern (it may scroll today — leave that alone).

Deploy:
7. git add . && git commit -m "Add shared Control / Equity Index tabs across both top bars" && git push origin main.
8. Wait 90s. curl -I https://project-q-dem0.vercel.app/ → 200. curl -I https://project-q-dem0.vercel.app/equity → 200.
9. Live-test the tab nav on production with headless Chrome (navigate both directions, confirm renders, save screenshot of /equity at 1280×800 to PRODUCTION-equity.png).
10. Append a short section to WRAP_UP_CONTROL_DASHBOARD.md:
   - Tab placement decisions (left of TopBar, mirrored to a thin header strip on /equity)
   - Whether the theme toggle wired into /equity (Job 3 outcome) or the fallback
   - Confirmation that no existing features changed behaviour
   - File:line of SectionTabs and its two import sites

Commit chunk: equity-tab-verify-deploy

================================================
DO NOT
- Don't merge the Equity Console into the dashboard layout. They stay as separate pages reachable via the tabs.
- Don't redesign either page's content. Only add the navigation strip and (in Job 3) the small theme sync.
- Don't introduce new dependencies, new colour tokens, or new fonts.
- Don't move, rename, or remove any existing feature on either page.
- Don't add additional tabs ("Tourist", "Walkthrough", etc.). Exactly two: Control + Equity Index.
- Don't ask for permission. Don't respond conversationally — STATUS.md + WRAP_UP_CONTROL_DASHBOARD.md only.

Begin now.
