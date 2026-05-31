import { chromium } from "playwright";
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

log("API_HAS_SETOCC", await page.evaluate(() => typeof window.ProjectQ.setOccupancyTarget));

const snapshot = () => page.evaluate(() => {
  const s = window.ProjectQ.getState();
  const md = window.ProjectQ.managedDemandPct;
  const peakRaw = Math.max(...s.seasonal.map((b) => b.demand_pct));
  const totalD = s.seasonal.reduce((a, b) => a + b.days, 0);
  const spread = s.seasonal.reduce((a, b) => a + b.days * Math.abs(md(b.demand_pct) - s.occupancy_target), 0) / totalD;
  return {
    occTarget: s.occupancy_target,
    baseFee: s.levers.find((l) => l.id === "base_fee").value,
    maxFeeCap: s.levers.find((l) => l.id === "max_fee_cap").value,
    ceiling: s.levers.find((l) => l.id === "ceiling_pct").value,
    peakRaw,
    peakManaged: Math.round(md(peakRaw) * 10) / 10,
    spreadFromTarget: Math.round(spread * 10) / 10,
  };
});

log("BEFORE", JSON.stringify(await snapshot()));
// Venice wants only 80% today.
await page.evaluate(() => window.ProjectQ.setOccupancyTarget(80));
const at80 = await snapshot();
log("AFTER_TARGET_80", JSON.stringify(at80));
log("PEAK_NEAR_80", Math.abs(at80.peakManaged - 80) <= 6);
log("LEVERS_MOVED", at80.maxFeeCap > 50 || at80.ceiling < 200);

// 60% target — even stronger deterrence.
await page.evaluate(() => window.ProjectQ.setOccupancyTarget(60));
const at60 = await snapshot();
log("AFTER_TARGET_60", JSON.stringify(at60));
log("PEAK_NEAR_60", Math.abs(at60.peakManaged - 60) <= 6);

// Reset to 100.
await page.evaluate(() => window.ProjectQ.setOccupancyTarget(null));
log("AFTER_RESET", JSON.stringify(await snapshot()));

// Voice command path.
const voice = await page.evaluate(() => {
  const r = window.ProjectQ.voiceCommand("we only want 80% capacity today");
  return { reply: r, occ: window.ProjectQ.getState().occupancy_target };
});
log("VOICE_OCC", JSON.stringify(voice));
const voice2 = await page.evaluate(() => {
  const r = window.ProjectQ.voiceCommand("hold occupancy at 70 percent");
  return { reply: r, occ: window.ProjectQ.getState().occupancy_target };
});
log("VOICE_OCC2", JSON.stringify(voice2));
// Make sure a normal lever command still routes correctly (not hijacked).
const lever = await page.evaluate(() => {
  window.ProjectQ.setOccupancyTarget(null);
  const r = window.ProjectQ.voiceCommand("set target capacity to 70000");
  return { reply: r, tc: window.ProjectQ.getState().levers.find((l) => l.id === "target_capacity").value };
});
log("LEVER_NOT_HIJACKED", JSON.stringify(lever));

log("CONSOLE_ERRORS", JSON.stringify(errors));
await browser.close();
log("VERIFY_OCC_DONE");
