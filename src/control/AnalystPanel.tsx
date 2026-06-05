import { useEffect, useRef, useState } from "react";
import {
  getState,
  setLever,
  setDemand,
  setDayType,
  setDate,
  setView,
  setOccupancyTarget,
} from "./state";
import { ask } from "./analyst";
import { tryVoiceCommand } from "./voice";
import { agentAsk, probeBrain } from "./agent";
import { speak, cancelSpeech, usingPremiumVoice } from "./speech";

type AssistantProps = {
  onSetDark: (dark: boolean) => void;
  /** Render the mic inline (e.g. in the TopBar) instead of as a floating dock. */
  inline?: boolean;
};

/** Condense an answer to a sentence or two for speaking aloud. */
function spokenSummary(text: string): string {
  const cleaned = text
    .split("\n")
    .filter((l) => !l.trim().startsWith("•") && !l.trim().startsWith("✓"))
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/Apply (it|the cheapest|these settings)\?/i, "")
    .replace(/[€]/g, "")
    .trim();
  const sentences = cleaned.match(/[^.!?]+[.!?]+/g) || [cleaned];
  return sentences.slice(0, 3).join(" ").trim();
}

const QUESTION_RE =
  /\b(why|how|explain|suggest|recommend|propose|what|which|cheapest|best|should|tell me|break ?down)\b/;

/**
 * Wake phrase. The assistant is ALWAYS listening but only acts when addressed as
 * "Hey Q, …". Speech recognisers transcribe the "Q" many ways (queue, cue, kew…),
 * so we accept the common mishears; "you" is deliberately excluded to avoid
 * firing on everyday "hey you" / "hi you" speech.
 */
const WAKE_RE =
  /\b(?:hey|hi|hello|ok|okay)[\s,]+(?:q|queue|cue|kew|kyu|cute|qew|kue|quu|qu)\b[\s,.:!?-]*/i;

/** If `transcript` is addressed to Q, return the command after the wake phrase
 *  ("" when it's just "Hey Q"). Returns null when not addressed to Q. */
function afterWake(transcript: string): string | null {
  const m = WAKE_RE.exec(transcript);
  if (!m) return null;
  return transcript.slice(m.index + m[0].length).trim();
}

/* ─── Web Speech API typing ─────────────────────────────────────────────── */
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

/**
 * Project Q voice assistant — runs in the BACKGROUND, voice only. A small mic
 * button (out of the way, bottom-left) toggles listening; from then on you just
 * talk. Direct commands are applied; questions are answered by the deterministic
 * analyst. Everything comes back AUDIBLY — there's no chat log or text box, just
 * a compact status pill showing what it heard / said and any lever it changed.
 */
export function AssistantPanel({ onSetDark, inline }: AssistantProps) {
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [said, setSaid] = useState("");
  const [premium, setPremium] = useState(false);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const wantListening = useRef(false);
  const suspended = useRef(false); // mic OFF while we speak a reply
  const processing = useRef(false); // a request is mid-flight (brain round-trip)
  const restartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHandled = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const recSupported = !!getRecognitionCtor();

  useEffect(() => {
    setPremium(usingPremiumVoice());
  }, [listening]);

  // Warm the Claude-brain availability flag once, so the first question doesn't
  // pay a probe round-trip (and the deterministic fallback engages instantly if
  // the proxy isn't configured).
  useEffect(() => {
    void probeBrain();
  }, []);

  // Cmd/Ctrl+J toggles listening.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "j" || e.key === "J")) {
        e.preventDefault();
        toggle();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening]);

  useEffect(() => {
    return () => {
      wantListening.current = false;
      if (restartTimer.current) clearTimeout(restartTimer.current);
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
      try {
        recRef.current?.stop();
        cancelSpeech();
      } catch {
        /* no-op */
      }
    };
  }, []);

  // Always-on: begin listening as soon as the assistant mounts. The very first
  // load may need one mic-permission grant (browser policy); once granted it
  // stays live and auto-restarts. Tap the orb to mute.
  useEffect(() => {
    if (!recSupported) return;
    const t = setTimeout(() => {
      if (!wantListening.current) start();
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function flashSaid(text: string) {
    setSaid(text);
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    fadeTimer.current = setTimeout(() => setSaid(""), 7000);
  }

  /** Speak a reply once; mic is muted for its whole duration, then resumes. */
  function respond(text: string) {
    flashSaid(text);
    suspended.current = true;
    try {
      recRef.current?.stop();
    } catch {
      /* no-op */
    }
    speak(spokenSummary(text), resumeListening);
  }

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

  async function handleTranscript(transcript: string) {
    if (suspended.current || processing.current) return;

    // Always-on, but only respond when addressed with the wake phrase "Hey Q, …".
    // Everything else (background talk, the pitch itself) is ignored — and never
    // sent to the brain, so there's no spurious cost on un-addressed speech.
    const command = afterWake(transcript);
    if (command == null) return;

    const h = command.toLowerCase().trim();
    const now = performance.now();
    if (h && h === lastHandled.current.text && now - lastHandled.current.at < 2500) return;
    lastHandled.current = { text: h, at: now };

    const snap = getState();
    if (!snap) return;
    setHeard(transcript);

    // "Hey Q" with nothing after it → a quick acknowledgement.
    if (!h) {
      respond("Yes?");
      return;
    }

    processing.current = true;
    try {
      // 1) The Claude brain — understands free-form requests, calls the
      //    deterministic tools (which do all the math + apply changes), phrases
      //    the reply. Returns null when the proxy isn't configured / is offline.
      const brain = await agentAsk(command, { setDark: onSetDark });
      if (brain) {
        respond(brain.answer);
        return;
      }

      // 2) Deterministic fallback (no API key / offline): keyword command, else
      //    the rule-based analyst. Auto-apply a suggested change.
      if (!QUESTION_RE.test(h)) {
        const cmd = tryVoiceCommand(command, {
          getState, setLever, setDemand, setDayType, setDate, setView, setOccupancyTarget, setDark: onSetDark,
        });
        if (cmd.recognized) {
          respond(cmd.reply);
          return;
        }
      }
      const res = ask(command, snap);
      // The user explicitly addressed Q, so always reply (even if unrecognised).
      respond(
        res.answer === "Sorry, I didn't catch a command I recognize."
          ? "Sorry, I didn't catch that — try again?"
          : res.answer,
      );
      if (res.action) {
        if ("setLever" in res.action) setLever(res.action.setLever.id, res.action.setLever.value);
        else for (const r of res.action.setLevers) setLever(r.id, r.value);
      }
    } finally {
      processing.current = false;
    }
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
      const t = last && last[0] ? last[0].transcript : "";
      if (t) void handleTranscript(t.trim());
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        // Silent — the orb just shows "off"; the operator taps it to grant the
        // mic (avoids announcing a block on every auto-start before permission).
        wantListening.current = false;
        setListening(false);
      }
    };
    rec.onend = () => {
      if (suspended.current) return; // speaking; utterance onend resumes the mic
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
      // No greeting box on start — the pulsing orb is the only "I'm listening"
      // signal; the status pill only appears once there's something to show.
    } catch {
      /* already running */
    }
  }

  function stop() {
    wantListening.current = false;
    suspended.current = false;
    setListening(false);
    if (restartTimer.current) clearTimeout(restartTimer.current);
    try {
      recRef.current?.stop();
      cancelSpeech();
    } catch {
      /* no-op */
    }
  }

  function toggle() {
    if (listening) stop();
    else start();
  }

  if (!recSupported) return null;

  return (
    <div className={"qctl-assistant-dock" + (inline ? " inline" : "")}>
      {(heard || said) && (
        <div className="qctl-assistant-status" role="status" aria-live="polite">
          {heard && <div className="qctl-assistant-heard">“{heard}”</div>}
          {said && <div className="qctl-assistant-said">{said}</div>}
        </div>
      )}
      <button
        type="button"
        className={"qctl-assistant-orb" + (listening ? " listening" : "")}
        onClick={toggle}
        aria-pressed={listening}
        title={
          (listening ? 'Listening for "Hey Q…" — tap to mute' : "Tap to enable always-on voice") +
          "  ·  ⌘/Ctrl+J" +
          (premium ? "  ·  premium voice" : "")
        }
        aria-label={listening ? "Mute the voice assistant" : "Enable the voice assistant"}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <rect x="7.2" y="2.2" width="5.6" height="10" rx="2.8" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M4.5 9.2a5.5 5.5 0 0 0 11 0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M10 14.7v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        {listening && <span className="qctl-assistant-ring" aria-hidden="true" />}
      </button>
    </div>
  );
}
