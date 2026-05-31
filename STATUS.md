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
[2026-05-30T04:21:06Z] · removed shoulder-season recirculation (UI+curve+force-off in loader, setRebate no-op); added voice control mode + audible confirmations (voice.ts parser, VoiceControl mic/TTS, window.ProjectQ.voiceCommand); build clean; local verify pass; pushing · 03854cd
[2026-05-30T04:23:14Z] · DONE · prod 200; live: shoulder rebate removed (row/legend/credit gone, fee@10%%=€10), voice control + audible confirms working (8/8 commands, "lowered to 30,000" etc), 0 console errors · b03916b
[2026-05-30T04:30:39Z] · voice: soft female voice (pitch 1.35/rate 0.95, prefers Samantha/Aria etc); fixed continuous-repeat (speak/mute self-hearing guard); added date recognition (4 phrasings) + reset; all UI controls voice-reachable; build clean; local verify pass; pushing · 7b02151
[2026-05-30T04:32:45Z] · DONE · prod 200; live: soft female voice, repeat-loop fixed (self-hearing guard), date voice commands work (4 phrasings, interpolated), all controls voice-reachable, 0 console errors · 6dc9345
[2026-05-30T04:54:02Z] · voice: stay silent on unrecognized audio (tryVoiceCommand recognized flag — no more "sorry" at every noise); warmer voice (prefer natural/neural female, skip harsh like Zira, pitch 1.35->1.05); build clean; local verify pass; pushing · c2cb821
[2026-05-30T04:56:06Z] · DONE · prod 200; live: ignores noise silently (5/5 noise phrases unchanged, not voiced), real commands work, warmer voice (pitch 1.05, natural-female preference), 0 console errors · ee49e60
[2026-05-30T05:08:30Z] · voice repeat fixed decisively (mic physically stopped while speaking, restart only after onend + dedupe); clarified zoom-out graph (plain-language "how busy across the year", crowd descriptors Very busy/Busy/Normal/Quiet, explainer); "Crowd level" + "?" help replaces raw demand%; build clean; verify pass; pushing · affdc61
[2026-05-30T05:10:38Z] · DONE · prod 200; live: voice speaks once (mic off while speaking), zoom-out graph clarified (How busy across the year, Very busy/Busy/Normal bands), demand renamed Crowd level + ? explainer, 0 console errors · 493504b
[2026-05-30T05:43:59Z] · voice routing fixed (specificity-scored lever match, no more default-to-target-capacity; ambiguous input stays silent); added "Sustainability fee if booked today" number (= fee at modelled crowd level); build clean; verify pass; pushing · dbc8ab7
[2026-05-30T05:46:07Z] · DONE · prod 200; live: voice routes to the named control (target capacity no longer hijacked; ambiguous input silent), "Sustainability fee if booked today" shows per-visitor fee at modelled crowd level (€50 @ 200%), 0 console errors · 87f9b3b
[2026-05-30T10:12:46Z] · redesigned dark mode: dropped warm-brown palette for cool "Apple glass" (deep slate canvas + blurred colour blobs + frosted translucent panels via backdrop-filter); light mode unchanged; build clean; verify pass; pushing · 2254629
[2026-05-30T10:15:07Z] · DONE · prod 200; live: Apple-glass dark mode (cool slate + blurred colour blobs + frosted translucent panels, no brown), light mode + features intact, 0 console errors · 4a98cac
[2026-05-30T10:23:14Z] · fixed Levers box clipping: right-rail grid now minmax(0,1fr) auto so Levers gets its full natural height (revenue flexes into leftover); all 4 sliders + ceiling ticks fit at 1280x800 & 1440x900, no scroll; build clean; pushing · 1a26d24
[2026-05-30T10:25:24Z] · DONE · prod 200; live: Levers box fully visible (all 4 sliders + ceiling ticks fit at 1280x800 & 1440x900, no scroll), 0 errors · 04dec13
[2026-05-30T10:49:47Z] · built deterministic in-UI analyst agent (explain "why is Feb 2nd 139%" via DPM-anchor interpolation; goal-seek "raise Jan revenue +3M via base fee" by bisection-solving the real engine; chat panel + Apply button + window.ProjectQ.askAnalyst); shrank revenue figures so no text clips; build clean; verify pass; pushing · a28614f
[2026-05-30T10:52:06Z] · DONE · prod 200; live: analyst agent works (explains Feb 2nd 139% via DPM anchors, goal-seeks Jan +€3M->base fee €12, Apply moves engine), revenue text no clip, 0 console errors · 6f53797
[2026-05-30T11:09:24Z] · analyst v2: lever comparison ("cheapest way to +€80M" ranks all levers, honest when target < step), explain-revenue (seasonal-band + monthly day-sum breakdown), spoken answers (shared speech.ts + speaker toggle, persisted); build clean; verify pass; pushing · f88d15f
[2026-05-30T11:11:34Z] · DONE · prod 200; live: analyst v2 — lever comparison (+€80M ranks levers, honest on tiny asks), revenue explanation (seasonal bands + monthly day-sum), spoken answers + speaker toggle, originals intact, 0 console errors · 5c2bf1d
[2026-05-30T23:15:54Z] · fixed zoom-out graph text overlap: band labels moved INSIDE each step, modelled-day caption to a fixed top-left slot (+ y-axis dot), removed redundant y-axis caption; collision sweep across demand 30-200% at 1280/1920 = 0 overlaps; build clean; pushing · e3f6b45
[2026-05-30T23:20:09Z] · DONE · prod 200; live: zoom-out graph 0 text overlaps across demand 30-200% at 1280 & 1920 (band labels inside steps, modelled-day caption fixed top-left) · 1865f5b
[2026-05-30T23:37:03Z] · zoom-out is now a demand-response curve: pricing levers flatten the year toward 100% capacity (managedDemandPct: managed=100+(raw-100)*e^(-fee/30)); raw forecast dashed + managed solid + "% flatter" badge; verified flatten monotonic (spread 18.5->4.2, peak 119->100) + 0 label overlaps across lever sweeps; build clean; pushing · f49a40a
[2026-05-30T23:39:20Z] · DONE · prod 200; live: zoom-out is a demand-response curve, levers flatten year toward 100% (spread 18.5->4.2, peak 119->100, monotonic), 0 label overlaps across lever sweeps, 0 console errors · fabb1d5
[2026-05-31T00:07:43Z] · occupancy target: set desired % (e.g. Venice wants 80% today) and the fee levers auto-tune to deter crowds above it + steer year toward it; TopBar field + voice command ("we only want 80% capacity today") + window.ProjectQ.setOccupancyTarget; year curve target line follows it; verified peak lands ~80/~60, voice routes, levers not hijacked; build clean; pushing · b6d1263
[2026-05-31T00:10:07Z] · DONE · prod 200; live: occupancy target auto-tunes fees (target 80->peak 81%, 60->61%), TopBar field + voice "we only want 80% capacity today", lever cmds not hijacked, 0 overlaps, 0 console errors · 90b6259
[2026-05-31T00:37:10Z] · merged voice + analyst into one Project Q Assistant (mic inside the chat; control commands auto-apply, questions analyzed, same warm voice reads replies); new "suggest lever settings for this day and explain" -> multi-lever recommendation + Apply; verified suggest/control/occupancy/question all route in one box, regressions pass; build clean; pushing · 5234ee2
