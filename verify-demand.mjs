import { chromium } from "playwright";
import { mkdirSync } from "fs";
const OUT = "review-screenshots/dpm-changes";
mkdirSync(OUT, { recursive: true });
const URL = process.env.QURL || "http://localhost:5173/";
const log = (...a) => console.log(...a);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector(".confidence-pill", { timeout: 20000 });

// Helper computed in-page: managed demand for the peak band + total spread from 100.
const measure = () =>
  page.evaluate(() => {
    const s = window.ProjectQ.getState();
    const md = window.ProjectQ.managedDemandPct;
    const peakRaw = Math.max(...s.seasonal.map((b) => b.demand_pct));
    const totalD = s.seasonal.reduce((a, b) => a + b.days, 0);
    const spread = s.seasonal.reduce((a, b) => a + b.days * Math.abs(md(b.demand_pct) - 100), 0) / totalD;
    return {
      baseFee: s.levers.find((l) => l.id === "base_fee").value,
      maxFeeCap: s.levers.find((l) => l.id === "max_fee_cap").value,
      ceiling: s.levers.find((l) => l.id === "ceiling_pct").value,
      peakRaw,
      peakManaged: Math.round(md(peakRaw) * 10) / 10,
      spread: Math.round(spread * 10) / 10,
    };
  });

log("API_HAS_MANAGED", await page.evaluate(() => typeof window.ProjectQ.managedDemandPct));
const m0 = await measure();
log("BASELINE", JSON.stringify(m0));

// Raise base fee → peak managed should drop toward 100, spread should shrink.
await page.evaluate(() => window.ProjectQ.setLever("base_fee", 40));
const m1 = await measure();
log("AFTER_BASE_FEE_40", JSON.stringify(m1));

// Raise max-fee cap further → even flatter.
await page.evaluate(() => window.ProjectQ.setLever("max_fee_cap", 300));
const m2 = await measure();
log("AFTER_CAP_300", JSON.stringify(m2));

// Lower ceiling (steeper curve, higher fees sooner) → flatter still.
await page.evaluate(() => window.ProjectQ.setLever("ceiling_pct", 130));
const m3 = await measure();
log("AFTER_CEILING_130", JSON.stringify(m3));

// Correct test: each fee increase must FLATTEN the year (spread → 0), and the
// strongest setup must pull the peak day all the way to the 100% target.
log("SPREAD_SERIES", JSON.stringify([m0.spread, m1.spread, m2.spread, m3.spread]));
log("FLATTENS_MONOTONIC", m1.spread < m0.spread && m2.spread < m1.spread && m3.spread <= m2.spread);
log("PEAK_PULLED_TO_TARGET", m3.peakManaged <= 101 && m2.peakManaged < m0.peakManaged + 0.01 && m2.peakManaged <= 101);

// Screenshot the zoom-out with a strong pricing setup (visible flatten).
await page.locator(".curve-view-toggle button", { hasText: "Zoom out" }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: OUT + "/year-managed.png" });
// Reset to baseline for a clean default screenshot.
await page.evaluate(() => { window.ProjectQ.setLever("base_fee", 10); window.ProjectQ.setLever("max_fee_cap", 50); window.ProjectQ.setLever("ceiling_pct", 200); });
await page.waitForTimeout(300);
await page.screenshot({ path: OUT + "/year-managed-default.png" });

log("CONSOLE_ERRORS", JSON.stringify(errors));
await browser.close();
log("VERIFY_DEMAND_DONE");
