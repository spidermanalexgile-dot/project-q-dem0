import { chromium } from "playwright";
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

// Every control reachable by voice, including the date picker.
const cmds = [
  "lower target capacity to 40000",
  "raise max fee cap to 750",
  "set base fee to 30 euros",
  "set capacity ceiling to 280",
  "set demand to 165",
  "model carnival saturday",
  "model August 1st",            // date by month + ordinal digit
  "pick the 9th of December",    // date, different phrasing
  "go to 2026-02-14",            // ISO date
  "model the first of July",     // ordinal word
  "reset",                       // back to default
  "zoom out to the whole year",
  "show the cost curve",
  "dark mode",
  "light mode",
];
const results = await page.evaluate((cmds) => {
  const out = [];
  for (const c of cmds) {
    const reply = window.ProjectQ.voiceCommand(c);
    const s = window.ProjectQ.getState();
    out.push({ cmd: c, reply, customDate: s.customDate, customDemand: s.customDemand, activeDay: s.activeDay, view: s.view });
  }
  return out;
}, cmds);
for (const r of results) log("V", JSON.stringify(r));

// Self-echo guard at the parser level: feeding a confirmation string back must
// not re-trigger the same lever (it has no imperative verb+lever+number combo
// that the parser treats as a command beyond what it says — check it's inert or
// idempotent). We assert the API doesn't crash and returns a string.
const echo = await page.evaluate(() => {
  const before = window.ProjectQ.getState().levers.find((l) => l.id === "target_capacity").value;
  const r = window.ProjectQ.voiceCommand("Target capacity successfully lowered to 40,000.");
  const after = window.ProjectQ.getState().levers.find((l) => l.id === "target_capacity").value;
  return { reply: r, before, after };
});
log("ECHO_REPLAY", JSON.stringify(echo));

log("CONSOLE_ERRORS", JSON.stringify(errors));
await browser.close();
log("VERIFY_VOICE2_DONE");
