import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(process.env.QURL || "http://localhost:5173/", { waitUntil: "networkidle" });
await page.waitForSelector(".levers-panel", { timeout: 20000 });

const r = await page.evaluate(() => {
  const out = {};
  // Base fee lever can go negative now.
  const bf = window.ProjectQ.getState().levers.find((l) => l.id === "base_fee");
  out.baseFeeMin = bf.min;
  // A quiet day at 45% with NO credit (base €10) — managed stays near 45.
  out.quietBefore = Math.round(window.ProjectQ.managedDemandPct(45) * 10) / 10;
  // Apply a credit: base fee -€15. The quiet day should be LIFTED toward target.
  window.ProjectQ.setLever("base_fee", -15);
  out.baseFeeAfter = window.ProjectQ.getState().levers.find((l) => l.id === "base_fee").value;
  out.feeAt45 = window.ProjectQ.feeAtPct(45);      // should be -15 (a credit)
  out.quietAfter = Math.round(window.ProjectQ.managedDemandPct(45) * 10) / 10;
  // Busy day (200%) must STILL be deterred normally — a credit on quiet days must
  // not change the busy-day curve (fee at 200% comes from the cap, not base).
  out.busyManaged = Math.round(window.ProjectQ.managedDemandPct(200) * 10) / 10;
  // Day revenue on the credited quiet day is negative (authority pays to attract).
  out.quietDayRevenue = Math.round(window.ProjectQ.dayRevenue(45));
  return out;
});
console.log("CREDIT", JSON.stringify(r));
console.log("QUIET_LIFTED", r.quietAfter > r.quietBefore);     // credit attracts → higher
console.log("BUSY_STILL_DETERRED", r.busyManaged < 130);       // peak still pulled down
console.log("LEVER_DISPLAY", await page.$$eval(".lever", (els) => {
  const e = els.find((x) => x.querySelector(".lever-label")?.childNodes[0]?.textContent?.trim() === "Base fee at target");
  return e?.querySelector(".lever-value")?.textContent?.trim();
}));
console.log("ERRORS", JSON.stringify(errors));
await browser.close();
console.log("DONE");
