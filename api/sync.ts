/**
 * Shared control-state relay for the web ↔ iPad lever console.
 *
 *   GET  /api/sync                  → { rev, clientId, data, ts }
 *   POST /api/sync {clientId,data}  → { rev }
 *
 * Storage:
 *  • Upstash/Vercel Redis when its REST env vars are present (KV_REST_API_URL +
 *    KV_REST_API_TOKEN, or UPSTASH_REDIS_REST_URL/TOKEN) — strongly consistent
 *    and durable across cold starts/instances. Provision once (Vercel → Storage
 *    → Redis) and it upgrades automatically; no code change.
 *  • Otherwise an in-process store. The clients send a heartbeat re-assert every
 *    few seconds, so even if a cold start wipes it, the shared state is restored
 *    within one heartbeat. `rev` is a server timestamp; an unchanged payload does
 *    NOT bump it, so heartbeats are silent no-ops.
 */
import type { IncomingMessage, ServerResponse } from "node:http";

type Req = IncomingMessage & { method?: string; body?: unknown };
type Snap = { rev: number; clientId: string | null; data: unknown; ts: number };

const KEY = "projectq:sync";
const R_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const R_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const redisOn = !!(R_URL && R_TOKEN);
const EMPTY: Snap = { rev: 0, clientId: null, data: null, ts: 0 };

let mem: Snap = EMPTY;

async function redis(cmd: unknown[]): Promise<unknown> {
  const r = await fetch(R_URL as string, {
    method: "POST",
    headers: { Authorization: `Bearer ${R_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  const j = (await r.json()) as { result?: unknown };
  return j.result;
}

async function read(): Promise<Snap> {
  if (!redisOn) return mem;
  try {
    const raw = (await redis(["GET", KEY])) as string | null;
    return raw ? (JSON.parse(raw) as Snap) : EMPTY;
  } catch {
    return mem;
  }
}

async function write(next: Snap): Promise<void> {
  mem = next;
  if (redisOn) {
    try {
      await redis(["SET", KEY, JSON.stringify(next)]);
    } catch {
      /* keep in-memory copy */
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
  try {
    if (req.method === "POST") {
      const body = await readJsonBody(req);
      const cur = await read();
      const incoming = JSON.stringify(body?.data ?? null);
      // Unchanged payload (a heartbeat re-assert) → keep the existing rev so the
      // other screen doesn't needlessly re-adopt identical state.
      if (incoming === JSON.stringify(cur.data) && cur.rev > 0) {
        send(res, 200, { rev: cur.rev });
        return;
      }
      const now = Date.now();
      const next: Snap = { rev: now, clientId: body?.clientId ?? null, data: body?.data ?? null, ts: now };
      await write(next);
      send(res, 200, { rev: next.rev });
      return;
    }
    send(res, 200, await read());
  } catch (e) {
    send(res, 200, { ...EMPTY, error: e instanceof Error ? e.message : "sync_error" });
  }
}
