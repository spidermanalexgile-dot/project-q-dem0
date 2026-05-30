import { chromium } from "playwright";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 3 });
const page = await ctx.newPage();
await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.waitForSelector(".curve-view-toggle", { timeout: 20000 });
await page.locator(".curve-view-toggle button", { hasText: "Zoom out" }).click();
await page.waitForTimeout(400);
const box = await page.locator(".curve-stage").boundingBox();
await page.screenshot({
  path: "review-screenshots/dpm-changes/year-crop.png",
  clip: { x: box.x, y: box.y, width: Math.round(box.width * 0.6), height: Math.round(box.height * 0.55) },
});
await browser.close();
console.log("CROP_DONE");
