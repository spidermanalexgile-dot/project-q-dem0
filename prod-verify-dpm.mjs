import { chromium } from "playwright";
import { mkdirSync } from "fs";

const URL = process.env.QURL || "https://project-q-dem0.vercel.app/";
const OUT = "review-screenshots/dpm-integration";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector(".confidence-pill", { timeout: 25000 });

const s = await page.evaluate(() => {
  const st = window.ProjectQ.getState();
  return {
    confidence: st.confidence,
    exponent: st.curve.shape.exponent,
    label: st.location.label,
    capacity: st.capacity.target,
    fee150: Math.round(window.ProjectQ.feeAtPct(150) * 100) / 100,
    dayTypes: st.day_types.map((d) => d.id),
  };
});
console.log("PROD_URL", URL);
console.log("PROD_STATE", JSON.stringify(s));
console.log("PROD_PILL", (await page.textContent(".confidence-pill"))?.trim());
await page.screenshot({ path: OUT + "/PRODUCTION.png" });
console.log("PROD_ERRORS", JSON.stringify(errors));
await browser.close();
console.log("PROD_VERIFY_DONE");
