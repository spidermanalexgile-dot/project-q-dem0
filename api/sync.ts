/**
 * Shared control-state relay for the web ↔ iPad lever console.
 *
 *   GET  /api/sync                  → { rev, clientId, data, ts }
 *   POST /api/sync {clientId,data}  → { rev }
 *
 * Durable storage via Redis (REDIS_URL, provisioned through the Vercel Redis
 * integration): strongly consistent, survives cold starts and works across
 * instances/regions, so the two screens stay in lockstep for real. `rev` is a
 * server timestamp; an unchanged payload (a heartbeat re-assert) does NOT bump
 * it. Falls back to an in-process copy if Redis is unreachable.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import Redis from "ioredis";

type Req = IncomingMessage & { method?: string; body?: unknown };
type Snap = { rev: number; clientId: string | null; data: unknown; ts: number };

const KEY = "projectq:sync";
const REDIS_URL = process.env.REDIS_URL;
const EMPTY: Snap = { rev: 0, clientId: null, data: null, ts: 0 };

let mem: Snap = EMPTY; // fallback if Redis is unreachable
let client: Redis | null = null;

function getClient(): Redis | null {
  if (!REDIS_URL) return null;
  if (!client) {
    client = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 2,
      connectTimeout: 4000,
      enableReadyCheck: false,
    });
    client.on("error", () => {
      /* swallow so a transient blip never crashes the function */
    });
  }
  return client;
}

async function read(): Promise<Snap> {
  const c = getClient();
  if (!c) return mem;
  try {
    const raw = await c.get(KEY);
    return raw ? (JSON.parse(raw) as Snap) : EMPTY;
  } catch {
    return mem;
  }
}

async function write(next: Snap): Promise<void> {
  mem = next;
  const c = getClient();
  if (c) {
    try {
      await c.set(KEY, JSON.stringify(next));
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
      // Unchanged payload (a heartbeat) → keep the existing rev so the other
      // screen doesn't needlessly re-adopt identical state.
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
