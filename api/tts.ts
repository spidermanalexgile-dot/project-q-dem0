/**
 * ElevenLabs text-to-speech proxy (Vercel Node serverless function).
 *
 * The ElevenLabs API key lives ONLY on the server, read from the
 * ELEVENLABS_API_KEY environment variable — it is never sent to the browser.
 * Node runtime is used (not Edge) so `process.env.ELEVENLABS_API_KEY` resolves
 * reliably at runtime.
 *   GET  /api/tts                → { ok: true } if the key is configured (probe)
 *   POST /api/tts {text,voiceId} → audio/mpeg
 *
 * Set the key in Vercel: Project → Settings → Environment Variables →
 *   ELEVENLABS_API_KEY = <your key>     (NO "VITE_" prefix — server-only)
 * then redeploy. The dashboard auto-detects it; no client change needed.
 */

import type { IncomingMessage, ServerResponse } from "node:http";

// Curated FEMALE voices — the proxy refuses any voice id not in this list, so the
// site can never be made to speak in a male voice even by a crafted request.
const FEMALE_VOICE_IDS = new Set([
  "21m00Tcm4TlvDq8ikWAM", // Rachel (default)
  "EXAVITQu4vr4xnSDxMaL", // Bella
  "MF3mGyEYCl7XYWbV9V6O", // Elli
  "XB0fDUnXU5powFXDhCwa", // Charlotte
  "XrExE9yKIg1WjnnlVkGX", // Matilda
  "oWAxZDx7w5VEj9dCyTzz", // Grace
  "pFZP5JQG7iQjIQuC4Bku", // Lily
]);
const DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM";

type Req = IncomingMessage & { method?: string; body?: unknown };

function readJsonBody(req: Req): Promise<{ text?: string; voiceId?: string }> {
  // Vercel usually parses JSON into req.body; fall back to reading the stream.
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body as never);
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

export default async function handler(req: Req, res: ServerResponse): Promise<void> {
  const key = process.env.ELEVENLABS_API_KEY;

  // Health probe — reports whether the key is configured WITHOUT exposing it.
  if (req.method === "GET") {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify({ ok: !!key }));
    return;
  }
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end("Method not allowed");
    return;
  }
  if (!key) {
    res.statusCode = 503;
    res.end("TTS not configured");
    return;
  }

  const body = await readJsonBody(req);
  const text = String(body.text || "").slice(0, 800);
  const voiceId = body.voiceId && FEMALE_VOICE_IDS.has(body.voiceId) ? body.voiceId : DEFAULT_VOICE;
  if (!text.trim()) {
    res.statusCode = 400;
    res.end("Empty text");
    return;
  }

  const upstream = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?optimize_streaming_latency=2`,
    {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2",
        voice_settings: { stability: 0.4, similarity_boost: 0.75, style: 0.2, use_speaker_boost: true },
      }),
    },
  );

  if (!upstream.ok || !upstream.body) {
    res.statusCode = 502;
    res.end("Upstream TTS failed");
    return;
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader("Cache-Control", "no-store");
  const buf = Buffer.from(await upstream.arrayBuffer());
  res.end(buf);
}
