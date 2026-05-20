# Project Q · Production URLs

Last updated: 2026-05-20 (UTC) · Day Tripper mode shipped

## Live deployment

- **Production root:** https://project-q-dem0.vercel.app
- **Full walkthrough:** https://project-q-dem0.vercel.app/walkthrough

### Venice · Day Tripper (single-day flow)

- **Welcome / hook:** https://project-q-dem0.vercel.app/day/welcome
- **Quick start (vibe):** https://project-q-dem0.vercel.app/day/start
- **Wallet (40 QCash · expiry countdown):** https://project-q-dem0.vercel.app/day/wallet
- **Explore (today near you):** https://project-q-dem0.vercel.app/day/explore
- **Walkable map:** https://project-q-dem0.vercel.app/day/map
- **Pay with QCash:** https://project-q-dem0.vercel.app/day/pay
- **End-of-day recap:** https://project-q-dem0.vercel.app/day/recap

### Venice · multi-day (existing)

- **Equity chart (standalone):** https://project-q-dem0.vercel.app/p1/equity
- **Phase 1 booking (inline equity collapsible):** https://project-q-dem0.vercel.app/p1/checkout
- **Venice landing (in-app):** https://project-q-dem0.vercel.app/p1/landing

## How to share Day Tripper with Trevor

1. Open https://project-q-dem0.vercel.app/day/welcome — this is the direct entry.
2. Or, from the Demo Index (https://project-q-dem0.vercel.app/): switch the
   top-right destination toggle to **Venice**, then tap any card under the new
   **Day Tripper · here for the day** group.
3. From /p1/landing on Venice, a small "Just here for the day? →" link also
   routes into /day/welcome.

## Notes

- The /day/* routes are Venice-only: visiting with `q-destination=queenstown`
  in localStorage redirects to /.
- All Day Tripper screens render in the existing iOS PhoneFrame and reuse the
  dark-glass aesthetic, QCash glyph, OSRM walking routes, and Pay QR flow from
  the multi-day app.
- The QCash balance is session-state only (resets on reload) and the impact
  allocation percentages are illustrative — see WRAP_UP_DAY_TRIPPER.md for the
  follow-up data work.
