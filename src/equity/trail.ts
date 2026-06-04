/**
 * Reasoning trail — the evidence log that decisions here were fair AND
 * thought-through: each entry is a justification (the operator's own words),
 * the action it produced, and the measured outcome (equity index before →
 * after). Persisted to localStorage; seeded with the design-shaping
 * justifications the operator gave, each tied to the mechanism it produced.
 */

export type TrailEntry = {
  /** ISO date or datetime. */
  ts: string;
  kind: "justification" | "prompt" | "action";
  /** The operator's words (prompt / justification) or the action label. */
  text: string;
  /** What it changed — the purposeful, actionable outcome. */
  outcome: string;
  indexBefore?: number;
  indexAfter?: number;
  brain?: "claude" | "engine";
  seeded?: boolean;
};

/** Design-shaping justifications (2026-06-04) and the mechanisms they produced. */
const SEEDS: TrailEntry[] = [
  {
    ts: "2026-06-04",
    kind: "justification",
    seeded: true,
    text: "The tourists' voice is definitely missing — how can we know what they collectively think is just treatment?",
    outcome:
      "Added 'Seat tourists at the table' to the decision catalog: exit polls at gates, stations and ports plus a standing visitor panel, published quarterly — just treatment gets defined by tourists, not assumed for them. Its own missing voice is flagged too: the deterred, who never arrive to be polled.",
  },
  {
    ts: "2026-06-04",
    kind: "justification",
    seeded: true,
    text: "At what point is the fee inequitable for the tourists coming in?",
    outcome:
      "Made the threshold explicit and live: the fee is weighed against trip cost — heavy-burden past 30% (€12 on a €40 day trip, €96 overnight), regressive past 100%. The verdict now updates with the fee slider instead of staying an open question.",
  },
  {
    ts: "2026-06-04",
    kind: "justification",
    seeded: true,
    text: "Vendors have different needs to the tourists: in Venice many day-trippers come in yet spend no money, while vendors would pay the sustainability fee to be there. And if the fee deters all tourists away, the vendors lose customers and therefore revenue.",
    outcome:
      "Engine now models deterrence: the fee compresses forecast crowding into actual footfall, and commerce stakeholders carry a lost-customer penalty for the crowd the fee turns away. Vendors are squeezed from both sides — over-charging AND over-deterrence — which is exactly why their bar collapses in a surge until an exemption is applied.",
  },
];

const STORAGE_KEY = "qeq-trail-v1";

type Listener = () => void;
const listeners = new Set<Listener>();
let version = 0;
let userEntries: TrailEntry[] = load();

function load(): TrailEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userEntries));
  } catch {
    /* storage full / private mode — trail stays in-memory */
  }
}

function notify() {
  version++;
  for (const fn of listeners) fn();
}

export function subscribeTrail(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getTrailVersion(): number {
  return version;
}

let cachedAll: TrailEntry[] | null = null;

/** Seeds first (the design rationale), then the session log in order. */
export function getTrail(): TrailEntry[] {
  if (!cachedAll) cachedAll = [...SEEDS, ...userEntries];
  return cachedAll;
}

export function addTrailEntry(entry: Omit<TrailEntry, "ts">): void {
  userEntries = [...userEntries, { ...entry, ts: new Date().toISOString() }];
  cachedAll = null;
  persist();
  notify();
}

/** Clears the session log; the seeded design justifications remain. */
export function clearTrail(): void {
  if (userEntries.length === 0) return;
  userEntries = [];
  cachedAll = null;
  persist();
  notify();
}
