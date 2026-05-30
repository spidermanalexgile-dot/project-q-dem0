import { useEffect, useRef, useState } from "react";
import { getState, setLever } from "./state";
import { ask, type AnalystAction } from "./analyst";
import { LEVER_SPOKEN, spokenLeverValue } from "./voice";

type Msg =
  | { role: "user"; text: string }
  | { role: "agent"; text: string; action?: AnalystAction };

const SUGGESTIONS = [
  "Why is Feb 2nd's demand 139%?",
  "Raise January revenue by €3M via the base fee",
  "Why is the fee on August 1st?",
  "What's annual revenue right now?",
];

export function AnalystPanel() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "agent",
      text:
        "I'm the Project Q analyst. Ask me why a day's demand or fee is what it is, " +
        "or set a revenue goal and I'll solve which lever to move.",
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, open]);

  // Cmd/Ctrl+J toggles the analyst.
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

  function submit(text: string) {
    const q = text.trim();
    if (!q) return;
    const snap = getState();
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setInput("");
    if (!snap) {
      setMsgs((m) => [...m, { role: "agent", text: "No payload loaded yet." }]);
      return;
    }
    const res = ask(q, snap);
    setMsgs((m) => [...m, { role: "agent", text: res.answer, action: res.action }]);
  }

  function applyAction(action: AnalystAction, atIndex: number) {
    setLever(action.setLever.id, action.setLever.value);
    const applied = getState()?.levers.find((l) => l.id === action.setLever.id)?.value;
    setMsgs((m) =>
      m.map((msg, i) =>
        i === atIndex
          ? {
              ...msg,
              action: undefined,
              text:
                msg.text +
                `\n\n✓ Applied — ${LEVER_SPOKEN[action.setLever.id]} set to ${spokenLeverValue(
                  action.setLever.id,
                  applied ?? action.setLever.value,
                )}.`,
            }
          : msg,
      ),
    );
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          className="qctl-analyst-fab"
          onClick={() => setOpen(true)}
          title="Ask the analyst  ·  ⌘/Ctrl+J"
          aria-label="Open analyst"
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
          <span>Analyst</span>
        </button>
      )}

      {open && (
        <div className="qctl-analyst" role="dialog" aria-label="Project Q analyst">
          <header className="qctl-analyst-head">
            <div className="qctl-analyst-title">
              <span className="qctl-analyst-dot" /> Project Q Analyst
            </div>
            <button
              type="button"
              className="qctl-analyst-close"
              onClick={() => setOpen(false)}
              aria-label="Close analyst"
            >
              ✕
            </button>
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
                    Apply: set {LEVER_SPOKEN[m.action.setLever.id]} to{" "}
                    {spokenLeverValue(m.action.setLever.id, m.action.setLever.value)}
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
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask why, or set a revenue goal…"
              aria-label="Ask the analyst"
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
