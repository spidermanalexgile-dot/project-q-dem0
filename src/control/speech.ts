/**
 * Shared speech-synthesis helper.
 *
 * Two engines, chosen at runtime:
 *  1. ElevenLabs (premium, very natural) — used when an API key + voice id are
 *     present (localStorage `qctl-eleven-key` / `qctl-eleven-voice`, or
 *     window.QCTL_ELEVEN = {key, voiceId}). Streams MP3 from their TTS endpoint
 *     and plays it through an <audio> element.
 *  2. Browser Web Speech API (free, no key) — the default fallback; picks the
 *     warmest natural female voice installed and softens the prosody.
 *
 * SECURITY NOTE: a browser-embedded ElevenLabs key is visible to anyone who opens
 * dev-tools. Fine for a local pitch demo; for production route TTS through a tiny
 * server proxy that holds the key and returns the audio.
 */

const ELEVEN_KEY_LS = "qctl-eleven-key";
const ELEVEN_VOICE_LS = "qctl-eleven-voice";

/* ─── server proxy (/api/tts) detection ──────────────────────────────────── */
// undefined = not probed yet, true/false = whether the secure server proxy is up.
let serverTtsReady: boolean | undefined;
let serverProbe: Promise<boolean> | null = null;
// Set true if a real proxy POST fails at runtime (e.g. ElevenLabs free-plan 402)
// — we then skip the proxy for the rest of the session and use the browser voice
// directly, so every reply isn't slowed by a failing round-trip.
let serverTtsDisabled = false;

function probeServerTts(): Promise<boolean> {
  if (serverTtsReady !== undefined) return Promise.resolve(serverTtsReady);
  if (serverProbe) return serverProbe;
  serverProbe = (async () => {
    try {
      const r = await fetch("/api/tts", { method: "GET" });
      const j = (await r.json()) as { ok?: boolean };
      serverTtsReady = r.ok && !!j.ok;
    } catch {
      serverTtsReady = false;
    }
    return serverTtsReady;
  })();
  return serverProbe;
}

/** Kick the probe early (called once on boot) so the first reply can use it. */
export function initServerVoice(): void {
  void probeServerTts();
}

/**
 * Curated FEMALE ElevenLabs voices (premade library voice IDs, all female). The
 * assistant only ever uses one of these, so it can never pick a male voice.
 * Default = Rachel (warm, calm, professional — a good pitch-room voice).
 */
export const ELEVEN_FEMALE_VOICES: { name: string; id: string; note: string }[] = [
  { name: "Rachel", id: "21m00Tcm4TlvDq8ikWAM", note: "warm · calm · professional" },
  { name: "Bella", id: "EXAVITQu4vr4xnSDxMaL", note: "soft · friendly" },
  { name: "Elli", id: "MF3mGyEYCl7XYWbV9V6O", note: "young · bright" },
  { name: "Charlotte", id: "XB0fDUnXU5powFXDhCwa", note: "British · elegant" },
  { name: "Matilda", id: "XrExE9yKIg1WjnnlVkGX", note: "warm · mature" },
  { name: "Grace", id: "oWAxZDx7w5VEj9dCyTzz", note: "gentle · Southern US" },
  { name: "Lily", id: "pFZP5JQG7iQjIQuC4Bku", note: "British · soft" },
];
const ELEVEN_DEFAULT_VOICE = ELEVEN_FEMALE_VOICES[0].id;

/** Resolve a spoken/typed voice name (e.g. "Charlotte") to a female voice id. */
function resolveFemaleVoiceId(nameOrId: string): string {
  const q = nameOrId.trim().toLowerCase();
  const byName = ELEVEN_FEMALE_VOICES.find((v) => v.name.toLowerCase() === q);
  if (byName) return byName.id;
  // Accept a raw id only if it's one of our curated female voices; otherwise fall
  // back to the default so we never end up on a non-female / unknown voice.
  const byId = ELEVEN_FEMALE_VOICES.find((v) => v.id === nameOrId);
  return byId ? byId.id : ELEVEN_DEFAULT_VOICE;
}

type ElevenCfg = { key: string; voiceId: string } | null;
function elevenConfig(): ElevenCfg {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { QCTL_ELEVEN?: { key?: string; voiceId?: string } };
  let key = w.QCTL_ELEVEN?.key || "";
  let voiceId = w.QCTL_ELEVEN?.voiceId || "";
  try {
    key = key || localStorage.getItem(ELEVEN_KEY_LS) || "";
    voiceId = voiceId || localStorage.getItem(ELEVEN_VOICE_LS) || "";
  } catch {
    /* storage blocked */
  }
  if (!key) return null;
  // Always resolve through the female catalogue so a stale/unknown id can never
  // produce a male voice.
  return { key, voiceId: resolveFemaleVoiceId(voiceId || ELEVEN_DEFAULT_VOICE) };
}

/** True when a premium ElevenLabs voice will be used (secure proxy or client key). */
export function usingPremiumVoice(): boolean {
  return (serverTtsReady === true && !serverTtsDisabled) || elevenConfig() != null;
}

/** Current chosen female voice id (client config, else default) for proxy calls. */
function chosenVoiceId(): string {
  let v = "";
  try {
    v = localStorage.getItem(ELEVEN_VOICE_LS) || "";
  } catch {
    /* no-op */
  }
  return resolveFemaleVoiceId(v || ELEVEN_DEFAULT_VOICE);
}

/** Speak via the secure server proxy (/api/tts). Returns false on any failure so
 *  the caller can fall back. The key never touches the browser here. */
async function speakViaProxy(text: string, onDone?: () => void): Promise<boolean> {
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voiceId: chosenVoiceId() }),
    });
    if (!res.ok) {
      // 401 (key lacks permission) / 402 (paid plan required) / 403 / 5xx all mean
      // ElevenLabs won't serve this — stop using the proxy this session and fall
      // back to the warm browser voice instead of retrying every reply.
      if ([401, 402, 403].includes(res.status) || res.status >= 500) serverTtsDisabled = true;
      return false;
    }
    const blob = await res.blob();
    return playAudioBlob(blob, onDone);
  } catch {
    return false;
  }
}

/** Store / clear the ElevenLabs key + voice. `voice` may be a name ("Charlotte")
 *  or a curated female id; anything else falls back to the default female voice. */
export function setElevenCredentials(key: string | null, voice?: string): void {
  try {
    if (key) localStorage.setItem(ELEVEN_KEY_LS, key);
    else localStorage.removeItem(ELEVEN_KEY_LS);
    if (voice) localStorage.setItem(ELEVEN_VOICE_LS, resolveFemaleVoiceId(voice));
  } catch {
    /* no-op */
  }
}

/** Switch the premium voice without touching the key (name or curated id). */
export function setElevenVoice(voice: string): void {
  try {
    localStorage.setItem(ELEVEN_VOICE_LS, resolveFemaleVoiceId(voice));
  } catch {
    /* no-op */
  }
}

/** The list of selectable female voices (name + note) for a picker / help text. */
export function listFemaleVoices(): { name: string; note: string }[] {
  return ELEVEN_FEMALE_VOICES.map((v) => ({ name: v.name, note: v.note }));
}

/** Which TTS engine is in use right now — handy for setup verification. */
export function voiceStatus(): { engine: "server-proxy" | "client-key" | "browser"; voice: string } {
  let voiceName = "browser default";
  const id = chosenVoiceId();
  const hit = ELEVEN_FEMALE_VOICES.find((v) => v.id === id);
  if (serverTtsReady === true && !serverTtsDisabled) return { engine: "server-proxy", voice: hit?.name ?? "Rachel" };
  if (elevenConfig() != null) return { engine: "client-key", voice: hit?.name ?? "Rachel" };
  return { engine: "browser", voice: voiceName };
}

let currentAudio: HTMLAudioElement | null = null;

/** Play an audio blob (MP3) through a single shared <audio>, calling onDone when
 *  it ends/errors. Returns false if playback can't start. */
async function playAudioBlob(blob: Blob, onDone?: () => void): Promise<boolean> {
  try {
    const url = URL.createObjectURL(blob);
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    const audio = new Audio(url);
    currentAudio = audio;
    const finish = () => {
      URL.revokeObjectURL(url);
      if (currentAudio === audio) currentAudio = null;
      onDone?.();
    };
    audio.onended = finish;
    audio.onerror = finish;
    await audio.play();
    return true;
  } catch {
    return false;
  }
}

async function speakEleven(text: string, cfg: ElevenCfg, onDone?: () => void): Promise<boolean> {
  if (!cfg) return false;
  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${cfg.voiceId}?optimize_streaming_latency=2`,
      {
        method: "POST",
        headers: { "xi-api-key": cfg.key, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2_5",
          voice_settings: { stability: 0.4, similarity_boost: 0.8, style: 0.32, use_speaker_boost: true },
        }),
      },
    );
    if (!res.ok) return false; // bad key / quota — caller falls back to Web Speech
    return playAudioBlob(await res.blob(), onDone);
  } catch {
    return false;
  }
}

const PREFERRED_VOICES = [
  // Highest-quality system voices first (macOS "Premium"/"Enhanced", MS "Natural").
  "ava (premium)", "zoe (premium)", "serena (premium)", "nora (premium)",
  "samantha (enhanced)", "allison (enhanced)", "susan (enhanced)",
  "ava natural", "aria natural", "jenny natural", "michelle natural",
  "ana natural", "sonia natural", "libby natural", "emma natural",
  "samantha", "siri", "ava", "allison", "susan", "zoe", "nicky", "joelle",
  "aria", "jenny", "michelle", "google uk english female", "google us english",
  "serena", "kate", "stephanie", "fiona", "tessa", "karen", "moira", "victoria",
];
const HARSH_VOICES =
  /zira|espeak|compact|albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|hysterical|pipe organ|trinoids|whisper|wobble|zarvox|superstar|novelty|eloquence/i;

export function pickFemaleVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const en = voices.filter((v) => /^en(-|_|$)/i.test(v.lang) || /english/i.test(v.name));
  const pool = (en.length ? en : voices).filter((v) => !HARSH_VOICES.test(v.name));
  const usable = pool.length ? pool : voices;
  for (const want of PREFERRED_VOICES) {
    const hit = usable.find((v) => v.name.toLowerCase().includes(want));
    if (hit) return hit;
  }
  const natural = usable.find(
    (v) => /natural|neural|premium|enhanced/i.test(v.name) && !/male/i.test(v.name.replace(/female/i, "")),
  );
  if (natural) return natural;
  const female = usable.find((v) => /female|woman/i.test(v.name));
  if (female) return female;
  const notMale = usable.find(
    (v) => !/\bmale\b|david|daniel|alex|fred|george|james|mark|thomas|oliver|arthur/i.test(v.name),
  );
  return notMale || usable[0] || null;
}

let cachedVoice: SpeechSynthesisVoice | null = null;
let voiceListenerAttached = false;

function ensureVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const synth = window.speechSynthesis;
  if (!cachedVoice) cachedVoice = pickFemaleVoice(synth.getVoices());
  if (!voiceListenerAttached) {
    voiceListenerAttached = true;
    synth.addEventListener?.("voiceschanged", () => {
      cachedVoice = pickFemaleVoice(synth.getVoices());
    });
  }
  return cachedVoice;
}

function speakBrowser(text: string, onDone?: () => void): void {
  try {
    const synth = window.speechSynthesis;
    if (!synth) {
      onDone?.();
      return;
    }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = ensureVoice();
    if (v) u.voice = v;
    u.rate = 0.95;
    u.pitch = 1.05;
    u.volume = 0.85;
    if (onDone) {
      u.onend = onDone;
      u.onerror = onDone;
    }
    synth.speak(u);
  } catch {
    onDone?.();
  }
}

/** Speak text once. Prefers the secure server proxy, then a client ElevenLabs key,
 *  then the browser voice — falling through on any failure so it's never silent.
 *  onDone fires when speech ends/errors so the caller can resume the mic. */
export function speak(text: string, onDone?: () => void): void {
  void (async () => {
    // 1. Secure server proxy (production) — unless a prior call proved it can't
    //    serve (e.g. free-plan 402).
    if (!serverTtsDisabled && (await probeServerTts())) {
      if (await speakViaProxy(text, onDone)) return;
    }
    // 2. Client-side ElevenLabs key (local pitch).
    const cfg = elevenConfig();
    if (cfg && (await speakEleven(text, cfg, onDone))) return;
    // 3. Built-in browser voice.
    speakBrowser(text, onDone);
  })();
}

export function cancelSpeech(): void {
  try {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    window.speechSynthesis?.cancel();
  } catch {
    /* no-op */
  }
}
