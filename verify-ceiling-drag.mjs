import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.waitForSelector(".levers-panel", { timeout: 20000 });
// Drag the ceiling slider; confirm the underlying lever value is still % and the
// displayed value tracks as visitors.
const before = await page.evaluate(() => window.ProjectQ.getState().levers.find((l) => l.id === "ceiling_pct").value);
// Set ceiling to 150% via API; display should read 75,000/day (50k × 150%).
await page.evaluate(() => window.ProjectQ.setLever("ceiling_pct", 150));
await page.waitForTimeout(200);
const lev = await page.$$eval(".lever", (els) => {
  const e = els.find((x) => x.querySelector(".lever-label")?.childNodes[0]?.textContent?.trim() === "Capacity ceiling");
  return { val: e.querySelector(".lever-value")?.textContent?.trim(), sub: e.querySelector(".lever-sub")?.textContent?.trim() };
});
const after = await page.evaluate(() => window.ProjectQ.getState().levers.find((l) => l.id === "ceiling_pct").value);
console.log("CEILING_DRAG", JSON.stringify({ before, afterPct: after, display: lev }));
// Voice still routes ceiling commands.
const voice = await page.evaluate(() => {
  const r = window.ProjectQ.voiceCommand("set capacity ceiling to 250");
  return { reply: r, pct: window.ProjectQ.getState().levers.find((l) => l.id === "ceiling_pct").value };
});
console.log("VOICE_CEILING", JSON.stringify(voice));
console.log("ERRORS", JSON.stringify(errors));
await browser.close();
console.log("DONE");
