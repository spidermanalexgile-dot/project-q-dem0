import { chromium } from "playwright";
import { mkdirSync } from "fs";
const OUT = "review-screenshots/dpm-changes";
mkdirSync(OUT, { recursive: true });
const URL = process.env.QURL || "http://localhost:5173/";
const log = (...a) => console.log(...a);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector(".confidence-pill", { timeout: 20000 });

// 1) LEVER COMPARISON — small ask (honest "can't hit exactly") + large ask (real ranking).
const cheapSmall = await page.evaluate(() => window.ProjectQ.askAnalyst("what's the cheapest way to add €3M to annual revenue?"));
log("CHEAPEST_SMALL", JSON.stringify(cheapSmall));
const cheapBig = await page.evaluate(() => window.ProjectQ.askAnalyst("what's the cheapest way to add €80M to annual revenue?"));
log("CHEAPEST_BIG", JSON.stringify(cheapBig));

// 2) EXPLAIN REVENUE — annual + a month.
const why = await page.evaluate(() => ({
  annual: window.ProjectQ.askAnalyst("why is annual revenue so high?"),
  jan: window.ProjectQ.askAnalyst("explain January's revenue"),
}));
log("WHY_ANNUAL", JSON.stringify(why.annual));
log("WHY_JAN", JSON.stringify(why.jan));

// 3) Speak toggle present in the UI + speechSynthesis was invoked.
const spoke = [];
await page.exposeFunction("__spoke", (t) => spoke.push(t));
await page.addInitScript(() => {});
await page.evaluate(() => {
  const orig = window.speechSynthesis?.speak?.bind(window.speechSynthesis);
  if (orig) window.speechSynthesis.speak = (u) => { window.__spoke(u.text); return orig(u); };
});
await page.locator(".qctl-analyst-fab").click();
await page.waitForSelector(".qctl-analyst-input input", { timeout: 5000 });
log("SPEAK_TOGGLE_PRESENT", await page.locator(".qctl-analyst-speak").count());
log("SPEAK_TOGGLE_ON", await page.locator(".qctl-analyst-speak.on").count());
await page.fill(".qctl-analyst-input input", "why is Feb 2nd's demand what it is?");
await page.click(".qctl-analyst-input button");
await page.waitForTimeout(500);
log("SPOKEN_TEXTS", JSON.stringify(spoke.map((t) => t.slice(0, 60))));

// Apply the cheapest-lever suggestion if present.
const cheapBtn = await page.locator(".qctl-msg-apply").count();
log("CHEAP_HAS_APPLY_IN_CHAT", cheapBtn);

await page.screenshot({ path: OUT + "/analyst2.png" });
log("CONSOLE_ERRORS", JSON.stringify(errors));
await browser.close();
log("VERIFY_ANALYST2_DONE");
