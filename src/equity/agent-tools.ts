/**
 * Equity advisor — deterministic tool surface.
 *
 * Same contract as src/control/agent-tools.ts: Claude picks the tool, the
 * engine does the math, the model narrates the result. No tool ever returns
 * a number the engine didn't compute.
 */

import {
  DECISIONS,
  deliberate,
  footfallPct,
  rankDecisions,
  SCENARIO_PRESETS,
  STAKEHOLDERS,
  touristFeeBurden,
  type ScenarioPresetId,
  type StakeholderId,
} from "./engine";
import {
  applyDecision,
  getEquityState,
  getResult,
  removeDecision,
  setPreset,
  setScenario,
} from "./store";

const STAKEHOLDER_IDS = STAKEHOLDERS.map((s) => s.id);
const DECISION_IDS = DECISIONS.map((d) => d.id);

export const EQUITY_TOOLS = [
  {
    name: "get_equity_state",
    description:
      "Read the live equity board: scenario (fee €, forecast crowding %), footfall after the fee's deterrence, deterred share, the tourist fee-burden verdicts (fee as % of trip cost, with the € thresholds where it turns heavy-burden/regressive), applied decisions, every stakeholder's score/verdict/delta, the overall equity index, and who is worst off.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "list_decisions",
    description:
      "List the full policy decision catalog with per-stakeholder deltas, whether each treats groups uniformly or responds to different needs, and whose voices shaped it.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "deliberate_decision",
    description:
      "Run the fairness routine (Circle of Viewpoints) for ONE decision against the live state: who is affected, who agrees and why, who is concerned and why, whose voice is included/missing, whether it treats people the same or responds to needs, the equity-index and worst-off movement, and exact before/after evidence. ALWAYS call this before recommending, applying, or judging a decision.",
    input_schema: {
      type: "object",
      properties: { id: { type: "string", enum: DECISION_IDS, description: "Decision id" } },
      required: ["id"],
    },
  },
  {
    name: "apply_decision",
    description: "Apply a decision to the live board (the bars move). Use after deliberating, when the user wants it enacted.",
    input_schema: {
      type: "object",
      properties: { id: { type: "string", enum: DECISION_IDS } },
      required: ["id"],
    },
  },
  {
    name: "remove_decision",
    description: "Remove a previously applied decision from the live board.",
    input_schema: {
      type: "object",
      properties: { id: { type: "string", enum: DECISION_IDS } },
      required: ["id"],
    },
  },
  {
    name: "set_scenario",
    description:
      "Change the fee scenario. Pass a preset (surge | high | balanced | low) OR explicit feeEUR (−20…300, negative = the city pays visitors) and/or crowding (0…200 % of capacity).",
    input_schema: {
      type: "object",
      properties: {
        preset: { type: "string", enum: SCENARIO_PRESETS.map((p) => p.id) },
        feeEUR: { type: "number" },
        crowding: { type: "number" },
      },
      required: [],
    },
  },
  {
    name: "suggest_decisions",
    description:
      "Rank the not-yet-applied decisions by how much they lift a target: a specific stakeholder id, 'worst_off' (whoever currently scores lowest), or 'equity_index' (the overall bar). Returns each candidate's gain for the target and the resulting index.",
    input_schema: {
      type: "object",
      properties: {
        target: {
          type: "string",
          enum: [...STAKEHOLDER_IDS, "worst_off", "equity_index"],
        },
      },
      required: ["target"],
    },
  },
];

export function stateSummary(): string {
  const st = getEquityState();
  const r = getResult();
  const foot = Math.round(footfallPct(st.scenario));
  const burden = touristFeeBurden(st.scenario)
    .map((b) => `${b.label}: fee is ${b.burdenPct}% of a €${b.avgTripEUR} trip (${b.verdict}; heavy-burden past €${b.inequitableAboveEUR}, regressive past €${b.regressiveAboveEUR})`)
    .join("; ");
  const lines = r.scores.map((x) => `${x.id}=${x.score}(${x.verdict})`).join(", ");
  return [
    `Scenario: fee €${st.scenario.feeEUR}/visitor (negative = city pays visitors), forecast crowding ${st.scenario.crowding}% of capacity${st.presetId ? ` [preset: ${st.presetId}]` : ""}.`,
    `Footfall after the fee's deterrence: ${foot}% (${Math.max(0, st.scenario.crowding - foot)} pts of crowd deterred — those are lost customers for vendors and shops).`,
    `Tourist fee-burden: ${burden}.`,
    `Applied decisions: ${st.applied.length ? st.applied.join(", ") : "none"}.`,
    `Equity index ${r.equityIndex} (mean ${r.mean}, spread ${r.spread}). Worst off: ${r.worstOff}.`,
    `Scores: ${lines}.`,
  ].join("\n");
}

export function runTool(
  name: string,
  input: Record<string, unknown>,
): { result: unknown; applied: boolean } {
  switch (name) {
    case "get_equity_state": {
      const st = getEquityState();
      const r = getResult();
      const foot = Math.round(footfallPct(st.scenario));
      return {
        result: {
          scenario: st.scenario,
          footfallAfterFee: foot,
          deterredPts: Math.max(0, st.scenario.crowding - foot),
          touristFeeBurden: touristFeeBurden(st.scenario),
          preset: st.presetId,
          applied: st.applied,
          equityIndex: r.equityIndex,
          mean: r.mean,
          spread: r.spread,
          worstOff: r.worstOff,
          scores: r.scores.map((x) => ({ id: x.id, label: x.label, score: x.score, baseline: x.baseline, delta: x.delta, verdict: x.verdict })),
        },
        applied: false,
      };
    }
    case "list_decisions":
      return {
        result: DECISIONS.map((d) => ({
          id: d.id,
          label: d.label,
          detail: d.detail,
          justification: d.justification,
          deltas: d.deltas,
          feeScaled: !!d.feeScaled,
          treatment: d.treatment,
          voicesIncluded: d.voicesIncluded,
          voicesMissing: d.voicesMissing,
          appliedNow: getEquityState().applied.includes(d.id),
        })),
        applied: false,
      };
    case "deliberate_decision": {
      const st = getEquityState();
      return { result: deliberate(String(input.id ?? ""), st.scenario, st.applied), applied: false };
    }
    case "apply_decision": {
      const id = String(input.id ?? "");
      const changed = applyDecision(id);
      const r = getResult();
      return {
        result: changed
          ? { changed: true, id, equityIndex: r.equityIndex, worstOff: r.worstOff }
          : { changed: false, id, reason: "unknown id or already applied", equityIndex: r.equityIndex },
        applied: changed,
      };
    }
    case "remove_decision": {
      const id = String(input.id ?? "");
      const changed = removeDecision(id);
      const r = getResult();
      return {
        result: changed
          ? { changed: true, id, equityIndex: r.equityIndex, worstOff: r.worstOff }
          : { changed: false, id, reason: "was not applied", equityIndex: r.equityIndex },
        applied: changed,
      };
    }
    case "set_scenario": {
      if (typeof input.preset === "string") {
        setPreset(input.preset as ScenarioPresetId);
      } else {
        const patch: { feeEUR?: number; crowding?: number } = {};
        if (typeof input.feeEUR === "number") patch.feeEUR = input.feeEUR;
        if (typeof input.crowding === "number") patch.crowding = input.crowding;
        if (Object.keys(patch).length === 0) {
          return { result: { changed: false, reason: "pass preset or feeEUR/crowding" }, applied: false };
        }
        setScenario(patch);
      }
      const st = getEquityState();
      const r = getResult();
      return {
        result: { changed: true, scenario: st.scenario, preset: st.presetId, equityIndex: r.equityIndex, worstOff: r.worstOff },
        applied: true,
      };
    }
    case "suggest_decisions": {
      const st = getEquityState();
      const target = String(input.target ?? "equity_index") as StakeholderId | "worst_off" | "equity_index";
      return { result: rankDecisions(st.scenario, st.applied, target).slice(0, 5), applied: false };
    }
    default:
      return { result: { error: `unknown tool ${name}` }, applied: false };
  }
}
