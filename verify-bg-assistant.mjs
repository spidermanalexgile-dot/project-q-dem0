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

// 1) Layout: orb is a small fixed widget at the BOTTOM-LEFT, not blocking the
//    panels. No big text box / chat log present.
const orb = await page.locator(".qctl-assistant-orb").count();
log("ORB_PRESENT", orb);
log("NO_OLD_FAB", await page.locator(".qctl-analyst-fab").count()); // 0
log("NO_TEXT_INPUT", await page.locator(".qctl-analyst-input input").count()); // 0
if (orb) {
  const box = await page.locator(".qctl-assistant-orb").boundingBox();
  const vw = 1440, vh = 900;
  log("ORB_POSITION", JSON.stringify({ leftHalf: box.x < vw / 2, bottomHalf: box.y > vh / 2, w: Math.round(box.width) }));
}

// 2) Premium voice API exists.
log("API_HAS_SETVOICEKEY", await page.evaluate(() => typeof window.ProjectQ.setVoiceApiKey));

// 3) The brain still works via window.ProjectQ (voice path uses the same code).
const brain = await page.evaluate(() => ({
  cmd: window.ProjectQ.voiceCommand("set base fee to 22"),
  baseFee: window.ProjectQ.getState().levers.find((l) => l.id === "base_fee").value,
  occ: window.ProjectQ.voiceCommand("we only want 80% capacity today"),
  occTarget: window.ProjectQ.getState().occupancy_target,
  suggest: window.ProjectQ.askAnalyst("suggest lever settings for this day and explain").slice(0, 80),
  why: window.ProjectQ.askAnalyst("why is Feb 2nd's demand what it is?").slice(0, 60),
}));
log("BRAIN", JSON.stringify(brain));

await page.screenshot({ path: OUT + "/bg-assistant.png" });
log("CONSOLE_ERRORS", JSON.stringify(errors));
await browser.close();
log("VERIFY_BG_DONE");
