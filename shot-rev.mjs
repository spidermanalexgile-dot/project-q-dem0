import { chromium } from "playwright";
import { mkdirSync } from "fs";
const OUT = "review-screenshots/dpm-changes";
mkdirSync(OUT, { recursive: true });
const URL = process.env.QURL || "http://localhost:5173/";
const browser = await chromium.launch();
const log = (...a) => console.log(...a);
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector(".rev-figure", { timeout: 20000 });
// Check no figure/label overflows its card.
const overflow = await page.evaluate(() => {
  const out = [];
  for (const sel of [".rev-figure", ".rev-label", ".rev-note", ".sustain-fee-figure", ".sustain-fee-label", ".sustain-fee-note"]) {
    document.querySelectorAll(sel).forEach((el) => {
      const card = el.closest(".rev-card, .sustain-fee, .revenue-panel");
      if (!card) return;
      const er = el.getBoundingClientRect(), cr = card.getBoundingClientRect();
      out.push({ sel, text: el.textContent.trim().slice(0, 30), overflowsRight: er.right > cr.right + 0.5, clipped: el.scrollWidth > el.clientWidth + 1 });
    });
  }
  return out;
});
for (const o of overflow) log("CHK", JSON.stringify(o));
log("ANY_CLIPPED", overflow.some((o) => o.overflowsRight || o.clipped));
await page.screenshot({ path: OUT + "/rev-smaller.png" });
await browser.close();
log("SHOT_REV_DONE");
