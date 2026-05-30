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

// 1) Sustainability fee number present and correct (= fee at active demand).
const sustain = await page.evaluate(() => {
  const txt = document.querySelector(".sustain-fee-figure")?.textContent?.trim();
  const s = window.ProjectQ.getState();
  const demand = window.ProjectQ.compute().activeDay.demand_pct;
  const fee = Math.round(window.ProjectQ.feeAtPct(demand));
  return { label: document.querySelector(".sustain-fee-label")?.textContent?.trim(), txt, demand, fee };
});
log("SUSTAIN", JSON.stringify(sustain));

// 2) Voice routing — each command must hit the RIGHT control, not target capacity.
const cmds = [
  ["set max fee cap to 300", "max_fee_cap", 300],
  ["change the capacity ceiling to 250", "ceiling_pct", 250],
  ["set base fee to 20", "base_fee", 20],
  ["lower target capacity to 60000", "target_capacity", 60000],
  ["set the fee cap to 450", "max_fee_cap", 450],
  ["raise base fee to 35", "base_fee", 35],
];
const routing = await page.evaluate((cmds) => {
  const out = [];
  for (const [cmd, expectId, expectVal] of cmds) {
    const reply = window.ProjectQ.voiceCommand(cmd);
    const s = window.ProjectQ.getState();
    const lev = Object.fromEntries(s.levers.map((l) => [l.id, l.value]));
    out.push({ cmd, expectId, expectVal, reply, actual: lev[expectId], hitTargetCap: lev["target_capacity"] });
  }
  return out;
}, cmds);
for (const r of routing) log("ROUTE", JSON.stringify(r));

// 3) Ambiguous / mis-heard input must NOT silently default to target capacity.
const capBefore = await page.evaluate(() => window.ProjectQ.getState().levers.find((l) => l.id === "target_capacity").value);
const ambiguous = await page.evaluate((capBefore) => {
  const out = [];
  for (const c of ["uhh make it bigger", "the target", "capacity", "increase it to 500"]) {
    const reply = window.ProjectQ.voiceCommand(c);
    const cap = window.ProjectQ.getState().levers.find((l) => l.id === "target_capacity").value;
    out.push({ c, reply, capChanged: cap !== capBefore });
  }
  return out;
}, capBefore);
for (const a of ambiguous) log("AMBIG", JSON.stringify(a));

await page.screenshot({ path: OUT + "/sustain-fee.png" });
log("CONSOLE_ERRORS", JSON.stringify(errors));
await browser.close();
log("VERIFY_FIXES_DONE");
