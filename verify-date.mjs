import { chromium } from "playwright";
import { mkdirSync } from "fs";

const OUT = "review-screenshots/dpm-changes";
mkdirSync(OUT, { recursive: true });
const URL = process.env.QURL || "http://localhost:5173/";
const log = (...a) => console.log(...a);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector(".confidence-pill", { timeout: 20000 });

// Date picker present.
log("DATE_INPUT_PRESENT", await page.locator(".tb-date-input input").count());

// setDate command: anchor dates should match their day_type demand exactly.
const anchors = await page.evaluate(() => {
  const out = {};
  window.ProjectQ.setDate("2026-08-01"); // peak_sat 200
  out["2026-08-01"] = window.ProjectQ.getState().customDemand;
  window.ProjectQ.setDate("2026-12-09"); // dec_weekday 45
  out["2026-12-09"] = window.ProjectQ.getState().customDemand;
  window.ProjectQ.setDate("2026-05-27"); // biennale_wkday 130
  out["2026-05-27"] = window.ProjectQ.getState().customDemand;
  window.ProjectQ.setDate("2026-02-14"); // carnival_sat 160
  out["2026-02-14"] = window.ProjectQ.getState().customDemand;
  return out;
});
log("ANCHOR_DATES", JSON.stringify(anchors));

// Interpolation: a date between two anchors lands between their demands.
const interp = await page.evaluate(() => {
  window.ProjectQ.setDate("2026-07-01"); // between biennale(27 May,130) & peak(1 Aug,200)
  const s = window.ProjectQ.getState();
  return { date: s.customDate, demand: s.customDemand };
});
log("INTERP_2026-07-01", JSON.stringify(interp));

// State drives the rest of the dashboard (callout/label via activeDayType).
const active = await page.evaluate(() => {
  window.ProjectQ.setDate("2026-08-01");
  const c = window.ProjectQ.compute();
  return { label: c.activeDay.label, date: c.activeDay.date, demand: c.activeDay.demand_pct };
});
log("ACTIVE_DAY_ON_DATE", JSON.stringify(active));

// Picking a preset day clears the date.
const cleared = await page.evaluate(() => {
  window.ProjectQ.setDayType("dec_weekday");
  const s = window.ProjectQ.getState();
  return { customDate: s.customDate, customDemand: s.customDemand, activeDay: s.activeDay };
});
log("AFTER_PICK_PRESET", JSON.stringify(cleared));

// setDate(null) reverts.
const reverted = await page.evaluate(() => {
  window.ProjectQ.setDate("2026-08-01");
  window.ProjectQ.setDate(null);
  const s = window.ProjectQ.getState();
  return { customDate: s.customDate, customDemand: s.customDemand };
});
log("AFTER_SETDATE_NULL", JSON.stringify(reverted));

// Exercise the actual <input type=date> UI.
await page.fill(".tb-date-input input", "2026-08-01");
await page.waitForTimeout(250);
log("UI_FILL_RESULT", JSON.stringify(await page.evaluate(() => {
  const s = window.ProjectQ.getState();
  return { customDate: s.customDate, customDemand: s.customDemand };
})));
await page.screenshot({ path: OUT + "/date-picker.png" });

log("CONSOLE_ERRORS", JSON.stringify(errors));
await browser.close();
log("VERIFY_DATE_DONE");
