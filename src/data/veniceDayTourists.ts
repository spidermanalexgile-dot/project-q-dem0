// Venice day-tourist segments — illustrative for the demo.
//
// Source: Blend of Venice city tourism reports 2018-2023 + cruise industry public
// data + ProjectQ illustrative modelling. Numbers are intentionally directional
// and must be replaced with Comune di Venezia 2024-2025 statistics before any
// external pitch.
//
// The data answers a single equity question for the proposed €40 sustainability
// fee: relative to what each segment ALREADY paid to arrive in Venice, what
// share of that arrival cost does the fee represent? A flat fee that lands as
// 9% on a cruise cabin lands as 500% on an €8 regional-train day-trip — the
// chart visualises that disparity at the booking moment.

export const VENICE_FEE_EUR = 40;

export type EquityVerdict =
  | "fair-share"
  | "proportional"
  | "heavy-burden"
  | "regressive";

export type DayTouristSegment = {
  id: string;
  name: string;
  descriptor: string;
  percentOfDayTourists: number; // 0-100, sums to 100 across all segments
  avgArrivalCostEUR: number; // per person, per arrival
  arrivalCostNote: string;
  verdict: EquityVerdict;
};

/** Verdict thresholds, expressed as fee-as-percent-of-arrival-cost. */
export const VERDICT_THRESHOLDS = {
  fairShareMax: 10, // < 10% → fair-share
  proportionalMax: 30, // 10-30% → proportional
  heavyBurdenMax: 100, // 30-100% → heavy-burden
  // > 100% → regressive
} as const;

export function verdictFor(arrivalCostEUR: number): EquityVerdict {
  const pct = (VENICE_FEE_EUR / arrivalCostEUR) * 100;
  if (pct < VERDICT_THRESHOLDS.fairShareMax) return "fair-share";
  if (pct < VERDICT_THRESHOLDS.proportionalMax) return "proportional";
  if (pct < VERDICT_THRESHOLDS.heavyBurdenMax) return "heavy-burden";
  return "regressive";
}

export const VERDICT_LABEL: Record<EquityVerdict, string> = {
  "fair-share": "Fair share",
  proportional: "Proportional",
  "heavy-burden": "Heavy burden",
  regressive: "Regressive",
};

export const VERDICT_DESCRIPTION: Record<EquityVerdict, string> = {
  "fair-share":
    "The fee is under 10% of what this segment already spent to arrive — barely perceptible at the booking moment.",
  proportional:
    "The fee sits between 10% and 30% of arrival cost — noticeable but in line with what this segment already accepts as the cost of the trip.",
  "heavy-burden":
    "The fee adds 30-100% on top of arrival cost — a real budget hit. The QCash rebate is what keeps this segment whole.",
  regressive:
    "The fee exceeds arrival cost itself, often several times over — without a rebate or relief, a flat fee disproportionately taxes the cheapest day-trippers.",
};

/** Seven Venice day-tourist segments. Percentages sum to 100. */
export const VENICE_DAY_TOURIST_SEGMENTS: DayTouristSegment[] = [
  {
    id: "cruise-cabin",
    name: "Cruise day-passenger",
    descriptor: "Disembarks for the day from a Mediterranean cruise.",
    percentOfDayTourists: 12,
    avgArrivalCostEUR: 450,
    arrivalCostNote: "Per-day cabin amortisation on a 7-night Med cruise.",
    verdict: "fair-share",
  },
  {
    id: "water-taxi",
    name: "Private water-taxi arrival",
    descriptor: "Premium independent traveller from Marco Polo airport.",
    percentOfDayTourists: 3,
    avgArrivalCostEUR: 280,
    arrivalCostNote: "Long-haul flight share + private water-taxi to San Marco.",
    verdict: "proportional",
  },
  {
    id: "nearby-hotel",
    name: "Nearby-hotel day-tripper",
    descriptor: "Staying in Padova or Mestre, in for the day.",
    percentOfDayTourists: 8,
    avgArrivalCostEUR: 220,
    arrivalCostNote: "Mainland hotel night + regional rail return.",
    verdict: "proportional",
  },
  {
    id: "city-break-flight",
    name: "City-break air arrival",
    descriptor: "European weekender flying in for one day in Venice.",
    percentOfDayTourists: 14,
    avgArrivalCostEUR: 180,
    arrivalCostNote: "Low-cost return flight share + airport transfer.",
    verdict: "proportional",
  },
  {
    id: "coach-tour",
    name: "Coach tour day-tripper",
    descriptor: "Organised European bus tour stop.",
    percentOfDayTourists: 22,
    avgArrivalCostEUR: 85,
    arrivalCostNote: "Per-person share of coach package + guide.",
    verdict: "heavy-burden",
  },
  {
    id: "intercity-bus",
    name: "Intercity bus / FlixBus",
    descriptor: "Backpacker arriving overland from elsewhere in Italy or Austria.",
    percentOfDayTourists: 24,
    avgArrivalCostEUR: 32,
    arrivalCostNote: "FlixBus return ticket from Milan / Vienna / Munich.",
    verdict: "regressive",
  },
  {
    id: "day-train",
    name: "Regional-train day-tripper",
    descriptor: "Italian or near-border tourist on a regional rail ticket.",
    percentOfDayTourists: 17,
    avgArrivalCostEUR: 8,
    arrivalCostNote: "Trenitalia regionale return from Verona / Treviso / Trieste.",
    verdict: "regressive",
  },
];

/** Fee as percent of arrival cost — rounded to whole percent for display. */
export function feePercentOf(segment: DayTouristSegment): number {
  return Math.round((VENICE_FEE_EUR / segment.avgArrivalCostEUR) * 100);
}

export const VENICE_EQUITY_SOURCE_NOTE =
  "Blend of Venice city tourism reports 2018-2023 + cruise industry public data + ProjectQ illustrative modelling. Demo numbers — replace with Comune di Venezia 2024-2025 statistics before external use.";
