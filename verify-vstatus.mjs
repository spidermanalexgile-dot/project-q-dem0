import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.waitForSelector(".confidence-pill", { timeout: 20000 });
await page.waitForTimeout(1000); // let the probe resolve
const r = await page.evaluate(() => ({
  status: window.ProjectQ.voiceStatus(),
  hasFns: ["setVoiceApiKey","setVoice","listVoices","voiceStatus"].map((f) => typeof window.ProjectQ[f]),
  voices: window.ProjectQ.listVoices().map((v) => v.name),
}));
console.log("VSTATUS", JSON.stringify(r));
console.log("ERRORS", JSON.stringify(errors));
await browser.close();
console.log("DONE");
