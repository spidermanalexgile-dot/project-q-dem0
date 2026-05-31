/**
 * Deterministic analyst agent for the Authority Control dashboard.
 *
 * This is NOT an LLM. Per the product rule ("no LLM math in the live loop") it is
 * a pure, deterministic reasoning layer over the same calc engine the dashboard
 * uses. It does two things:
 *   1. EXPLAIN — answer "why is <date>'s demand N%?" / "why is the fee €X?" by
 *      telling the truth about how the model derived the number.
 *   2. SOLVE  — goal-seek, e.g. "raise January revenue by €3M by changing the base
 *      fee", by solving the real engine equations (bisection over the lever).
 *
 * Same question + same state → same answer, always.
 */

import {
  feeAtPct,
  dayRevenue,
  annualRevenue,
  managedDemandPct,
  occupancyTarget,
  activeDayType,
  type LeverId,
  type State,
} from "./state";
import {
  demandForISO,
  explainDemandForISO,
  parseSpokenDate,
  formatISO,
} from "./dateutil";
import { LEVER_SPOKEN, spokenLeverValue, MODELLING_YEAR } from "./voice";

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];
const MONTH_TITLE = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function daysInMonth(monthIdx: number, year: number): number {
  if (monthIdx === 1 && ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0)) return 29;
  return DAYS_IN_MONTH[monthIdx];
}

function eur(n: number): string {
  const v = Math.round(n);
  const sign = v < 0 ? "−" : "";
  return sign + "€" + Math.abs(v).toLocaleString("en-US");
}

function eurCompact(n: number): string {
  const v = Math.round(n);
  const a = Math.abs(v);
  const s = v < 0 ? "−" : "";
  if (a >= 1_000_000_000) return s + "€" + (a / 1e9).toFixed(2).replace(/\.?0+$/, "") + "B";
  if (a >= 1_000_000) return s + "€" + (a / 1e6).toFixed(2).replace(/\.?0+$/, "") + "M";
  if (a >= 1_000) return s + "€" + (a / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
  return s + "€" + a;
}

/** Revenue for a single calendar month, using demand interpolated from the DPM
 *  anchors for each day of that month. Deterministic, derived from the engine. */
export function monthRevenue(snap: State, monthIdx: number, year: number): number {
  const dim = daysInMonth(monthIdx, year);
  let total = 0;
  for (let d = 1; d <= dim; d++) {
    const iso = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const demand = demandForISO(iso, snap.day_types) ?? 100;
    total += dayRevenue(demand, snap);
  }
  return total;
}

/** A shallow clone of state with one lever overridden (for what-if solving). */
export function withLever(snap: State, id: LeverId, value: number): State {
  return {
    ...snap,
    levers: snap.levers.map((l) => (l.id === id ? { ...l, value } : l)),
  };
}

function leverObj(snap: State, id: LeverId) {
  return snap.levers.find((l) => l.id === id);
}

/** Apply several lever overrides at once (for what-if projection). */
export function withLevers(snap: State, recs: { id: LeverId; value: number }[]): State {
  const map = new Map(recs.map((r) => [r.id, r.value]));
  return { ...snap, levers: snap.levers.map((l) => (map.has(l.id) ? { ...l, value: map.get(l.id)! } : l)) };
}

/** Clamp a value to a lever's [min,max] and snap to its step. */
function clampStep(value: number, lever: { min: number; max: number; step?: number }): number {
  const step = lever.step || 1;
  const snapped = Math.round(value / step) * step;
  return Math.max(lever.min, Math.min(lever.max, snapped));
}

/**
 * Bisection solver: find the lever value that makes metric(state) === target.
 * Works for monotonic metrics in either direction (we detect the sign from the
 * endpoints). Returns null if the target isn't reachable within the lever bounds.
 */
export function solveLever(
  snap: State,
  id: LeverId,
  metric: (s: State) => number,
  target: number,
): { value: number; clamped: boolean } | null {
  const lever = leverObj(snap, id);
  if (!lever) return null;
  let lo = lever.min;
  let hi = lever.max;
  const fLo = metric(withLever(snap, id, lo));
  const fHi = metric(withLever(snap, id, hi));
  const min = Math.min(fLo, fHi);
  const max = Math.max(fLo, fHi);
  // Target outside achievable range → return the closest bound.
  if (target <= min) return { value: fLo <= fHi ? lo : hi, clamped: true };
  if (target >= max) return { value: fLo <= fHi ? hi : lo, clamped: true };

  const increasing = fHi >= fLo;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const fm = metric(withLever(snap, id, mid));
    if (Math.abs(fm - target) < Math.max(1, Math.abs(target) * 1e-6)) {
      return { value: snapToStep(mid, lever.step), clamped: false };
    }
    if ((fm < target) === increasing) lo = mid;
    else hi = mid;
  }
  return { value: snapToStep((lo + hi) / 2, lever.step), clamped: false };
}

function snapToStep(value: number, step?: number): number {
  if (!step || step <= 0) return Math.round(value);
  return Math.round(value / step) * step;
}

/* ─── intent + result types ─────────────────────────────────────────────── */

export type AnalystAction =
  | { setLever: { id: LeverId; value: number } }
  | { setLevers: { id: LeverId; value: number }[]; label: string };

export type AnalystResult = {
  answer: string; // markdown-ish plain text (we render line breaks)
  action?: AnalystAction; // an optional change the user can apply
};

/** Map a spoken/typed lever name to its id (looser than the voice matcher). */
function matchLever(text: string): LeverId | null {
  if (/\bmax(imum)?[-\s]?fee\b|\bfee cap\b|\bprice cap\b|\bcap\b/.test(text)) return "max_fee_cap";
  if (/\bbase fee\b|\bbase price\b|\bstarting fee\b/.test(text)) return "base_fee";
  if (/\bceiling\b/.test(text)) return "ceiling_pct";
  if (/\btarget capacity\b|\bcapacity\b|\bvisitors\b/.test(text)) return "target_capacity";
  return null;
}

/** Parse a money amount: "3 million", "€3m", "500k", "2,000,000". */
function parseMoney(text: string): number | null {
  const m = /(?:€|eur\s*)?(-?\d[\d,]*\.?\d*)\s*(billion|million|thousand|m|k|b)?/i.exec(text);
  if (!m) return null;
  let n = parseFloat(m[1].replace(/,/g, ""));
  if (Number.isNaN(n)) return null;
  const u = (m[2] || "").toLowerCase();
  if (u === "b" || u === "billion") n *= 1e9;
  else if (u === "m" || u === "million") n *= 1e6;
  else if (u === "k" || u === "thousand") n *= 1e3;
  return n;
}

function findMonth(text: string): number | null {
  for (let i = 0; i < MONTHS.length; i++) if (text.includes(MONTHS[i])) return i;
  return null;
}

/* ─── reusable deterministic tools (shared by ask() + the Claude brain) ───── */

const PERIOD_MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

/** Resolve a period name ("annual" | a month) into a revenue metric over state. */
export function periodMetric(period: string, year = MODELLING_YEAR): {
  metric: (s: State) => number;
  label: string;
} {
  const p = period.trim().toLowerCase();
  const m = PERIOD_MONTHS[p];
  if (m != null) return { metric: (s) => monthRevenue(s, m, year), label: MONTH_TITLE[m] };
  return { metric: (s) => annualRevenue(s), label: "annual" };
}

export type SuggestResult = {
  dayLabel: string;
  demand: number;
  target: number;
  atOrUnder: boolean;
  recs: { id: LeverId; value: number; label: string; from: number }[];
  projectedPct: number | null;
};

/**
 * Deterministic "suggest lever settings" solver. Given a day (ISO or the day
 * currently modelled), works out concrete lever values that settle that day at
 * the occupancy target, and reports the projected managed demand. No LLM, no
 * guessing — the same engine the dashboard runs.
 */
export function suggestLeverSettings(snap: State, iso?: string | null): SuggestResult {
  const day = iso
    ? { demand: demandForISO(iso, snap.day_types) ?? 100, label: formatISO(iso) }
    : { demand: activeDayType(snap).demand_pct, label: activeDayType(snap).label };
  const target = occupancyTarget(snap);
  const base = leverObj(snap, "base_fee")!;
  const cap = leverObj(snap, "max_fee_cap")!;
  const ceiling = leverObj(snap, "ceiling_pct")!;
  const over = day.demand - target;

  if (over <= 2) {
    return {
      dayLabel: day.label,
      demand: day.demand,
      target,
      atOrUnder: true,
      recs: [
        { id: "base_fee", value: base.value, label: LEVER_SPOKEN.base_fee, from: base.value },
        { id: "max_fee_cap", value: cap.value, label: LEVER_SPOKEN.max_fee_cap, from: cap.value },
      ],
      projectedPct: managedDemandPct(day.demand, snap),
    };
  }

  // Need a deterrent fee. fee* compresses (demand-target) down toward ~target.
  const desiredGap = Math.max(0.02, 2 / over); // leave ~2% of the overshoot
  const feeStar = Math.max(base.value + (cap.step || 1), -30 * Math.log(desiredGap));
  const capV = clampStep(feeStar, cap);
  const ceilV = clampStep(Math.max(ceiling.min, Math.min(ceiling.value, Math.round(day.demand))), ceiling);
  const recs = [
    { id: "base_fee" as LeverId, value: base.value, label: LEVER_SPOKEN.base_fee, from: base.value },
    { id: "max_fee_cap" as LeverId, value: capV, label: LEVER_SPOKEN.max_fee_cap, from: cap.value },
    { id: "ceiling_pct" as LeverId, value: ceilV, label: LEVER_SPOKEN.ceiling_pct, from: ceiling.value },
  ];
  return {
    dayLabel: day.label,
    demand: day.demand,
    target,
    atOrUnder: false,
    recs,
    projectedPct: managedDemandPct(day.demand, withLevers(snap, recs)),
  };
}

export type GoalSeekResult = {
  ok: boolean;
  lever: LeverId;
  leverLabel: string;
  from: number;
  to: number;
  current: number;
  achieved: number;
  delta: number;
  target: number;
  clamped: boolean;
  periodLabel: string;
};

/** Solve a single lever to move a period's revenue by/to an amount. Deterministic. */
export function goalSeekRevenue(
  snap: State,
  opts: { period: string; amount: number; lever: LeverId; direction?: 1 | -1; absolute?: boolean },
): GoalSeekResult | null {
  const { metric, label } = periodMetric(opts.period);
  const lev = leverObj(snap, opts.lever);
  if (!lev) return null;
  const current = metric(snap);
  const dir = opts.direction ?? 1;
  const target = opts.absolute ? Math.abs(opts.amount) : current + dir * Math.abs(opts.amount);
  const sol = solveLever(snap, opts.lever, metric, target);
  if (!sol) return null;
  const achieved = metric(withLever(snap, opts.lever, sol.value));
  return {
    ok: !sol.clamped,
    lever: opts.lever,
    leverLabel: LEVER_SPOKEN[opts.lever],
    from: lev.value,
    to: sol.value,
    current,
    achieved,
    delta: achieved - current,
    target,
    clamped: sol.clamped,
    periodLabel: label,
  };
}

export type CheapestLeverResult = {
  periodLabel: string;
  current: number;
  target: number;
  reaches: boolean;
  ranked: { id: LeverId; label: string; from: number; to: number; achieved: number; delta: number }[];
};

/** Rank every lever by how cheaply it moves a period's revenue to a goal. */
export function cheapestLeverForRevenue(
  snap: State,
  opts: { period: string; amount: number; direction?: 1 | -1 },
): CheapestLeverResult {
  const { metric, label } = periodMetric(opts.period);
  const current = metric(snap);
  const dir = opts.direction ?? 1;
  const target = current + dir * Math.abs(opts.amount);
  const tol = Math.max(1, Math.abs(opts.amount) * 0.05);
  type Cand = { id: LeverId; value: number; achieved: number; miss: number; effort: number };
  const cands: Cand[] = [];
  for (const id of ["base_fee", "max_fee_cap", "target_capacity", "ceiling_pct"] as LeverId[]) {
    const lev = leverObj(snap, id);
    if (!lev) continue;
    const sol = solveLever(snap, id, metric, target);
    if (!sol) continue;
    const achieved = metric(withLever(snap, id, sol.value));
    cands.push({
      id,
      value: sol.value,
      achieved,
      miss: Math.abs(achieved - target),
      effort: Math.abs(sol.value - lev.value) / Math.max(1, lev.max - lev.min),
    });
  }
  cands.sort((a, b) => a.miss - b.miss || a.effort - b.effort);
  return {
    periodLabel: label,
    current,
    target,
    reaches: cands.length > 0 && cands[0].miss <= tol,
    ranked: cands.slice(0, 4).map((c) => ({
      id: c.id,
      label: LEVER_SPOKEN[c.id],
      from: leverObj(snap, c.id)!.value,
      to: c.value,
      achieved: c.achieved,
      delta: c.achieved - current,
    })),
  };
}

/* ─── the agent ─────────────────────────────────────────────────────────── */

/**
 * Answer a natural-language question against the current state. Pure: the caller
 * applies result.action if the user accepts it.
 */
export function ask(qRaw: string, snap: State): AnalystResult {
  const q = " " + qRaw.toLowerCase().trim() + " ";
  const year = MODELLING_YEAR;

  // ── 0. SUGGEST lever settings for a day, and explain ──────────────────────
  if (/\b(suggest|recommend|propose|what should|best|optimal|ideal|set up|tune|advise)\b/.test(q) &&
      /\b(lever|levers|setting|settings|fee|fees|price|prices|config|configuration)\b/.test(q)) {
    // Which day? A spoken date, else the day currently modelled.
    const iso = parseSpokenDate(q, year);
    const s = suggestLeverSettings(snap, iso);
    const recs = s.recs.map((r) => ({ id: r.id, value: r.value }));
    let rationale: string;
    if (s.atOrUnder) {
      const base = s.recs.find((r) => r.id === "base_fee")!;
      const cap = s.recs.find((r) => r.id === "max_fee_cap")!;
      rationale =
        `${s.dayLabel} is forecast at ${Math.round(s.demand)}% — at or under your ${s.target}% target, ` +
        `so no extra deterrence is needed. Keep the base fee around ${eur(base.value)} and the cap at ` +
        `${eur(cap.value)}; pushing fees higher would just turn away visitors you actually want.`;
    } else {
      const capV = s.recs.find((r) => r.id === "max_fee_cap")!.value;
      const ceilV = s.recs.find((r) => r.id === "ceiling_pct")!.value;
      const baseV = s.recs.find((r) => r.id === "base_fee")!.value;
      rationale =
        `${s.dayLabel} is forecast at ${Math.round(s.demand)}% — that's ${Math.round(s.demand - s.target)} points over your ` +
        `${s.target}% target, so the pricing curve needs to bite. I'd set:\n` +
        `• Max-fee cap → ${eur(capV)} (the deterrent the busiest hours pay)\n` +
        `• Capacity ceiling → ${ceilV}% (so the curve reaches that cap by this day's crowd level)\n` +
        `• Base fee → ${eur(baseV)} (keep the entry price gentle for normal days)\n\n` +
        `That settles ${s.dayLabel} at about ${Math.round(s.projectedPct ?? s.demand)}% of capacity — right on your ${s.target}% ` +
        `target — while quiet days stay near the base fee. Higher fee on the busy day deters the overflow; ` +
        `the cheap base keeps the shoulder days welcoming.`;
    }
    return {
      answer: rationale,
      action: { setLevers: recs, label: `the suggested settings for ${s.dayLabel}` },
    };
  }

  // ── 1. WHY IS <date> DEMAND N%? ───────────────────────────────────────────
  if (/\b(why|how come|explain|what makes)\b/.test(q) && /\b(demand|busy|crowd|%|percent|capacity)\b/.test(q)) {
    const iso = parseSpokenDate(q, year);
    if (iso) {
      const ex = explainDemandForISO(iso, snap.day_types);
      if (ex) {
        const date = formatISO(iso);
        if (ex.exact && ex.lower) {
          return {
            answer:
              `${date} is ${ex.demand}% busy because it lands exactly on the DPM anchor ` +
              `"${ex.lower.label}" (${ex.lower.demand}% of a normal day). The model reports that day directly — no interpolation.`,
          };
        }
        if (ex.lower && ex.upper) {
          const pctUp = Math.round(ex.weightUpper * 100);
          return {
            answer:
              `${date} is modelled at ${ex.demand}% busy.\n\n` +
              `It sits between two of Ollie's DPM anchor days:\n` +
              `• ${ex.lower.label} — ${ex.lower.demand}% (${ex.lower.daysAway} days before)\n` +
              `• ${ex.upper.label} — ${ex.upper.demand}% (${ex.upper.daysAway} days after)\n\n` +
              `The figure is a straight-line blend between them: ${date} is ${pctUp}% of the way from ` +
              `the first to the second, giving ${ex.lower.demand}% → ${ex.upper.demand}% ≈ ${ex.demand}%. ` +
              `Nothing is invented — it's interpolated from the DPM's own dated demand points.`,
          };
        }
      }
    }
  }

  // ── 2. WHY IS THE FEE €X / how is the fee worked out ──────────────────────
  if (/\b(why|how|explain)\b/.test(q) && /\bfee\b/.test(q) && !/\bcap\b/.test(q)) {
    const iso = parseSpokenDate(q, year);
    const demand =
      (iso ? demandForISO(iso, snap.day_types) : null) ??
      (snap.customDemand ?? activeDemand(snap));
    const fee = feeAtPct(demand, snap);
    const base = leverObj(snap, "base_fee")!.value;
    const cap = leverObj(snap, "max_fee_cap")!.value;
    const plateau = snap.curve.shape.plateau_end_pct;
    const ceiling = leverObj(snap, "ceiling_pct")!.value;
    const exp = snap.curve.shape.exponent;
    let how: string;
    if (demand <= plateau) how = `at or below ${plateau}% the fee is just the base fee, ${eur(base)}.`;
    else if (demand >= ceiling) how = `at or above the ${ceiling}% ceiling the fee is capped at ${eur(cap)}.`;
    else {
      const t = (demand - plateau) / (ceiling - plateau);
      how =
        `the curve rises from the base fee (${eur(base)} at ${plateau}%) to the cap (${eur(cap)} at ${ceiling}%) ` +
        `along an exponent-${exp} curve. At ${demand}% it's ${Math.round(t * 100)}% of the way along, giving ${eur(fee)}.`;
    }
    return { answer: `At ${demand}% busy, a visitor pays ${eur(fee)} — ${how}` };
  }

  // ── 2b. EXPLAIN revenue (why is <period> revenue €X / how is it worked out) ─
  if (/\b(why|how|explain|what makes|break ?down)\b/.test(q) && /\brevenue\b/.test(q) &&
      !/\b(change|raise|increase|grow|lift|lower|reduce|drop|cut|boost|add|hit|reach|cheap|best|which|fastest|easiest)\b/.test(q)) {
    const monthIdx = findMonth(q);
    const tc = leverObj(snap, "target_capacity")!.value;
    if (monthIdx != null) {
      const r = monthRevenue(snap, monthIdx, year);
      const dim = daysInMonth(monthIdx, year);
      // Sample a representative mid-month day to illustrate.
      const midIso = `${year}-${String(monthIdx + 1).padStart(2, "0")}-15`;
      const midDemand = demandForISO(midIso, snap.day_types) ?? 100;
      const midFee = feeAtPct(midDemand, snap);
      return {
        answer:
          `${MONTH_TITLE[monthIdx]} is projected at ${eurCompact(r)}.\n\n` +
          `It's the sum over all ${dim} days of (visitors × fee). Each day's visitors = ` +
          `${tc.toLocaleString("en-US")} target × that day's crowd level, and the fee comes from the ` +
          `cost curve at that crowd level. For example mid-month (${midDemand}% busy) a visitor pays ` +
          `${eur(midFee)}, so that day earns ≈ ${eurCompact(dayRevenue(midDemand, snap))}. ` +
          `Quieter winter days pull the month down; busier days lift it.`,
      };
    }
    const r = annualRevenue(snap);
    // Show the seasonal-band contributions.
    const bands = [...snap.seasonal]
      .map((s) => ({ ...s, rev: s.days * dayRevenue(s.demand_pct, snap) }))
      .sort((a, b) => b.rev - a.rev);
    const lines = bands
      .map((b) => `• ${b.demand_pct}% busy × ${b.days} days → ${eurCompact(b.rev)}`)
      .join("\n");
    return {
      answer:
        `Annual revenue is ${eurCompact(r)}.\n\n` +
        `It's built from the DPM's seasonal bands — each is (visitors × fee × number of days):\n` +
        `${lines}\n\n` +
        `Visitors = ${tc.toLocaleString("en-US")} target capacity × crowd level; the fee per visitor ` +
        `is read off the cost curve at that crowd level. The busiest bands dominate the total.`,
    };
  }

  // ── 3a. COMPARE levers: cheapest / best / which lever for a revenue goal ───
  if (/\b(cheapest|best|which|fastest|easiest|smallest|most efficient|least)\b/.test(q) &&
      /\brevenue\b/.test(q)) {
    const monthIdx = findMonth(q);
    const amount = parseMoney(q.replace(/\b20\d{2}\b/g, ""));
    const direction = /\b(lower|reduce|drop|cut|decrease|down|less)\b/.test(q) ? -1 : 1;
    const metric =
      monthIdx != null ? (s: State) => monthRevenue(s, monthIdx, year) : (s: State) => annualRevenue(s);
    const periodLabel = monthIdx != null ? MONTH_TITLE[monthIdx] : "annual";
    if (amount == null) {
      return { answer: `Which target? e.g. "what's the cheapest way to add €3M to ${periodLabel} revenue?"` };
    }
    const current = metric(snap);
    const target = current + direction * Math.abs(amount);
    const tol = Math.max(1, Math.abs(amount) * 0.05);
    type Cand = { id: LeverId; value: number; achieved: number; miss: number; effort: number; moves: boolean };
    const candidates: Cand[] = [];
    for (const id of ["base_fee", "max_fee_cap", "target_capacity", "ceiling_pct"] as LeverId[]) {
      const sol = solveLever(snap, id, metric, target);
      const lev = leverObj(snap, id)!;
      if (!sol) continue;
      const achieved = metric(withLever(snap, id, sol.value));
      candidates.push({
        id,
        value: sol.value,
        achieved,
        miss: Math.abs(achieved - target),
        effort: Math.abs(sol.value - lev.value) / Math.max(1, lev.max - lev.min),
        moves: sol.value !== lev.value,
      });
    }
    if (!candidates.length) return { answer: `I couldn't find a lever that moves ${periodLabel} revenue that far.` };

    // Rank by how close they land to the target, then by the smallest move.
    candidates.sort((a, b) => a.miss - b.miss || a.effort - b.effort);
    const best = candidates[0];
    const lev = leverObj(snap, best.id)!;
    const reaches = best.miss <= tol;

    const ranked = candidates
      .slice(0, 3)
      .map((c) => {
        const l = leverObj(snap, c.id)!;
        const lands = `lands ${eurCompact(c.achieved - current >= 0 ? c.achieved - current : c.achieved - current)} (${eurCompact(c.achieved)})`;
        return `• ${LEVER_SPOKEN[c.id]}: ${spokenLeverValue(c.id, l.value)} → ${spokenLeverValue(c.id, c.value)} — ${lands}`;
      })
      .join("\n");

    if (!reaches) {
      // No lever can hit the target precisely — usually because the ask is small
      // relative to a single lever step. Be honest and show the closest.
      return {
        answer:
          `No single lever can move ${periodLabel} revenue by exactly ${eurCompact(direction * Math.abs(amount))} — ` +
          `that's smaller than one step of any lever (each step shifts it more than that).\n\n` +
          `Closest is ${LEVER_SPOKEN[best.id]} → ${spokenLeverValue(best.id, best.value)}, which lands ` +
          `${eurCompact(best.achieved - current)} (${eurCompact(best.achieved)} vs. ${eurCompact(current)} now).\n\n` +
          `Options, nearest first:\n${ranked}`,
        action: best.moves ? { setLever: { id: best.id, value: best.value } } : undefined,
      };
    }

    return {
      answer:
        `Cheapest lever to move ${periodLabel} revenue by ${eurCompact(direction * Math.abs(amount))}: ` +
        `${LEVER_SPOKEN[best.id]}.\n\nSet it to ${spokenLeverValue(best.id, best.value)} ` +
        `(from ${spokenLeverValue(best.id, lev.value)}) — the smallest move that gets there ` +
        `(lands ${eurCompact(best.achieved)}).\n\nOther options:\n${ranked}\n\nApply the cheapest?`,
      action: best.moves ? { setLever: { id: best.id, value: best.value } } : undefined,
    };
  }

  // ── 3. GOAL-SEEK: change <period> revenue by <amount> via <lever> ─────────
  if (/\b(change|raise|increase|grow|lift|lower|reduce|drop|cut|boost|add|by|make|hit|reach|get)\b/.test(q) &&
      /\brevenue\b/.test(q)) {
    const lever = matchLever(q) ?? (/(fee)/.test(q) ? "base_fee" : null);
    const monthIdx = findMonth(q);
    const amount = parseMoney(q.replace(/\b20\d{2}\b/g, "")); // ignore a year token
    const direction = /\b(lower|reduce|drop|cut|decrease|down|less)\b/.test(q) ? -1 : 1;

    // Choose the metric: a named month, else annual.
    const metric =
      monthIdx != null
        ? (s: State) => monthRevenue(s, monthIdx, year)
        : (s: State) => annualRevenue(s);
    const periodLabel = monthIdx != null ? `${MONTH_TITLE[monthIdx]}` : "annual";

    if (!lever) {
      return {
        answer:
          `Tell me which lever to use and I'll solve it — e.g. "raise ${periodLabel} revenue by €3M by changing the base fee". ` +
          `I can adjust base fee, max-fee cap, target capacity, or capacity ceiling.`,
      };
    }
    if (amount == null) {
      return { answer: `By how much? e.g. "${direction < 0 ? "lower" : "raise"} ${periodLabel} revenue by €3M via ${LEVER_SPOKEN[lever].toLowerCase()}".` };
    }

    const current = metric(snap);
    // "by N" = delta; "to N" / "reach N" / "hit N" = absolute target.
    const absolute = /\b(to|reach|hit|at|equal|of)\b/.test(q) && !/\bby\b/.test(q);
    const target = absolute ? Math.abs(amount) : current + direction * Math.abs(amount);

    const sol = solveLever(snap, lever, metric, target);
    const lev = leverObj(snap, lever)!;
    if (!sol) return { answer: `I couldn't solve that with ${LEVER_SPOKEN[lever].toLowerCase()}.` };

    const achieved = metric(withLever(snap, lever, sol.value));
    const deltaAchieved = achieved - current;
    const fromVal = spokenLeverValue(lever, lev.value);
    const toVal = spokenLeverValue(lever, sol.value);

    if (sol.clamped) {
      return {
        answer:
          `That target isn't reachable with ${LEVER_SPOKEN[lever].toLowerCase()} alone within its limits. ` +
          `Pushed to ${toVal} (its bound), ${periodLabel} revenue moves ${eurCompact(deltaAchieved)} ` +
          `(from ${eurCompact(current)} to ${eurCompact(achieved)}). Try another lever or a smaller amount.`,
        action: lev.value !== sol.value ? { setLever: { id: lever, value: sol.value } } : undefined,
      };
    }

    return {
      answer:
        `To move ${periodLabel} revenue by ${eurCompact(direction * Math.abs(amount))} ` +
        `(${eurCompact(current)} → ${eurCompact(target)}), set ${LEVER_SPOKEN[lever]} to ${toVal} ` +
        `(currently ${fromVal}).\n\nThat lands ${periodLabel} revenue at ${eurCompact(achieved)} ` +
        `— ${eurCompact(deltaAchieved)} vs. now. Apply it?`,
      action: { setLever: { id: lever, value: sol.value } },
    };
  }

  // ── 4. WHAT IS <period> revenue right now ─────────────────────────────────
  if (/\b(what|how much|tell me)\b/.test(q) && /\brevenue\b/.test(q)) {
    const monthIdx = findMonth(q);
    if (monthIdx != null) {
      const r = monthRevenue(snap, monthIdx, year);
      return { answer: `${MONTH_TITLE[monthIdx]} is projected at ${eurCompact(r)} (${eur(r)}) at the current settings.` };
    }
    if (/\b(annual|year)\b/.test(q)) {
      const r = annualRevenue(snap);
      return { answer: `Projected annual revenue is ${eurCompact(r)} (${eur(r)}).` };
    }
  }

  // ── 5. WHAT-IF a specific date's fee/revenue ──────────────────────────────
  const isoAny = parseSpokenDate(q, year);
  if (isoAny && /\b(fee|cost|pay|revenue|demand|busy)\b/.test(q)) {
    const demand = demandForISO(isoAny, snap.day_types) ?? 100;
    const fee = feeAtPct(demand, snap);
    const rev = dayRevenue(demand, snap);
    return {
      answer:
        `${formatISO(isoAny)}: modelled at ${demand}% busy. A visitor pays ${eur(fee)}, ` +
        `and that day brings in about ${eurCompact(rev)}.`,
    };
  }

  // ── fallback / help ───────────────────────────────────────────────────────
  return {
    answer:
      `I'm the Project Q analyst. Try:\n` +
      `• "Why is Feb 2nd's demand 139%?"\n` +
      `• "Why is the fee €25 on August 1st?"\n` +
      `• "Raise January revenue by €3M by changing the base fee"\n` +
      `• "What's annual revenue right now?"\n` +
      `Every answer comes straight from the live model — no guesswork.`,
  };
}

function activeDemand(snap: State): number {
  if (snap.customDemand != null) return snap.customDemand;
  const d = snap.day_types.find((x) => x.id === snap.activeDay) || snap.day_types[0];
  return d ? d.demand_pct : 100;
}
