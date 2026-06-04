/* Headless verification for /equity — screenshots + behaviour assertions. */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, extname } from "node:path";

const DIST = join(process.cwd(), "dist");
const OUT = join(process.cwd(), "review-screenshots", "equity-console");
mkdirSync(OUT, { recursive: true });

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png" };
const server = createServer((req, res) => {
  let p = join(DIST, (req.url || "/").split("?")[0]);
  if (!existsSync(p) || extname(p) === "") p = join(DIST, "index.html"); // SPA fallback
  res.setHeader("Content-Type", MIME[extname(p)] || "application/octet-stream");
  res.end(readFileSync(p));
});
await new Promise((r) => server.listen(4519, r));

const browser = await chromium.launch();
const fails = [];
const ok = (name, cond) => { console.log(`${cond ? "PASS" : "FAIL"}  ${name}`); if (!cond) fails.push(name); };

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:4519/equity");
await page.waitForSelector(".qeq-root");

// Surge preset default: index visible, 8 stakeholder bars.
ok("8 stakeholder rows", (await page.locator(".qeq-row").count()) === 8);
const idxBefore = Number(await page.locator(".qeq-hero-num").innerText().then((t) => t.replace(/\/100/, "").trim()));
ok("equity index is a number", Number.isFinite(idxBefore));
await page.screenshot({ path: join(OUT, "equity-surge-desktop.png") });

// Toggle "exempt vendors" → vendors bar should rise, index should move.
await page.locator(".qeq-toggle").first().click();
await page.waitForTimeout(700);
const idxAfter = Number(await page.locator(".qeq-hero-num").innerText().then((t) => t.replace(/\/100/, "").trim()));
ok("index moves when decision applied", idxAfter !== idxBefore);
await page.screenshot({ path: join(OUT, "equity-decision-applied.png") });

// Stats strip: footfall + tourist burden thresholds (surge → regressive for day-trippers).
const stats = await page.locator(".qeq-stats").innerText();
ok("footfall-after-fee readout", /footfall after fee/i.test(stats));
ok("tourist burden verdict shown", /regressive/i.test(stats) && /inequitable past/i.test(stats));

// Open deliberation panel (click card body) → justification + circle grid + embedded Ask Claude.
await page.locator(".qeq-card").first().click();
await page.waitForSelector(".qeq-justification");
ok("justification shown on select", /the case for this decision/i.test(await page.locator(".qeq-justification h4").innerText()));
ok("circle-of-viewpoints grid renders", (await page.locator(".qeq-delib-grid h4").count()) >= 4);
ok("Ask Claude lives inside the circle panel", (await page.locator(".qeq-delib .qeq-advisor").count()) === 1);
ok("chart closes while deliberating", (await page.locator(".qeq-chart").count()) === 0);
ok("left column does not scroll", await page.locator(".qeq-left").evaluate((el) => el.scrollHeight <= el.clientHeight + 1));
await page.screenshot({ path: join(OUT, "equity-deliberation.png") });
// Trail folds to its header while deliberating (no left-column scroll).
ok("trail folds while deliberating", (await page.locator(".qeq-trail-entry").count()) === 0);

// Close deliberation → chart returns, trail unfolds with the 3 seeded justifications.
await page.locator(".qeq-close").click();
ok("chart returns on close", (await page.locator(".qeq-chart").count()) === 1);
ok("trail seeded with 3 justifications", (await page.locator(".qeq-trail-entry.justification").count()) === 3);
await page.locator(".qeq-card").first().click(); // reopen for the advisor step below

// Fallback advisor (no /api/agent on this static server → deterministic engine).
await page.locator(".qeq-chat-input input").fill("we won't charge vendors who commute every day");
await page.locator(".qeq-chat-input button").click();
await page.waitForSelector(".qeq-msg.advisor:not(.qeq-thinking)", { timeout: 8000 });
const reply = await page.locator(".qeq-msg.advisor").last().innerText();
ok("fallback advisor deliberates with evidence", /equity index/i.test(reply) && /voices/i.test(reply));
console.log("  advisor said:", reply.slice(0, 220));
await page.screenshot({ path: join(OUT, "equity-advisor.png") });
await page.locator(".qeq-close").click(); // unfold the trail to check the log
ok("prompt logged to reasoning trail", (await page.locator(".qeq-trail-entry.prompt").count()) >= 1);

// Low-season preset: negative fee credit shows.
await page.locator(".qeq-preset", { hasText: "Low season" }).click();
await page.waitForTimeout(700);
ok("negative fee shown as credit", /−€|-€/.test(await page.locator(".qeq-sliders").innerText()));
await page.screenshot({ path: join(OUT, "equity-low-season.png") });

// Mobile
const mob = await browser.newPage({ viewport: { width: 393, height: 852 } });
await mob.goto("http://localhost:4519/equity");
await mob.waitForSelector(".qeq-root");
await mob.screenshot({ path: join(OUT, "equity-mobile.png"), fullPage: false });

await browser.close();
server.close();
console.log(fails.length ? `\n${fails.length} FAILURES` : "\nALL PASS");
process.exit(fails.length ? 1 : 0);
