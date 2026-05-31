import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.waitForSelector(".confidence-pill", { timeout: 20000 });
// Directly fetch /api/tts and see what dev returns.
const probe = await page.evaluate(async () => {
  try {
    const r = await fetch("/api/tts");
    const ct = r.headers.get("content-type");
    let parsed = "n/a";
    try { parsed = JSON.stringify(await r.clone().json()); } catch (e) { parsed = "JSON_PARSE_FAILED"; }
    return { status: r.status, ct, parsed };
  } catch (e) { return { error: String(e) }; }
});
console.log("DEV_PROBE", JSON.stringify(probe));
await browser.close();
console.log("DONE");
