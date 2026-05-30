/**
 * Shared speech-synthesis helper — picks a warm, natural female voice and speaks
 * text with softened prosody. Used by both the voice control and the analyst so
 * they sound identical. No recognition here (that lives in VoiceControl).
 */

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

/** Speak text once with the shared warm voice. Cancels any in-progress speech. */
export function speak(text: string): void {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = ensureVoice();
    if (v) u.voice = v;
    u.rate = 0.95;
    u.pitch = 1.05;
    u.volume = 0.85;
    synth.speak(u);
  } catch {
    /* speech synthesis unavailable — silent no-op */
  }
}

export function cancelSpeech(): void {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* no-op */
  }
}
