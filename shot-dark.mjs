import { chromium } from "playwright";
import { mkdirSync } from "fs";
const OUT = "review-screenshots/dpm-changes";
mkdirSync(OUT, { recursive: true });
const URL = process.env.QURL || "http://localhost:5173/";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector(".confidence-pill", { timeout: 20000 });
// Ensure dark mode on.
const isDark = await page.evaluate(() => document.querySelector(".qctl-root").classList.contains("dark"));
if (!isDark) { await page.locator(".tb-theme").click(); await page.waitForTimeout(400); }
await page.waitForTimeout(400);
await page.screenshot({ path: OUT + "/glass-dark-cost.png" });
// Year view too.
await page.locator(".curve-view-toggle button", { hasText: "Zoom out" }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: OUT + "/glass-dark-year.png" });
console.log("DARK_BG", await page.evaluate(() => getComputedStyle(document.querySelector(".qctl-root")).backgroundColor));
console.log("CONSOLE_ERRORS", JSON.stringify(errors));
await browser.close();
console.log("SHOT_DARK_DONE");
