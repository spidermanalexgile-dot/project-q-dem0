import { chromium } from "playwright";
import { mkdirSync } from "fs";
const OUT = "review-screenshots/dpm-changes";
mkdirSync(OUT, { recursive: true });
const URL = process.env.QURL || "http://localhost:5173/";
const browser = await chromium.launch();
const log = (...a) => console.log(...a);
for (const vp of [{ w: 1280, h: 800 }, { w: 1920, h: 1200 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForSelector(".curve-view-toggle", { timeout: 20000 });
  await page.locator(".curve-view-toggle button", { hasText: "Zoom out" }).click();
  await page.waitForTimeout(400);
  // Try modelling a quiet day too (changes active-line position).
  await page.screenshot({ path: `${OUT}/year-overlap-${vp.w}.png` });
  await ctx.close();
}
await browser.close();
log("SHOT_YEAR_DONE");
