# Project Q · Production URLs

Last updated: 2026-05-28 (UTC) · Venice Authority Control Dashboard shipped at /

## Live deployment

- **Authority Control Dashboard (root):** https://project-q-dem0.vercel.app/
- **Tourist demo index:** https://project-q-dem0.vercel.app/tourist
- **Full walkthrough:** https://project-q-dem0.vercel.app/walkthrough

### Tourist demo · Venice multi-day

- Equity chart: https://project-q-dem0.vercel.app/p1/equity
- Phase 1 booking with inline equity: https://project-q-dem0.vercel.app/p1/checkout
- Phase 1 Venice landing: https://project-q-dem0.vercel.app/p1/landing

### Tourist demo · Venice Day Tripper

- Welcome: https://project-q-dem0.vercel.app/day/welcome
- Wallet: https://project-q-dem0.vercel.app/day/wallet
- Recap: https://project-q-dem0.vercel.app/day/recap

## How to share with Trevor

1. Open https://project-q-dem0.vercel.app/ — the Authority Control Dashboard
   loads with the Venice DPM payload.
2. Move any lever (target capacity / base fee / max-fee cap / capacity
   ceiling) and watch the curve + revenue figures recompute instantly.
3. Open the browser console during the pitch and drive the dashboard with
   `window.ProjectQ`:
   ```js
   window.ProjectQ.setLever('max_fee_cap', 30);
   window.ProjectQ.setLever('ceiling_pct', 180);
   window.ProjectQ.setDayType('dec_weekday');
   window.ProjectQ.setPhase(3);
   window.ProjectQ.getState();
   ```
4. The tourist demo is still reachable from the small **Tourist demo →**
   link in the bottom-right of the dashboard, or directly at /tourist.

## Notes

- The dashboard is data-agnostic: loading a Dubrovnik or Barcelona DPM
  payload turns the screen into a Dubrovnik or Barcelona pitch with zero
  code changes (`window.ProjectQ.loadPayload(payload)`).
- Loader accepts either a pre-parsed Payload object, a JSON string, or a
  markdown document containing a fenced ```json block (the production DPM
  contract).
- All figures are whole-integer EUR. Single screen, no scroll, tested at
  1280×800 and 1920×1200.
