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

// 1. Lever maxes raised dramatically (read from payload).
const levers = await page.evaluate(() =>
  Object.fromEntries(window.ProjectQ.getState().levers.map((l) => [l.id, { max: l.max, value: l.value }])),
);
log("LEVER_MAXES", JSON.stringify(levers));
log("TICK_LABELS", JSON.stringify(await page.$$eval(".ticks", (ts) => ts.map((t) => t.textContent.trim()))));

// 2. Year 1/2/3 removed from the top bar.
const phaseButtons = await page.$$eval("button", (bs) =>
  bs.map((b) => b.textContent.trim()).filter((t) => /^YR/.test(t)),
);
log("PHASE_BUTTONS_REMAINING", JSON.stringify(phaseButtons));

// confidence + exponent still correct.
log(
  "CORE",
  JSON.stringify(
    await page.evaluate(() => {
      const s = window.ProjectQ.getState();
      return { confidence: s.confidence, exponent: s.curve.shape.exponent };
    }),
  ),
);

// 3. "Zoom out" annual demand view.
await page.screenshot({ path: OUT + "/cost-light.png" });
const yearBtn = page.locator(".curve-view-toggle button", { hasText: "Zoom out" });
await yearBtn.click();
await page.waitForTimeout(300);
log("YEAR_TITLE", (await page.textContent(".panel-title"))?.trim());
log("YEAR_BANDS", await page.$$eval("g[key], .year-band-label", () => 0).catch(() => "n/a"));
log("YEAR_HAS_SVG", await page.locator(".curve-stage svg").count());
await page.screenshot({ path: OUT + "/year-light.png" });
// back to cost
await page.locator(".curve-view-toggle button", { hasText: "Cost curve" }).click();
await page.waitForTimeout(200);

// 4. Dark mode toggle.
const before = await page.evaluate(() => document.querySelector(".qctl-root").className);
await page.locator(".tb-theme").click();
await page.waitForTimeout(300);
const after = await page.evaluate(() => document.querySelector(".qctl-root").className);
log("ROOT_CLASS_BEFORE", before, "| AFTER", after);
const bg = await page.evaluate(() =>
  getComputedStyle(document.querySelector(".qctl-root")).backgroundColor,
);
log("DARK_BG", bg);
await page.screenshot({ path: OUT + "/cost-dark.png" });
await page.locator(".curve-view-toggle button", { hasText: "Zoom out" }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: OUT + "/year-dark.png" });

// command API still intact.
log(
  "CMD_API",
  JSON.stringify(
    await page.evaluate(() => {
      window.ProjectQ.setLever("max_fee_cap", 800);
      return { cap: window.ProjectQ.getState().levers.find((l) => l.id === "max_fee_cap").value };
    }),
  ),
);

log("CONSOLE_ERRORS", JSON.stringify(errors));
await browser.close();
log("VERIFY_CHANGES_DONE");
