/**
 * Deterministic fallback advisor — used when /api/agent isn't configured.
 * Keyword-matches the request to a catalog decision (or a scenario / suggest
 * intent), runs the SAME engine routine the Claude brain would, and phrases
 * the deliberation from the computed object. No LLM, same numbers.
 */

import { deliberate, rankDecisions, STAKEHOLDERS, type Deliberation, type StakeholderId } from "./engine";
import { applyDecision, getEquityState, getResult, removeDecision, setPreset } from "./store";

const DECISION_KEYWORDS: { id: string; words: string[] }[] = [
  { id: "exempt_vendors", words: ["vendor", "commut", "worker", "exempt"] },
  { id: "resident_guest_pass", words: ["guest", "family", "friend", "host"] },
  { id: "earmark_revenue", words: ["earmark", "ring-fence", "ringfence", "revenue", "reinvest", "housing"] },
  { id: "tiered_fee", words: ["tier", "arrival cost", "flat fee", "regressive", "train", "budget"] },
  { id: "low_season_credit", words: ["low season", "low-season", "credit", "negative fee", "pay tourists", "quiet"] },
  { id: "cruise_levy", words: ["cruise", "berth", "ship", "port"] },
  { id: "essential_cap", words: ["essential", "nurse", "teacher", "student"] },
  { id: "smallbiz_grants", words: ["grant", "small business", "shop", "off-season", "bridge"] },
  { id: "tourist_panel", words: ["exit poll", "poll", "panel", "survey", "tourist voice", "what tourists think", "ask the tourists", "seat tourists"] },
  { id: "transparency_board", words: ["transparen", "board", "vote", "algorithm"] },
  { id: "surge_notice_cap", words: ["notice", "cap the surge", "hard cap", "warn", "ambush"] },
];

const PRESET_KEYWORDS: { id: "surge" | "high" | "balanced" | "low"; words: string[] }[] = [
  { id: "surge", words: ["surge", "crisis", "breach"] },
  { id: "high", words: ["high season", "busy"] },
  { id: "balanced", words: ["balanced", "shoulder", "normal"] },
  { id: "low", words: ["low season", "winter", "quiet season"] },
];

function matchDecision(text: string): string | null {
  const t = text.toLowerCase();
  let best: { id: string; hits: number } | null = null;
  for (const k of DECISION_KEYWORDS) {
    const hits = k.words.filter((w) => t.includes(w)).length;
    if (hits > 0 && (!best || hits > best.hits)) best = { id: k.id, hits };
  }
  return best ? best.id : null;
}

function matchStakeholder(text: string): StakeholderId | null {
  const t = text.toLowerCase();
  for (const s of STAKEHOLDERS) {
    if (t.includes(s.short.toLowerCase()) || t.includes(s.label.toLowerCase())) return s.id;
  }
  if (t.includes("local")) return "residents";
  if (t.includes("tourist")) return "day_tourists";
  if (t.includes("business")) return "small_biz";
  if (t.includes("hotel") || t.includes("cruise")) return "operators";
  return null;
}

function narrate(del: Deliberation, applied: boolean): string {
  const agrees = del.agrees.map((a) => a.label).join(", ") || "no group";
  const concerned = del.concerned.map((c) => `${c.label} (−${-c.delta})`).join(", ") || "no group";
  const fg = del.fairForGroup;
  const eq = del.equitableForNeeds;
  return [
    applied ? `Applied: ${del.decision.label}.` : `Considered: ${del.decision.label}.`,
    `In favour: ${agrees}. Concerned: ${concerned}.`,
    `${del.treatmentNote} Voices in the room: ${del.voicesIncluded.join("; ")}. Still missing: ${del.voicesMissing.join("; ")}.`,
    `Evidence — equity index ${fg.indexBefore} → ${fg.indexAfter} (${fg.indexGain >= 0 ? "+" : ""}${fg.indexGain}); worst-off ${eq.worstOffBefore.score} → ${eq.worstOffAfter.score}; spread ${eq.spreadBefore} → ${eq.spreadAfter}.`,
  ].join(" ");
}

export function fallbackAsk(userText: string): string {
  const t = userText.toLowerCase();
  const st = getEquityState();

  // Scenario switch?
  for (const p of PRESET_KEYWORDS) {
    if (p.words.some((w) => t.includes(w)) && (t.includes("scenario") || t.includes("switch") || t.includes("season") || t.includes("surge"))) {
      setPreset(p.id);
      const r = getResult();
      return `Scenario set to ${p.id}: fee €${getEquityState().scenario.feeEUR}, crowding ${getEquityState().scenario.crowding}%. Equity index now ${r.equityIndex}; worst off: ${r.worstOff}.`;
    }
  }

  // Remove?
  const removing = t.includes("remove") || t.includes("undo") || t.includes("revoke");
  const decisionId = matchDecision(userText);
  if (decisionId && removing) {
    const changed = removeDecision(decisionId);
    const r = getResult();
    return changed
      ? `Removed it. Equity index now ${r.equityIndex}; worst off: ${r.worstOff}.`
      : `That decision wasn't applied. Equity index stands at ${r.equityIndex}.`;
  }

  // Apply / evaluate a specific decision — always run the routine.
  if (decisionId) {
    const wantsApply = /\b(apply|enact|do it|won't charge|wont charge|don't charge|dont charge|exempt|introduce|adopt)\b/.test(t);
    const del = deliberate(decisionId, st.scenario, st.applied);
    if ("error" in del) return del.error;
    if (wantsApply) applyDecision(decisionId);
    return narrate(del, wantsApply);
  }

  // "Who should we help" / suggestions.
  if (t.includes("suggest") || t.includes("help") || t.includes("next") || t.includes("recommend") || t.includes("worst")) {
    const target = matchStakeholder(userText) ?? "worst_off";
    const ranked = rankDecisions(st.scenario, st.applied, target);
    if (ranked.length === 0) return "Every decision in the catalog is already applied.";
    const top = ranked[0];
    const del = deliberate(top.id, st.scenario, st.applied);
    const head = `Best next move for ${target === "worst_off" ? "the worst-off group" : target}: ${top.label} (+${top.targetGain} for them, index → ${top.indexAfter}).`;
    return "error" in del ? head : `${head} ${narrate(del, false)}`;
  }

  // Default: read the board.
  const r = getResult();
  const worst = r.scores.find((x) => x.id === r.worstOff)!;
  return `Equity index ${r.equityIndex} (mean ${r.mean}, spread ${r.spread}). Worst off right now: ${worst.label} at ${worst.score} (${worst.verdict}). Ask me to suggest a decision, or name one — e.g. "exempt commuting vendors".`;
}
