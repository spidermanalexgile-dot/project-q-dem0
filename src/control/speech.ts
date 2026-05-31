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
// A pleasant default ElevenLabs voice ("Rachel") — overridable per deployment.
const ELEVEN_DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM";

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
  return { key, voiceId: voiceId || ELEVEN_DEFAULT_VOICE };
}

/** True when the premium ElevenLabs voice is configured + will be used. */
export function usingPremiumVoice(): boolean {
  return elevenConfig() != null;
}

/** Store / clear the ElevenLabs key + voice (so the operator can enable it live). */
export function setElevenCredentials(key: string | null, voiceId?: string): void {
  try {
    if (key) localStorage.setItem(ELEVEN_KEY_LS, key);
    else localStorage.removeItem(ELEVEN_KEY_LS);
    if (voiceId) localStorage.setItem(ELEVEN_VOICE_LS, voiceId);
  } catch {
    /* no-op */
  }
}

let currentAudio: HTMLAudioElement | null = null;

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
          model_id: "eleven_turbo_v2",
          voice_settings: { stability: 0.4, similarity_boost: 0.75, style: 0.2, use_speaker_boost: true },
        }),
      },
    );
    if (!res.ok) return false; // bad key / quota — caller falls back to Web Speech
    const blob = await res.blob();
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

const PREFERRED_VOICES = [
  "samantha", "siri", "ava", "allison", "susan", "zoe", "nicky", "joelle",
  "aria natural", "jenny natural", "michelle natural", "ana natural",
  "sonia natural", "libby natural", "aria", "jenny", "michelle",
  "google uk english female", "google us english",
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

/** Speak text once. Uses ElevenLabs when configured, else the browser voice.
 *  onDone fires when speech ends/errors so the caller can resume the mic. */
export function speak(text: string, onDone?: () => void): void {
  const cfg = elevenConfig();
  if (cfg) {
    // Try premium first; on any failure fall back to the browser voice so the
    // assistant is never left silent.
    speakEleven(text, cfg, onDone).then((ok) => {
      if (!ok) speakBrowser(text, onDone);
    });
    return;
  }
  speakBrowser(text, onDone);
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
