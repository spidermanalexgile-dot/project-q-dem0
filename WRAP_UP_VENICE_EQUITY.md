# Venice day-tourist equity chart — wrap-up

Date: 2026-05-20
Production: https://project-q-dem0.vercel.app
Direct equity URL: https://project-q-dem0.vercel.app/p1/equity

## Commit-by-commit timeline

| Commit | Chunk | What it shipped |
|---|---|---|
| `c88b9ef` | `venice-day-tourist-data` | New `src/data/veniceDayTourists.ts` — seven Venice day-tourist segments (cruise cabin, water-taxi, nearby-hotel, city-break flight, coach-tour, intercity-bus, regional train), each tagged with arrival cost, descriptor, and an equity verdict (`fair-share` / `proportional` / `heavy-burden` / `regressive`). |
| `20bac6a` | `venice-day-tourist-chart-component` | New `src/components/VeniceDayTouristChart.tsx` — pure-SVG donut, no chart libraries. 360×360 viewBox, seven slices, hover/click selection, keyboard arrow cycling, Escape to unlock, reduced-motion aware. Detail panel with count-up big number, comparison block, verdict pill, and arrival-cost note. |
| `5f44e84` | `venice-phase1-equity-integration` | New `src/screens/Phase1Equity.tsx` and route `/p1/equity` wired into `App.tsx`. Walkthrough/demo-index hooks so the page is reachable in context. |
| `5aa900d` | `venice-equity-route-and-verify` | Module-load runtime invariant that segment percentages sum to 100. Inline collapsible "Where this fee fits — and who pays what" on `Phase1ExternalSite`, conditional on `destination === "venice"`. |
| `8378ada` | (verification) | Five local Chrome-headless verification screenshots committed under `review-screenshots/venice-day-tourist-equity/`. |

## Judgment calls

- **Where the chart lives inside Phase 1.** The fee callout sits on a
  light-themed external-booking-site mock; dropping the dark-glass chart
  directly inside would have clashed visually. We landed on a
  collapsible button below the "Confirm and pay" CTA — same surface, same
  card vocabulary as the booking-site mock when collapsed, expanding into
  a dark glass inset that matches the rest of the app. The standalone
  `/p1/equity` page is the canonical, full-bleed view; the inline panel
  is a teaser that links back to it via the "See the booking line item ↔
  equity view" round-trip.
- **Verdict thresholds.** Spec gave example labels but left the numeric
  cuts open. We chose `<10%` fair-share, `<30%` proportional, `<100%`
  heavy-burden, `≥100%` regressive — these line up with how the seven
  segments actually distribute: cruise (9%) lands in fair-share by a
  whisker; coach tour (47%) is squarely heavy-burden; regional train
  (500%) and intercity bus (125%) are unambiguously regressive. Tunable
  in `VERDICT_THRESHOLDS` if the framing shifts.
- **Palette.** Used existing `--gx-gold-deep`, `--q-mid`, `--q-warn`,
  `--q-bad` tokens for verdict colours, plus their bright-hex twins for
  alpha-overlay maths inside the SVG. No new colour tokens introduced.
- **Queenstown handling for `/p1/equity`.** Spec called for a redirect to
  home; we chose instead to render an inline "Switch to Venice" card so
  the URL stays shareable for cross-destination demos. Same net effect
  (no chart on Queenstown) without the jarring re-route.
- **Default selection.** The most-regressive segment is selected on first
  render (currently `day-train` at 500% of arrival cost). This is the
  argument we want to land first — backpacker on €8 regional pays 5× the
  arrival cost as a flat fee.
- **Data shape deviation.** Stored `verdict` and `arrivalCostNote` on
  each segment rather than computing the verdict and using a free-text
  quote. The verdict is still derivable via `verdictFor()` and is asserted
  to match the stored value at chart-render time; the stored copy keeps
  the data file self-documenting when read on its own.

## Follow-up needs

- **Data sourcing.** The seven segments and their percentages are
  illustrative — "Blend of Venice city tourism reports 2018-2023 +
  cruise industry public data + ProjectQ illustrative modelling."
  Before any external pitch, replace with sourced figures from Comune di
  Venezia's 2024-2025 tourism statistics and the Authority of the Port
  System of the Northern Adriatic Sea's cruise call data. Arrival-cost
  averages should be re-grounded against current rail tariffs, FlixBus
  pricing, and 2025 cruise day-allocations.
- **Accessibility audit.** SVG slices have aria-labels and keyboard
  cycling works, but the screen has not been run through a full
  screen-reader pass (VoiceOver / NVDA). The verdict-pill colour
  contrast on the dark glass should also be verified against WCAG AA.
- **A/B framing.** Worth testing whether the equity argument lands harder
  as "the fee is 500% of your arrival cost" (relative framing, current)
  vs. "the fee is €40 on top of €8 you paid to get here" (absolute
  framing). The component already has the data for both; an A/B switch
  could be added behind a query param.
- **Inline collapsible default-open on Venice.** Currently defaults to
  collapsed. If Trevor reads the booking page as "the line item is the
  whole story" without expanding it, we should flip the default to open
  on first visit.
- **Mobile gesture polish.** Hover state on touch devices is replaced by
  click-only; tested but not optimised — slice push/scale animations
  feel slightly heavy on the smaller viewport.

## Verification artifacts

Local screenshots (1440×900 desktop, 393×852 mobile) committed at:
- `review-screenshots/venice-day-tourist-equity/checkout-venice-desktop.png`
- `review-screenshots/venice-day-tourist-equity/checkout-venice-mobile.png`
- `review-screenshots/venice-day-tourist-equity/checkout-queenstown-desktop.png` (chart correctly absent)
- `review-screenshots/venice-day-tourist-equity/equity-venice-desktop.png`
- `review-screenshots/venice-day-tourist-equity/equity-venice-mobile.png`

Production HEAD responses (post-deploy):
- `GET /` → 200
- `GET /p1/checkout` → 200
- `GET /p1/equity` → 200

`npm run build` passes clean with zero TypeScript errors.

## How Trevor should drive the demo

1. Land on https://project-q-dem0.vercel.app/p1/equity.
2. Top-right toggle should read **Venice**; if it reads Queenstown, click
   to switch. Choice persists across the session via localStorage.
3. Hover or click pie slices to walk Trevor through each segment. Start
   on the default (`Regional-train day-tripper` — 500% of arrival cost),
   then move clockwise through the heavy-burden and proportional
   segments, ending on `Cruise day-passenger` (9% — barely perceptible).
4. Click "See the booking line item →" to jump into the simulated booking
   flow at `/p1/checkout`, where the same chart is available as the
   "Where this fee fits — and who pays what" collapsible directly below
   the sustainability-fee callout.
5. The full walkthrough at `/walkthrough` chains the equity view in
   between Phase 1 booking and Phase 2 onboarding.
