/**
 * Claude concierge proxy (Vercel Node serverless function).
 *
 * Holds the Anthropic key ONLY on the server, read from ANTHROPIC_API_KEY — it is
 * never sent to the browser. Node runtime (not Edge) so process.env resolves at
 * runtime. The browser runs the tool-use loop and posts {system, tools, messages}
 * here; this just forwards to Anthropic and returns the raw Messages response, so
 * all deterministic tool math stays client-side against the live store.
 *
 *   GET  /api/agent            → { ok } if the key is configured (probe)
 *   GET  /api/agent?debug=1    → SAFE env diagnostic (names only, never values)
 *   POST /api/agent {system,tools,messages} → Anthropic Messages API response
 *
 * Set the key in Vercel: Project → Settings → Environment Variables →
 *   ANTHROPIC_API_KEY = <your key>     (NO "VITE_" prefix — server-only)
 * then redeploy.
 */

import type { IncomingMessage, ServerResponse } from "node:http";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 900;
const ANTHROPIC_VERSION = "2023-06-01";

type Req = IncomingMessage & { method?: string; body?: unknown };

type AgentBody = {
  system?: string;
  tools?: unknown[];
  messages?: unknown[];
};

function readJsonBody(req: Req): Promise<AgentBody> {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body as AgentBody);
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

/** Find the Anthropic key tolerant of casing/spelling — env names are
 *  case-sensitive, so accept ANTHROPIC_API_KEY / Anthropic_Api_Key / a CLAUDE_*
 *  alternate, etc. */
function findAnthropicKey(): string | undefined {
  const direct = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
  if (direct) return direct;
  for (const [name, value] of Object.entries(process.env)) {
    const n = name.toLowerCase().replace(/[^a-z]/g, "");
    if ((n.includes("anthropic") || n.includes("claude")) && n.includes("key") && value) {
      return value;
    }
  }
  return undefined;
}

export default async function handler(req: Req, res: ServerResponse): Promise<void> {
  const key = findAnthropicKey();

  if (req.method === "GET") {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    const url = req.url || "";
    if (url.includes("debug=1")) {
      const names = Object.keys(process.env);
      res.end(
        JSON.stringify({
          ok: !!key,
          keyPresent: !!key,
          keyLength: key ? key.length : 0,
          model: MODEL,
          anthropicVarNames: names.filter((n) => /anthropic|claude/i.test(n)),
          totalEnvVars: names.length,
        }),
      );
      return;
    }
    res.end(JSON.stringify({ ok: !!key, model: MODEL }));
    return;
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end("Method not allowed");
    return;
  }
  if (!key) {
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "agent_not_configured" }));
    return;
  }

  const body = await readJsonBody(req);
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "missing_messages" }));
    return;
  }

  let upstreamStatus = 502;
  let text = JSON.stringify({ error: "upstream_unreachable" });
  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": ANTHROPIC_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: typeof body.system === "string" ? body.system : undefined,
        tools: Array.isArray(body.tools) ? body.tools : undefined,
        messages: body.messages,
      }),
    });
    upstreamStatus = upstream.status;
    text = await upstream.text();
  } catch (e) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "upstream_unreachable", detail: String(e).slice(0, 200) }));
    return;
  }

  // Forward Anthropic's real status (401 bad key, 429 rate limit, 400 bad req…)
  // and body so the client can react / surface a useful message.
  res.statusCode = upstreamStatus;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(text);
}
