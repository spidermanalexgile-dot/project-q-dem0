import { chromium } from "playwright";
import { mkdirSync } from "fs";
mkdirSync("review-screenshots/dpm-changes", { recursive: true });
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })).newPage();
await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.waitForSelector(".levers-panel", { timeout: 20000 });
// Model a quiet December weekday + apply a credit, switch to zoom-out to show lift.
await page.evaluate(() => { window.ProjectQ.setLever("base_fee", -15); window.ProjectQ.setDayType("dec_weekday"); window.ProjectQ.setView("year"); });
await page.waitForTimeout(500);
await page.screenshot({ path: "review-screenshots/dpm-changes/base-fee-credit.png" });
await browser.close();
console.log("DONE");
