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

// 1) EXPLAIN — "why is Feb 2nd's demand X%". Compute the model's own value first.
const explain = await page.evaluate(() => {
  const a1 = window.ProjectQ.askAnalyst("Why is Feb 2nd's demand what it is?");
  const a2 = window.ProjectQ.askAnalyst("why is the fee on August 1st?");
  return { feb2: a1, aug1: a2 };
});
log("EXPLAIN_FEB2", JSON.stringify(explain.feb2));
log("EXPLAIN_AUG1", JSON.stringify(explain.aug1));

// 2) GOAL-SEEK accuracy — ask the analyst to RAISE annual revenue by 50M via base fee,
//    then via the chat UI apply it and confirm the engine actually moved ~that much.
const solve = await page.evaluate(() => {
  const before = window.ProjectQ.annualRevenue();
  const ans = window.ProjectQ.askAnalyst("raise annual revenue by 50 million by changing the base fee");
  return { before, ans };
});
log("SOLVE_ANNUAL_50M", JSON.stringify(solve));

// 3) Month solve — "raise January revenue by €3M via base fee".
const janSolve = await page.evaluate(() => window.ProjectQ.askAnalyst("raise January revenue by €3M by changing the base fee"));
log("SOLVE_JAN_3M", JSON.stringify(janSolve));

// 4) Drive the chat UI end-to-end: open, ask a goal, click Apply, verify lever moved.
await page.locator(".qctl-analyst-fab").click();
await page.waitForSelector(".qctl-analyst-input input", { timeout: 5000 });
const baseBefore = await page.evaluate(() => window.ProjectQ.getState().levers.find((l) => l.id === "base_fee").value);
await page.fill(".qctl-analyst-input input", "raise annual revenue by 100 million via base fee");
await page.click(".qctl-analyst-input button");
await page.waitForTimeout(300);
const hasApply = await page.locator(".qctl-msg-apply").count();
log("CHAT_HAS_APPLY_BTN", hasApply);
const revBefore = await page.evaluate(() => window.ProjectQ.annualRevenue());
if (hasApply) await page.locator(".qctl-msg-apply").last().click();
await page.waitForTimeout(300);
const after = await page.evaluate(() => ({
  baseFee: window.ProjectQ.getState().levers.find((l) => l.id === "base_fee").value,
  rev: window.ProjectQ.annualRevenue(),
}));
log("CHAT_APPLY", JSON.stringify({ baseBefore, baseAfter: after.baseFee, revBefore: Math.round(revBefore), revAfter: Math.round(after.rev), revDelta: Math.round(after.rev - revBefore) }));

await page.screenshot({ path: OUT + "/analyst.png" });
log("CONSOLE_ERRORS", JSON.stringify(errors));
await browser.close();
log("VERIFY_ANALYST_DONE");
