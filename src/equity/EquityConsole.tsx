/**
 * Project Q · Equity Console — /equity
 *
 * Dark-glass board for the dynamic sustainability fee. One clear horizontal
 * bar chart (one bar per stakeholder), an overall equity bar that moves as
 * decisions are applied, a decision rail, the Circle-of-Viewpoints
 * deliberation panel, and the advisor dock (Claude brain via /api/agent,
 * deterministic fallback otherwise). All numbers come from engine.ts.
 */

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  DECISIONS,
  deliberate,
  FEE_BOUNDS,
  CROWDING_BOUNDS,
  SCENARIO_PRESETS,
  VERDICT_THRESHOLDS,
  type Deliberation,
  type StakeholderScore,
} from "./engine";
import {
  getEquityState,
  getResult,
  getVersion,
  setPreset,
  setScenario,
  subscribe,
  toggleDecision,
} from "./store";
import { advisorAsk, probeBrain } from "./agent";
import { fallbackAsk } from "./fallback";
import "./equity.css";

const VERDICT_LABEL = { just: "treated justly", watch: "under watch", unjust: "treated unjustly" } as const;

function useEquity() {
  useSyncExternalStore(subscribe, getVersion);
  return { state: getEquityState(), result: getResult() };
}

/* ─── overall equity bar ────────────────────────────────────────────────── */

function EquityBar({ index, mean, spread }: { index: number; mean: number; spread: number }) {
  return (
    <section className="qeq-panel qeq-hero" aria-label="Overall equity">
      <div className="qeq-hero-head">
        <h2>Equity index</h2>
        <div className="qeq-hero-num" aria-live="polite">
          {index}
          <span className="qeq-hero-denom">/100</span>
        </div>
      </div>
      <div className="qeq-meter" role="meter" aria-valuenow={index} aria-valuemin={0} aria-valuemax={100}>
        <div className="qeq-meter-fill" style={{ width: `${index}%` }} />
        <div className="qeq-meter-tick" style={{ left: `${VERDICT_THRESHOLDS.watch}%` }} />
        <div className="qeq-meter-tick" style={{ left: `${VERDICT_THRESHOLDS.just}%` }} />
      </div>
      <p className="qeq-hero-caption">
        mean {mean} − spread penalty ({spread}) · helping one group at everyone else's expense drags this down
      </p>
    </section>
  );
}

/* ─── stakeholder bar chart ─────────────────────────────────────────────── */

function StakeholderChart({
  scores,
  worstOff,
}: {
  scores: StakeholderScore[];
  worstOff: string;
}) {
  return (
    <section className="qeq-panel qeq-chart" aria-label="Stakeholder equity chart">
      <div className="qeq-chart-head">
        <h2>Who's being treated justly</h2>
        <div className="qeq-legend">
          <span className="qeq-dot just" /> just ≥{VERDICT_THRESHOLDS.just}
          <span className="qeq-dot watch" /> watch
          <span className="qeq-dot unjust" /> unjust &lt;{VERDICT_THRESHOLDS.watch}
        </div>
      </div>
      <div className="qeq-rows">
        {scores.map((s) => (
          <div key={s.id} className={`qeq-row${s.id === worstOff ? " worst" : ""}`}>
            <div className="qeq-row-label" title={s.note}>
              {s.label}
              {s.id === worstOff && <span className="qeq-worst-chip">worst off</span>}
            </div>
            <div className="qeq-track">
              <div className={`qeq-bar ${s.verdict}`} style={{ width: `${s.score}%` }} />
              {/* baseline tick — where this group sat before any decisions */}
              <div className="qeq-base-tick" style={{ left: `${s.baseline}%` }} title={`baseline ${s.baseline}`} />
            </div>
            <div className="qeq-row-num">
              <span className="qeq-score">{s.score}</span>
              <span className={`qeq-delta ${s.delta > 0 ? "up" : s.delta < 0 ? "down" : ""}`}>
                {s.delta > 0 ? `+${s.delta}` : s.delta < 0 ? `${s.delta}` : "·"}
              </span>
            </div>
            <span className={`qeq-pill ${s.verdict}`}>{VERDICT_LABEL[s.verdict]}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── circle of viewpoints panel ────────────────────────────────────────── */

function DeliberationPanel({ del, onClose }: { del: Deliberation; onClose: () => void }) {
  const fg = del.fairForGroup;
  const eq = del.equitableForNeeds;
  return (
    <section className="qeq-panel qeq-delib" aria-label="Circle of viewpoints">
      <div className="qeq-delib-head">
        <div>
          <h3>Circle of viewpoints</h3>
          <p className="qeq-delib-sub">{del.decision.label}</p>
        </div>
        <button className="qeq-close" onClick={onClose} aria-label="Close deliberation">
          ✕
        </button>
      </div>
      <div className="qeq-delib-grid">
        <div className="qeq-delib-cell">
          <h4>Who might agree, and why</h4>
          {del.agrees.length === 0 && <p className="qeq-mute">No group gains under the live fee.</p>}
          {del.agrees.map((a) => (
            <p key={a.id}>
              <b>{a.label}</b> <span className="qeq-delta up">+{a.delta}</span>
            </p>
          ))}
        </div>
        <div className="qeq-delib-cell">
          <h4>Who might be concerned, and why</h4>
          {del.concerned.length === 0 && <p className="qeq-mute">No group gives anything up.</p>}
          {del.concerned.map((c) => (
            <p key={c.id}>
              <b>{c.label}</b> <span className="qeq-delta down">{c.delta}</span>
            </p>
          ))}
        </div>
        <div className="qeq-delib-cell">
          <h4>Whose voice is in the room</h4>
          <p>{del.voicesIncluded.join(" · ")}</p>
          <h4 className="qeq-gap">Whose voice might be missing</h4>
          <p className="qeq-missing">{del.voicesMissing.join(" · ")}</p>
        </div>
        <div className="qeq-delib-cell">
          <h4>Same treatment, or different needs?</h4>
          <p>{del.treatmentNote}</p>
          <h4 className="qeq-gap">Evidence this is fair &amp; thoughtful</h4>
          <p>
            Equity index {fg.indexBefore} → <b>{fg.indexAfter}</b> ({fg.indexGain >= 0 ? "+" : ""}
            {fg.indexGain}) · worst-off {eq.worstOffBefore.score} → <b>{eq.worstOffAfter.score}</b> · spread {eq.spreadBefore} → {eq.spreadAfter}
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─── decision rail ─────────────────────────────────────────────────────── */

function DecisionRail({
  applied,
  selected,
  onSelect,
}: {
  applied: string[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="qeq-panel qeq-decisions" aria-label="Policy decisions">
      <h2>Decisions</h2>
      <p className="qeq-rail-sub">Toggle to apply · click a card to deliberate</p>
      <div className="qeq-decision-list">
        {DECISIONS.map((d) => {
          const on = applied.includes(d.id);
          return (
            <div
              key={d.id}
              className={`qeq-card${on ? " on" : ""}${selected === d.id ? " sel" : ""}`}
              onClick={() => onSelect(d.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSelect(d.id);
              }}
            >
              <div className="qeq-card-top">
                <span className="qeq-card-label">{d.label}</span>
                <button
                  className={`qeq-toggle${on ? " on" : ""}`}
                  aria-pressed={on}
                  aria-label={`${on ? "Remove" : "Apply"}: ${d.label}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleDecision(d.id);
                  }}
                >
                  <span className="qeq-knob" />
                </button>
              </div>
              <p className="qeq-card-detail">{d.detail}</p>
              <span className={`qeq-treatment ${d.treatment}`}>
                {d.treatment === "needs_based" ? "responds to needs" : "same rule for all"}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ─── advisor dock ──────────────────────────────────────────────────────── */

type ChatMsg = { who: "you" | "advisor"; text: string; brain: "claude" | "engine" };

function AdvisorDock() {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [brain, setBrain] = useState<boolean | null>(null);
  const [log, setLog] = useState<ChatMsg[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    probeBrain().then(setBrain);
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [log]);

  async function send() {
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    setLog((l) => [...l, { who: "you", text: q, brain: "engine" }]);
    setBusy(true);
    const reply = await advisorAsk(q);
    if (reply) {
      setBrain(true);
      setLog((l) => [...l, { who: "advisor", text: reply.answer, brain: "claude" }]);
    } else {
      setBrain(false);
      setLog((l) => [...l, { who: "advisor", text: fallbackAsk(q), brain: "engine" }]);
    }
    setBusy(false);
  }

  return (
    <section className="qeq-panel qeq-advisor" aria-label="Equity advisor">
      <div className="qeq-advisor-head">
        <h2>Equity advisor</h2>
        <span className={`qeq-brain ${brain ? "live" : "det"}`}>
          {brain === null ? "…" : brain ? "Claude reasoning" : "deterministic engine"}
        </span>
      </div>
      <div className="qeq-chat" ref={logRef}>
        {log.length === 0 && (
          <p className="qeq-mute qeq-chat-hint">
            Try: "we won't charge vendors who commute every day" · "who's worst off and what should we do?" · "switch to low season"
          </p>
        )}
        {log.map((m, i) => (
          <div key={i} className={`qeq-msg ${m.who}`}>
            {m.text}
          </div>
        ))}
        {busy && <div className="qeq-msg advisor qeq-thinking">deliberating…</div>}
      </div>
      <div className="qeq-chat-input">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
          placeholder="Propose a decision or ask who's treated unjustly…"
          aria-label="Ask the equity advisor"
        />
        <button onClick={send} disabled={busy || !input.trim()}>
          Ask
        </button>
      </div>
    </section>
  );
}

/* ─── top bar / scenario controls ───────────────────────────────────────── */

function ScenarioBar() {
  const { state } = useEquity();
  const s = state.scenario;
  return (
    <header className="qeq-topbar">
      <div className="qeq-brand">
        <span className="qeq-mark" />
        <div>
          <div className="qeq-brand-name">Project Q</div>
          <div className="qeq-brand-sub">Equity Console</div>
        </div>
      </div>
      <div className="qeq-presets" role="tablist" aria-label="Scenario presets">
        {SCENARIO_PRESETS.map((p) => (
          <button
            key={p.id}
            role="tab"
            aria-selected={state.presetId === p.id}
            className={`qeq-preset${state.presetId === p.id ? " on" : ""}`}
            onClick={() => setPreset(p.id)}
            title={p.tagline}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="qeq-sliders">
        <label>
          <span>
            Fee <b className={s.feeEUR < 0 ? "qeq-credit" : ""}>{s.feeEUR < 0 ? `−€${-s.feeEUR}` : `€${s.feeEUR}`}</b>
            {s.feeEUR < 0 && <em className="qeq-credit-note"> city pays visitors</em>}
          </span>
          <input
            type="range"
            min={FEE_BOUNDS.min}
            max={FEE_BOUNDS.max}
            value={s.feeEUR}
            onChange={(e) => setScenario({ feeEUR: Number(e.target.value) })}
            aria-label="Sustainability fee in euros"
          />
        </label>
        <label>
          <span>
            Crowding <b className={s.crowding > 100 ? "qeq-breach" : ""}>{s.crowding}%</b>
            {s.crowding > 100 && <em className="qeq-breach-note"> capacity breached</em>}
          </span>
          <input
            type="range"
            min={CROWDING_BOUNDS.min}
            max={CROWDING_BOUNDS.max}
            value={s.crowding}
            onChange={(e) => setScenario({ crowding: Number(e.target.value) })}
            aria-label="Crowding as percent of capacity"
          />
        </label>
      </div>
    </header>
  );
}

/* ─── page ──────────────────────────────────────────────────────────────── */

export function EquityConsole() {
  const { state, result } = useEquity();
  const [selected, setSelected] = useState<string | null>(null);

  const del = useMemo(() => {
    if (!selected) return null;
    const d = deliberate(selected, state.scenario, state.applied);
    return "error" in d ? null : d;
    // recompute when anything moves so the evidence stays live
  }, [selected, state.scenario, state.applied]);

  return (
    <div className="qeq-root">
      <ScenarioBar />
      <main className="qeq-main">
        <div className="qeq-left">
          <EquityBar index={result.equityIndex} mean={result.mean} spread={result.spread} />
          <StakeholderChart scores={result.scores} worstOff={result.worstOff} />
          {del && <DeliberationPanel del={del} onClose={() => setSelected(null)} />}
        </div>
        <div className="qeq-right">
          <DecisionRail
            applied={state.applied}
            selected={selected}
            onSelect={(id) => setSelected((cur) => (cur === id ? null : id))}
          />
          <AdvisorDock />
        </div>
      </main>
    </div>
  );
}
