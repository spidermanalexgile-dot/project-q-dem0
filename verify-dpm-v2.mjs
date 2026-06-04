import { chromium } from "playwright";
import { readFileSync } from "fs";

const dir = "./dpm-payloads/venice-2027/";
const names = [
  "ProjectQ_Venice_Daily_Prediction_2027.csv",
  "ProjectQ_Venice_Monthly_Summary_2027.csv",
  "ProjectQ_Venice_Shock_Scenarios.csv",
  "ProjectQ_Venice_Assumptions.csv",
];
const files = names.map((n) => ({ name: n, text: readFileSync(dir + n, "utf8") }));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message));
await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.waitForFunction(() => !!window.ProjectQ?.getState());

const log = (k, v) => console.log(k, typeof v === "object" ? JSON.stringify(v) : v);

// ── 1. v1 default boot degrades gracefully ────────────────────────────────
const v1 = await page.evaluate(() => {
  const s = window.ProjectQ.getState();
  return {
    confidence: s.confidence,
    hasDaily: !!s.daily,
    hasShocks: !!s.shocks,
    hasAssumptions: !!s.assumptions,
    threshold: s.capacity.threshold ?? null,
    cpi: window.ProjectQ.activeCPI(),
  };
});
log("V1_BOOT", v1);
const v1ui = await page.evaluate(() => ({
  stressDropdown: !!document.querySelector('select[aria-label="Apply a stress-test scenario"]'),
  cpiInSvg: /CPI \d/.test(document.querySelector(".curve-svg")?.textContent || ""),
  infoBtn: !!document.querySelector(".assumptions-info"),
}));
log("V1_UI_HIDDEN", v1ui);

// ── 2. Load the v2 bundle (the same path the folder-drop UI calls) ─────────
await page.evaluate((files) => window.ProjectQ.loadBundle(files), files);
await page.waitForTimeout(200);
const merged = await page.evaluate(() => {
  const s = window.ProjectQ.getState();
  return {
    daily: s.daily?.length, shocks: s.shocks?.length, threshold: s.capacity.threshold,
    confidence: s.confidence, run_confidence: s.run_confidence,
    dayTypes: s.day_types.length, provenance: s.provenance,
    assumptions: s.assumptions?.length,
  };
});
log("MERGED", merged);

// ── 3. New UI now present ──────────────────────────────────────────────────
const v2ui = await page.evaluate(() => ({
  stressOptions: Array.from(document.querySelectorAll('select[aria-label="Apply a stress-test scenario"] option')).map(o => o.value),
  cpiPill: /CPI \d/.test(document.querySelector(".curve-svg")?.textContent || ""),
  thresholdLabel: /CPI 1\.0/.test(document.querySelector(".curve-svg")?.textContent || ""),
  infoBtn: !!document.querySelector(".assumptions-info"),
  runConf: document.querySelector(".run-confidence")?.textContent?.trim(),
  provenance: document.querySelector(".curve-provenance")?.textContent?.trim(),
}));
log("V2_UI", v2ui);

// ── 4. CPI sanity (computed path) ──────────────────────────────────────────
const cpiPeak = await page.evaluate(() => { window.ProjectQ.setDayType("peak_sat"); return window.ProjectQ.activeCPI(); });
const cpiDec = await page.evaluate(() => { window.ProjectQ.setDayType("dec_weekday"); return window.ProjectQ.activeCPI(); });
log("CPI_PEAK_SAT", cpiPeak?.toFixed(2), "(expect ~1.92)");
log("CPI_DEC", cpiDec?.toFixed(2), "(expect ~0.43)");

// ── 5. Stress overlay sanity ───────────────────────────────────────────────
const base = await page.evaluate(() => {
  window.ProjectQ.setDayType("peak_sat");
  const c = window.ProjectQ.compute();
  return { dayRev: Math.round(c.dayRevenue), annual: Math.round(window.ProjectQ.annualRevenue()) };
});
const surge = await page.evaluate(() => {
  window.ProjectQ.setActiveShock("peak-season-surge-redentore-heatwave");
  const c = window.ProjectQ.compute();
  return { cpi: window.ProjectQ.activeCPI(), dayRev: Math.round(c.dayRevenue), annual: Math.round(window.ProjectQ.annualRevenue()),
           banner: document.querySelector(".stress-banner")?.textContent?.replace(/\s+/g," ").trim() };
});
const pandemic = await page.evaluate(() => {
  window.ProjectQ.setActiveShock("pandemic-style-shock-travel-restrictions");
  return { cpi: window.ProjectQ.activeCPI(), annual: Math.round(window.ProjectQ.annualRevenue()) };
});
const backToBase = await page.evaluate(() => {
  window.ProjectQ.setActiveShock(null);
  return { annual: Math.round(window.ProjectQ.annualRevenue()), banner: !!document.querySelector(".stress-banner") };
});
log("BASELINE", base);
log("SURGE", surge);
log("SURGE_DAYREV_ROSE", surge.dayRev > base.dayRev);
log("SURGE_ANNUAL_ROSE", surge.annual > base.annual);
log("PANDEMIC", pandemic);
log("PANDEMIC_DROP_EUR", base.annual - pandemic.annual, "(expect ~694.7M)");
log("BASELINE_RESTORED", backToBase.annual === base.annual, "banner gone:", !backToBase.banner);

// ── 6. Assumptions slide-out ───────────────────────────────────────────────
await page.click(".assumptions-info");
await page.waitForTimeout(250);
const panel = await page.evaluate(() => {
  const rows = document.querySelectorAll(".assumptions-table tbody tr").length;
  const open = !!document.querySelector(".assumptions-panel");
  return { open, rows };
});
log("ASSUMPTIONS_PANEL", panel);
await page.keyboard.press("Escape");
await page.waitForTimeout(250);
const closed = await page.evaluate(() => !document.querySelector(".assumptions-panel"));
log("ASSUMPTIONS_ESC_CLOSED", closed);

// ── 7. No-scroll at two viewports ──────────────────────────────────────────
async function noScroll(w, h) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(150);
  return page.evaluate(() => {
    const el = document.scrollingElement || document.body;
    return { scrollH: el.scrollHeight, clientH: el.clientHeight, overflow: el.scrollHeight - el.clientHeight };
  });
}
log("NOSCROLL_1280x800", await noScroll(1280, 800));
log("NOSCROLL_1920x1200", await noScroll(1920, 1200));

// ── 8. Screenshots (baseline + stress) at both viewports ───────────────────
const shot = async (w, h, name) => {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `review-screenshots/dpm-bundle-v2/${name}.png` });
};
await page.evaluate(() => window.ProjectQ.setActiveShock(null));
await shot(1280, 800, "baseline-1280x800");
await shot(1920, 1200, "baseline-1920x1200");
await page.evaluate(() => window.ProjectQ.setActiveShock("peak-season-surge-redentore-heatwave"));
await shot(1280, 800, "surge-1280x800");
await shot(1920, 1200, "surge-1920x1200");

log("ERRORS", errors);
console.log("DONE");
await browser.close();
