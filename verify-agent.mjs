import { chromium } from "playwright";

const URL = process.env.QURL || "http://localhost:5173/";
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForFunction(() => !!window.ProjectQ && !!window.ProjectQ.getState());

// 1) Deterministic "suggest lever settings" still computes (refactored path).
const suggest = await page.evaluate(() => {
  // Make sure we're on a busy day so the deterrent branch fires.
  window.ProjectQ.setDayType("peak_sat");
  const before = window.ProjectQ.getState().levers.map((l) => ({ id: l.id, value: l.value }));
  const answer = window.ProjectQ.askAnalyst("suggest lever settings");
  return { answer, before };
});
const computes = /max-?fee cap|capacity ceiling|base fee/i.test(suggest.answer) && /%/.test(suggest.answer);
console.log("SUGGEST_COMPUTES", computes);
console.log("SUGGEST_ANSWER", JSON.stringify(suggest.answer.slice(0, 220)));

// 2) Goal-seek still computes through the deterministic analyst.
const goal = await page.evaluate(() =>
  window.ProjectQ.askAnalyst("raise annual revenue by 3 million by changing the base fee"));
console.log("GOALSEEK_COMPUTES", /base fee/i.test(goal) && /€/.test(goal));

// 3) Claude brain gracefully falls back to null locally (no /api/agent in vite dev).
const brain = await page.evaluate(async () => {
  try { return await window.ProjectQ.askAgent("what's annual revenue?"); }
  catch (e) { return "THREW:" + String(e); }
});
console.log("BRAIN_FALLBACK_NULL", brain === null);
console.log("BRAIN_RAW", JSON.stringify(brain));

console.log("ERRORS", JSON.stringify(errors));
console.log("DONE");
await browser.close();
