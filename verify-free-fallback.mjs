import { chromium } from "playwright";
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
const errors = [];
const ttsPosts = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("response", (r) => {
  if (r.url().includes("/api/tts") && r.request().method() === "POST") ttsPosts.push(r.status());
});
await page.goto(process.env.QURL, { waitUntil: "networkidle" });
await page.waitForSelector(".qctl-assistant-orb", { timeout: 20000 });
await page.waitForTimeout(1200);
const before = await page.evaluate(() => window.ProjectQ.voiceStatus());
// Drive the REAL assistant: open mic? It's voice-only. Instead invoke the panel's
// speak path by simulating a recognized command through the component is hard from
// outside; so we directly exercise speak() via a tiny shim the app exposes? It
// doesn't. Use the orb: clicking starts listening + says "Listening. How can I help?"
// which calls speak() → proxy POST. That triggers the path we want.
await page.locator(".qctl-assistant-orb").click({ timeout: 5000 }).catch(() => {});
await page.waitForTimeout(3500); // allow proxy POST + fallback
const after = await page.evaluate(() => window.ProjectQ.voiceStatus());
console.log("STATUS_BEFORE", JSON.stringify(before));
console.log("TTS_POSTS", JSON.stringify(ttsPosts));
console.log("STATUS_AFTER", JSON.stringify(after));
console.log("ERRORS", JSON.stringify(errors));
await browser.close();
console.log("DONE");
