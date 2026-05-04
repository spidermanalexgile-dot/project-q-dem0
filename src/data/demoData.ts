// Hardcoded demo data — no backend, no API.
// Joe, family of 4, Eichardt's Private Hotel, Queenstown, 16-21 March 2027.

export const trip = {
  guest: { name: "Joe", email: "joe@example.com", partySize: 4 },
  hotel: "Eichardt's Private Hotel",
  destination: "Queenstown",
  dates: { in: "16 Mar 2027", out: "21 Mar 2027", nights: 5 },
  feePaid: 140,
  countdownDays: 12,
  bookingNumber: "00042-JF",
};

export const qcash = {
  projection: { floor: 50, current: 95, ceiling: 140 },
  startingBalance: 95,
  spent: 53,
  balance: 42, // 95 - 53
  expiresAt: "21 Mar 23:59",
};

export type LedgerEntry = {
  id: string;
  name: string;
  time: string;
  amount: number; // negative = spend, positive = earn
  display: string; // shown text (e.g. "−Q$30 (Q$45 value)")
  type: "spend" | "earn";
};

export const ledger: LedgerEntry[] = [
  { id: "l1", name: "Onsen Hot Pools", time: "Today · 11:14", amount: -18, display: "−Q$18", type: "spend" },
  { id: "l2", name: "Skyline Gondola", time: "Yesterday", amount: -30, display: "−Q$30 (Q$45 value)", type: "spend" },
  { id: "l3", name: "Patagonia Chocolates", time: "Yesterday", amount: -5, display: "−Q$5", type: "spend" },
  { id: "l4", name: "Off-peak bonus · cloudy day", time: "12 Mar", amount: 8, display: "+Q$8", type: "earn" },
  { id: "l5", name: "Pre-arrival rebate", time: "12 Mar", amount: 95, display: "+Q$95", type: "earn" },
];

export type Vendor = {
  id: string;
  name: string;
  category: string;
  deal?: string;
  multiplier?: string;
  img: string;
};

export const vendors: Vendor[] = [
  { id: "v1", name: "Skyline Gondola", category: "Adventure", deal: "1.5× QCash", img: "Gondola" },
  { id: "v2", name: "Shotover Jet", category: "Adventure", deal: "20% off", img: "Jet boat" },
  { id: "v3", name: "Fergburger", category: "Food", deal: "Skip queue", img: "Burger" },
  { id: "v4", name: "Onsen Hot Pools", category: "Wellness", multiplier: "1.5×", img: "Onsen" },
  { id: "v5", name: "Patagonia Chocolates", category: "Food", img: "Choc" },
  { id: "v6", name: "Kiwi Birdlife Park", category: "Family", img: "Kiwi" },
];

export type ChatMessage = {
  id: string;
  from: "q" | "user";
  text: string;
  plan?: PlanCard;
};

export type PlanStop = { time: string; name: string; q: string; note: string };

export type PlanCard = {
  title: string;
  meta: string;
  stops: PlanStop[];
};

export const initialChat: ChatMessage[] = [
  {
    id: "m1",
    from: "q",
    text: "Welcome to Queenstown, Joe ✦ It's drizzling on Bob's Peak — Skyline just dropped to 30 min wait.",
  },
  { id: "m2", from: "user", text: "what should we do today? raining + 2 kids" },
  {
    id: "m3",
    from: "q",
    text: "Got you. Built a rainy-day plan that uses Q$42 of your balance and dodges the cruise crowd downtown:",
    plan: {
      title: "Saturday plan",
      meta: "3 STOPS · 6h",
      stops: [
        { time: "10:30", name: "Onsen Hot Pools", q: "18", note: "Indoor · 1.5× QCash today" },
        { time: "13:00", name: "Patagonia Chocolates", q: "8", note: "12 min walk · cosy" },
        { time: "15:00", name: "Kiwi Birdlife Park", q: "16", note: "Family-rated · sheltered paths" },
      ],
    },
  },
];

// Simulated assistant responses, chosen at random when the user sends a message.
export const cannedReplies: string[] = [
  "Good call. The cable car runs every 15 min — next one at 14:45. Want me to hold 4 spots? You'd use Q$24 (1.5× bonus active).",
  "There's a window in the rain at 16:00 — 30 min of clear sky. The lakefront walk to Steamer Wharf is your best bet. I'll ping you 10 min before.",
  "Patagonia Chocolates is 6 min away, no queue right now. Hot chocolate + brownie for the kids comes to Q$8.40. Want a single-use code?",
  "I checked — Eichardt's restaurant has a 2-top open at 19:30 tonight. They take QCash. Should I lock it?",
];

export type HeatPin = {
  x: string; // % of map width
  y: string; // % of map height
  label: string;
  deal?: string;
  hot?: boolean;
};

export const heatPins: HeatPin[] = [
  { x: "55%", y: "58%", label: "Fergburger", deal: "47m queue", hot: true },
  { x: "32%", y: "44%", label: "Onsen", deal: "1.5×" },
  { x: "76%", y: "32%", label: "Skyline", deal: "30m wait" },
  { x: "20%", y: "72%", label: "Steamer Wharf" },
  { x: "60%", y: "28%", label: "Patagonia", deal: "Q$8" },
];

export const weather = { temp: "11°", condition: "rain" as const, label: "Drizzle" };
export const nowLabel = { time: "14:32", busy: "Town centre 81% busy" };

export const payTransaction = {
  vendor: "Patagonia Chocolates",
  pos: "POS-04",
  amount: 8.4,
  items: "2× hot chocolate, 1× brownie",
  ttlSeconds: 15,
};

// Today's guided plan — used by the new Trip page
export type TripDayItem = {
  id: string;
  time: string;
  name: string;
  short: string; // one-line "why this"
  long: string; // 2-line description shown when expanded
  qcash?: number;
  walkMinutes?: number;
  status: "done" | "next" | "later" | "optional";
  action?: string; // button label when expanded
};

export const todayPlan: TripDayItem[] = [
  {
    id: "t1",
    time: "10:30",
    name: "Onsen Hot Pools",
    short: "Indoor · already done",
    long: "Cedar tubs above Shotover River. You stayed 70 min and earned a 1.5× bonus.",
    qcash: 18,
    status: "done",
  },
  {
    id: "t2",
    time: "12:30",
    name: "Lunch at Patagonia Chocolates",
    short: "6 min walk · cosy & dry",
    long: "Hot chocolates and brownies the kids will fight over. Counter seating, no queue right now.",
    qcash: 8,
    walkMinutes: 6,
    status: "next",
    action: "Start walking",
  },
  {
    id: "t3",
    time: "15:00",
    name: "Kiwi Birdlife Park",
    short: "Family-rated · sheltered paths",
    long: "Native birds and tuatara under bush canopy. Stays dry even in rain. Last entry 16:30.",
    qcash: 16,
    walkMinutes: 14,
    status: "later",
    action: "View details",
  },
  {
    id: "t4",
    time: "18:30",
    name: "Dinner at The Bunker",
    short: "You picked this — table held",
    long: "Tucked-away spot off Cow Lane. Fireplace, short menu. Confirmed for 4 at 18:30.",
    walkMinutes: 8,
    status: "later",
    action: "View booking",
  },
  {
    id: "t5",
    time: "20:00",
    name: "Lakefront stroll · optional",
    short: "Rain clears at 19:45",
    long: "Forecast shows a clear window. 1.6 km loop along Steamer Wharf — 22 minutes, well-lit.",
    status: "optional",
    action: "Add to today",
  },
];

export const tomorrowPreview = {
  date: "Sun 19 Mar",
  headline: "Skyline Gondola, 9:00am",
  detail: "Bob's Peak gondola + 5 luge rides for the family. Pre-booked at 1.5× — locked in already.",
  walkMinutes: 4,
  qcash: 60,
};

export const tripProgress = {
  dayNumber: 3,
  totalDays: 5,
  daysLeft: 2,
  message: "We'll guide you each day — open the app any time to see what's next.",
};

// Where-you-are-now derived snapshot for the Trip page hero
export const nowSnapshot = {
  time: "12:22",
  location: "Steamer Wharf",
  weatherLabel: "Drizzle · 11°",
  upNext: {
    name: "Lunch at Patagonia Chocolates",
    when: "12:30",
    walkMinutes: 6,
    qcash: 8,
    pinId: "patagonia", // deep-link target for Start walking → Map
  },
};

export const tripSummary = {
  date: "21 March",
  nights: 5,
  vendors: 14,
  km: 23,
  paid: 140,
  unlocked: 252,
  rebated: 95,
  spent: 78,
  remaining: 17,
};
