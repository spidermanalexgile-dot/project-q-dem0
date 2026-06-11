/**
 * Shared control-state relay for the web ↔ iPad lever console.
 *
 *   GET  /api/sync                  → { rev, clientId, data, ts }
 *   POST /api/sync {clientId,data}  → { rev }
 *
 * Durable storage via Vercel Blob (store "projectq-sync"): survives cold starts
 * and works across serverless instances/regions, so the two screens stay in
 * lockstep for real. `rev` is a server timestamp (monotonic across writes); the
 * blob is written with cacheControlMaxAge:0 and read with a cache-buster so polls
 * always see the latest. An in-process copy is kept only as an offline fallback.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { put, head } from "@vercel/blob";

type Req = IncomingMessage & { method?: string; body?: unknown };
type Snap = { rev: number; clientId: string | null; data: unknown; ts: number };

const PATH = "projectq-sync.json";
const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const EMPTY: Snap = { rev: 0, clientId: null, data: null, ts: 0 };

let mem: Snap = EMPTY; // offline fallback only

async function readSnap(): Promise<Snap> {
  if (!TOKEN) return mem;
  try {
    const h = await head(PATH, { token: TOKEN });
    const bust = (h.url.includes("?") ? "&" : "?") + "_=" + Date.now();
    const r = await fetch(h.url + bust, { cache: "no-store" });
    if (!r.ok) return mem;
    return (await r.json()) as Snap;
  } catch {
    return mem; // blob not created yet (no writes), or transient error
  }
}

async function writeSnap(next: Snap): Promise<void> {
  mem = next;
  if (!TOKEN) return;
  await put(PATH, JSON.stringify(next), {
    access: "public",
    allowOverwrite: true,
    addRandomSuffix: false,
    cacheControlMaxAge: 0,
    contentType: "application/json",
    token: TOKEN,
  });
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
      const now = Date.now();
      const next: Snap = { rev: now, clientId: body?.clientId ?? null, data: body?.data ?? null, ts: now };
      await writeSnap(next);
      send(res, 200, { rev: next.rev });
      return;
    }
    send(res, 200, await readSnap());
  } catch (e) {
    send(res, 200, { ...EMPTY, error: e instanceof Error ? e.message : "sync_error" });
  }
}
