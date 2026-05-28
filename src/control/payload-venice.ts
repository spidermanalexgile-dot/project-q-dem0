import type { Payload } from "./state";

/**
 * Sample DPM payload — Venice.
 * In production this is emitted by the offline DPM as a markdown file with a
 * machine-readable JSON block. The UI parses & loads it via window.ProjectQ.loadPayload().
 * Nothing about Venice is special-cased in the UI layer.
 */
export const PAYLOAD_VENICE: Payload = {
  location: { id: "venice", label: "Venice", currency: "EUR" },
  capacity: { target: 50000, unit: "visitors/day" },
  confidence: 40,

  curve: {
    base_fee_at_target: 10,
    max_fee_cap: 50,
    ceiling_pct: 200,
    shape: { plateau_end_pct: 100, exponent: 2.2 },
  },

  shoulder_rebate: { enabled: true, credit: 8, applies_below_pct: 28 },

  levers: [
    { id: "target_capacity", min: 20000, max: 120000, step: 1000, value: 50000 },
    { id: "base_fee", min: 0, max: 50, step: 1, value: 10 },
    { id: "max_fee_cap", min: 10, max: 200, step: 5, value: 50 },
    { id: "ceiling_pct", min: 120, max: 250, step: 5, value: 200 },
  ],

  day_types: [
    { id: "peak_sat", label: "Peak summer Saturday", date: "Sat 17 Jun", demand_pct: 200 },
    { id: "high_weekday", label: "High-season weekday", date: "Thu 13 Jul", demand_pct: 145 },
    { id: "shoulder", label: "Shoulder Sunday", date: "Sun 22 Oct", demand_pct: 85 },
    { id: "dec_weekday", label: "December weekday", date: "Tue 5 Dec", demand_pct: 45 },
    { id: "deep_low", label: "Deep low season", date: "Wed 14 Feb", demand_pct: 22 },
  ],

  phase: { year: 1, real_pay_cap: 20 },

  seasonal: [
    { days: 30, demand_pct: 200 },
    { days: 50, demand_pct: 150 },
    { days: 80, demand_pct: 110 },
    { days: 90, demand_pct: 80 },
    { days: 65, demand_pct: 50 },
    { days: 50, demand_pct: 22 },
  ],
};
