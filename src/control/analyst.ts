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
function withLever(snap: State, id: LeverId, value: number): State {
  return {
    ...snap,
    levers: snap.levers.map((l) => (l.id === id ? { ...l, value } : l)),
  };
}

function leverObj(snap: State, id: LeverId) {
  return snap.levers.find((l) => l.id === id);
}

/**
 * Bisection solver: find the lever value that makes metric(state) === target.
 * Works for monotonic metrics in either direction (we detect the sign from the
 * endpoints). Returns null if the target isn't reachable within the lever bounds.
 */
function solveLever(
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

export type AnalystAction = { setLever: { id: LeverId; value: number } };

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

/* ─── the agent ─────────────────────────────────────────────────────────── */

/**
 * Answer a natural-language question against the current state. Pure: the caller
 * applies result.action if the user accepts it.
 */
export function ask(qRaw: string, snap: State): AnalystResult {
  const q = " " + qRaw.toLowerCase().trim() + " ";
  const year = MODELLING_YEAR;

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
