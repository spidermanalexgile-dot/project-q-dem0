/**
 * Day Tripper mode data — Venice-only, single-day compressed experience.
 *
 * Data illustrative for the May 2026 Trevor demo; replace with sourced figures
 * before any external pitch.
 */

export type DayTripperPersona = {
  names: string;
  arrival: string;
  departBy: string;
  feePaidEUR: number;
  qcashGranted: number;
  qcashExpiry: string;
};

export const dayTripperPersona: DayTripperPersona = {
  names: "Lena & Tom",
  arrival: "Morning cruise",
  departBy: "18:00",
  feePaidEUR: 40,
  qcashGranted: 40,
  qcashExpiry: "23:59 tonight",
};

export type DayTripperSpotType =
  | "food"
  | "sight"
  | "experience"
  | "viewpoint"
  | "shopping"
  | "transport";

export type DayTripperSpot = {
  id: string;
  name: string;
  type: DayTripperSpotType;
  lat: number;
  lng: number;
  walkMinutesFromSanMarco: number;
  qcashAccepted: true;
  blurb: string;
  qcashPriceRange: string;
};

/**
 * Curated short-list for a Venice day-tripper: walkable from the San Marco /
 * Rialto / Santa Lucia corridor, doable in a few hours, QCash-accepting.
 * Coordinates kept consistent with src/data/venicePins.ts.
 */
export const dayTripperSpots: DayTripperSpot[] = [
  {
    id: "caffe-florian",
    name: "Caffè Florian",
    type: "food",
    lat: 45.4338,
    lng: 12.3382,
    walkMinutesFromSanMarco: 1,
    qcashAccepted: true,
    blurb: "Coffee under the San Marco arcades — open since 1720.",
    qcashPriceRange: "8–14 QCash",
  },
  {
    id: "campanile",
    name: "St Mark's Campanile",
    type: "viewpoint",
    lat: 45.4339,
    lng: 12.3391,
    walkMinutesFromSanMarco: 1,
    qcashAccepted: true,
    blurb: "98m bell tower lift — best view in Venice.",
    qcashPriceRange: "10–12 QCash",
  },
  {
    id: "gondola-bacino",
    name: "Gondola · Bacino Orseolo",
    type: "experience",
    lat: 45.4347,
    lng: 12.3372,
    walkMinutesFromSanMarco: 3,
    qcashAccepted: true,
    blurb: "45-min gondola ride along the Grand Canal.",
    qcashPriceRange: "30–40 QCash",
  },
  {
    id: "vap-san-marco",
    name: "Vaporetto · San Marco day pass",
    type: "transport",
    lat: 45.4324,
    lng: 12.3370,
    walkMinutesFromSanMarco: 2,
    qcashAccepted: true,
    blurb: "All-day boat pass — covers Murano, Burano, the Lido.",
    qcashPriceRange: "20 QCash",
  },
  {
    id: "rialto-bridge",
    name: "Rialto Bridge",
    type: "sight",
    lat: 45.4380,
    lng: 12.3360,
    walkMinutesFromSanMarco: 8,
    qcashAccepted: true,
    blurb: "Stone arch over the Grand Canal — the postcard.",
    qcashPriceRange: "free · tip QCash",
  },
  {
    id: "rialto-market",
    name: "Rialto Market",
    type: "shopping",
    lat: 45.4396,
    lng: 12.3343,
    walkMinutesFromSanMarco: 10,
    qcashAccepted: true,
    blurb: "Open-air fish & produce — locals' market since 1097.",
    qcashPriceRange: "5–15 QCash",
  },
  {
    id: "gelato-rialto",
    name: "Gelato · Suso (nr. Rialto)",
    type: "food",
    lat: 45.4373,
    lng: 12.3370,
    walkMinutesFromSanMarco: 7,
    qcashAccepted: true,
    blurb: "Hand-made gelato — opera-singer cone the move.",
    qcashPriceRange: "4–6 QCash",
  },
  {
    id: "cantine-schiavi",
    name: "Cantine del Vino già Schiavi",
    type: "food",
    lat: 45.4297,
    lng: 12.3275,
    walkMinutesFromSanMarco: 12,
    qcashAccepted: true,
    blurb: "Standing-room cicchetti & wine. Locals' pick.",
    qcashPriceRange: "10–18 QCash",
  },
  {
    id: "accademia",
    name: "Gallerie dell'Accademia",
    type: "sight",
    lat: 45.4310,
    lng: 12.3286,
    walkMinutesFromSanMarco: 11,
    qcashAccepted: true,
    blurb: "Venetian masters — Bellini, Titian, Tintoretto.",
    qcashPriceRange: "14–16 QCash",
  },
  {
    id: "peggy-guggenheim",
    name: "Peggy Guggenheim Collection",
    type: "sight",
    lat: 45.4309,
    lng: 12.3309,
    walkMinutesFromSanMarco: 9,
    qcashAccepted: true,
    blurb: "20th-century modern art in Peggy's palazzo.",
    qcashPriceRange: "16–18 QCash",
  },
  {
    id: "libreria-acqua-alta",
    name: "Libreria Acqua Alta",
    type: "shopping",
    lat: 45.4374,
    lng: 12.3434,
    walkMinutesFromSanMarco: 9,
    qcashAccepted: true,
    blurb: "Books stacked in gondolas — most-photographed shop in Venice.",
    qcashPriceRange: "5–20 QCash",
  },
  {
    id: "bacaro-spritz",
    name: "Bacaro · spritz & cicchetti",
    type: "food",
    lat: 45.4360,
    lng: 12.3315,
    walkMinutesFromSanMarco: 6,
    qcashAccepted: true,
    blurb: "Pop into a bàcaro for a spritz & one cicchetto.",
    qcashPriceRange: "6–10 QCash",
  },
  {
    id: "punta-dogana",
    name: "Punta della Dogana",
    type: "viewpoint",
    lat: 45.4304,
    lng: 12.3346,
    walkMinutesFromSanMarco: 7,
    qcashAccepted: true,
    blurb: "Tip of Dorsoduro — sunset walking spot.",
    qcashPriceRange: "free · tip QCash",
  },
  {
    id: "murano-demo",
    name: "Murano · glass-blowing demo",
    type: "experience",
    lat: 45.4584,
    lng: 12.3528,
    walkMinutesFromSanMarco: 40,
    qcashAccepted: true,
    blurb: "Vaporetto out to Murano — a working glass studio.",
    qcashPriceRange: "12–24 QCash",
  },
];

export type DayTripperVibe =
  | "Food & wine"
  | "Sights & history"
  | "Hidden Venice"
  | "Just wandering";

export const dayTripperVibes: DayTripperVibe[] = [
  "Food & wine",
  "Sights & history",
  "Hidden Venice",
  "Just wandering",
];

/** Which spot types each vibe surfaces (used to lightly filter explore). */
export const vibeTypeMap: Record<DayTripperVibe, DayTripperSpotType[]> = {
  "Food & wine": ["food", "shopping"],
  "Sights & history": ["sight", "viewpoint"],
  "Hidden Venice": ["food", "shopping", "experience"],
  "Just wandering": ["food", "sight", "experience", "viewpoint", "shopping", "transport"],
};

export type ImpactAllocation = { label: string; pct: number };

export const impactAllocations: ImpactAllocation[] = [
  { label: "Acqua alta flood defences (MOSE upkeep)", pct: 35 },
  { label: "Canal & bridge maintenance", pct: 30 },
  { label: "Waste & cleaning for day-visitor load", pct: 20 },
  { label: "Resident services fund", pct: 15 },
];

/** San Marco arrival point — used as the walking origin for the day-tripper. */
export const sanMarcoArrival = { lat: 45.4341, lng: 12.3388 };
