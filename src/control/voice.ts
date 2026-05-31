/**
 * Voice-control command parser for the Authority Control dashboard.
 *
 * Pure + deterministic: interpretCommand() takes a recognized transcript plus a
 * read-only snapshot and returns a structured Intent (or null). No side effects,
 * no I/O — the VoiceControl component executes the intent and reads state back to
 * build the spoken confirmation. Keeping the parse pure makes it unit-testable
 * and keeps the "agent reads back state to confirm" property intact.
 */

import type { LeverId, State } from "./state";
import { parseSpokenDate, formatISO } from "./dateutil";

/** Modelling year used when a spoken date omits the year (demo context: 2026).
 *  Not city data — just the default calendar year the picker opens on. */
export const MODELLING_YEAR = 2026;

export type Intent =
  | { kind: "lever"; id: LeverId; value: number }
  | { kind: "demand"; value: number }
  | { kind: "dayType"; id: string; label: string }
  | { kind: "date"; iso: string }
  | { kind: "occupancy"; value: number }
  | { kind: "theme"; dark: boolean }
  | { kind: "view"; view: "cost" | "year" }
  | { kind: "reset" };

/** Friendly spoken names for each lever (used in confirmations). */
export const LEVER_SPOKEN: Record<LeverId, string> = {
  target_capacity: "Target capacity",
  base_fee: "Base fee",
  max_fee_cap: "Max-fee cap",
  ceiling_pct: "Capacity ceiling",
};

/**
 * Keyword groups that identify a lever. Each phrase has a SPECIFICITY (longer /
 * less ambiguous phrases score higher). We pick the highest-scoring lever across
 * ALL phrases — not the first one that happens to contain a generic word like
 * "capacity" — so "capacity ceiling" resolves to ceiling_pct, not target_capacity.
 * Bare ambiguous words ("target", "capacity") are deliberately weak.
 */
const LEVER_KEYWORDS: { id: LeverId; phrases: string[] }[] = [
  { id: "max_fee_cap", phrases: ["max fee cap", "maximum fee cap", "max fee", "maximum fee", "fee cap", "max cap", "price cap", "maximum price"] },
  { id: "ceiling_pct", phrases: ["capacity ceiling", "demand ceiling", "ceiling percent", "ceiling"] },
  { id: "base_fee", phrases: ["base fee at target", "base fee", "base price", "starting fee", "starting price"] },
  { id: "target_capacity", phrases: ["target capacity", "capacity target", "daily capacity", "visitor capacity", "number of visitors", "visitors per day", "target visitors"] },
];

/** Verbs/cues that signal the user is actually issuing a set-value command —
 *  used to avoid acting on incidental mentions of a control word. */
const ACTION_CUE = /\b(set|change|make|adjust|move|raise|increase|lower|decrease|reduce|drop|bump|put|cap|to|at|=)\b/;

const SMALL: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90,
};
const SCALE: Record<string, number> = { hundred: 100, thousand: 1000, million: 1000000, k: 1000, m: 1000000 };

/**
 * Parse a number out of a phrase, handling digits ("50,000", "30k", "1.2m") and
 * spoken words ("fifty thousand", "two hundred"). Returns null if none found.
 */
export function parseNumber(text: string): number | null {
  // Digit forms first: 50000 / 50,000 / 30k / 1.2m / 200%
  const digit = /(\d[\d,]*\.?\d*)\s*(k|m|thousand|million|percent|%)?/i.exec(text);
  let digitVal: number | null = null;
  if (digit) {
    let n = parseFloat(digit[1].replace(/,/g, ""));
    const unit = (digit[2] || "").toLowerCase();
    if (unit === "k" || unit === "thousand") n *= 1000;
    else if (unit === "m" || unit === "million") n *= 1000000;
    if (!Number.isNaN(n)) digitVal = n;
  }

  // Spoken-word number (only if no usable digit form).
  if (digitVal == null) {
    const words = text.toLowerCase().split(/[\s-]+/);
    let total = 0;
    let current = 0;
    let matched = false;
    for (const w of words) {
      if (w in SMALL) {
        current += SMALL[w];
        matched = true;
      } else if (w in SCALE) {
        const s = SCALE[w];
        if (s === 100) current = (current || 1) * 100;
        else {
          total += (current || 1) * s;
          current = 0;
        }
        matched = true;
      }
    }
    if (matched) digitVal = total + current;
  }

  return digitVal == null ? null : Math.round(digitVal);
}

/**
 * Interpret a recognized transcript into a structured Intent against the current
 * state snapshot. Returns null when nothing actionable is recognized.
 */
export function interpretCommand(transcript: string, snap: State): Intent | null {
  const t = " " + transcript.toLowerCase().trim() + " ";

  // Theme.
  if (/\b(dark mode|dark theme|go dark|lights off|night mode)\b/.test(t)) return { kind: "theme", dark: true };
  if (/\b(light mode|light theme|go light|lights on|day mode)\b/.test(t)) return { kind: "theme", dark: false };

  // Occupancy target: "we only want 80% capacity today", "hold occupancy at 80",
  // "target 80 percent capacity", "limit crowds to 80%". Checked before levers so
  // a capacity-target phrase doesn't get read as a target_capacity lever change.
  if (
    /\b(occupancy|capacity|crowd|crowds|busy|full|fill|hold|limit|cap it|keep it|only want|aim for|target)\b/.test(t) &&
    /\b(target|occupancy|hold|limit|keep|only|aim|want|deter|no more than|under|below|at most|max)\b/.test(t) &&
    !/\b(target capacity|capacity target|visitors|max fee|fee cap|base fee|ceiling)\b/.test(t)
  ) {
    const n = parseNumber(t);
    if (n != null && n >= 10 && n <= 200) return { kind: "occupancy", value: n };
  }

  // Curve view.
  if (/\b(zoom out|annual|whole year|year view|full year)\b/.test(t)) return { kind: "view", view: "year" };
  if (/\b(zoom in|cost curve|cost view|back to (the )?curve)\b/.test(t)) return { kind: "view", view: "cost" };

  // Reset / clear back to the default preset day.
  if (/\b(reset|clear|default|first day|back to default)\b/.test(t)) {
    return { kind: "reset" };
  }

  // Calendar date (e.g. "model August 1st", "pick the 9th of December",
  // "go to 2026-02-14"). Checked before day types / levers so a month name wins.
  const iso = parseSpokenDate(t, MODELLING_YEAR);
  if (iso) return { kind: "date", iso };

  // Day type by spoken label (fuzzy: all significant words present).
  for (const d of snap.day_types) {
    const words = d.label.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    if (words.length && words.every((w) => t.includes(w))) {
      return { kind: "dayType", id: d.id, label: d.label };
    }
  }

  const num = parseNumber(t);

  // Levers — score EVERY matching phrase across all levers and take the most
  // specific (longest matched phrase). This stops the old bug where a generic
  // word like "capacity" made everything collapse onto target_capacity.
  let best: { id: LeverId; score: number } | null = null;
  for (const { id, phrases } of LEVER_KEYWORDS) {
    for (const p of phrases) {
      if (t.includes(" " + p + " ") || t.includes(" " + p) || t.includes(p + " ")) {
        const score = p.length + p.split(" ").length * 4; // favour multi-word, longer
        if (!best || score > best.score) best = { id, score };
      }
    }
  }
  if (best && num != null) {
    // "ceiling/percent" style levers accept a %, value levers need a real number.
    return { kind: "lever", id: best.id, value: num };
  }

  // Demand / crowd level (free-form modelled %): "set demand to 150",
  // "crowd level 80", "model 80 percent". Only when no lever matched.
  if (/\b(demand|crowd level|crowd|busy|busyness|model|modelling|modeling)\b/.test(t) && num != null) {
    return { kind: "demand", value: num };
  }

  // A bare number with a clear action cue and nothing else matched is ambiguous —
  // do NOT guess (this is what previously defaulted to target capacity). Return
  // null so the assistant stays silent rather than acting on a mis-hear.
  if (best && num == null && ACTION_CUE.test(t)) {
    // Heard a control word but no number — ask isn't possible; ignore quietly.
    return null;
  }

  return null;
}

/** Direction verb for a confirmation, comparing old → new. */
export function directionWord(oldV: number, newV: number): "raised" | "lowered" | "set" {
  if (newV > oldV) return "raised";
  if (newV < oldV) return "lowered";
  return "set";
}

/** Whole-number / unit-aware spoken value for a lever. */
export function spokenLeverValue(id: LeverId, value: number): string {
  if (id === "ceiling_pct") return `${value} percent`;
  if (id === "base_fee" || id === "max_fee_cap") return `${value} euro`;
  return value.toLocaleString("en-US"); // target_capacity
}

/** Commands the executor needs — injected so voice.ts stays free of React. */
export type VoiceDeps = {
  getState: () => State | null;
  setLever: (id: LeverId, value: number) => void;
  setDemand: (pct: number | null) => void;
  setDayType: (id: string) => void;
  setDate: (iso: string | null) => void;
  setView: (view: "cost" | "year") => void;
  setOccupancyTarget?: (pct: number | null) => void;
  setDark?: (dark: boolean) => void;
};

/**
 * Parse a transcript, apply the resulting intent through the injected commands,
 * and return the spoken confirmation string (or a "didn't catch that" message).
 * Shared by the VoiceControl component and the window.ProjectQ.voiceCommand API,
 * so both behave identically and stay testable without a microphone.
 */
export type VoiceResult = { recognized: boolean; reply: string };

/**
 * Like executeVoiceCommand but reports whether anything was actually recognized.
 * The live mic uses this to STAY SILENT on unrecognized audio (a phone buzz, a
 * stray word) instead of speaking "sorry" at every noise. `recognized` is false
 * only when no intent matched; a matched-but-unavailable target is still
 * "recognized" so the operator hears why it didn't apply.
 */
export function tryVoiceCommand(transcript: string, deps: VoiceDeps): VoiceResult {
  const snap = deps.getState();
  if (!snap) return { recognized: false, reply: "No payload loaded yet." };
  const intent = interpretCommand(transcript, snap);
  if (!intent) {
    return { recognized: false, reply: "Sorry, I didn't catch a command I recognize." };
  }

  switch (intent.kind) {
    case "lever": {
      const lever = snap.levers.find((l) => l.id === intent.id);
      if (!lever) return { recognized: true, reply: "That lever isn't available." };
      const oldV = lever.value;
      deps.setLever(intent.id, intent.value);
      const newV = deps.getState()?.levers.find((l) => l.id === intent.id)?.value ?? intent.value;
      const dir = directionWord(oldV, newV);
      return {
        recognized: true,
        reply: `${LEVER_SPOKEN[intent.id]} successfully ${dir} to ${spokenLeverValue(intent.id, newV)}.`,
      };
    }
    case "demand": {
      deps.setDemand(intent.value);
      const v = deps.getState()?.customDemand ?? intent.value;
      return { recognized: true, reply: `Modelling demand set to ${v} percent.` };
    }
    case "dayType": {
      deps.setDayType(intent.id);
      const d = deps.getState()?.day_types.find((x) => x.id === intent.id);
      return {
        recognized: true,
        reply: `Now modelling ${intent.label}${d ? `, ${d.demand_pct} percent of target` : ""}.`,
      };
    }
    case "date": {
      deps.setDate(intent.iso);
      const v = deps.getState()?.customDemand;
      return {
        recognized: true,
        reply: `Modelling ${formatISO(intent.iso)}${v != null ? `, ${v} percent of target` : ""}.`,
      };
    }
    case "reset": {
      deps.setDate(null);
      deps.setDemand(null);
      const id = deps.getState()?.activeDay;
      const d = deps.getState()?.day_types.find((x) => x.id === id);
      return {
        recognized: true,
        reply: d ? `Reset to ${d.label}, ${d.demand_pct} percent of target.` : "Reset to the default day.",
      };
    }
    case "view": {
      deps.setView(intent.view);
      return {
        recognized: true,
        reply: intent.view === "year" ? "Showing the annual demand profile." : "Showing the cost curve.",
      };
    }
    case "occupancy": {
      deps.setOccupancyTarget?.(intent.value);
      return {
        recognized: true,
        reply: `Occupancy target set to ${intent.value} percent. Adjusting fees to deter crowds above ${intent.value} percent of capacity.`,
      };
    }
    case "theme": {
      deps.setDark?.(intent.dark);
      return { recognized: true, reply: intent.dark ? "Dark mode on." : "Light mode on." };
    }
    default:
      return { recognized: false, reply: "Sorry, I didn't catch a command I recognize." };
  }
}

/** Back-compat string-only wrapper (used by window.ProjectQ.voiceCommand). */
export function executeVoiceCommand(transcript: string, deps: VoiceDeps): string {
  return tryVoiceCommand(transcript, deps).reply;
}
