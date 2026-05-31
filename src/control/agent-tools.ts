/**
 * Tool layer for the Claude-brained concierge.
 *
 * The model NEVER does the maths. Each tool here runs the same deterministic calc
 * engine the dashboard uses, against the live store, and returns plain data /
 * applies a concrete change. Claude only decides which tool to call and phrases
 * the result. This keeps the product rule intact ("no LLM math in the live loop")
 * while letting her understand free-form, multi-part requests.
 */

import {
  getState,
  setLever,
  setTargetCapacity,
  setDemand,
  setDayType,
  setDate,
  setView,
  setOccupancyTarget,
  feeAtPct,
  dayRevenue,
  annualRevenue,
  targetCapacity,
  occupancyTarget,
  liveDemandPct,
  activeDayType,
  type LeverId,
  type State,
} from "./state";
import {
  suggestLeverSettings,
  goalSeekRevenue,
  cheapestLeverForRevenue,
  monthRevenue,
} from "./analyst";
import {
  parseSpokenDate,
  formatISO,
  demandForISO,
  explainDemandForISO,
} from "./dateutil";
import { MODELLING_YEAR } from "./voice";

const MONTH_IDX: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

/** Resolve a free-form date phrase ("August 1st", "2026-08-01") to an ISO date. */
function isoOf(date?: string | null): string | null {
  if (!date) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) return date.trim();
  return parseSpokenDate(" " + date.toLowerCase() + " ", MODELLING_YEAR);
}

function currentDemand(snap: State): number {
  if (snap.customDemand != null) return snap.customDemand;
  return activeDayType(snap).demand_pct;
}

/** A compact, factual snapshot for the system prompt — keeps the model grounded
 *  in the live numbers without it having to call get_state first. */
export function stateSummary(): string {
  const s = getState();
  if (!s) return "No payload is loaded yet.";
  const demand = currentDemand(s);
  const live = Math.round(liveDemandPct(demand, s));
  const levers = s.levers
    .map((l) => `${l.id}=${l.value} [${l.min}..${l.max}]`)
    .join(", ");
  return [
    `Location: ${s.location.label} (${s.location.currency}).`,
    `Target capacity: ${targetCapacity(s).toLocaleString("en-US")} visitors/day. Occupancy target: ${occupancyTarget(s)}%.`,
    `Levers: ${levers}.`,
    `Now modelling: ${activeDayType(s).label} — raw demand ${demand}%, live (rebased) ${live}%.`,
    `At that crowd level a visitor pays €${Math.round(feeAtPct(demand, s))}; that day earns ≈ €${Math.round(dayRevenue(demand, s)).toLocaleString("en-US")}.`,
    `Projected annual revenue: €${Math.round(annualRevenue(s)).toLocaleString("en-US")}.`,
    `Day-type presets: ${s.day_types.map((d) => `${d.label} (${d.date}, ${d.demand_pct}%)`).join("; ")}.`,
  ].join(" ");
}

/* ─── tool schemas exposed to Claude ──────────────────────────────────────── */

export const AGENT_TOOLS = [
  {
    name: "get_state",
    description: "Read the live dashboard state: levers, target capacity, occupancy target, the day being modelled, current fee, day revenue and annual revenue.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "suggest_lever_settings",
    description: "Compute recommended lever settings (base fee, max-fee cap, capacity ceiling) that settle a given day at the occupancy target. Returns concrete values plus the projected managed crowd level. Use whenever the user asks what the levers/fees should be, to 'tune', 'optimise' or 'suggest' settings for a day.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Optional day, e.g. 'August 1st' or '2026-08-01'. Omit to use the day currently modelled." },
        apply: { type: "boolean", description: "Set true to actually apply the suggested settings to the dashboard, false to only report them." },
      },
    },
  },
  {
    name: "goal_seek_revenue",
    description: "Solve a single lever to move a period's revenue by an amount (or to an absolute figure). Returns the exact lever value and the revenue it lands.",
    input_schema: {
      type: "object",
      properties: {
        period: { type: "string", description: "'annual' or a month name like 'January'." },
        amount: { type: "number", description: "Euro amount. With absolute=false it's a delta; with absolute=true it's the target revenue." },
        lever: { type: "string", enum: ["base_fee", "max_fee_cap", "ceiling_pct", "target_capacity"] },
        direction: { type: "string", enum: ["up", "down"], description: "Whether to raise or lower (ignored when absolute=true)." },
        absolute: { type: "boolean", description: "True if amount is a target figure rather than a change." },
        apply: { type: "boolean", description: "True to apply the solved lever value." },
      },
      required: ["period", "amount", "lever"],
    },
  },
  {
    name: "cheapest_lever_for_revenue",
    description: "Rank every lever by how cheaply (smallest move) it can shift a period's revenue by an amount. Use for 'what's the cheapest/best/fastest way to add €X'.",
    input_schema: {
      type: "object",
      properties: {
        period: { type: "string", description: "'annual' or a month name." },
        amount: { type: "number", description: "Euro change." },
        direction: { type: "string", enum: ["up", "down"] },
      },
      required: ["period", "amount"],
    },
  },
  {
    name: "explain_demand",
    description: "Explain why a given calendar date is modelled at its crowd level, from the DPM's dated demand anchors (exact or interpolated).",
    input_schema: {
      type: "object",
      properties: { date: { type: "string", description: "e.g. 'February 2nd' or '2026-02-02'." } },
      required: ["date"],
    },
  },
  {
    name: "get_revenue",
    description: "Get the current projected revenue for a period at the present settings.",
    input_schema: {
      type: "object",
      properties: { period: { type: "string", description: "'annual' or a month name." } },
      required: ["period"],
    },
  },
  {
    name: "whatif_date",
    description: "Report the fee a visitor pays and the revenue for a specific calendar date at current settings.",
    input_schema: {
      type: "object",
      properties: { date: { type: "string" } },
      required: ["date"],
    },
  },
  {
    name: "set_lever",
    description: "Set a pricing lever to a value and apply it immediately. Use for direct commands like 'set the base fee to 20'.",
    input_schema: {
      type: "object",
      properties: {
        lever: { type: "string", enum: ["base_fee", "max_fee_cap", "ceiling_pct", "target_capacity"] },
        value: { type: "number" },
      },
      required: ["lever", "value"],
    },
  },
  {
    name: "set_target_capacity",
    description: "Set the target capacity in visitors per day (rebases the whole demand model).",
    input_schema: { type: "object", properties: { visitors: { type: "number" } }, required: ["visitors"] },
  },
  {
    name: "set_occupancy_target",
    description: "Set the occupancy target (% of capacity the authority wants to hold). Auto-tunes fees to deter crowds above it.",
    input_schema: { type: "object", properties: { pct: { type: "number" } }, required: ["pct"] },
  },
  {
    name: "set_demand",
    description: "Model a custom crowd level (% of a normal day) for the working day.",
    input_schema: { type: "object", properties: { pct: { type: "number" } }, required: ["pct"] },
  },
  {
    name: "set_day_type",
    description: "Switch the modelled day to one of the DPM preset day-types by its id.",
    input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "set_date",
    description: "Model a specific calendar date, or clear back to presets.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "A date phrase or ISO; omit with clear=true to reset." },
        clear: { type: "boolean" },
      },
    },
  },
  {
    name: "set_view",
    description: "Switch the chart between the daily cost curve and the annual zoom-out.",
    input_schema: { type: "object", properties: { view: { type: "string", enum: ["cost", "year"] } }, required: ["view"] },
  },
  {
    name: "set_theme",
    description: "Switch the dashboard between light and dark mode.",
    input_schema: { type: "object", properties: { dark: { type: "boolean" } }, required: ["dark"] },
  },
] as const;

export type ToolDeps = { setDark?: (dark: boolean) => void };

/** Execute one tool call against the live state. Returns data for the model plus
 *  whether anything was applied. All numbers come from the deterministic engine. */
export function runTool(
  name: string,
  input: Record<string, unknown>,
  deps: ToolDeps = {},
): { result: unknown; applied: boolean } {
  const snap = getState();
  if (!snap) return { result: { error: "No payload loaded yet." }, applied: false };
  const dir: 1 | -1 = input.direction === "down" ? -1 : 1;

  switch (name) {
    case "get_state":
      return { result: { summary: stateSummary() }, applied: false };

    case "suggest_lever_settings": {
      const iso = isoOf(input.date as string | undefined);
      const s = suggestLeverSettings(snap, iso);
      let applied = false;
      if (input.apply) {
        for (const r of s.recs) setLever(r.id, r.value);
        applied = true;
      }
      return {
        result: {
          day: s.dayLabel,
          forecast_pct: Math.round(s.demand),
          occupancy_target_pct: s.target,
          already_at_or_under_target: s.atOrUnder,
          recommended: s.recs.map((r) => ({ lever: r.label, id: r.id, from: r.from, to: r.value })),
          projected_managed_pct: s.projectedPct == null ? null : Math.round(s.projectedPct),
          applied,
        },
        applied,
      };
    }

    case "goal_seek_revenue": {
      const r = goalSeekRevenue(snap, {
        period: String(input.period),
        amount: Number(input.amount),
        lever: input.lever as LeverId,
        direction: dir,
        absolute: Boolean(input.absolute),
      });
      if (!r) return { result: { error: "Unsolvable with that lever." }, applied: false };
      let applied = false;
      if (input.apply && r.from !== r.to) {
        setLever(r.lever, r.to);
        applied = true;
      }
      return {
        result: {
          lever: r.leverLabel, id: r.lever, from: r.from, to: r.to,
          period: r.periodLabel,
          current_revenue: Math.round(r.current),
          achieved_revenue: Math.round(r.achieved),
          delta: Math.round(r.delta),
          reachable: r.ok, clamped_to_bound: r.clamped, applied,
        },
        applied,
      };
    }

    case "cheapest_lever_for_revenue": {
      const r = cheapestLeverForRevenue(snap, {
        period: String(input.period),
        amount: Number(input.amount),
        direction: dir,
      });
      return {
        result: {
          period: r.periodLabel,
          current_revenue: Math.round(r.current),
          target_revenue: Math.round(r.target),
          exactly_reachable: r.reaches,
          options: r.ranked.map((o) => ({
            lever: o.label, id: o.id, from: o.from, to: o.to,
            lands_revenue: Math.round(o.achieved), delta: Math.round(o.delta),
          })),
        },
        applied: false,
      };
    }

    case "explain_demand": {
      const iso = isoOf(input.date as string);
      if (!iso) return { result: { error: "Couldn't parse that date." }, applied: false };
      const ex = explainDemandForISO(iso, snap.day_types);
      if (!ex) return { result: { error: "No demand data for that date." }, applied: false };
      return { result: { date: formatISO(iso), ...ex }, applied: false };
    }

    case "get_revenue": {
      const p = String(input.period || "").toLowerCase();
      const mi = MONTH_IDX[p];
      if (mi != null) return { result: { period: p, revenue: Math.round(monthRevenue(snap, mi, MODELLING_YEAR)) }, applied: false };
      return { result: { period: "annual", revenue: Math.round(annualRevenue(snap)) }, applied: false };
    }

    case "whatif_date": {
      const iso = isoOf(input.date as string);
      if (!iso) return { result: { error: "Couldn't parse that date." }, applied: false };
      const demand = demandForISO(iso, snap.day_types) ?? 100;
      return {
        result: {
          date: formatISO(iso), demand_pct: demand,
          fee: Math.round(feeAtPct(demand, snap)),
          revenue: Math.round(dayRevenue(demand, snap)),
        },
        applied: false,
      };
    }

    case "set_lever": {
      const id = input.lever as LeverId;
      const from = id === "target_capacity" ? targetCapacity(snap) : snap.levers.find((l) => l.id === id)?.value;
      if (id === "target_capacity") setTargetCapacity(Number(input.value));
      else setLever(id, Number(input.value));
      const to = id === "target_capacity"
        ? targetCapacity(getState()!)
        : getState()!.levers.find((l) => l.id === id)?.value;
      return { result: { lever: id, from, to, changed: from !== to, applied: true }, applied: true };
    }

    case "set_target_capacity": {
      const from = targetCapacity(snap);
      setTargetCapacity(Number(input.visitors));
      const to = targetCapacity(getState()!);
      return { result: { target_capacity: to, from, changed: from !== to, applied: true }, applied: true };
    }

    case "set_occupancy_target": {
      const from = occupancyTarget(snap);
      setOccupancyTarget(Number(input.pct));
      const to = occupancyTarget(getState()!);
      return { result: { occupancy_target: to, from, changed: from !== to, applied: true }, applied: true };
    }

    case "set_demand": {
      const from = snap.customDemand ?? activeDayType(snap).demand_pct;
      setDemand(Number(input.pct));
      return { result: { demand_pct: getState()!.customDemand, from, applied: true }, applied: true };
    }

    case "set_day_type": {
      const id = String(input.id);
      const exists = snap.day_types.some((d) => d.id === id);
      if (!exists) return { result: { error: `No day-type '${id}'. Valid: ${snap.day_types.map((d) => d.id).join(", ")}` }, applied: false };
      setDayType(id);
      return { result: { day_type: id, applied: true }, applied: true };
    }

    case "set_date": {
      if (input.clear) { setDate(null); return { result: { cleared: true, applied: true }, applied: true }; }
      const iso = isoOf(input.date as string);
      if (!iso) return { result: { error: "Couldn't parse that date." }, applied: false };
      setDate(iso);
      return { result: { date: formatISO(iso), applied: true }, applied: true };
    }

    case "set_view":
      setView(input.view === "year" ? "year" : "cost");
      return { result: { view: input.view, applied: true }, applied: true };

    case "set_theme":
      deps.setDark?.(Boolean(input.dark));
      return { result: { dark: Boolean(input.dark), applied: true }, applied: true };

    default:
      return { result: { error: `Unknown tool '${name}'.` }, applied: false };
  }
}
