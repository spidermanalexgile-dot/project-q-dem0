import { chromium } from "playwright";
import { mkdirSync } from "fs";

const OUT = "review-screenshots/dpm-changes";
mkdirSync(OUT, { recursive: true });
const URL = process.env.QURL || "http://localhost:5173/";
const log = (...a) => console.log(...a);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector(".confidence-pill", { timeout: 20000 });

// 1. New lever maxes.
const levers = await page.evaluate(() =>
  Object.fromEntries(window.ProjectQ.getState().levers.map((l) => [l.id, l.max])),
);
log("LEVER_MAXES", JSON.stringify(levers));

// 2. No y-axis (€) number labels on the cost curve — only X ticks (%) remain.
const tickLabels = await page.$$eval(".curve-svg .curve-tick-label", (ts) =>
  ts.map((t) => t.textContent.trim()),
);
log("CURVE_TICK_LABELS", JSON.stringify(tickLabels));
log("ANY_EURO_LABEL", tickLabels.some((t) => t.includes("€")));

// 3. Free-form demand input.
const demandInput = page.locator(".tb-demand-input input");
log("DEMAND_INPUT_PRESENT", await demandInput.count());
log("DEMAND_INPUT_START", await demandInput.inputValue());
await demandInput.fill("175");
await demandInput.dispatchEvent("input");
await page.waitForTimeout(250);
log(
  "AFTER_TYPING_175",
  JSON.stringify(
    await page.evaluate(() => {
      const s = window.ProjectQ.getState();
      return { customDemand: s.customDemand, activeDemand: window.ProjectQ.compute().activeDay.demand_pct };
    }),
  ),
);
// Selecting a preset day clears the custom override.
await page.selectOption(".tb-context select >> nth=1", "dec_weekday");
await page.waitForTimeout(200);
log(
  "AFTER_PICK_DEC",
  JSON.stringify(
    await page.evaluate(() => {
      const s = window.ProjectQ.getState();
      return { customDemand: s.customDemand, activeDay: s.activeDay, demand: window.ProjectQ.compute().activeDay.demand_pct };
    }),
  ),
);
// setDemand command API.
log(
  "SETDEMAND_API",
  await page.evaluate(() => {
    window.ProjectQ.setDemand(260);
    return window.ProjectQ.getState().customDemand;
  }),
);
await page.evaluate(() => window.ProjectQ.setDemand(null));

log("CORE", JSON.stringify(await page.evaluate(() => {
  const s = window.ProjectQ.getState();
  return { confidence: s.confidence, exponent: s.curve.shape.exponent };
})));

await page.screenshot({ path: OUT + "/cost-light.png" });
// dark mode
await page.locator(".tb-theme").click();
await page.waitForTimeout(250);
log("DARK_BG", await page.evaluate(() => getComputedStyle(document.querySelector(".qctl-root")).backgroundColor));
await page.screenshot({ path: OUT + "/cost-dark.png" });

log("CONSOLE_ERRORS", JSON.stringify(errors));
await browser.close();
log("VERIFY_CHANGES_DONE");
