import { chromium } from "playwright";
import { mkdirSync } from "fs";
mkdirSync("review-screenshots/dpm-changes", { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(process.env.QURL || "http://localhost:5173/", { waitUntil: "networkidle" });
await page.waitForSelector(".levers-panel", { timeout: 20000 });
// Top bar overlap check: do any two tb-field/tb-label boxes overlap?
const overlap = await page.evaluate(() => {
  const boxes = [...document.querySelectorAll(".topbar .tb-field")].map((e) => e.getBoundingClientRect());
  let hit = 0;
  for (let i=0;i<boxes.length;i++) for (let j=i+1;j<boxes.length;j++){
    const a=boxes[i],b=boxes[j];
    const ox=Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left));
    const oy=Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
    if(ox>2&&oy>2)hit++;
  }
  return { fields: boxes.length, overlaps: hit, topbarScrollW: document.querySelector(".topbar").scrollWidth, topbarClientW: document.querySelector(".topbar").clientWidth };
});
console.log("TOPBAR", JSON.stringify(overlap));
console.log("TARGET_IN_LEVERS", await page.locator(".lever-input input").count());
// Convex ramp: midpoint should be BELOW linear midpoint (steeper near 100%).
const ramp = await page.evaluate(() => ({
  f25: Math.round(window.ProjectQ.feeAtPct(25)*100)/100,
  f50: Math.round(window.ProjectQ.feeAtPct(50)*100)/100,
  f75: Math.round(window.ProjectQ.feeAtPct(75)*100)/100,
  f100: Math.round(window.ProjectQ.feeAtPct(100)*100)/100,
}));
console.log("RAMP", JSON.stringify(ramp));
await page.screenshot({ path: "review-screenshots/dpm-changes/refine-topbar.png" });
// Revenue trend highlight: bump a lever up → annual figure gets .up (green).
await page.evaluate(() => window.ProjectQ.setLever("base_fee", 30));
await page.waitForTimeout(300);
const trend = await page.evaluate(() => {
  const f = document.querySelector(".rev-figure.annual");
  return { cls: f.className, color: getComputedStyle(f).color };
});
console.log("REV_TREND_UP", JSON.stringify(trend));
// Zoom-out green fill.
await page.locator(".curve-view-toggle button", { hasText: "Zoom out" }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: "review-screenshots/dpm-changes/year-green.png" });
console.log("ERRORS", JSON.stringify(errors));
await browser.close();
console.log("DONE");
