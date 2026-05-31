import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(process.env.QURL || "http://localhost:5173/", { waitUntil: "networkidle" });
await page.waitForSelector(".confidence-pill", { timeout: 20000 });
const r = await page.evaluate(() => {
  const out = {};
  out.api = {
    setVoiceApiKey: typeof window.ProjectQ.setVoiceApiKey,
    setVoice: typeof window.ProjectQ.setVoice,
    listVoices: typeof window.ProjectQ.listVoices,
  };
  out.voices = window.ProjectQ.listVoices();
  // Enable premium with a fake key + a named female voice.
  window.ProjectQ.setVoiceApiKey("test-key-123", "Charlotte");
  out.afterSetCharlotte = {
    key: localStorage.getItem("qctl-eleven-key"),
    voice: localStorage.getItem("qctl-eleven-voice"),
  };
  // Switch voice by name only.
  window.ProjectQ.setVoice("Matilda");
  out.afterMatilda = localStorage.getItem("qctl-eleven-voice");
  // Unknown / male name must fall back to the default female id (Rachel).
  window.ProjectQ.setVoice("David");
  out.afterUnknown = localStorage.getItem("qctl-eleven-voice");
  // Clear.
  window.ProjectQ.setVoiceApiKey(null);
  out.afterClear = localStorage.getItem("qctl-eleven-key");
  return out;
});
console.log("RESULT", JSON.stringify(r, null, 0));
console.log("ALL_FEMALE", r.voices.every((v) => v.name && v.note));
console.log("ERRORS", JSON.stringify(errors));
await browser.close();
console.log("DONE");
