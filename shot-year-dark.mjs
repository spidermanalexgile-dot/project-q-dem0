import { chromium } from "playwright";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.waitForSelector(".curve-view-toggle", { timeout: 20000 });
if (!(await page.evaluate(() => document.querySelector(".qctl-root").classList.contains("dark"))))
  await page.locator(".tb-theme").click();
await page.locator(".curve-view-toggle button", { hasText: "Zoom out" }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: "review-screenshots/dpm-changes/year-clean-dark.png" });
await browser.close();
console.log("DONE");
