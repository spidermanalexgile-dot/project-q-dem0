import { chromium } from "playwright";
import { mkdirSync } from "fs";
const OUT = "review-screenshots/dpm-changes";
mkdirSync(OUT, { recursive: true });
const URL = process.env.QURL || "http://localhost:5173/";
const log = (...a) => console.log(...a);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector(".confidence-pill", { timeout: 20000 });

// "Crowd level" label + help badge present.
log("CROWD_LABEL", await page.locator(".tb-label", { hasText: "Crowd level" }).count());
log("HELP_BADGE", await page.locator(".tb-help").count());
log("HELP_TITLE", await page.locator(".tb-help").getAttribute("title"));

// Switch to the year ("zoom out") view and check the clearer labels.
await page.locator(".curve-view-toggle button", { hasText: "Zoom out" }).click();
await page.waitForTimeout(300);
log("YEAR_TITLE", (await page.textContent(".panel-title"))?.trim());
log("YEAR_SUB", (await page.textContent(".panel-sub"))?.trim());
log("EXPLAINER_PRESENT", await page.locator(".year-explainer").count());
log("EXPLAINER_TEXT", (await page.textContent(".year-explainer"))?.replace(/\s+/g, " ").trim().slice(0, 120));
const bandLabels = await page.$$eval(".year-band-label", (ts) => ts.map((t) => t.textContent.trim()));
log("BAND_LABELS", JSON.stringify(bandLabels));
await page.screenshot({ path: OUT + "/year-clear-light.png" });

// Dark mode screenshot of the clarified year view.
await page.locator(".tb-theme").click();
await page.waitForTimeout(250);
await page.screenshot({ path: OUT + "/year-clear-dark.png" });

// Voice still parses (noise silent, real works) — quick smoke.
const voice = await page.evaluate(() => ({
  noise: window.ProjectQ.voiceCommand("hello there"),
  real: window.ProjectQ.voiceCommand("lower target capacity to 33000"),
  cap: window.ProjectQ.getState().levers.find((l) => l.id === "target_capacity").value,
}));
log("VOICE_SMOKE", JSON.stringify(voice));

log("CONSOLE_ERRORS", JSON.stringify(errors));
await browser.close();
log("VERIFY_CLARITY_DONE");
