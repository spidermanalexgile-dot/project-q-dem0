/**
 * Project Q · Equity Console — deterministic equity engine.
 *
 * Pure functions, no I/O, no Math.random, no Date.now. Same inputs → same
 * outputs. The Claude advisor NEVER computes equity numbers — every score,
 * delta, and index it speaks comes from these functions via agent tools.
 *
 * Model (illustrative, tunable — coefficients are policy assumptions, not data):
 *   • A SCENARIO is the live fee context: feeEUR (can be negative — the city
 *     pays visitors to come) and crowding (% of daily capacity).
 *   • Each STAKEHOLDER gets a baseline score 0–100 from the scenario via
 *     linear weights on four normalised pressures (over-capacity, under-
 *     capacity, positive fee, negative fee).
 *   • Each applied DECISION adds explicit per-stakeholder deltas. Fee-linked
 *     decisions (exemptions, tiering) scale with the live fee — exempting
 *     vendors from a €4 fee matters less than from a €240 surge.
 *   • EQUITY INDEX = mean(scores) − 0.9·stdev(scores). The dispersion penalty
 *     is what makes it an equity measure: helping one group at everyone
 *     else's expense visibly drags the bar down.
 */

export type StakeholderId =
  | "residents"
  | "vendors"
  | "small_biz"
  | "operators"
  | "day_tourists"
  | "overnight_tourists"
  | "government"
  | "environment";

export type Stakeholder = {
  id: StakeholderId;
  label: string;
  short: string;
  note: string;
  base: number;
  /** Score points per unit of each normalised pressure (see pressures()). */
  wOver: number;
  wUnder: number;
  wFeePos: number;
  wFeeNeg: number;
};

export const STAKEHOLDERS: Stakeholder[] = [
  {
    id: "residents",
    label: "Local residents",
    short: "Residents",
    note: "Live with the crowds year-round; the fee is meant to protect them.",
    base: 70, wOver: -38, wUnder: 6, wFeePos: 10, wFeeNeg: -6,
  },
  {
    id: "vendors",
    label: "Commuting vendors & workers",
    short: "Vendors",
    note: "Cross into the zone daily to work — a flat visitor fee taxes their livelihood.",
    base: 66, wOver: -6, wUnder: -14, wFeePos: -24, wFeeNeg: 4,
  },
  {
    id: "small_biz",
    label: "Small local businesses",
    short: "Small biz",
    note: "Need steady footfall; over-tourism brings churn, the dead season brings ruin.",
    base: 64, wOver: -8, wUnder: -26, wFeePos: -10, wFeeNeg: 10,
  },
  {
    id: "operators",
    label: "Large operators",
    short: "Operators",
    note: "Hotels, cruise lines, coach tours — fees on their guests suppress bookings.",
    base: 62, wOver: 6, wUnder: -24, wFeePos: -14, wFeeNeg: 8,
  },
  {
    id: "day_tourists",
    label: "Budget & day-trip tourists",
    short: "Day tourists",
    note: "A flat fee is regressive — €40 on an €8 train ticket, a rounding error on a suite.",
    base: 60, wOver: -10, wUnder: 4, wFeePos: -34, wFeeNeg: 10,
  },
  {
    id: "overnight_tourists",
    label: "Overnight & premium tourists",
    short: "Overnight",
    note: "The fee is a small share of their trip; crowding ruins what they paid for.",
    base: 68, wOver: -14, wUnder: 6, wFeePos: -8, wFeeNeg: 2,
  },
  {
    id: "government",
    label: "City government",
    short: "Government",
    note: "Owns the fee, the revenue, and the political heat when capacity breaches.",
    base: 58, wOver: -16, wUnder: -8, wFeePos: 20, wFeeNeg: -16,
  },
  {
    id: "environment",
    label: "Environment & heritage",
    short: "Environment",
    note: "The destination itself — lagoons, old stone, future generations.",
    base: 52, wOver: -36, wUnder: 16, wFeePos: 14, wFeeNeg: -10,
  },
];

/* ─── scenarios ─────────────────────────────────────────────────────────── */

export type Scenario = {
  /** Sustainability fee in € per visitor; negative = the city pays visitors. */
  feeEUR: number;
  /** Forecast crowd as % of daily capacity. >100 = capacity breached. */
  crowding: number;
};

export type ScenarioPresetId = "surge" | "high" | "balanced" | "low";

export const SCENARIO_PRESETS: { id: ScenarioPresetId; label: string; tagline: string; scenario: Scenario }[] = [
  { id: "surge", label: "Surge crisis", tagline: "Capacity dangerously breached — fee soaring to deter arrivals", scenario: { feeEUR: 240, crowding: 165 } },
  { id: "high", label: "High season", tagline: "Busy but holding — fee above base", scenario: { feeEUR: 45, crowding: 115 } },
  { id: "balanced", label: "Balanced", tagline: "Shoulder season near target", scenario: { feeEUR: 12, crowding: 85 } },
  { id: "low", label: "Low season", tagline: "Quiet city — negative fee pays visitors to come", scenario: { feeEUR: -8, crowding: 45 } },
];

export const FEE_BOUNDS = { min: -20, max: 300 } as const;
export const CROWDING_BOUNDS = { min: 0, max: 200 } as const;

export function clampScenario(s: Scenario): Scenario {
  return {
    feeEUR: Math.max(FEE_BOUNDS.min, Math.min(FEE_BOUNDS.max, Math.round(s.feeEUR))),
    crowding: Math.max(CROWDING_BOUNDS.min, Math.min(CROWDING_BOUNDS.max, Math.round(s.crowding))),
  };
}

/** Four normalised pressures, each roughly 0–1 (feePos can exceed 1 in a surge). */
function pressures(s: Scenario) {
  return {
    over: Math.max(0, s.crowding - 100) / 100,
    under: Math.max(0, 90 - s.crowding) / 90,
    feePos: Math.max(0, s.feeEUR) / 150,
    feeNeg: Math.max(0, -s.feeEUR) / 20,
  };
}

/* ─── decisions ─────────────────────────────────────────────────────────── */

export type Decision = {
  id: string;
  label: string;
  detail: string;
  /** Per-stakeholder score deltas (omitted = 0). */
  deltas: Partial<Record<StakeholderId, number>>;
  /**
   * Fee-linked decisions scale with the live positive fee: multiplier
   * clamp(fee/60, 0.4, 1.5), or 0.25 when the fee is zero/negative — an
   * exemption from a credit is nearly moot.
   */
  feeScaled?: boolean;
  /** "uniform" treats everyone the same; "needs_based" responds to different needs. */
  treatment: "uniform" | "needs_based";
  /** Whose voice shaped this rule — and whose is still missing from the room. */
  voicesIncluded: string[];
  voicesMissing: string[];
};

export const DECISIONS: Decision[] = [
  {
    id: "exempt_vendors",
    label: "Exempt daily-commuting vendors & workers",
    detail: "Anyone who crosses into the zone to work pays nothing — the fee targets visitors, not livelihoods.",
    deltas: { vendors: 22, small_biz: 4, residents: 2, government: -4 },
    feeScaled: true,
    treatment: "needs_based",
    voicesIncluded: ["Market vendor associations", "Trade unions", "Chamber of commerce"],
    voicesMissing: ["Informal & undocumented workers who can't prove a commute"],
  },
  {
    id: "resident_guest_pass",
    label: "Resident guest passes",
    detail: "Residents host friends and family fee-free — their social life isn't a tourism externality.",
    deltas: { residents: 14, overnight_tourists: 2, government: -3 },
    feeScaled: true,
    treatment: "needs_based",
    voicesIncluded: ["Resident committees", "Neighbourhood councils"],
    voicesMissing: ["Second-home owners — resident or visitor?"],
  },
  {
    id: "earmark_revenue",
    label: "Earmark ≥70% of fee revenue locally",
    detail: "Surge revenue is ring-fenced for housing, transit and heritage repair — not the general budget.",
    deltas: { residents: 12, environment: 10, small_biz: 3, government: -6 },
    feeScaled: true,
    treatment: "uniform",
    voicesIncluded: ["Resident committees", "Heritage trusts", "City auditors"],
    voicesMissing: ["Outer districts that host the workforce but see none of the fee"],
  },
  {
    id: "tiered_fee",
    label: "Tier the fee to arrival cost",
    detail: "No flat fee on budget travel — the €8 regional-train rider never pays the same as the suite guest.",
    deltas: { day_tourists: 18, government: -5, overnight_tourists: -4 },
    feeScaled: true,
    treatment: "needs_based",
    voicesIncluded: ["Consumer travel groups", "Rail operators"],
    voicesMissing: ["Premium visitors who now carry a larger share — rarely consulted, easy to overtax quietly"],
  },
  {
    id: "low_season_credit",
    label: "Fund low-season credits from surge revenue",
    detail: "The negative fee that fills the quiet months is paid for by the busiest days, not by taxpayers.",
    deltas: { small_biz: 12, operators: 10, vendors: 8, government: -8, environment: -4 },
    treatment: "needs_based",
    voicesIncluded: ["Hotel associations", "Small-business guilds", "Tourism board"],
    voicesMissing: ["Residents who prefer the quiet months exactly as they are"],
  },
  {
    id: "cruise_levy",
    label: "Levy cruise lines at berth, not passengers at gate",
    detail: "The operator with the 3,000-berth ship pays per call; their passengers stop subsidising everyone else.",
    deltas: { day_tourists: 8, government: 6, environment: 6, operators: -12 },
    treatment: "needs_based",
    voicesIncluded: ["Port authority", "Environmental NGOs", "City government"],
    voicesMissing: ["Cruise crews and port workers whose jobs ride on call volumes"],
  },
  {
    id: "essential_cap",
    label: "Cap fees for essential workers & students",
    detail: "Nurses, teachers and students pay a fixed token fee no matter how high the surge climbs.",
    deltas: { vendors: 10, residents: 6, government: -3 },
    feeScaled: true,
    treatment: "needs_based",
    voicesIncluded: ["Health & education unions", "Student bodies"],
    voicesMissing: ["Gig and shift workers who fall outside the 'essential' list"],
  },
  {
    id: "smallbiz_grants",
    label: "Off-season grants for small businesses",
    detail: "A slice of the fee fund bridges the dead months for independent shops and trattorie.",
    deltas: { small_biz: 14, vendors: 4, government: -7 },
    treatment: "needs_based",
    voicesIncluded: ["Small-business guilds", "Artisan cooperatives"],
    voicesMissing: ["New businesses without a trading history to qualify on"],
  },
  {
    id: "transparency_board",
    label: "Open the algorithm — stakeholder seats on the fee board",
    detail: "The pricing curve is published and every group at this table votes on changes. Procedural equity.",
    deltas: { residents: 6, vendors: 5, small_biz: 5, day_tourists: 4, environment: 4, operators: 3, overnight_tourists: 3, government: 2 },
    treatment: "uniform",
    voicesIncluded: ["Every stakeholder group on this chart, by construction"],
    voicesMissing: ["Future visitors and future residents — represented only by proxy"],
  },
  {
    id: "surge_notice_cap",
    label: "48-hour notice + hard cap on surge fees",
    detail: "No traveller is ambushed at the gate — but a capped surge deters fewer arrivals on breach days.",
    deltas: { day_tourists: 9, overnight_tourists: 6, operators: 5, government: -2, residents: -4, environment: -6 },
    treatment: "uniform",
    voicesIncluded: ["Consumer travel groups", "Booking platforms", "Operators"],
    voicesMissing: ["Residents and the lagoon itself, who absorb the crowds a capped fee fails to deter"],
  },
];

export function decisionById(id: string): Decision | undefined {
  return DECISIONS.find((d) => d.id === id);
}

function feeMultiplier(s: Scenario): number {
  if (s.feeEUR <= 0) return 0.25;
  return Math.max(0.4, Math.min(1.5, s.feeEUR / 60));
}

/* ─── scoring ───────────────────────────────────────────────────────────── */

export type Verdict = "just" | "watch" | "unjust";

export const VERDICT_THRESHOLDS = { just: 70, watch: 50 } as const;

export function verdictFor(score: number): Verdict {
  if (score >= VERDICT_THRESHOLDS.just) return "just";
  if (score >= VERDICT_THRESHOLDS.watch) return "watch";
  return "unjust";
}

export type StakeholderScore = {
  id: StakeholderId;
  label: string;
  short: string;
  note: string;
  baseline: number;
  score: number;
  delta: number;
  verdict: Verdict;
};

export type EquityResult = {
  scenario: Scenario;
  applied: string[];
  scores: StakeholderScore[];
  /** mean(scores) − 0.9·stdev(scores), rounded — the equity bar. */
  equityIndex: number;
  mean: number;
  spread: number;
  worstOff: StakeholderId;
};

function clamp01_100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function baselineScore(st: Stakeholder, scenario: Scenario): number {
  const p = pressures(scenario);
  return clamp01_100(
    st.base + st.wOver * p.over + st.wUnder * p.under + st.wFeePos * p.feePos + st.wFeeNeg * p.feeNeg,
  );
}

export function computeEquity(scenario: Scenario, appliedIds: string[]): EquityResult {
  const s = clampScenario(scenario);
  const m = feeMultiplier(s);
  const applied = appliedIds.filter((id) => decisionById(id));

  const scores: StakeholderScore[] = STAKEHOLDERS.map((st) => {
    const baseline = baselineScore(st, s);
    let total = baseline;
    for (const id of applied) {
      const d = decisionById(id)!;
      const raw = d.deltas[st.id] ?? 0;
      total += d.feeScaled ? raw * m : raw;
    }
    const score = clamp01_100(total);
    return {
      id: st.id,
      label: st.label,
      short: st.short,
      note: st.note,
      baseline,
      score,
      delta: score - baseline,
      verdict: verdictFor(score),
    };
  });

  const mean = scores.reduce((a, x) => a + x.score, 0) / scores.length;
  const variance = scores.reduce((a, x) => a + (x.score - mean) ** 2, 0) / scores.length;
  const spread = Math.sqrt(variance);
  const equityIndex = clamp01_100(mean - 0.9 * spread);
  const worstOff = scores.reduce((min, x) => (x.score < min.score ? x : min), scores[0]).id;

  return { scenario: s, applied, scores, equityIndex, mean: Math.round(mean), spread: Math.round(spread), worstOff };
}

/**
 * Rank not-yet-applied decisions by how much they lift a target (a stakeholder,
 * or the worst-off group, or the overall index). Deterministic — this is the
 * engine the advisor calls when asked "what should we do for X?".
 */
export function rankDecisions(
  scenario: Scenario,
  appliedIds: string[],
  target: StakeholderId | "worst_off" | "equity_index",
): { id: string; label: string; targetGain: number; indexAfter: number; indexGain: number }[] {
  const before = computeEquity(scenario, appliedIds);
  const targetId: StakeholderId | null =
    target === "equity_index" ? null : target === "worst_off" ? before.worstOff : target;

  const ranked = DECISIONS.filter((d) => !appliedIds.includes(d.id)).map((d) => {
    const after = computeEquity(scenario, [...appliedIds, d.id]);
    const targetGain = targetId
      ? after.scores.find((x) => x.id === targetId)!.score - before.scores.find((x) => x.id === targetId)!.score
      : after.equityIndex - before.equityIndex;
    return {
      id: d.id,
      label: d.label,
      targetGain: Math.round(targetGain),
      indexAfter: after.equityIndex,
      indexGain: after.equityIndex - before.equityIndex,
    };
  });

  return ranked.sort((a, b) => b.targetGain - a.targetGain || b.indexGain - a.indexGain);
}

/* ─── deliberation — the Circle of Viewpoints, deterministically ────────── */

/**
 * Walks the fairness routine for one decision against the live state. Every
 * answer that CAN be computed IS computed:
 *   • who is affected / agrees / is concerned  → the decision's deltas
 *   • fair for the group?                      → equity-index move
 *   • equitable for different needs?           → worst-off move + treatment kind
 *   • evidence                                 → exact before/after scores
 * Only voicesIncluded/voicesMissing are curated metadata — and they're data,
 * not model output. The advisor narrates this object; it never invents it.
 */
export type Deliberation = {
  decision: { id: string; label: string; detail: string };
  affected: { id: StakeholderId; label: string; delta: number }[];
  agrees: { id: StakeholderId; label: string; delta: number; why: string }[];
  concerned: { id: StakeholderId; label: string; delta: number; why: string }[];
  voicesIncluded: string[];
  voicesMissing: string[];
  treatment: "uniform" | "needs_based";
  treatmentNote: string;
  fairForGroup: { indexBefore: number; indexAfter: number; indexGain: number };
  equitableForNeeds: {
    worstOffBefore: { id: StakeholderId; score: number };
    worstOffAfter: { id: StakeholderId; score: number };
    worstOffGain: number;
    spreadBefore: number;
    spreadAfter: number;
  };
  evidence: { id: StakeholderId; label: string; before: number; after: number; verdictBefore: Verdict; verdictAfter: Verdict }[];
};

export function deliberate(decisionId: string, scenario: Scenario, appliedIds: string[]): Deliberation | { error: string } {
  const d = decisionById(decisionId);
  if (!d) return { error: `unknown decision '${decisionId}'` };

  const others = appliedIds.filter((id) => id !== d.id);
  const before = computeEquity(scenario, others);
  const after = computeEquity(scenario, [...others, d.id]);

  const moved = after.scores
    .map((x) => ({ ...x, change: x.score - before.scores.find((b) => b.id === x.id)!.score }))
    .filter((x) => x.change !== 0);

  const why = (label: string, delta: number) =>
    delta > 0
      ? `${label} gain ${delta} equity points under the live fee`
      : `${label} give up ${-delta} equity points under the live fee`;

  const worstBefore = before.scores.find((x) => x.id === before.worstOff)!;
  const worstAfter = after.scores.find((x) => x.id === after.worstOff)!;

  return {
    decision: { id: d.id, label: d.label, detail: d.detail },
    affected: moved.map((x) => ({ id: x.id, label: x.label, delta: x.change })),
    agrees: moved.filter((x) => x.change > 0).map((x) => ({ id: x.id, label: x.label, delta: x.change, why: why(x.label, x.change) })),
    concerned: moved.filter((x) => x.change < 0).map((x) => ({ id: x.id, label: x.label, delta: x.change, why: why(x.label, x.change) })),
    voicesIncluded: d.voicesIncluded,
    voicesMissing: d.voicesMissing,
    treatment: d.treatment,
    treatmentNote:
      d.treatment === "needs_based"
        ? "Responds to different needs — different groups are deliberately treated differently."
        : "Treats every group by the same rule.",
    fairForGroup: {
      indexBefore: before.equityIndex,
      indexAfter: after.equityIndex,
      indexGain: after.equityIndex - before.equityIndex,
    },
    equitableForNeeds: {
      worstOffBefore: { id: worstBefore.id, score: worstBefore.score },
      worstOffAfter: { id: worstAfter.id, score: worstAfter.score },
      worstOffGain: worstAfter.score - worstBefore.score,
      spreadBefore: before.spread,
      spreadAfter: after.spread,
    },
    evidence: after.scores.map((x) => {
      const b = before.scores.find((y) => y.id === x.id)!;
      return { id: x.id, label: x.label, before: b.score, after: x.score, verdictBefore: b.verdict, verdictAfter: x.verdict };
    }),
  };
}
