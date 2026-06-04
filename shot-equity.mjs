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

// Open deliberation panel (click card body).
await page.locator(".qeq-card").first().click();
await page.waitForSelector(".qeq-delib");
ok("circle-of-viewpoints panel renders", await page.locator(".qeq-delib h4").count() >= 4);
await page.screenshot({ path: join(OUT, "equity-deliberation.png") });

// Fallback advisor (no /api/agent on this static server → deterministic engine).
await page.locator(".qeq-chat-input input").fill("we won't charge vendors who commute every day");
await page.locator(".qeq-chat-input button").click();
await page.waitForSelector(".qeq-msg.advisor:not(.qeq-thinking)", { timeout: 8000 });
const reply = await page.locator(".qeq-msg.advisor").last().innerText();
ok("fallback advisor deliberates with evidence", /equity index/i.test(reply) && /voices/i.test(reply));
console.log("  advisor said:", reply.slice(0, 220));
await page.screenshot({ path: join(OUT, "equity-advisor.png") });

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
