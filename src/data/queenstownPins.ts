/**
 * Real Queenstown, NZ locations with real coordinates.
 * Hardcoded for the demo — no API.
 *
 * Coordinates were chosen from each business's real address. Where a
 * business has multiple Queenstown locations (e.g. AJ Hackett operates
 * out of The Station in town and the Kawarau Bridge site out of town)
 * the most-visited tourist endpoint is used.
 */

export type PinCategory = "food" | "activity" | "scenic" | "stay" | "wellness";
export type PinChip = "eat" | "drink" | "adventure" | "scenic" | "stay";

export type Pin = {
  id: string;
  name: string;
  category: PinCategory;
  chip: PinChip;
  lat: number;
  lng: number;
  description: string;
  qcash?: number;
  rating: number; // 0–5
  reviews: number;
  imgLabel: string;
};

/** User location — Steamer Wharf / Main Town Pier area, where Joe is "right now". */
export const userLocation = { lat: -45.0331, lng: 168.6580 };

/** Map default center — town centre, slight offset so pins fan out evenly. */
export const defaultCenter = { lat: -45.0322, lng: 168.6605, zoom: 15 };

export const queenstownPins: Pin[] = [
  // — Food / cafés / restaurants ----------------------------------------------
  {
    id: "fergburger",
    name: "Fergburger",
    category: "food",
    chip: "eat",
    lat: -45.03187,
    lng: 168.66063,
    description: "The famous burger queue. 47-min wait right now — Q will reroute you.",
    qcash: 18,
    rating: 4.6,
    reviews: 8200,
    imgLabel: "FERGBURGER · SHOTOVER ST",
  },
  {
    id: "vudu",
    name: "Vudu Café & Larder",
    category: "food",
    chip: "eat",
    lat: -45.03224,
    lng: 168.66124,
    description: "All-day brunch on Beach St. Locals' pick — fast in & out.",
    qcash: 22,
    rating: 4.7,
    reviews: 1900,
    imgLabel: "VUDU · BEACH ST",
  },
  {
    id: "bunker",
    name: "The Bunker",
    category: "food",
    chip: "eat",
    lat: -45.03217,
    lng: 168.66023,
    description: "Tucked off Cow Lane. Fireplace, short menu, your dinner spot at 18:30.",
    qcash: 60,
    rating: 4.8,
    reviews: 720,
    imgLabel: "THE BUNKER · COW LANE",
  },
  {
    id: "botswana",
    name: "Botswana Butchery",
    category: "food",
    chip: "eat",
    lat: -45.03363,
    lng: 168.66037,
    description: "Lakefront fine dining. Big-night-out energy with views over Wakatipu.",
    qcash: 90,
    rating: 4.5,
    reviews: 3100,
    imgLabel: "BOTSWANA · MARINE PDE",
  },
  {
    id: "joes-garage",
    name: "Joe's Garage",
    category: "food",
    chip: "eat",
    lat: -45.03194,
    lng: 168.65970,
    description: "Coffee + breakfast institution. Searle Lane.",
    qcash: 16,
    rating: 4.4,
    reviews: 2400,
    imgLabel: "JOE'S GARAGE · SEARLE LN",
  },
  {
    id: "yonder",
    name: "Yonder",
    category: "food",
    chip: "eat",
    lat: -45.03220,
    lng: 168.66180,
    description: "Healthy bowls, gluten-free options, mountain-view roof terrace.",
    qcash: 24,
    rating: 4.6,
    reviews: 1100,
    imgLabel: "YONDER · CHURCH ST",
  },
  {
    id: "patagonia",
    name: "Patagonia Chocolates",
    category: "food",
    chip: "eat",
    lat: -45.03268,
    lng: 168.66113,
    description: "Hot chocolate the kids will fight over. No queue right now.",
    qcash: 8,
    rating: 4.7,
    reviews: 2700,
    imgLabel: "PATAGONIA · BEACH ST",
  },
  {
    id: "bespoke",
    name: "Bespoke Kitchen",
    category: "food",
    chip: "eat",
    lat: -45.03012,
    lng: 168.65730,
    description: "Up the hill at the Skyline base. Brunch fuel before the gondola.",
    qcash: 22,
    rating: 4.7,
    reviews: 1300,
    imgLabel: "BESPOKE · ISLE ST",
  },

  // — Drink ------------------------------------------------------------------
  {
    id: "atlas",
    name: "Atlas Beer Café",
    category: "food",
    chip: "drink",
    lat: -45.03252,
    lng: 168.65820,
    description: "20+ taps right on Steamer Wharf. Dog-friendly deck.",
    qcash: 18,
    rating: 4.5,
    reviews: 880,
    imgLabel: "ATLAS BEER · STEAMER WHARF",
  },

  // — Activities / providers --------------------------------------------------
  {
    id: "skyline",
    name: "Skyline Gondola",
    category: "activity",
    chip: "adventure",
    lat: -45.02875,
    lng: 168.65395,
    description: "Bob's Peak gondola + luge. Family-rated, 1.5× QCash today.",
    qcash: 60,
    rating: 4.7,
    reviews: 12100,
    imgLabel: "SKYLINE GONDOLA · BRECON ST",
  },
  {
    id: "ajhackett",
    name: "AJ Hackett Bungy · The Station",
    category: "activity",
    chip: "adventure",
    lat: -45.03145,
    lng: 168.65843,
    description: "The Station hub on Camp St. Shuttle leaves on the hour for Kawarau Bridge & The Nevis.",
    qcash: 120,
    rating: 4.8,
    reviews: 5400,
    imgLabel: "AJ HACKETT · THE STATION",
  },
  {
    id: "shotover-jet",
    name: "Shotover Jet",
    category: "activity",
    chip: "adventure",
    lat: -44.99949,
    lng: 168.67708,
    description: "Big red boats through the canyons at Arthur's Point. 20% off via QCash this week.",
    qcash: 80,
    rating: 4.7,
    reviews: 7600,
    imgLabel: "SHOTOVER JET · ARTHURS POINT",
  },
  {
    id: "kjet",
    name: "KJet",
    category: "activity",
    chip: "adventure",
    lat: -45.03309,
    lng: 168.65594,
    description: "1-hour jet through 3 lakes. Departs from the Main Town Pier.",
    qcash: 70,
    rating: 4.6,
    reviews: 1800,
    imgLabel: "KJET · MAIN TOWN PIER",
  },
  {
    id: "ice-arena",
    name: "Queenstown Ice Arena",
    category: "activity",
    chip: "adventure",
    lat: -45.03677,
    lng: 168.66339,
    description: "Indoor rink in the Gardens. Public sessions afternoons.",
    qcash: 14,
    rating: 4.3,
    reviews: 410,
    imgLabel: "ICE ARENA · GARDENS",
  },
  {
    id: "kiwi-park",
    name: "Kiwi Birdlife Park",
    category: "activity",
    chip: "adventure",
    lat: -45.02975,
    lng: 168.65478,
    description: "Native birds and tuatara under bush canopy — sheltered family afternoon.",
    qcash: 16,
    rating: 4.5,
    reviews: 2200,
    imgLabel: "KIWI BIRDLIFE · BRECON ST",
  },

  // — Wellness (folded under Adventure for the chip filter) ------------------
  {
    id: "onsen",
    name: "Onsen Hot Pools",
    category: "wellness",
    chip: "adventure",
    lat: -44.99275,
    lng: 168.67196,
    description: "Cedar tubs above Shotover River, Arthur's Point. You went this morning.",
    qcash: 18,
    rating: 4.8,
    reviews: 3300,
    imgLabel: "ONSEN · ARTHUR'S POINT",
  },

  // — Scenic / landmarks ------------------------------------------------------
  {
    id: "wakatipu",
    name: "Lake Wakatipu Waterfront",
    category: "scenic",
    chip: "scenic",
    lat: -45.03340,
    lng: 168.65730,
    description: "Steamer Wharf to Marine Pde. The 1.6 km loop everyone walks.",
    rating: 4.9,
    reviews: 9100,
    imgLabel: "LAKE WAKATIPU · MARINE PDE",
  },
  {
    id: "gardens",
    name: "Queenstown Gardens",
    category: "scenic",
    chip: "scenic",
    lat: -45.03667,
    lng: 168.66428,
    description: "Pine peninsula sticking into the lake. Disc golf, big trees.",
    rating: 4.7,
    reviews: 2800,
    imgLabel: "QUEENSTOWN GARDENS",
  },
  {
    id: "bobs-peak",
    name: "Bob's Peak Lookout",
    category: "scenic",
    chip: "scenic",
    lat: -45.02601,
    lng: 168.64998,
    description: "The view at the top of the gondola. Best at sunset.",
    rating: 4.8,
    reviews: 4500,
    imgLabel: "BOB'S PEAK · SUMMIT",
  },

  // — Stay -------------------------------------------------------------------
  {
    id: "eichardts",
    name: "Eichardt's Private Hotel",
    category: "stay",
    chip: "stay",
    lat: -45.03346,
    lng: 168.65938,
    description: "Your hotel. Marine Parade lakefront. Lake-suite check-out at 11:00 on the 21st.",
    rating: 4.7,
    reviews: 690,
    imgLabel: "EICHARDT'S · MARINE PDE",
  },
  {
    id: "hilton",
    name: "Hilton Queenstown",
    category: "stay",
    chip: "stay",
    lat: -45.04540,
    lng: 168.72650,
    description: "Across the bay at Kawarau Village, Frankton. Ferry runs every 30 min.",
    rating: 4.4,
    reviews: 2100,
    imgLabel: "HILTON · KAWARAU VILLAGE",
  },
];

/* ----- AI-planned itinerary --------------------------------------------- */

export type PlannedStop = {
  pinId: string;
  day: string;
  time: string;
  status: "done" | "next" | "later";
};

export const plannedTrip: PlannedStop[] = [
  { pinId: "onsen", day: "Today", time: "10:30", status: "done" },
  { pinId: "patagonia", day: "Today", time: "12:30", status: "next" },
  { pinId: "kiwi-park", day: "Today", time: "15:00", status: "later" },
  { pinId: "bunker", day: "Today", time: "18:30", status: "later" },
  { pinId: "wakatipu", day: "Today", time: "20:00", status: "later" },
  { pinId: "skyline", day: "Tomorrow", time: "09:00", status: "later" },
];

/* ----- Top 5 in Queenstown ---------------------------------------------- */

export const topFiveIds = [
  "skyline",
  "fergburger",
  "ajhackett",
  "wakatipu",
  "onsen",
] as const;

/* ----- Distance + format ------------------------------------------------- */

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function formatReviews(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export const categoryLabels: Record<PinCategory, string> = {
  food: "Food & drink",
  activity: "Activity",
  scenic: "Scenic",
  stay: "Stay",
  wellness: "Wellness",
};

export const categoryGlyph: Record<PinCategory, string> = {
  food: "◆",
  activity: "▲",
  scenic: "●",
  stay: "■",
  wellness: "◇",
};

export const chipLabels: Record<PinChip, string> = {
  eat: "Eat",
  drink: "Drink",
  adventure: "Adventure",
  scenic: "Scenic",
  stay: "Stay",
};

export const chipOrder: PinChip[] = ["eat", "drink", "adventure", "scenic", "stay"];

export function findPin(id: string): Pin | undefined {
  return queenstownPins.find((p) => p.id === id);
}
