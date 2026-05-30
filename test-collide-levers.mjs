import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 })).newPage();
await page.goto(process.env.QURL || "http://localhost:5173/", { waitUntil: "networkidle" });
await page.waitForSelector(".curve-view-toggle", { timeout: 20000 });
await page.locator(".curve-view-toggle button", { hasText: "Zoom out" }).click();
await page.waitForTimeout(300);
const overlaps = async () => page.evaluate(() => {
  const boxes = [...document.querySelectorAll(".curve-svg text")]
    .map((t) => ({ t: t.textContent.trim().slice(0,22), r: t.getBoundingClientRect() }))
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
// Sweep lever combos that flatten the curve to varying degrees.
const combos = [
  [10,50,200],[20,50,200],[40,50,200],[40,300,200],[100,1000,200],[40,300,130],[60,500,150],[10,1000,200]
];
const res = {};
for (const [bf, mc, cl] of combos) {
  await page.evaluate(([a,b,c]) => { window.ProjectQ.setLever("base_fee",a); window.ProjectQ.setLever("max_fee_cap",b); window.ProjectQ.setLever("ceiling_pct",c); }, [bf,mc,cl]);
  await page.waitForTimeout(150);
  res[`${bf}/${mc}/${cl}`] = await overlaps();
}
console.log("LEVER_SWEEP", JSON.stringify(res));
await browser.close();
console.log("DONE");
