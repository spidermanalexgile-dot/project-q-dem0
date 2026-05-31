import { chromium } from "playwright";
import { mkdirSync } from "fs";
mkdirSync("review-screenshots/dpm-changes", { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(process.env.QURL || "http://localhost:5173/", { waitUntil: "networkidle" });
await page.waitForSelector(".curve-view-toggle", { timeout: 20000 });
// Set 80% via the new TopBar field path (use API to be deterministic).
await page.evaluate(() => window.ProjectQ.setOccupancyTarget(80));
await page.locator(".curve-view-toggle button", { hasText: "Zoom out" }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: "review-screenshots/dpm-changes/occupancy-80.png" });
// Topbar field visible?
const occField = await page.locator(".tb-label", { hasText: "Occupancy target" }).count();
console.log("OCC_FIELD_PRESENT", occField);
await page.evaluate(() => window.ProjectQ.setOccupancyTarget(null));
await browser.close();
console.log("DONE");
