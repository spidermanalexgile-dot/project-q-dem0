import { chromium } from "playwright";
const browser = await chromium.launch();
async function run(w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(process.env.QURL || "http://localhost:5173/", { waitUntil: "networkidle" });
  await page.waitForSelector(".curve-view-toggle", { timeout: 20000 });
  await page.locator(".curve-view-toggle button", { hasText: "Zoom out" }).click();
  await page.waitForTimeout(300);
  const overlaps = async () => page.evaluate(() => {
    const boxes = [...document.querySelectorAll(".curve-svg text")]
      .map((t) => ({ t: t.textContent.trim().slice(0,20), r: t.getBoundingClientRect() }))
      .filter((b) => b.r.width > 0 && b.t.length);
    const hits = [];
    for (let i=0;i<boxes.length;i++) for (let j=i+1;j<boxes.length;j++){
      const a=boxes[i].r,b=boxes[j].r;
      const ox=Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left));
      const oy=Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
      if(ox>2&&oy>2)hits.push([boxes[i].t,boxes[j].t]);
    }
    return hits;
  });
  const res = {};
  for (const d of [200,160,130,100,95,88,70,45,30]) {
    await page.evaluate((x)=>window.ProjectQ.setDemand(x), d);
    await page.waitForTimeout(120);
    res[d] = await overlaps();
  }
  console.log(`SIZE_${w}x${h}`, JSON.stringify(res));
  await ctx.close();
}
await run(1280, 800);
await run(1920, 1200);
await browser.close();
console.log("DONE");
