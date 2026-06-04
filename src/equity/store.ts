/**
 * Equity Console store — scenario + applied decisions, with subscribe/notify
 * so both the UI and the advisor's tools write through the same commands
 * (mirrors src/control/state.ts).
 */

import {
  clampScenario,
  computeEquity,
  decisionById,
  SCENARIO_PRESETS,
  type EquityResult,
  type Scenario,
  type ScenarioPresetId,
} from "./engine";

export type EquityState = {
  presetId: ScenarioPresetId | null;
  scenario: Scenario;
  applied: string[];
};

type Listener = () => void;

const listeners = new Set<Listener>();
let version = 0;

const initial = SCENARIO_PRESETS.find((p) => p.id === "surge")!;
const state: EquityState = {
  presetId: initial.id,
  scenario: { ...initial.scenario },
  applied: [],
};

function notify() {
  version++;
  for (const fn of listeners) fn();
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getVersion(): number {
  return version;
}

export function getEquityState(): EquityState {
  return state;
}

export function getResult(): EquityResult {
  return computeEquity(state.scenario, state.applied);
}

export function setPreset(id: ScenarioPresetId): void {
  const p = SCENARIO_PRESETS.find((x) => x.id === id);
  if (!p) return;
  state.presetId = p.id;
  state.scenario = { ...p.scenario };
  notify();
}

export function setScenario(next: Partial<Scenario>): void {
  state.scenario = clampScenario({ ...state.scenario, ...next });
  // A hand-tuned scenario is no longer exactly a preset.
  state.presetId = null;
  notify();
}

/** Returns true if the decision was newly applied (false = unknown id / already on). */
export function applyDecision(id: string): boolean {
  if (!decisionById(id) || state.applied.includes(id)) return false;
  state.applied = [...state.applied, id];
  notify();
  return true;
}

/** Returns true if the decision was removed (false = wasn't applied). */
export function removeDecision(id: string): boolean {
  if (!state.applied.includes(id)) return false;
  state.applied = state.applied.filter((x) => x !== id);
  notify();
  return true;
}

export function toggleDecision(id: string): void {
  if (state.applied.includes(id)) removeDecision(id);
  else applyDecision(id);
}

export function clearDecisions(): void {
  if (state.applied.length === 0) return;
  state.applied = [];
  notify();
}
