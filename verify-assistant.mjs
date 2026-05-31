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

// One unified surface: open it, confirm there's no separate voice button.
log("OLD_VOICE_BTN_GONE", await page.locator(".qctl-voice-btn").count()); // expect 0
await page.locator(".qctl-analyst-fab").click();
await page.waitForSelector(".qctl-analyst-input input", { timeout: 5000 });
log("FAB_LABEL", (await page.locator(".qctl-analyst-fab").count()) === 0 ? "open" : "?");
log("MIC_IN_CHAT", await page.locator(".qctl-analyst-mic").count()); // expect 1 (if recognition supported)
log("SPEAK_TOGGLE", await page.locator(".qctl-analyst-speak").count());

async function send(text) {
  await page.fill(".qctl-analyst-input input", text);
  await page.click(".qctl-analyst-input button[type=submit]");
  await page.waitForTimeout(250);
  const msgs = await page.$$eval(".qctl-msg.agent .qctl-msg-text", (els) => els.map((e) => e.textContent));
  return msgs[msgs.length - 1];
}

// 1) SUGGEST + EXPLAIN (the new capability).
const suggest = await send("suggest lever settings for this day and explain");
log("SUGGEST", JSON.stringify(suggest.slice(0, 200)));
log("SUGGEST_HAS_APPLY", await page.locator(".qctl-msg-apply").last().textContent());

// 2) A direct CONTROL command routed through the SAME box (auto-applied).
const before = await page.evaluate(() => window.ProjectQ.getState().levers.find((l) => l.id === "base_fee").value);
const ctl = await send("set base fee to 18");
const after = await page.evaluate(() => window.ProjectQ.getState().levers.find((l) => l.id === "base_fee").value);
log("CONTROL_CMD", JSON.stringify({ reply: ctl, before, after }));

// 3) Occupancy command in the same box.
const occ = await send("we only want 80% capacity today");
log("OCC_CMD", JSON.stringify({ reply: occ.slice(0, 80), occ: await page.evaluate(() => window.ProjectQ.getState().occupancy_target) }));

// 4) An analyst QUESTION in the same box.
const why = await send("why is Feb 2nd's demand what it is?");
log("QUESTION", JSON.stringify(why.slice(0, 90)));

// 5) Apply the suggestion → multiple levers move.
await send("suggest lever settings for this day and explain");
const lev0 = await page.evaluate(() => Object.fromEntries(window.ProjectQ.getState().levers.map((l) => [l.id, l.value])));
await page.locator(".qctl-msg-apply").last().click();
await page.waitForTimeout(200);
const lev1 = await page.evaluate(() => Object.fromEntries(window.ProjectQ.getState().levers.map((l) => [l.id, l.value])));
log("APPLY_SUGGESTION", JSON.stringify({ before: lev0, after: lev1 }));

await page.screenshot({ path: OUT + "/assistant-unified.png" });
log("CONSOLE_ERRORS", JSON.stringify(errors));
await browser.close();
log("VERIFY_ASSISTANT_DONE");
