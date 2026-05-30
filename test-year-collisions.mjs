import { chromium } from "playwright";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
await page.waitForSelector(".curve-view-toggle", { timeout: 20000 });
await page.locator(".curve-view-toggle button", { hasText: "Zoom out" }).click();
await page.waitForTimeout(300);
// Collision check: do any two <text> in the year SVG overlap bounding boxes?
async function overlaps() {
  return await page.evaluate(() => {
    const texts = [...document.querySelectorAll(".curve-svg text")];
    const boxes = texts.map((t) => ({ t: t.textContent.trim().slice(0, 24), r: t.getBoundingClientRect() }))
      .filter((b) => b.r.width > 0 && b.t.length);
    const hits = [];
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i].r, b = boxes[j].r;
        const ox = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const oy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        if (ox > 2 && oy > 2) hits.push([boxes[i].t, boxes[j].t, Math.round(ox), Math.round(oy)]);
      }
    return hits;
  });
}
// Test several modelled days (changes the active line height).
const results = {};
for (const demand of [200, 130, 80, 45]) {
  await page.evaluate((d) => window.ProjectQ.setDemand(d), demand);
  await page.waitForTimeout(150);
  results[demand] = await overlaps();
}
console.log("COLLISIONS", JSON.stringify(results, null, 0));
await browser.close();
console.log("DONE");
