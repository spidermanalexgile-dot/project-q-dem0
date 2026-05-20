# Project Q · Production URLs

Last updated: 2026-05-20 (UTC)

## Live deployment

- **Production root:** https://project-q-dem0.vercel.app
- **Venice equity chart (standalone):** https://project-q-dem0.vercel.app/p1/equity
- **Phase 1 booking (inline equity collapsible appears when Venice is active):** https://project-q-dem0.vercel.app/p1/checkout
- **Full walkthrough:** https://project-q-dem0.vercel.app/walkthrough

## How to share with Trevor

1. Open https://project-q-dem0.vercel.app/p1/equity
2. The destination toggle is in the top-right of the page. It should already
   read **Venice** by default on first visit; if Trevor lands in the
   Queenstown demo, click the toggle to switch.
3. The pie chart on the left renders the seven Venice day-tourist segments;
   hover or tap any slice to update the detail panel on the right. The
   `Regressive`-verdict slices (regional train, intercity bus) are the
   equity argument for the QCash rebate.
4. From there, "See the booking line item →" jumps to /p1/checkout where
   the same chart is available as an inline "Where this fee fits — and who
   pays what" collapsible directly beneath the €40 fee line on the
   simulated external booking page.

## Notes

- The destination toggle is persisted to `localStorage` (`q-destination`);
  Trevor's choice will stick across pages and tabs.
- Queenstown does **not** render this chart anywhere — the segments don't
  map across cleanly (Queenstown is heavily fly-in skewed) and the equity
  argument differs.
- Numbers in the chart are illustrative; see WRAP_UP_VENICE_EQUITY.md for
  the follow-up around sourced Comune di Venezia statistics.
