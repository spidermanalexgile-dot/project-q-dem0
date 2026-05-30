import { useEffect, useRef, useState } from "react";
import { getState, setLever, setDemand, setDayType, setView } from "./state";
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

export function VoiceControl({ dark, onSetDark }: VoiceProps) {
  const supported = !!getRecognitionCtor();
  const [listening, setListening] = useState(false);
  const [caption, setCaption] = useState<string>("");
  const [confirm, setConfirm] = useState<string>("");
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const captionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wantListening = useRef(false);

  /** Speak a confirmation with the browser's speech synthesis. */
  function speak(text: string) {
    setConfirm(text);
    if (captionTimer.current) clearTimeout(captionTimer.current);
    captionTimer.current = setTimeout(() => setConfirm(""), 6000);
    try {
      const synth = window.speechSynthesis;
      if (!synth) return;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.05;
      u.pitch = 1;
      synth.speak(u);
    } catch {
      /* speech synthesis unavailable — caption still shows the confirmation */
    }
  }

  function handleTranscript(transcript: string) {
    setCaption(transcript);
    const reply = executeVoiceCommand(transcript, {
      getState,
      setLever,
      setDemand,
      setDayType,
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
      // ends on silence in some browsers).
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
