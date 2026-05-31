/**
 * ElevenLabs text-to-speech proxy (Vercel serverless function).
 *
 * The ElevenLabs API key lives ONLY on the server, read from the
 * ELEVENLABS_API_KEY environment variable — it is never sent to the browser.
 * The dashboard calls this endpoint instead of ElevenLabs directly:
 *   GET  /api/tts            → { ok: true }  if the key is configured (health probe)
 *   POST /api/tts {text,voiceId} → audio/mpeg stream
 *
 * Set the key in Vercel: Project → Settings → Environment Variables →
 *   ELEVENLABS_API_KEY = <your key>     (NO "VITE_" prefix — server-only)
 * then redeploy. No client change needed; the assistant auto-detects it.
 */

export const config = { runtime: "edge" };

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

export default async function handler(req: Request): Promise<Response> {
  const key = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.ELEVENLABS_API_KEY;

  // Health probe — lets the client know whether the premium voice is available
  // WITHOUT exposing the key.
  if (req.method === "GET") {
    return Response.json({ ok: !!key });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  if (!key) {
    return new Response("TTS not configured", { status: 503 });
  }

  let text = "";
  let voiceId = DEFAULT_VOICE;
  try {
    const body = (await req.json()) as { text?: string; voiceId?: string };
    text = (body.text || "").slice(0, 800); // cap length to limit abuse
    if (body.voiceId && FEMALE_VOICE_IDS.has(body.voiceId)) voiceId = body.voiceId;
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  if (!text.trim()) return new Response("Empty text", { status: 400 });

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
    return new Response("Upstream TTS failed", { status: 502 });
  }
  return new Response(upstream.body, {
    status: 200,
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
  });
}
