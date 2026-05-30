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

/* ── Shoulder-season recirculation removed ─────────────────────────────── */
log("REBATE_ROW_COUNT", await page.locator(".rebate-row").count()); // expect 0
log("CREDIT_LEGEND_COUNT", await page.locator(".legend-swatch", { hasText: "Credit" }).count()); // expect 0
log("REBATE_ENABLED", await page.evaluate(() => window.ProjectQ.getState().shoulder_rebate.enabled)); // false
// setRebate(true) must be a no-op now.
log("SETREBATE_TRUE_THEN", await page.evaluate(() => {
  window.ProjectQ.setRebate(true);
  return window.ProjectQ.getState().shoulder_rebate.enabled;
})); // false
// fee below old threshold must NOT be a credit (negative) anymore.
log("FEE_AT_10PCT", await page.evaluate(() => window.ProjectQ.feeAtPct(10))); // 10 (base), not -8

/* ── Voice command API (parse + apply + spoken confirmation) ───────────── */
const cmds = [
  "lower target capacity to 30000",
  "raise the max fee cap to 600",
  "set base fee to 25 euros",
  "set capacity ceiling to 250",
  "set demand to 150",
  "model December weekday",
  "zoom out to the whole year",
  "show the cost curve",
];
const results = await page.evaluate((cmds) => {
  const out = [];
  for (const c of cmds) {
    const reply = window.ProjectQ.voiceCommand(c);
    const s = window.ProjectQ.getState();
    out.push({
      cmd: c,
      reply,
      cap: s.levers.find((l) => l.id === "target_capacity").value,
      maxFee: s.levers.find((l) => l.id === "max_fee_cap").value,
      baseFee: s.levers.find((l) => l.id === "base_fee").value,
      ceiling: s.levers.find((l) => l.id === "ceiling_pct").value,
      customDemand: s.customDemand,
      activeDay: s.activeDay,
      view: s.view,
    });
  }
  return out;
}, cmds);
for (const r of results) log("VOICE", JSON.stringify(r));

/* ── Voice UI present (Web Speech may be absent in headless — button still
      renders only when supported; we assert the spoken-number parser works
      regardless via the API above). ──────────────────────────────────────── */
log("VOICE_BTN_COUNT", await page.locator(".qctl-voice-btn").count());

log("CONSOLE_ERRORS", JSON.stringify(errors));
await page.screenshot({ path: OUT + "/voice-no-rebate.png" });
await browser.close();
log("VERIFY_VOICE_DONE");
