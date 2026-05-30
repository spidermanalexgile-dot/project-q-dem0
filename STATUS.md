[2026-05-20T02:53:17Z] · start: Venice equity chart · 356ca33
[2026-05-20T05:31:18Z] · built clean; dev 200s on /, /walkthrough, /p1/equity; chromium installing · 356ca33
[2026-05-20T09:15:45Z] · adding runtime assert + inline collapsible · 5f44e84
[2026-05-20T09:29:11Z] · local screenshots OK; cleanup; pushing · 5aa900d
[2026-05-20T09:31:49Z] · prod 200s; pushing seeder + wrap-up · 8378ada
[2026-05-20T09:37:47Z] · prod shots OK; removing seeder; final push · ac9eefa
[2026-05-20T09:39:20Z] · DONE · prod 200s on /, /p1/checkout, /p1/equity · 5a67abb
[2026-05-20T09:51:03Z] · start day-tripper build · 73d0ddd
[2026-05-20T10:00:22Z] · local verified · 73d0ddd
[2026-05-20T10:01:30Z] · pushed; waiting 90s for Vercel · f690fda
[2026-05-20T10:03:00Z] · 90s elapsed, probing prod
[2026-05-20T10:05:02Z] · prod 200 OK on all /day/* routes · f690fda
[2026-05-21T02:39:34Z] · mode switcher built · fa97935
[2026-05-25T03:02:22Z] · fee changed to €14.19 · 9c1739a
[2026-05-28T02:23:57Z] · start Control Dashboard build · 5f66752
[2026-05-28T03:04:27Z] · dashboard local verified · 5f66752
[2026-05-28T03:10:15Z] · pushed, waiting 90s for Vercel
[2026-05-28T03:14:18Z] · prod 200 on /, /tourist, /walkthrough · c6f0ec4
[2026-05-28T04:27:31Z] · dashboard-only mode · 037b1f4
[2026-05-28T04:31:38Z] · prod dashboard-only live, /p1/equity redirects to / · 36a8a1a
[2026-05-29T02:23:49Z] · DPM integration: edits in (payload import, exponent normalize, upload UI); build clean; dev 200; running headless verify · 7aac1cc
[2026-05-29T02:26:24Z] · verify PASS (conf 42, exp 2.2, fee150 €18.71, toasts OK, 0 console errs); build clean; committing+pushing · 4530c68
[2026-05-29T02:29:26Z] · DONE · pushed 676b052; prod 200; live conf 42 + exp 2.2 + fee150 €18.71; PRODUCTION.png captured · 676b052
[2026-05-29T02:40:29Z] · changes: lever maxes↑ (1M/500/2000/1000), dark mode, annual "zoom out" view, removed YR1/2/3; build clean; local verify pass; pushing · ca7eda4
[2026-05-29T02:43:14Z] · fixed light-mode --ink-inverse token; rebuild clean; re-verify; committing · e3ded0a
[2026-05-29T02:45:21Z] · DONE · prod 200; live: lever maxes 1M/500/2000/1000, dark mode + "zoom out" year view live, YR1/2/3 removed, conf 42 exp 2.2, 0 console errors · ddadb8e
[2026-05-30T02:50:44Z] · lever maxes 350k/100/1000/300; removed y-axis € labels; modelling-day now free-form demand input (+setDemand API); build clean; local verify pass; pushing · adb486c
[2026-05-30T02:52:50Z] · DONE · prod 200; live: lever maxes 350k/100/1000/300, y-axis € labels removed, free-form demand input (setDemand) works, conf 42 exp 2.2, 0 console errors · a15367a
[2026-05-30T03:02:15Z] · added calendar date picker (setDate, interpolates demand from DPM day_type date anchors); build clean; local verify pass (anchors exact, 1 Jul→167%); pushing · 453387d
[2026-05-30T03:04:20Z] · DONE · prod 200; live: calendar date picker works (anchors exact, 1 Jul→167%, callout "Sat 1 Aug 2026"), preset/null clears, conf 42 exp 2.2, 0 console errors · f49a6eb
