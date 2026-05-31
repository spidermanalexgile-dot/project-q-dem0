import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
let spoke = [];
await page.goto(process.env.QURL, { waitUntil: "networkidle" });
await page.waitForSelector(".confidence-pill", { timeout: 20000 });
await page.waitForTimeout(1200); // let probe resolve (will be ok:true now)
// Hook SpeechSynthesis to see if the BROWSER voice gets used as fallback after
// the proxy 402s.
await page.evaluate(() => {
  window.__spoke = [];
  const s = window.speechSynthesis;
  if (s) { const o = s.speak.bind(s); s.speak = (u) => { window.__spoke.push(u.text); return o(u); }; }
});
const status = await page.evaluate(() => window.ProjectQ.voiceStatus());
// Trigger a reply via the assistant brain (this calls speak()).
await page.evaluate(() => window.ProjectQ.voiceCommand("set base fee to 19"));
await page.waitForTimeout(2500); // proxy attempt (402) → browser fallback
const result = await page.evaluate(() => ({ status: window.ProjectQ.voiceStatus(), spoke: window.__spoke }));
console.log("VOICE_STATUS", JSON.stringify(status));
console.log("AFTER_REPLY", JSON.stringify(result));
console.log("ERRORS", JSON.stringify(errors));
await browser.close();
console.log("DONE");
