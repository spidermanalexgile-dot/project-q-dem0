import { chromium } from "playwright";
import { mkdirSync } from "fs";
const OUT = "review-screenshots/dpm-changes";
mkdirSync(OUT, { recursive: true });
const URL = process.env.QURL || "http://localhost:5173/";
const browser = await chromium.launch();
const log = (...a) => console.log(...a);

for (const vp of [{ w: 1280, h: 800 }, { w: 1440, h: 900 }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForSelector(".levers-panel", { timeout: 20000 });
  // Is the last lever (Capacity ceiling) + its ticks fully inside the viewport?
  const fit = await page.evaluate((vh) => {
    const panel = document.querySelector(".levers-panel");
    const rows = document.querySelectorAll(".levers-list .lever");
    const last = rows[rows.length - 1];
    const lastTicks = last?.querySelector(".ticks");
    const pr = panel.getBoundingClientRect();
    const lr = (lastTicks || last).getBoundingClientRect();
    return {
      leverCount: rows.length,
      panelBottom: Math.round(pr.bottom),
      lastBottom: Math.round(lr.bottom),
      viewportH: vh,
      panelFits: pr.bottom <= vh + 0.5,
      lastLeverFits: lr.bottom <= pr.bottom + 0.5 && lr.bottom <= vh + 0.5,
      docScroll: document.documentElement.scrollHeight > vh,
    };
  }, vp.h);
  log(`VP_${vp.w}x${vp.h}`, JSON.stringify(fit), "errors", JSON.stringify(errors));
  await page.screenshot({ path: `${OUT}/levers-${vp.w}x${vp.h}.png` });
  await ctx.close();
}
await browser.close();
log("SHOT_LEVERS_DONE");
