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

// Noise / non-commands: state must be UNCHANGED and reply must be the "sorry"
// string (which the live UI now suppresses — it stays silent).
const noise = [
  "uh hmm",
  "bzzzt",
  "what time is it",
  "hello there how are you",
  "the weather is nice today",
];
const noiseResults = await page.evaluate((noise) => {
  const snapshot = () => JSON.stringify(window.ProjectQ.getState());
  const out = [];
  for (const n of noise) {
    const before = snapshot();
    const reply = window.ProjectQ.voiceCommand(n);
    const after = snapshot();
    out.push({ n, reply, unchanged: before === after });
  }
  return out;
}, noise);
for (const r of noiseResults) log("NOISE", JSON.stringify(r));
log("ALL_NOISE_UNCHANGED", noiseResults.every((r) => r.unchanged));
log("ALL_NOISE_SORRY", noiseResults.every((r) => /didn't catch/.test(r.reply)));

// Real commands still work + change state.
const real = await page.evaluate(() => {
  const out = [];
  let r = window.ProjectQ.voiceCommand("lower target capacity to 35000");
  out.push({ cmd: "lower target capacity to 35000", reply: r, val: window.ProjectQ.getState().levers.find((l) => l.id === "target_capacity").value });
  r = window.ProjectQ.voiceCommand("model August 1st");
  out.push({ cmd: "model August 1st", reply: r, date: window.ProjectQ.getState().customDate });
  r = window.ProjectQ.voiceCommand("dark mode");
  out.push({ cmd: "dark mode", reply: r });
  return out;
});
for (const r of real) log("REAL", JSON.stringify(r));

log("CONSOLE_ERRORS", JSON.stringify(errors));
await browser.close();
log("VERIFY_VOICE3_DONE");
