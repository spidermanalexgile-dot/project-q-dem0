import { useEffect, useRef, useState } from "react";
import { getState, setLever, setDemand, setDayType, setDate, setView } from "./state";
import { executeVoiceCommand } from "./voice";

type VoiceProps = {
  dark: boolean;
  onSetDark: (dark: boolean) => void;
};

/** Minimal typing for the Web Speech API (not in lib.dom for all targets). */
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> & { length: number } }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

/**
 * Pick the softest, most feminine English voice available. We score the
 * installed voices and keep the best match — preferring known soft female
 * voices (Samantha, Victoria, Karen, Serena, Google UK English Female, Zira,
 * Aria), then anything explicitly female, then any English voice.
 */
const PREFERRED_VOICES = [
  "samantha", "victoria", "serena", "karen", "moira", "tessa", "fiona",
  "google uk english female", "microsoft aria", "microsoft zira",
  "microsoft sonia", "microsoft libby", "google us english", "allison", "ava",
];
function pickFemaleVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const en = voices.filter((v) => /^en(-|_|$)/i.test(v.lang) || /english/i.test(v.name));
  const pool = en.length ? en : voices;
  // 1. Named preferred soft-female voices, in priority order.
  for (const want of PREFERRED_VOICES) {
    const hit = pool.find((v) => v.name.toLowerCase().includes(want));
    if (hit) return hit;
  }
  // 2. Anything that advertises "female".
  const female = pool.find((v) => /female|woman/i.test(v.name));
  if (female) return female;
  // 3. Avoid obviously male voices; otherwise first English voice.
  const notMale = pool.find((v) => !/male|david|daniel|alex|fred|george|james|mark/i.test(v.name));
  return notMale || pool[0] || null;
}

export function VoiceControl({ dark, onSetDark }: VoiceProps) {
  const supported = !!getRecognitionCtor();
  const [listening, setListening] = useState(false);
  const [caption, setCaption] = useState<string>("");
  const [confirm, setConfirm] = useState<string>("");
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const captionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wantListening = useRef(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  // True while we're speaking a confirmation (or just finished) — used to drop
  // recognition results so the assistant never hears and re-runs its own reply.
  const speakingRef = useRef(false);
  const muteUntil = useRef(0);
  const lastSpoken = useRef<string>("");

  // Resolve the female voice once voices are available (they load async).
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const synth = window.speechSynthesis;
    const load = () => {
      const v = pickFemaleVoice(synth.getVoices());
      if (v) voiceRef.current = v;
    };
    load();
    synth.onvoiceschanged = load;
    return () => {
      synth.onvoiceschanged = null;
    };
  }, []);

  /** Speak a confirmation with a soft, feminine voice. Suppresses self-hearing
   *  by muting recognition processing while (and shortly after) speaking. */
  function speak(text: string) {
    setConfirm(text);
    lastSpoken.current = text.toLowerCase();
    if (captionTimer.current) clearTimeout(captionTimer.current);
    captionTimer.current = setTimeout(() => setConfirm(""), 6000);
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (voiceRef.current) u.voice = voiceRef.current;
      // Softer + more feminine: gentler pace, slightly higher pitch, eased volume.
      u.rate = 0.95;
      u.pitch = 1.35;
      u.volume = 0.9;
      speakingRef.current = true;
      u.onend = () => {
        speakingRef.current = false;
        // Keep a short guard window after speech ends to swallow trailing echo.
        muteUntil.current = performance.now() + 700;
      };
      u.onerror = () => {
        speakingRef.current = false;
        muteUntil.current = performance.now() + 700;
      };
      synth.speak(u);
    } catch {
      /* speech synthesis unavailable — caption still shows the confirmation */
    }
  }

  function handleTranscript(transcript: string) {
    // Drop anything heard while we're speaking or within the post-speech guard —
    // this is what stops the assistant repeating its own confirmation forever.
    if (speakingRef.current || performance.now() < muteUntil.current) return;
    const heard = transcript.toLowerCase();
    // Extra guard: ignore a result that is just our own last confirmation echoed.
    if (lastSpoken.current && heard.length > 6 && lastSpoken.current.includes(heard)) return;

    setCaption(transcript);
    const reply = executeVoiceCommand(transcript, {
      getState,
      setLever,
      setDemand,
      setDayType,
      setDate,
      setView,
      setDark: onSetDark,
    });
    speak(reply);
  }

  function start() {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const last = e.results[e.results.length - 1];
      const transcript = last && last[0] ? last[0].transcript : "";
      if (transcript) handleTranscript(transcript.trim());
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        wantListening.current = false;
        setListening(false);
        speak("Microphone access was blocked.");
      }
    };
    rec.onend = () => {
      // Auto-restart while the operator still wants to listen (continuous mode
      // ends on silence in some browsers). This is session continuity, NOT the
      // command-repeat bug — that's handled by the speak/mute guards above.
      if (wantListening.current) {
        try {
          rec.start();
        } catch {
          /* already started */
        }
      } else {
        setListening(false);
      }
    };
    recRef.current = rec;
    wantListening.current = true;
    try {
      rec.start();
      setListening(true);
    } catch {
      /* start may throw if already running */
    }
  }

  function stop() {
    wantListening.current = false;
    setListening(false);
    try {
      recRef.current?.stop();
    } catch {
      /* no-op */
    }
  }

  function toggle() {
    if (listening) stop();
    else start();
  }

  useEffect(() => {
    return () => {
      wantListening.current = false;
      try {
        recRef.current?.stop();
        window.speechSynthesis?.cancel();
      } catch {
        /* no-op */
      }
    };
  }, []);

  if (!supported) return null;

  return (
    <div className={"qctl-voice" + (dark ? " on-dark" : "")}>
      {(caption || confirm) && (
        <div className="qctl-voice-bubble" role="status" aria-live="polite">
          {caption && <div className="qctl-voice-heard">“{caption}”</div>}
          {confirm && <div className="qctl-voice-said">{confirm}</div>}
        </div>
      )}
      <button
        type="button"
        className={"qctl-voice-btn" + (listening ? " listening" : "")}
        onClick={toggle}
        aria-pressed={listening}
        title={listening ? "Stop voice control" : "Start voice control"}
        aria-label={listening ? "Stop voice control" : "Start voice control"}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <rect x="7.2" y="2.2" width="5.6" height="10" rx="2.8" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M4.5 9.2a5.5 5.5 0 0 0 11 0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M10 14.7v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span className="qctl-voice-label">{listening ? "Listening…" : "Voice"}</span>
      </button>
    </div>
  );
}
