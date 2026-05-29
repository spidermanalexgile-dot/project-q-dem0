import { chromium } from "playwright";
import { mkdirSync } from "fs";

const OUT = "review-screenshots/dpm-integration";
mkdirSync(OUT, { recursive: true });
const URL = process.env.QURL || "http://localhost:5173/";
const log = (...a) => console.log(...a);

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector(".confidence-pill", { timeout: 20000 });

const boot = await page.evaluate(() => {
  const s = window.ProjectQ.getState();
  return {
    confidence: s.confidence,
    label: s.location.label,
    capacity: s.capacity.target,
    exponent: s.curve.shape.exponent,
    dayTypes: s.day_types.map((d) => d.id),
    dayLabels: s.day_types.map((d) => `${d.label} · ${d.date}`),
    activeDay: s.activeDay,
    fee100: Math.round(window.ProjectQ.feeAtPct(100) * 100) / 100,
    fee150: Math.round(window.ProjectQ.feeAtPct(150) * 100) / 100,
    fee200: Math.round(window.ProjectQ.feeAtPct(200) * 100) / 100,
    realPayCap: s.phase.real_pay_cap,
    rebate: s.shoulder_rebate,
  };
});
log("BOOT", JSON.stringify(boot, null, 2));
log("CONFIDENCE_PILL_TEXT:", (await page.textContent(".confidence-pill"))?.trim());

// DOM check: modelling-day dropdown options
const dayOpts = await page.$$eval(
  ".tb-context select",
  (sels) =>
    Array.from(sels[1]?.options || []).map((o) => o.textContent?.trim()),
);
log("DAY_DROPDOWN_OPTIONS:", JSON.stringify(dayOpts));

await page.screenshot({ path: OUT + "/dpm-1280x800.png" });
await page.setViewportSize({ width: 1920, height: 1200 });
await page.waitForTimeout(350);
await page.screenshot({ path: OUT + "/dpm-1920x1200.png" });
await page.setViewportSize({ width: 1280, height: 800 });
await page.waitForTimeout(200);

// Upload success path via the real hidden file input (exercises the UI code path).
await page.setInputFiles(".tb-file-input", "dpm-payloads/venice-2026.json");
await page.waitForSelector(".qctl-payload-toast.ok", { timeout: 6000 });
log(
  "UPLOAD_OK_TOAST:",
  (await page.textContent(".qctl-payload-toast.ok"))?.trim(),
);
log(
  "CONFIDENCE_AFTER_OK_UPLOAD:",
  await page.evaluate(() => window.ProjectQ.getState().confidence),
);
await page.waitForTimeout(4000); // let the success toast fade

// Failure path: previous Venice payload must survive, no crash.
await page.setInputFiles(".tb-file-input", "/tmp/broken.json");
await page.waitForSelector(".qctl-payload-toast.err", { timeout: 6000 });
log(
  "UPLOAD_ERR_TOAST:",
  (await page.textContent(".qctl-payload-toast.err"))?.trim(),
);
log(
  "STATE_AFTER_ERR (must still be Venice/42):",
  JSON.stringify(
    await page.evaluate(() => {
      const s = window.ProjectQ.getState();
      return { confidence: s.confidence, label: s.location.label };
    }),
  ),
);

// Command API smoke test.
const cmd = await page.evaluate(() => {
  window.ProjectQ.setLever("max_fee_cap", 60);
  const cap = window.ProjectQ.getState().levers.find((l) => l.id === "max_fee_cap").value;
  window.ProjectQ.setDayType("dec_weekday");
  const day = window.ProjectQ.getState().activeDay;
  window.ProjectQ.setPhase(2);
  const payCap = window.ProjectQ.getState().phase.real_pay_cap;
  window.ProjectQ.setRebate(false);
  const rebate = window.ProjectQ.getState().shoulder_rebate.enabled;
  return { cap, day, payCap, rebate };
});
log("CMD_API:", JSON.stringify(cmd));
log("CONSOLE_ERRORS:", JSON.stringify(errors));

await browser.close();
log("VERIFY_DONE");
