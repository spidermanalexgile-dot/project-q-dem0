import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
// Capture the /api/tts probe request.
let probed = false, probeStatus = null;
page.on("request", (r) => { if (r.url().includes("/api/tts")) probed = true; });
page.on("response", (r) => { if (r.url().includes("/api/tts")) probeStatus = r.status(); });
await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.waitForSelector(".confidence-pill", { timeout: 20000 });
await page.waitForTimeout(800);
// Probe happened? In dev there's no /api so it 404s → serverTtsReady false → falls
// back to browser voice. The app must still work + speak path not crash.
console.log("PROBE_FIRED", probed, "PROBE_STATUS", probeStatus);
const r = await page.evaluate(() => {
  // usingPremiumVoice should be false in dev (no server proxy, no client key).
  // Trigger a speak via the assistant brain to ensure no crash.
  const reply = window.ProjectQ.voiceCommand("set base fee to 17");
  return { reply, baseFee: window.ProjectQ.getState().levers.find((l) => l.id === "base_fee").value,
           hasInitServerVoice: typeof window.ProjectQ.setVoice, voices: window.ProjectQ.listVoices().length };
});
console.log("APP", JSON.stringify(r));
console.log("ERRORS", JSON.stringify(errors));
await browser.close();
console.log("DONE");
