# Wrap-up · Venice Day Tripper mode

**Date:** 2026-05-20 (UTC)
**Branch:** main
**HEAD at deploy:** f690fda

A simplified, single-day Venice experience shipped to production. Existing
multi-day Venice (Phases 1–4) and the full Queenstown demo are untouched; the
Day Tripper mode is purely additive.

## Production URL

https://project-q-dem0.vercel.app/day/welcome

**For Trevor:** open that link. The Venice destination is forced on entry by
the Demo Index card; if you arrive with `q-destination=queenstown` set in
localStorage, /day/welcome redirects you back to /.

### Reaching it from the Demo Index in the Venice toggle

1. Go to https://project-q-dem0.vercel.app/
2. Top-right toggle: switch to **Venice** (it persists in localStorage)
3. A new card group appears: **Day Tripper · here for the day** with the seven
   /day/* screens listed. Tap "Welcome · the hook ★" to start.

It's also accessible from /p1/landing on Venice via a small
"Just here for the day? →" link below the primary CTA.

## Commit-by-commit timeline

1. **a2c2fb1** — `day-tripper-routing-and-entry`
   - `/day/*` route namespace in App.tsx, all wrapped in `<MobileRoute>` + `<DayGuard>`.
   - `DayGuard` redirects when destination=queenstown → /.
   - `DayTripperProvider` (session state: QCash balance, spend log, selected vibe, selected spot).
   - Demo Index card "Day Tripper · here for the day" added, gated `veniceOnly: true`.
   - Phase 1 Venice landing screen gets a small "Just here for the day? →" link (Venice-only).

2. **879b606** — `day-tripper-data`
   - `src/data/dayTripper.ts`: persona (Lena & Tom), 14 walkable spots (consistent with `venicePins.ts` coordinates), four vibes mapped to spot types, and the €40 impact allocation breakdown.
   - Spots cover food / sight / experience / viewpoint / shopping / transport.

3. **6fafcd8** — `day-tripper-screens`
   - All seven screens: Welcome, Start, Wallet, Explore, Map, Pay, Recap.
   - Shared `DayNav` bottom tab bar (Wallet · Explore · Map · Pay · Recap), used by the five core screens (not Welcome/Start — those are pre-app onboarding).
   - Wallet: live countdown to 23:59 local, count-up balance, expandable "How QCash works".
   - Explore: list sorted by `walkMinutesFromSanMarco`, vibe chip filter.
   - Map: Leaflet + Esri imagery tiles, OSRM `/foot/` walking route from the San Marco arrival point to the selected spot, fallback to straight line on OSRM failure.
   - Pay: reuses the QR-code + ttl pattern from `Phase3PayGlass`; decrements the session balance and writes to the spend log on confirm.
   - Recap: numbers from the live spend log, plus a stacked impact bar.

4. **de93947** — `day-tripper-walkthrough-integration`
   - Seven new Walkthrough sections under "Venice · Day Tripper", flagged `veniceOnly: true` so they appear only under the Venice destination toggle.

5. **f690fda** — `day-tripper-verify-deploy`
   - Local headless Chrome screenshots at 393×852 (mobile) and 1440×900 (desktop) for every /day/* route in `review-screenshots/day-tripper/`.
   - Queenstown→`/day/welcome` redirect verification screenshot included.
   - STATUS.md entries appended.

After push: production routes confirmed 200 (`/`, `/day/welcome`, `/day/wallet`,
`/day/recap`, `/day/explore`, `/day/map`, `/day/pay`, `/day/start`). Production
screenshots saved as `PRODUCTION-day-welcome-mobile.png` and
`PRODUCTION-day-wallet-mobile.png`.

## Judgment calls

- **Routing approach:** chose the `/day/*` route namespace (Option 1) over a
  ModeContext. Keeps Day Tripper fully isolated — no risk of touching the
  multi-day phase screens, and shareable URLs are unambiguous.
- **Destination guarding:** `DayGuard` redirects Queenstown → /. It does *not*
  auto-promote to Venice; the assumption is that someone arriving in /day/*
  with Queenstown selected wants to bail back to the chooser, not be silently
  switched. The Demo Index card is hidden in Queenstown anyway.
- **Shortlist:** picked 14 spots that fit four criteria — walkable from
  central arrival corridor, doable in <2hrs, QCash-accepting, and varied across
  food / sight / experience / viewpoint / shopping / transport. Murano is
  included (40-min vaporetto) as the one "out and back" option for visitors
  with a longer window.
- **Session-state QCash:** held in a small React context (`DayTripperContext`)
  rather than localStorage. Day Tripper sessions are intentionally ephemeral
  (you're here for one day); persisting balance across reloads conflicts with
  the same-day-urgency framing. Spend log and balance both reset on reload —
  acceptable for the demo, would need to be tied to the arrival-QR identity in
  production.
- **Pay amount:** the QR amount is derived from the lower bound of the
  selected spot's `qcashPriceRange` (plus a small increment) so the demo
  feels lived-in without exposing a price picker UI.
- **Onboarding:** held to exactly one optional question, per the brief. The
  vibe selector is single-tap to advance; "Skip" is always visible.
- **Recap with no spends:** when `spends.length === 0`, the Recap screen falls
  back to a clearly labelled sample day so the screen never looks empty in the
  demo. Real spends override this immediately.
- **Map pins:** only the 14 day-tripper pins render — not the full venicePins
  set — so the visual matches the "today only" narrative.

## Follow-ups

- **Spot / QCash data:** all 14 spots are illustrative. Before any external
  pitch, replace with real merchant signups + actual QCash redemption rates
  from the Venice pilot.
- **Impact allocations:** the four buckets are placeholders. Real source
  figures should come from Comune di Venezia's published apportionment of the
  day-visitor contributo per categoria di spesa.
- **Share my Venice day:** currently a styled mock button. Wire to a Web
  Share API call (with an image card / OG tags) once Phase 4 memory-film
  generation is hooked up.
- **Localisation:** all copy is English-only. Day-tripper is the persona most
  likely to need IT / DE / FR / ES — add before pilot.
- **Persistent session:** for production, balance + spend log should be tied
  to the arrival-QR identity so a reload (or a switch to phone-share) doesn't
  reset the wallet. Today it's pure React state.
- **OSRM dependency:** walking routes hit the public OSRM demo. For a real
  rollout this needs either a hosted OSRM tile or an OS-routing-machine
  contract — the current fallback (dashed gold straight line) is fine for the
  demo.

## Tests / checks performed

- `npm run build` clean (0 TS errors)
- Local dev (`http://localhost:5173/`) serves 200 for `/` and `/day/welcome`
- Production 200 on `/`, `/day/welcome`, `/day/wallet`, `/day/recap`,
  `/day/explore`, `/day/map`, `/day/pay`, `/day/start`
- Mobile (393×852) + desktop (1440×900) screenshots captured for every screen
- Queenstown `/day/welcome` redirect manually verified, lands on Demo Index
- No regressions to the multi-day Venice or Queenstown screens (no shared
  files modified beyond the additive Demo Index card, Walkthrough section,
  and Phase 1 Venice landing link)
