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
import { ask, type AnalystAction } from "./analyst";
import { LEVER_SPOKEN, spokenLeverValue, tryVoiceCommand } from "./voice";
import { speak, cancelSpeech } from "./speech";

type AssistantProps = {
  onSetDark: (dark: boolean) => void;
};

const SPEAK_KEY = "qctl-assistant-speak";

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
  return sentences.slice(0, 2).join(" ").trim();
}

type Msg =
  | { role: "user"; text: string }
  | { role: "agent"; text: string; action?: AnalystAction };

const SUGGESTIONS = [
  "Suggest lever settings for this day and explain",
  "Why is Feb 2nd's demand 139%?",
  "We only want 80% capacity today",
  "Cheapest way to add €3M to annual revenue?",
];

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
 * Project Q Assistant — the single unified surface for voice control AND the
 * analyst. You can type or speak; direct commands ("set base fee to 20", "we want
 * 80% capacity") are applied immediately, while questions ("why is…", "suggest…",
 * "cheapest way to…") are answered by the deterministic analyst. The same warm
 * voice reads replies aloud, and the mic is physically muted while it speaks.
 */
export function AssistantPanel({ onSetDark }: AssistantProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "agent",
      text:
        "I'm the Project Q assistant. Type or talk to me — give a command (\"set base fee to 20\", " +
        "\"we only want 80% capacity\"), ask a question (\"why is Feb 2nd's demand 139%?\"), or say " +
        "\"suggest lever settings for this day and explain\".",
    },
  ]);
  const [speakOn, setSpeakOn] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SPEAK_KEY) !== "off";
    } catch {
      return true;
    }
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const wantListening = useRef(false);
  const suspended = useRef(false); // mic OFF while we speak a reply
  const restartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHandled = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const speakOnRef = useRef(speakOn);
  speakOnRef.current = speakOn;
  const recSupported = !!getRecognitionCtor();

  useEffect(() => {
    try {
      localStorage.setItem(SPEAK_KEY, speakOn ? "on" : "off");
    } catch {
      /* no-op */
    }
    if (!speakOn) cancelSpeech();
  }, [speakOn]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, open]);

  // Cmd/Ctrl+J toggles the assistant.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "j" || e.key === "J")) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // Cleanup mic on unmount.
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

  function pushAgent(text: string, action?: AnalystAction, spokenText?: string) {
    setMsgs((m) => [...m, { role: "agent", text, action }]);
    if (speakOnRef.current) {
      // Mute the mic for the duration of the reply, then resume.
      suspended.current = true;
      try {
        recRef.current?.stop();
      } catch {
        /* no-op */
      }
      speak(spokenText ?? spokenSummary(text), resumeListening);
    }
  }

  /**
   * Route one utterance/typed line. Direct controls are applied via the voice
   * matcher (tryVoiceCommand); anything else goes to the analyst. Returns false
   * if nothing was recognized at all (used to stay silent on mic noise).
   */
  function route(text: string): boolean {
    const snap = getState();
    if (!snap) {
      pushAgent("No payload loaded yet.");
      return true;
    }
    // Questions / analysis ALWAYS go to the analyst, even if they mention a date
    // or lever (so "why is Feb 2nd's demand…" isn't read as a date command).
    const isQuestion = /\b(why|how|explain|suggest|recommend|propose|what|which|cheapest|best|should|tell me|break ?down)\b/.test(
      text.toLowerCase(),
    );
    if (!isQuestion) {
      const cmd = tryVoiceCommand(text, {
        getState, setLever, setDemand, setDayType, setDate, setView, setOccupancyTarget, setDark: onSetDark,
      });
      if (cmd.recognized) {
        pushAgent(cmd.reply);
        return true;
      }
    }
    const res = ask(text, snap);
    pushAgent(res.answer, res.action);
    return res.answer !== "Sorry, I didn't catch a command I recognize.";
  }

  function submit(text: string) {
    const q = text.trim();
    if (!q) return;
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setInput("");
    route(q);
  }

  function applyAction(action: AnalystAction, atIndex: number) {
    let note: string;
    if ("setLever" in action) {
      setLever(action.setLever.id, action.setLever.value);
      const v = getState()?.levers.find((l) => l.id === action.setLever.id)?.value;
      note = `✓ Applied — ${LEVER_SPOKEN[action.setLever.id]} set to ${spokenLeverValue(
        action.setLever.id,
        v ?? action.setLever.value,
      )}.`;
    } else {
      for (const r of action.setLevers) setLever(r.id, r.value);
      const parts = action.setLevers.map((r) => {
        const v = getState()?.levers.find((l) => l.id === r.id)?.value ?? r.value;
        return `${LEVER_SPOKEN[r.id]} ${spokenLeverValue(r.id, v)}`;
      });
      note = `✓ Applied — ${parts.join(", ")}.`;
    }
    setMsgs((m) => m.map((msg, i) => (i === atIndex ? { ...msg, action: undefined, text: msg.text + "\n\n" + note } : msg)));
    if (speakOnRef.current) speak("Done. Applied.");
  }

  /* ─── microphone ──────────────────────────────────────────────────────── */
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

  function handleTranscript(transcript: string) {
    if (suspended.current) return;
    const heard = transcript.toLowerCase().trim();
    const now = performance.now();
    if (heard === lastHandled.current.text && now - lastHandled.current.at < 2500) return;
    lastHandled.current = { text: heard, at: now };

    const snap = getState();
    if (!snap) return;
    // Questions go to the analyst; otherwise try a direct command. Stay silent on
    // background noise (a phone buzz) — only act on something understood.
    const isQuestion = /\b(why|how|explain|suggest|recommend|propose|what|which|cheapest|best|should|tell me|break ?down)\b/.test(
      transcript.toLowerCase(),
    );
    if (!isQuestion) {
      const cmd = tryVoiceCommand(transcript, {
        getState, setLever, setDemand, setDayType, setDate, setView, setOccupancyTarget, setDark: onSetDark,
      });
      if (cmd.recognized) {
        setMsgs((m) => [...m, { role: "user", text: transcript }]);
        pushAgent(cmd.reply);
        return;
      }
    }
    const res = ask(transcript, snap);
    if (res.answer === "Sorry, I didn't catch a command I recognize.") return; // noise
    setMsgs((m) => [...m, { role: "user", text: transcript }]);
    pushAgent(res.answer, res.action);
  }

  function startMic() {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const last = e.results[e.results.length - 1];
      const t = last && last[0] ? last[0].transcript : "";
      if (t) handleTranscript(t.trim());
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        wantListening.current = false;
        setListening(false);
        pushAgent("Microphone access was blocked. You can still type to me.");
      }
    };
    rec.onend = () => {
      if (suspended.current) return; // we're speaking; utterance onend resumes it
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
      /* already running */
    }
  }

  function stopMic() {
    wantListening.current = false;
    suspended.current = false;
    setListening(false);
    if (restartTimer.current) clearTimeout(restartTimer.current);
    try {
      recRef.current?.stop();
    } catch {
      /* no-op */
    }
  }

  function toggleMic() {
    if (listening) stopMic();
    else startMic();
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          className="qctl-analyst-fab"
          onClick={() => setOpen(true)}
          title="Project Q Assistant — talk or type  ·  ⌘/Ctrl+J"
          aria-label="Open assistant"
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path
              d="M10 2.5a6.2 6.2 0 0 0-5.2 9.6L3.6 16l3.9-1.1A6.2 6.2 0 1 0 10 2.5Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <circle cx="7.2" cy="9.4" r="0.9" fill="currentColor" />
            <circle cx="10" cy="9.4" r="0.9" fill="currentColor" />
            <circle cx="12.8" cy="9.4" r="0.9" fill="currentColor" />
          </svg>
          <span>Assistant</span>
        </button>
      )}

      {open && (
        <div className="qctl-analyst" role="dialog" aria-label="Project Q assistant">
          <header className="qctl-analyst-head">
            <div className="qctl-analyst-title">
              <span className={"qctl-analyst-dot" + (listening ? " live" : "")} /> Project Q Assistant
            </div>
            <div className="qctl-analyst-head-actions">
              <button
                type="button"
                className={"qctl-analyst-speak" + (speakOn ? " on" : "")}
                onClick={() => setSpeakOn((s) => !s)}
                title={speakOn ? "Mute spoken answers" : "Speak answers aloud"}
                aria-label={speakOn ? "Mute spoken answers" : "Speak answers aloud"}
                aria-pressed={speakOn}
              >
                <svg viewBox="0 0 18 18" aria-hidden="true">
                  <path d="M4 7H2.5v4H4l3.5 2.6V4.4L4 7Z" fill="currentColor" />
                  {speakOn ? (
                    <>
                      <path d="M10.5 6.2a3.2 3.2 0 0 1 0 5.6" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                      <path d="M12.3 4.3a5.8 5.8 0 0 1 0 9.4" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    </>
                  ) : (
                    <path d="M11 6.5l4 5M15 6.5l-4 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  )}
                </svg>
              </button>
              <button
                type="button"
                className="qctl-analyst-close"
                onClick={() => setOpen(false)}
                aria-label="Close assistant"
              >
                ✕
              </button>
            </div>
          </header>

          <div className="qctl-analyst-log" ref={scrollRef}>
            {msgs.map((m, i) => (
              <div key={i} className={"qctl-msg " + m.role}>
                <div className="qctl-msg-text">
                  {m.text.split("\n").map((line, j) => (
                    <span key={j}>
                      {line}
                      {j < m.text.split("\n").length - 1 && <br />}
                    </span>
                  ))}
                </div>
                {m.role === "agent" && m.action && (
                  <button className="qctl-msg-apply" onClick={() => applyAction(m.action!, i)}>
                    {"setLever" in m.action
                      ? `Apply: set ${LEVER_SPOKEN[m.action.setLever.id]} to ${spokenLeverValue(
                          m.action.setLever.id,
                          m.action.setLever.value,
                        )}`
                      : `Apply ${m.action.label}`}
                  </button>
                )}
              </div>
            ))}
          </div>

          {msgs.length <= 1 && (
            <div className="qctl-analyst-chips">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="qctl-chip" onClick={() => submit(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}

          <form
            className="qctl-analyst-input"
            onSubmit={(e) => {
              e.preventDefault();
              submit(input);
            }}
          >
            {recSupported && (
              <button
                type="button"
                className={"qctl-analyst-mic" + (listening ? " listening" : "")}
                onClick={toggleMic}
                aria-pressed={listening}
                title={listening ? "Stop listening" : "Talk to the assistant"}
                aria-label={listening ? "Stop listening" : "Talk to the assistant"}
              >
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <rect x="7.2" y="2.2" width="5.6" height="10" rx="2.8" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M4.5 9.2a5.5 5.5 0 0 0 11 0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <path d="M10 14.7v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            )}
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={listening ? "Listening… or type" : "Talk or type a command or question…"}
              aria-label="Talk or type to the assistant"
            />
            <button type="submit" aria-label="Send">
              ↑
            </button>
          </form>
        </div>
      )}
    </>
  );
}
