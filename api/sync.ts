/**
 * Shared control-state relay for the web ↔ iPad lever console.
 *
 *   GET  /api/sync                  → { rev, clientId, data, ts }
 *   POST /api/sync {clientId,data}  → { rev }   (rev increments on every write)
 *
 * Storage: Vercel KV / Upstash Redis when its env vars are present (durable,
 * survives cold starts + multiple regions); otherwise an in-process fallback
 * that is good enough for a single-region live demo. To make it rock-solid,
 * provision Vercel KV (Project → Storage → KV) and redeploy — no code change.
 */
import type { IncomingMessage, ServerResponse } from "node:http";

type Req = IncomingMessage & { method?: string; body?: unknown };
type Snap = { rev: number; clientId: string | null; data: unknown; ts: number };

const KEY = "projectq:sync";
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const kvOn = !!(KV_URL && KV_TOKEN);

// In-process fallback (per warm serverless instance).
let mem: Snap = { rev: 0, clientId: null, data: null, ts: 0 };

async function kvCmd(cmd: unknown[]): Promise<unknown> {
  const r = await fetch(KV_URL as string, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  const j = (await r.json()) as { result?: unknown };
  return j.result;
}

async function read(): Promise<Snap> {
  if (!kvOn) return mem;
  try {
    const raw = (await kvCmd(["GET", KEY])) as string | null;
    return raw ? (JSON.parse(raw) as Snap) : { rev: 0, clientId: null, data: null, ts: 0 };
  } catch {
    return mem;
  }
}

async function write(next: Snap): Promise<void> {
  mem = next;
  if (kvOn) {
    try {
      await kvCmd(["SET", KEY, JSON.stringify(next)]);
    } catch {
      /* keep the in-memory copy */
    }
  }
}

function readJsonBody(req: Req): Promise<{ clientId?: string; data?: unknown }> {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body as { clientId?: string; data?: unknown });
  return new Promise((resolve) => {
    let s = "";
    req.on("data", (c) => (s += c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(s || "{}"));
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

export default async function handler(req: Req, res: ServerResponse): Promise<void> {
  if (req.method === "POST") {
    const body = await readJsonBody(req);
    const cur = await read();
    const next: Snap = {
      rev: cur.rev + 1,
      clientId: body?.clientId ?? null,
      data: body?.data ?? null,
      ts: Date.now(),
    };
    await write(next);
    send(res, 200, { rev: next.rev });
    return;
  }
  send(res, 200, await read());
}
