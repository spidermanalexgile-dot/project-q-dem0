import { chromium } from "playwright";
import { mkdirSync } from "fs";
mkdirSync("review-screenshots/dpm-changes", { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(process.env.QURL || "http://localhost:5173/", { waitUntil: "networkidle" });
await page.waitForSelector(".levers-panel", { timeout: 20000 });
const labels = await page.$$eval(".tb-label", (els) => els.map((e) => e.textContent.trim()));
console.log("TB_LABELS", JSON.stringify(labels.filter((l) => /Location|Crowd/.test(l))));
// Capacity ceiling lever value should be a visitor count (100,000 at 200% × 50k).
const levers = await page.$$eval(".lever", (els) => els.map((e) => {
  const label = e.querySelector(".lever-label")?.childNodes[0]?.textContent?.trim();
  const sub = e.querySelector(".lever-sub")?.textContent?.trim();
  const val = e.querySelector(".lever-value")?.textContent?.trim();
  const ticks = [...e.querySelectorAll(".ticks span")].map((s) => s.textContent.trim());
  return { label, sub, val, ticks };
}));
const ceiling = levers.find((l) => l.label === "Capacity ceiling");
console.log("CEILING", JSON.stringify(ceiling));
console.log("ALL_LEVER_VALUES", JSON.stringify(levers.map((l) => `${l.label}=${l.val}`)));
await page.screenshot({ path: "review-screenshots/dpm-changes/capacity-render.png" });
console.log("CONSOLE_ERRORS", JSON.stringify(errors));
await browser.close();
console.log("DONE");
