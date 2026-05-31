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

/** Find the ElevenLabs key tolerant of casing/spelling — env names are
 *  case-sensitive, so accept ELEVENLABS_API_KEY / ElevenLabs_API_Key / etc.,
 *  plus a couple of common alternates. */
function findElevenKey(): string | undefined {
  const direct = process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_API_KEY;
  if (direct) return direct;
  for (const [name, value] of Object.entries(process.env)) {
    const n = name.toLowerCase().replace(/[^a-z]/g, "");
    if ((n.includes("elevenlabs") || n.includes("eleven")) && n.includes("key") && value) {
      return value;
    }
  }
  return undefined;
}

export default async function handler(req: Req, res: ServerResponse): Promise<void> {
  const key = findElevenKey();

  // Health probe — reports whether the key is configured WITHOUT exposing it.
  // ?debug=1 adds a SAFE diagnostic (env var NAMES only, never values) to help
  // pinpoint a misnamed / wrongly-scoped var. No secret is ever returned.
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
          elevenVarNames: names.filter((n) => /eleven/i.test(n)),
          totalEnvVars: names.length,
        }),
      );
      return;
    }
    // ?voices=1 lists the account's usable voices (names + ids + category +
    // gender) so we can pick a FREE-plan-usable female voice. No secret returned.
    if ((req.url || "").includes("voices=1")) {
      if (!key) {
        res.end(JSON.stringify({ ok: false }));
        return;
      }
      try {
        const vr = await fetch("https://api.elevenlabs.io/v1/voices", {
          headers: { "xi-api-key": key },
        });
        const raw = await vr.text();
        let parsed: { voices?: { voice_id: string; name: string; category?: string; labels?: Record<string, string> }[] } = {};
        try {
          parsed = JSON.parse(raw);
        } catch {
          /* non-json */
        }
        const voices = (parsed.voices || []).map((v) => ({
          id: v.voice_id,
          name: v.name,
          category: v.category,
          gender: v.labels?.gender,
        }));
        res.end(
          JSON.stringify({
            ok: true,
            status: vr.status,
            count: voices.length,
            voices,
            rawHead: voices.length ? undefined : raw.slice(0, 400),
          }),
        );
      } catch (e) {
        res.end(JSON.stringify({ ok: true, voices: [], error: String(e).slice(0, 200) }));
      }
      return;
    }
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
    // Surface ElevenLabs' own error so failures are diagnosable (it's their
    // status/message, not our secret). Common causes: free tier doesn't allow
    // the turbo model, quota exhausted, or the voice isn't in the account.
    let detail = "";
    try {
      detail = (await upstream.text()).slice(0, 300);
    } catch {
      /* ignore */
    }
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "upstream_tts_failed", status: upstream.status, detail }));
    return;
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", "audio/mpeg");
  res.setHeader("Cache-Control", "no-store");
  const buf = Buffer.from(await upstream.arrayBuffer());
  res.end(buf);
}
