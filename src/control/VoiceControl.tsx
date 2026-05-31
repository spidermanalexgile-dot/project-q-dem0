import { useEffect, useRef, useState } from "react";
import { getState, setLever, setDemand, setDayType, setDate, setView, setOccupancyTarget } from "./state";
import { tryVoiceCommand } from "./voice";

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
 * Pick a WARM, NATURAL female English voice. Priority order favours modern
 * neural/premium voices that sound human (Apple "Siri"/premium, Microsoft Natural,
 * Google) over the old robotic ones. We also explicitly avoid the harsh/tinny
 * legacy voices (Zira, eSpeak, "Compact", Albert/Bad-News novelty voices).
 */
const PREFERRED_VOICES = [
  // Apple premium / Siri (very natural)
  "samantha", "siri", "ava", "allison", "susan", "zoe", "nicky", "joelle",
  // Microsoft neural
  "aria natural", "jenny natural", "michelle natural", "ana natural",
  "sonia natural", "libby natural", "aria", "jenny", "michelle",
  // Google
  "google uk english female", "google us english",
  // Other pleasant female voices
  "serena", "kate", "stephanie", "fiona", "tessa", "karen", "moira", "victoria",
];
// Harsh / robotic / novelty voices to skip even if nothing else matches.
const HARSH_VOICES =
  /zira|espeak|compact|albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|hysterical|pipe organ|trinoids|whisper|wobble|zarvox|superstar|novelty|eloquence/i;

function pickFemaleVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const en = voices.filter((v) => /^en(-|_|$)/i.test(v.lang) || /english/i.test(v.name));
  const pool = (en.length ? en : voices).filter((v) => !HARSH_VOICES.test(v.name));
  const usable = pool.length ? pool : voices;
  // 1. Named warm/natural female voices, in priority order.
  for (const want of PREFERRED_VOICES) {
    const hit = usable.find((v) => v.name.toLowerCase().includes(want));
    if (hit) return hit;
  }
  // 2. A voice that advertises "natural" (neural) and isn't male.
  const natural = usable.find(
    (v) => /natural|neural|premium|enhanced/i.test(v.name) && !/male/i.test(v.name.replace(/female/i, "")),
  );
  if (natural) return natural;
  // 3. Anything explicitly female.
  const female = usable.find((v) => /female|woman/i.test(v.name));
  if (female) return female;
  // 4. Avoid obviously male voices; otherwise first usable voice.
  const notMale = usable.find(
    (v) => !/\bmale\b|david|daniel|alex|fred|george|james|mark|thomas|oliver|arthur/i.test(v.name),
  );
  return notMale || usable[0] || null;
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
  // While true the mic is deliberately OFF (we're speaking a reply). The
  // recognition onend handler must NOT auto-restart during this window — the
  // utterance's own onend restarts it. This is what makes the assistant
  // physically deaf while it talks, so it can never hear and repeat itself.
  const suspended = useRef(false);
  const restartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Dedupe: ignore an identical transcript fired again within a short cooldown
  // (some browsers deliver the same final result more than once).
  const lastHandled = useRef<{ text: string; at: number }>({ text: "", at: 0 });

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

  /** Turn the mic back on after we've finished speaking (if still wanted). */
  function resumeListening() {
    if (restartTimer.current) clearTimeout(restartTimer.current);
    restartTimer.current = setTimeout(() => {
      suspended.current = false;
      if (wantListening.current) {
        try {
          recRef.current?.start();
        } catch {
          /* already running */
        }
      }
    }, 350);
  }

  /**
   * Speak a confirmation ONCE. The microphone is fully stopped before speaking
   * and only restarted after the utterance ends — so the assistant is physically
   * deaf while it talks and cannot hear (and repeat) its own words. A hard
   * fallback timer guarantees the mic resumes even if onend never fires.
   */
  function speak(text: string) {
    setConfirm(text);
    if (captionTimer.current) clearTimeout(captionTimer.current);
    captionTimer.current = setTimeout(() => setConfirm(""), 6000);

    // Stop listening for the whole duration of the reply.
    suspended.current = true;
    try {
      recRef.current?.stop();
    } catch {
      /* no-op */
    }

    try {
      const synth = window.speechSynthesis;
      if (!synth) {
        resumeListening();
        return;
      }
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (voiceRef.current) u.voice = voiceRef.current;
      // Warm + natural: gentle pace, near-neutral pitch (high pitch sounds harsh
      // & tinny on legacy voices), eased volume.
      u.rate = 0.95;
      u.pitch = 1.05;
      u.volume = 0.85;
      u.onend = () => resumeListening();
      u.onerror = () => resumeListening();
      synth.speak(u);
      // Safety net: estimate speech length (~12 chars/sec) and force-resume if
      // onend is dropped (happens on some browsers when the tab is busy).
      const est = Math.min(8000, 1200 + text.length * 80);
      if (restartTimer.current) clearTimeout(restartTimer.current);
      restartTimer.current = setTimeout(() => {
        suspended.current = false;
        if (wantListening.current) {
          try {
            recRef.current?.start();
          } catch {
            /* already running */
          }
        }
      }, est);
    } catch {
      resumeListening();
    }
  }

  function handleTranscript(transcript: string) {
    // Ignore anything heard while the mic is meant to be off (belt & braces on
    // top of physically stopping it).
    if (suspended.current) return;

    const heard = transcript.toLowerCase().trim();
    // Dedupe identical results fired twice in quick succession.
    const now = performance.now();
    if (heard === lastHandled.current.text && now - lastHandled.current.at < 2500) return;
    lastHandled.current = { text: heard, at: now };

    const { recognized, reply } = tryVoiceCommand(transcript, {
      getState,
      setLever,
      setDemand,
      setDayType,
      setDate,
      setView,
      setOccupancyTarget,
      setDark: onSetDark,
    });

    // Only react to ACTUAL commands. Random noise (a phone buzz, background
    // chatter) gets transcribed too — staying silent on it keeps the assistant
    // calm instead of saying "sorry, didn't catch that" at every sound.
    if (!recognized) return;

    setCaption(transcript);
    speak(reply); // speaks exactly once; mic is off until it finishes
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
      // While suspended (we're speaking a reply) do NOT auto-restart — the
      // utterance's onend resumes the mic once it's done talking. This is the
      // crux of the no-repeat fix: the mic stays off for the whole reply.
      if (suspended.current) return;
      // Otherwise keep listening across the silence-driven onend (continuity).
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
    suspended.current = false;
    setListening(false);
    if (restartTimer.current) clearTimeout(restartTimer.current);
    try {
      recRef.current?.stop();
      window.speechSynthesis?.cancel();
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
      if (restartTimer.current) clearTimeout(restartTimer.current);
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
