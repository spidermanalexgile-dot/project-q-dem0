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
  decisionById,
  FEE_BOUNDS,
  footfallPct,
  CROWDING_BOUNDS,
  SCENARIO_PRESETS,
  touristFeeBurden,
  VERDICT_THRESHOLDS,
  type Deliberation,
  type Scenario,
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
import { addTrailEntry, clearTrail, getTrail, getTrailVersion, subscribeTrail } from "./trail";
import "./equity.css";

const VERDICT_LABEL = { just: "treated justly", watch: "under watch", unjust: "treated unjustly" } as const;

function useEquity() {
  useSyncExternalStore(subscribe, getVersion);
  return { state: getEquityState(), result: getResult() };
}

/* ─── overall equity bar ────────────────────────────────────────────────── */

function EquityBar({
  index,
  mean,
  spread,
  scenario,
}: {
  index: number;
  mean: number;
  spread: number;
  scenario: Scenario;
}) {
  const foot = Math.round(footfallPct(scenario));
  const deterred = Math.max(0, scenario.crowding - foot);
  const burden = touristFeeBurden(scenario);
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
      <div className="qeq-stats">
        <span className="qeq-stat">
          footfall after fee <b>{foot}%</b>
          {deterred > 0 && <em> · {deterred} pts deterred = lost customers for vendors</em>}
        </span>
        {burden.map((b) => (
          <span key={b.id} className={`qeq-stat qeq-burden ${b.verdict}`}>
            {b.label}: fee = <b>{b.burdenPct}%</b> of a €{b.avgTripEUR} trip · <b>{b.verdict}</b>
            <em> · inequitable past €{b.inequitableAboveEUR}</em>
          </span>
        ))}
      </div>
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

function DeliberationPanel({ del, onClose }: { del: Deliberation | null; onClose: () => void }) {
  return (
    <section className="qeq-panel qeq-delib" aria-label="Circle of viewpoints">
      <div className="qeq-delib-head">
        <div>
          <h3>Circle of viewpoints</h3>
          <p className="qeq-delib-sub">
            {del ? del.decision.label : "Select a decision to weigh its justification — or ask Claude below."}
          </p>
        </div>
        {del && (
          <button className="qeq-close" onClick={onClose} aria-label="Close deliberation">
            ✕
          </button>
        )}
      </div>
      {del && (
        <>
          <div className="qeq-justification">
            <h4>Justification — the case for this decision</h4>
            <p>{del.decision.justification}</p>
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
                Equity index {del.fairForGroup.indexBefore} → <b>{del.fairForGroup.indexAfter}</b> (
                {del.fairForGroup.indexGain >= 0 ? "+" : ""}
                {del.fairForGroup.indexGain}) · worst-off {del.equitableForNeeds.worstOffBefore.score} →{" "}
                <b>{del.equitableForNeeds.worstOffAfter.score}</b> · spread {del.equitableForNeeds.spreadBefore} →{" "}
                {del.equitableForNeeds.spreadAfter}
              </p>
            </div>
          </div>
        </>
      )}
      <AdvisorDock />
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
                    const indexBefore = getResult().equityIndex;
                    toggleDecision(d.id);
                    addTrailEntry({
                      kind: "action",
                      text: `${on ? "Removed" : "Applied"}: ${decisionById(d.id)?.label ?? d.id} (manual toggle)`,
                      outcome: on ? "Decision withdrawn from the board." : "Decision enacted on the board.",
                      indexBefore,
                      indexAfter: getResult().equityIndex,
                    });
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
    const indexBefore = getResult().equityIndex;
    const reply = await advisorAsk(q);
    let answer: string;
    let brainUsed: "claude" | "engine";
    if (reply) {
      setBrain(true);
      answer = reply.answer;
      brainUsed = "claude";
    } else {
      setBrain(false);
      answer = fallbackAsk(q);
      brainUsed = "engine";
    }
    setLog((l) => [...l, { who: "advisor", text: answer, brain: brainUsed }]);
    // Every prompt lands in the reasoning trail: justification → outcome → index move.
    addTrailEntry({
      kind: "prompt",
      text: q,
      outcome: answer,
      indexBefore,
      indexAfter: getResult().equityIndex,
      brain: brainUsed,
    });
    setBusy(false);
  }

  return (
    <div className="qeq-advisor" aria-label="Ask Claude">
      <div className="qeq-advisor-head">
        <h4>Ask Claude</h4>
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
    </div>
  );
}

/* ─── reasoning trail ───────────────────────────────────────────────────── */

const KIND_LABEL = { justification: "design justification", prompt: "your prompt", action: "manual action" } as const;

function ReasoningTrail() {
  useSyncExternalStore(subscribeTrail, getTrailVersion);
  const [open, setOpen] = useState(true);
  const entries = getTrail();
  const sessionCount = entries.filter((e) => !e.seeded).length;

  return (
    <section className="qeq-panel qeq-trail" aria-label="Reasoning trail">
      <div className="qeq-trail-head">
        <h2>
          Reasoning trail <span className="qeq-trail-sub">justification → action → measured outcome</span>
        </h2>
        <div className="qeq-trail-actions">
          {sessionCount > 0 && (
            <button className="qeq-trail-btn" onClick={clearTrail}>
              clear session
            </button>
          )}
          <button className="qeq-trail-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {open ? "collapse" : `expand (${entries.length})`}
          </button>
        </div>
      </div>
      {open && (
        <div className="qeq-trail-list">
          {entries.map((e, i) => (
            <div key={i} className={`qeq-trail-entry ${e.kind}`}>
              <div className="qeq-trail-meta">
                <span className="qeq-trail-kind">{KIND_LABEL[e.kind]}</span>
                <span className="qeq-trail-ts">{e.ts.slice(0, 10)}</span>
                {e.brain && <span className={`qeq-trail-brain ${e.brain}`}>{e.brain === "claude" ? "Claude" : "engine"}</span>}
                {e.indexBefore !== undefined && e.indexAfter !== undefined && e.indexBefore !== e.indexAfter && (
                  <span className={`qeq-trail-idx ${e.indexAfter > e.indexBefore ? "up" : "down"}`}>
                    index {e.indexBefore} → {e.indexAfter}
                  </span>
                )}
              </div>
              <p className="qeq-trail-text">“{e.text}”</p>
              <p className="qeq-trail-outcome">→ {e.outcome}</p>
            </div>
          ))}
        </div>
      )}
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
          <EquityBar index={result.equityIndex} mean={result.mean} spread={result.spread} scenario={state.scenario} />
          <StakeholderChart scores={result.scores} worstOff={result.worstOff} />
          <DeliberationPanel del={del} onClose={() => setSelected(null)} />
        </div>
        <div className="qeq-right">
          <DecisionRail
            applied={state.applied}
            selected={selected}
            onSelect={(id) => setSelected((cur) => (cur === id ? null : id))}
          />
        </div>
      </main>
      <ReasoningTrail />
    </div>
  );
}
