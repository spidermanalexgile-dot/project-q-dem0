import { chromium } from "playwright";
import { mkdirSync } from "fs";
mkdirSync("review-screenshots/dpm-changes", { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
const URL = process.env.QURL || "http://localhost:5173/";
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector(".levers-panel", { timeout: 20000 });
const log = (...a) => console.log(...a);

// API exists
log("API", JSON.stringify(await page.evaluate(() => ({
  setTargetCapacity: typeof window.ProjectQ.setTargetCapacity,
  liveDemandPct: typeof window.ProjectQ.liveDemandPct,
  targetCapacity: typeof window.ProjectQ.targetCapacity,
}))));

// 1) Cost curve ramps BELOW target + goes NEGATIVE near empty.
const curve = await page.evaluate(() => ({
  feeAt0: Math.round(window.ProjectQ.feeAtPct(0) * 10) / 10,      // negative (paid to come)
  feeAt20: Math.round(window.ProjectQ.feeAtPct(20) * 10) / 10,    // low
  feeAt50: Math.round(window.ProjectQ.feeAtPct(50) * 10) / 10,    // mid-ramp
  feeAt100: Math.round(window.ProjectQ.feeAtPct(100) * 10) / 10,  // base €10 at target
}));
log("CURVE_RAMP", JSON.stringify(curve));
log("RAMP_RISING", curve.feeAt0 < curve.feeAt20 && curve.feeAt20 < curve.feeAt50 && curve.feeAt50 < curve.feeAt100);
log("NEGATIVE_NEAR_EMPTY", curve.feeAt0 < 0);

// 2) Target capacity rebases demand. A 100% baseline day at 50k = 100%; at 40k = 125%.
const rebase = await page.evaluate(() => {
  const at50 = window.ProjectQ.liveDemandPct(100); // default target 50k
  window.ProjectQ.setTargetCapacity(40000);
  const at40 = window.ProjectQ.liveDemandPct(100);
  return { target: window.ProjectQ.targetCapacity(), at50: Math.round(at50), at40: Math.round(at40) };
});
log("REBASE", JSON.stringify(rebase));
log("LOWER_TARGET_RAISES_DEMAND", rebase.at40 > rebase.at50);

// Topbar shows target capacity input + live %.
log("TARGET_INPUT", await page.locator(".tb-capacity-input input").count());
log("TARGET_VALUE", await page.locator(".tb-capacity-input input").inputValue());

// 3) Zoom-out: month labels (Jan..Dec), bell-curve shape (Aug peak).
await page.evaluate(() => window.ProjectQ.setTargetCapacity(50000)); // reset
await page.locator(".curve-view-toggle button", { hasText: "Zoom out" }).click();
await page.waitForTimeout(400);
const xLabels = await page.$$eval(".curve-svg .curve-tick-label", (ts) => ts.map((t) => t.textContent.trim()));
log("X_LABELS", JSON.stringify(xLabels.filter((l) => /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/.test(l))));
await page.screenshot({ path: "review-screenshots/dpm-changes/year-bell.png" });
await page.locator(".curve-view-toggle button", { hasText: "Cost curve" }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: "review-screenshots/dpm-changes/cost-curve-ramp.png" });

log("CONSOLE_ERRORS", JSON.stringify(errors));
await browser.close();
log("DONE");
