import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
const reqs = [];
page.on("request", (r) => { if (r.url().includes("/api/tts")) reqs.push(r.method()); });
page.on("response", async (r) => {
  if (r.url().includes("/api/tts") && r.request().method() === "POST") {
    console.log("PROXY_POST_STATUS", r.status());
  }
});
await page.goto(process.env.QURL, { waitUntil: "networkidle" });
await page.waitForSelector(".confidence-pill", { timeout: 20000 });
await page.waitForTimeout(1200);
// Instrument: does speechSynthesis.speak get CALLED (fallback) after proxy fails?
await page.evaluate(() => {
  window.__browserSpeakCalled = 0;
  const s = window.speechSynthesis;
  if (s) { const o = s.speak.bind(s); s.speak = (u) => { window.__browserSpeakCalled++; try { return o(u); } catch { return undefined; } }; }
});
await page.evaluate(() => window.ProjectQ.voiceCommand("set base fee to 21"));
await page.waitForTimeout(3000); // proxy POST (402) then fallback
const r = await page.evaluate(() => ({ browserSpeakCalled: window.__browserSpeakCalled }));
console.log("PROXY_REQS", JSON.stringify(reqs));
console.log("BROWSER_FALLBACK_CALLED", JSON.stringify(r));
await browser.close();
console.log("DONE");
