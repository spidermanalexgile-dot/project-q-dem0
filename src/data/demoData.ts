// Destination-keyed demo data — no backend, no API.
// Same TypeScript shape for both Queenstown and Venice.

import { useDestination, type Destination } from "../context/DestinationContext";

/* ---------- Shared types -------------------------------------------------- */

export type LedgerEntry = {
  id: string;
  name: string;
  time: string;
  amount: number;
  display: string;
  type: "spend" | "earn";
};

export type Vendor = {
  id: string;
  name: string;
  category: string;
  deal?: string;
  multiplier?: string;
  img: string;
};

export type PlanStop = { time: string; name: string; q: string; note: string };

export type PlanCard = {
  title: string;
  meta: string;
  stops: PlanStop[];
};

export type ChatMessage = {
  id: string;
  from: "q" | "user";
  text: string;
  plan?: PlanCard;
};

export type HeatPin = {
  x: string;
  y: string;
  label: string;
  deal?: string;
  hot?: boolean;
};

export type TripDayItem = {
  id: string;
  time: string;
  name: string;
  short: string;
  long: string;
  qcash?: number;
  walkMinutes?: number;
  status: "done" | "next" | "later" | "optional";
  action?: string;
};

export type DemoData = {
  destinationName: string;
  trip: {
    guest: { name: string; email: string; partySize: number };
    hotel: string;
    destination: string;
    dates: { in: string; out: string; nights: number };
    feePaid: number;
    countdownDays: number;
    bookingNumber: string;
  };
  qcash: {
    projection: { floor: number; current: number; ceiling: number };
    startingBalance: number;
    spent: number;
    balance: number;
    expiresAt: string;
  };
  ledger: LedgerEntry[];
  vendors: Vendor[];
  initialChat: ChatMessage[];
  cannedReplies: string[];
  heatPins: HeatPin[];
  weather: { temp: string; condition: "rain" | "sun" | "cloud"; label: string };
  nowLabel: { time: string; busy: string };
  payTransaction: {
    vendor: string;
    pos: string;
    amount: number;
    items: string;
    ttlSeconds: number;
  };
  todayPlan: TripDayItem[];
  tomorrowPreview: {
    date: string;
    headline: string;
    detail: string;
    walkMinutes: number;
    qcash: number;
  };
  tripProgress: {
    dayNumber: number;
    totalDays: number;
    daysLeft: number;
    message: string;
  };
  nowSnapshot: {
    time: string;
    location: string;
    weatherLabel: string;
    upNext: {
      name: string;
      when: string;
      walkMinutes: number;
      qcash: number;
      pinId: string;
    };
  };
  tripSummary: {
    date: string;
    nights: number;
    vendors: number;
    km: number;
    paid: number;
    unlocked: number;
    rebated: number;
    spent: number;
    remaining: number;
  };
  /** Persona presets shown in Take Control mode. */
  takeControlPersonas: {
    primary: TakeControlPersona;
    cruise: TakeControlPersona;
    retiree: TakeControlPersona;
  };
  /** Memory film hero (Phase 4 Memory). */
  memoryCaption: { date: string; location: string; quote: string };
  /** Donate-the-remainder causes line. */
  donationCauses: string;
  /** Phase 2 pre-book screen content. */
  preBookActivity: {
    title: string;
    headline: string;
    detail: string;
    multiplierLabel: string;
    standardPrice: string;
    qcashApplied: string;
    qcashValue: string;
    youPay: string;
    infoNote: string;
    imgLabel: string;
  };
  /** Phase 1 booking platform line-item copy. */
  bookingLineItem: {
    suiteLine: string;
    suiteAmount: string;
    cleaningAmount: string;
    serviceAmount: string;
    taxLabel: string;
    taxAmount: string;
    sustainabilityLine: string;
    totalAmount: string;
    feeRationale: string;
    breadcrumb: string;
  };
  /** Phase 1 marketing welcome copy. */
  bookingWelcome: {
    eyebrow: string;
    rationale: string;
    liveCapacity: string;
    effectiveLine: string;
  };
  /** Landing public page content. */
  landing: {
    partners: string[];
    testimonials: Array<{
      tag: string;
      quote: string;
      name: string;
      role: string;
      initials: string;
      bg: string;
    }>;
    mayor: { name: string; title: string; council: string };
    capacityLine: string;
    vendorBlurbCopy: string;
    forCityDescription: string;
  };
  /** Walkthrough page subtitle. */
  walkthroughSubtitle: string;
  /** DemoIndex page subtitle. */
  demoIndexSubtitle: string;
};

export type TakeControlPersona = {
  name: string;
  q: string;
  trip: string;
  action: string;
  advice: string;
  targetPin: string;
};

/* ---------- Queenstown slice --------------------------------------------- */

const queenstown: DemoData = {
  destinationName: "Queenstown",
  trip: {
    guest: { name: "Joe", email: "joe@example.com", partySize: 4 },
    hotel: "Eichardt's Private Hotel",
    destination: "Queenstown",
    dates: { in: "16 Mar 2027", out: "21 Mar 2027", nights: 5 },
    feePaid: 140,
    countdownDays: 12,
    bookingNumber: "00042-JF",
  },
  qcash: {
    projection: { floor: 50, current: 95, ceiling: 140 },
    startingBalance: 95,
    spent: 53,
    balance: 42,
    expiresAt: "21 Mar 23:59",
  },
  ledger: [
    { id: "l1", name: "Onsen Hot Pools", time: "Today · 11:14", amount: -18, display: "−Q$18", type: "spend" },
    { id: "l2", name: "Skyline Gondola", time: "Yesterday", amount: -30, display: "−Q$30 (Q$45 value)", type: "spend" },
    { id: "l3", name: "Patagonia Chocolates", time: "Yesterday", amount: -5, display: "−Q$5", type: "spend" },
    { id: "l4", name: "Off-peak bonus · cloudy day", time: "12 Mar", amount: 8, display: "+Q$8", type: "earn" },
    { id: "l5", name: "Pre-arrival rebate", time: "12 Mar", amount: 95, display: "+Q$95", type: "earn" },
  ],
  vendors: [
    { id: "v1", name: "Skyline Gondola", category: "Adventure", deal: "1.5× QCash", img: "Gondola" },
    { id: "v2", name: "Shotover Jet", category: "Adventure", deal: "20% off", img: "Jet boat" },
    { id: "v3", name: "Fergburger", category: "Food", deal: "Skip queue", img: "Burger" },
    { id: "v4", name: "Onsen Hot Pools", category: "Wellness", multiplier: "1.5×", img: "Onsen" },
    { id: "v5", name: "Patagonia Chocolates", category: "Food", img: "Choc" },
    { id: "v6", name: "Kiwi Birdlife Park", category: "Family", img: "Kiwi" },
  ],
  initialChat: [
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
  ],
  cannedReplies: [
    "Good call. The cable car runs every 15 min — next one at 14:45. Want me to hold 4 spots? You'd use Q$24 (1.5× bonus active).",
    "There's a window in the rain at 16:00 — 30 min of clear sky. The lakefront walk to Steamer Wharf is your best bet. I'll ping you 10 min before.",
    "Patagonia Chocolates is 6 min away, no queue right now. Hot chocolate + brownie for the kids comes to Q$8.40. Want a single-use code?",
    "I checked — Eichardt's restaurant has a 2-top open at 19:30 tonight. They take QCash. Should I lock it?",
  ],
  heatPins: [
    { x: "55%", y: "58%", label: "Fergburger", deal: "47m queue", hot: true },
    { x: "32%", y: "44%", label: "Onsen", deal: "1.5×" },
    { x: "76%", y: "32%", label: "Skyline", deal: "30m wait" },
    { x: "20%", y: "72%", label: "Steamer Wharf" },
    { x: "60%", y: "28%", label: "Patagonia", deal: "Q$8" },
  ],
  weather: { temp: "11°", condition: "rain", label: "Drizzle" },
  nowLabel: { time: "14:32", busy: "Town centre 81% busy" },
  payTransaction: {
    vendor: "Patagonia Chocolates",
    pos: "POS-04",
    amount: 8.4,
    items: "2× hot chocolate, 1× brownie",
    ttlSeconds: 15,
  },
  todayPlan: [
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
  ],
  tomorrowPreview: {
    date: "Sun 19 Mar",
    headline: "Skyline Gondola, 9:00am",
    detail: "Bob's Peak gondola + 5 luge rides for the family. Pre-booked at 1.5× — locked in already.",
    walkMinutes: 4,
    qcash: 60,
  },
  tripProgress: {
    dayNumber: 3,
    totalDays: 5,
    daysLeft: 2,
    message: "We'll guide you each day — open the app any time to see what's next.",
  },
  nowSnapshot: {
    time: "12:22",
    location: "Steamer Wharf",
    weatherLabel: "Drizzle · 11°",
    upNext: {
      name: "Lunch at Patagonia Chocolates",
      when: "12:30",
      walkMinutes: 6,
      qcash: 8,
      pinId: "patagonia",
    },
  },
  tripSummary: {
    date: "21 March",
    nights: 5,
    vendors: 14,
    km: 23,
    paid: 140,
    unlocked: 252,
    rebated: 95,
    spent: 78,
    remaining: 17,
  },
  takeControlPersonas: {
    primary: {
      name: "Joe",
      q: "42",
      trip: "Queenstown · Day 3",
      action: "Lunch",
      advice: "Patagonia Chocolates is a 3-min walk. Use Q$8 — your full lunch is covered.",
      targetPin: "patagonia",
    },
    cruise: {
      name: "Margaret",
      q: "28",
      trip: "Day-pass · 6h left",
      action: "Lunch",
      advice:
        "You have 6 hours before your ship leaves. Ferg Burger has a 47-min queue — Patagonia is ready right now.",
      targetPin: "patagonia",
    },
    retiree: {
      name: "Eleanor",
      q: "56",
      trip: "Queenstown · Day 2",
      action: "Lunch",
      advice:
        "It's lunchtime. The hotel is 8 minutes away. Or use Q$8 at Patagonia Chocolates around the corner.",
      targetPin: "patagonia",
    },
  },
  memoryCaption: {
    date: "17 Mar · 8°C · Mist",
    location: "Lake Wakatipu",
    quote: "\"The lake was completely glass that morning.\"",
  },
  donationCauses: "Wakatipu Reforestation · Lake clean-up · Trail maintenance",
  preBookActivity: {
    title: "Skyline Gondola + Luge",
    headline: "Skyline Gondola + 5 Luge rides",
    detail: "Family of 4 · Tue 17 Mar, 2:30pm",
    multiplierLabel: "1.5× QCash",
    standardPrice: "$240.00",
    qcashApplied: "− Q$60 ($90 value)",
    qcashValue: "Q$60",
    youPay: "$150.00",
    infoNote:
      "Heads up: Pre-spending Q$60 reserves it from your projected balance. If your final rebate lands below Q$60, the gap stays interest-free.",
    imgLabel: "GONDOLA · BOB'S PEAK",
  },
  bookingLineItem: {
    suiteLine: "Lake suite × 5 nights",
    suiteAmount: "$3,250.00",
    cleaningAmount: "$75.00",
    serviceAmount: "$240.00",
    taxLabel: "GST",
    taxAmount: "$520.00",
    sustainabilityLine: "$28/night × 5 nights · funds Queenstown's regenerative tourism",
    totalAmount: "$4,225.00",
    feeRationale: "$28 × 5 · returned as Q$95 in QCash",
    breadcrumb: "Queenstown, New Zealand · Lake Wakatipu suite · 5 nights",
  },
  bookingWelcome: {
    eyebrow: "Welcome, Joe — your trip to Queenstown",
    rationale:
      "You're the 2,847th visitor to opt in for the week of 16 March. That puts you under Queenstown's daily capacity — your sustainability fee is 32% below the seasonal average, and we're projecting a strong QCash rebate.",
    liveCapacity: "● Live · Queenstown capacity 71% · 2,847 / 4,000",
    effectiveLine: "You'll effectively pay $45",
  },
  landing: {
    partners: [
      "Eichardt's", "Skyline", "AJ Hackett", "Shotover Jet", "KJet",
      "Onsen", "Fergburger", "Vudu Café", "The Bunker", "Botswana Butchery",
      "Joe's Garage", "Yonder", "Bespoke Kitchen", "Atlas Beer", "Patagonia Chocolates",
      "Kiwi Birdlife", "Hilton Queenstown", "Queenstown Gardens", "Steamer Wharf", "Gibbston Wines",
      "Cardrona Distillery", "Coronet Peak", "The Remarkables", "Nomad Safaris", "Hippo Lodge",
    ],
    testimonials: [
      {
        tag: "Tourist",
        quote: "We saved $200 in 5 days, ate everywhere we wanted, and didn't have to think about budgeting once. The fee paid for itself.",
        name: "Joe F.",
        role: "Family of 4 · Queenstown March 2027",
        initials: "JF",
        bg: "linear-gradient(135deg, #d4b87a 0%, #8a6a2a 100%)",
      },
      {
        tag: "Vendor",
        quote: "Q customers tip 18% more on average and rebook us for the next year. The single-use QR settles instantly to our account.",
        name: "Mariana L.",
        role: "Owner · Patagonia Chocolates",
        initials: "ML",
        bg: "linear-gradient(135deg, #2a7a64 0%, #0a4d3c 100%)",
      },
      {
        tag: "Council",
        quote: "For the first time we have real-time visibility into where visitors spend, when they cluster, and what locals lose. It's the dashboard we wished we had a decade ago.",
        name: "James Foster",
        role: "Mayor · Queenstown Lakes District",
        initials: "JF",
        bg: "linear-gradient(135deg, #1a3d33 0%, #03100c 100%)",
      },
    ],
    mayor: { name: "James Foster", title: "Mayor", council: "Queenstown Lakes District" },
    capacityLine: "● Live · Queenstown capacity 71% · 2,847 / 4,000",
    vendorBlurbCopy:
      "Your visitor levy, returned as spendable currency at 200+ Queenstown businesses. Spend on dinner, gondolas, hot pools, gifts — settle vendors instantly with a QR code.",
    forCityDescription:
      "The visitor levy was already going to be paid. Project Q gives the money a job. Visitors get a smarter trip. Local businesses get steadier traffic and instant settlement. Council gets real-time visibility into spend distribution, capacity pressure, and where money actually lands.",
  },
  walkthroughSubtitle:
    "Joe books a Queenstown trip 6 months out. The fee becomes QCash. He uses it. He goes home. We invite him back.",
  demoIndexSubtitle:
    "Joe, family of 4 · Eichardt's Private Hotel · 16–21 March 2027. Hardcoded demo data — every interaction is mocked but feels live.",
};

/* ---------- Venice slice -------------------------------------------------- */

const venice: DemoData = {
  destinationName: "Venice",
  trip: {
    guest: { name: "Eleanor", email: "eleanor@example.com", partySize: 2 },
    hotel: "Gritti Palace · Dorsoduro",
    destination: "Venice",
    dates: { in: "12 Sep 2027", out: "17 Sep 2027", nights: 5 },
    feePaid: 140,
    countdownDays: 12,
    bookingNumber: "00042-EM",
  },
  qcash: {
    projection: { floor: 50, current: 95, ceiling: 140 },
    startingBalance: 95,
    spent: 53,
    balance: 42,
    expiresAt: "17 Sep 23:59",
  },
  ledger: [
    { id: "l1", name: "Peggy Guggenheim Collection", time: "Today · 11:14", amount: -18, display: "−Q$18", type: "spend" },
    { id: "l2", name: "Gondola ride · Bacino Orseolo", time: "Yesterday", amount: -30, display: "−Q$30 (Q$45 value)", type: "spend" },
    { id: "l3", name: "Caffè Florian", time: "Yesterday", amount: -5, display: "−Q$5", type: "spend" },
    { id: "l4", name: "Off-peak bonus · acqua alta day", time: "8 Sep", amount: 8, display: "+Q$8", type: "earn" },
    { id: "l5", name: "Pre-arrival rebate", time: "8 Sep", amount: 95, display: "+Q$95", type: "earn" },
  ],
  vendors: [
    { id: "v1", name: "Gondola · Bacino Orseolo", category: "Experience", deal: "1.5× QCash", img: "Gondola" },
    { id: "v2", name: "Vaporetto Day Pass", category: "Transport", deal: "20% off", img: "Vaporetto" },
    { id: "v3", name: "Cantine del Vino già Schiavi", category: "Food", deal: "Skip queue", img: "Cicchetti" },
    { id: "v4", name: "Peggy Guggenheim", category: "Culture", multiplier: "1.5×", img: "Museum" },
    { id: "v5", name: "Caffè Florian", category: "Food", img: "Café" },
    { id: "v6", name: "Doge's Palace", category: "Culture", img: "Palazzo" },
  ],
  initialChat: [
    {
      id: "m1",
      from: "q",
      text: "Welcome to Venice, Eleanor ✦ Light rain easing in Dorsoduro — Caffè Florian just opened up a corner table.",
    },
    { id: "m2", from: "user", text: "what should we do today? on and off rain" },
    {
      id: "m3",
      from: "q",
      text: "Got you. Built a rainy-day plan that uses Q$42 of your balance and dodges the cruise crowd around San Marco:",
      plan: {
        title: "Sunday plan",
        meta: "3 STOPS · 6h",
        stops: [
          { time: "10:30", name: "Peggy Guggenheim", q: "18", note: "Indoor · 1.5× QCash today" },
          { time: "13:00", name: "Cantine del Vino già Schiavi", q: "8", note: "8 min walk · cicchetti & wine" },
          { time: "15:00", name: "Doge's Palace", q: "16", note: "Sheltered tour · Bridge of Sighs" },
        ],
      },
    },
  ],
  cannedReplies: [
    "Good call. Vaporetto Line 1 runs every 10 min — next one at 14:45. Want me to hold 2 spots? You'd use Q$24 (1.5× bonus active).",
    "There's a window in the rain at 16:00 — 30 min of clear sky. The Zattere promenade walk along Dorsoduro is your best bet. I'll ping you 10 min before.",
    "Caffè Florian is 6 min away, no queue right now. Two espressos + tiramisu comes to Q$8.40. Want a single-use code?",
    "I checked — Gritti's terrace has a 2-top open at 20:30 tonight. They take QCash. Should I lock it?",
  ],
  heatPins: [
    { x: "55%", y: "58%", label: "Caffè Florian", deal: "47m queue", hot: true },
    { x: "32%", y: "44%", label: "Peggy G.", deal: "1.5×" },
    { x: "76%", y: "32%", label: "Doge's Palace", deal: "30m wait" },
    { x: "20%", y: "72%", label: "Zattere" },
    { x: "60%", y: "28%", label: "Cantine", deal: "Q$8" },
  ],
  weather: { temp: "18°", condition: "rain", label: "Light rain" },
  nowLabel: { time: "14:32", busy: "San Marco 76% busy" },
  payTransaction: {
    vendor: "Caffè Florian",
    pos: "POS-12",
    amount: 8.4,
    items: "2× espresso, 1× tiramisu",
    ttlSeconds: 15,
  },
  todayPlan: [
    {
      id: "t1",
      time: "10:30",
      name: "Peggy Guggenheim Collection",
      short: "Indoor · already done",
      long: "Peggy's Grand Canal palazzo — 20th-century modern art under one roof. You stayed 90 min and earned a 1.5× bonus.",
      qcash: 18,
      status: "done",
    },
    {
      id: "t2",
      time: "12:30",
      name: "Lunch at Cantine del Vino già Schiavi",
      short: "6 min walk · cosy & dry",
      long: "Standing cicchetti and ombra di vino across from San Trovaso. Easy to share, fast in and out.",
      qcash: 8,
      walkMinutes: 6,
      status: "next",
      action: "Start walking",
    },
    {
      id: "t3",
      time: "15:00",
      name: "Doge's Palace",
      short: "Indoor tour · sheltered paths",
      long: "Gothic palace of the Venetian Republic. Includes the Bridge of Sighs walkway. Last entry 17:00.",
      qcash: 16,
      walkMinutes: 14,
      status: "later",
      action: "View details",
    },
    {
      id: "t4",
      time: "20:30",
      name: "Dinner at Trattoria alla Madonna",
      short: "You picked this — table held",
      long: "Old-school Venetian seafood near Rialto. White tablecloths, no fuss. Confirmed for 2 at 20:30.",
      walkMinutes: 8,
      status: "later",
      action: "View booking",
    },
    {
      id: "t5",
      time: "22:00",
      name: "Canal walk · optional",
      short: "Rain clears at 21:45",
      long: "Forecast shows a clear window. Walk from Dorsoduro along the Zattere to Punta della Dogana — 22 minutes, well-lit.",
      status: "optional",
      action: "Add to today",
    },
  ],
  tomorrowPreview: {
    date: "Mon 13 Sep",
    headline: "Gondola ride, 9:00am",
    detail: "45-min gondola ride along the Grand Canal, departing Bacino Orseolo. Pre-booked at 1.5× — locked in already.",
    walkMinutes: 6,
    qcash: 60,
  },
  tripProgress: {
    dayNumber: 3,
    totalDays: 5,
    daysLeft: 2,
    message: "We'll guide you each day — open the app any time to see what's next.",
  },
  nowSnapshot: {
    time: "12:22",
    location: "Dorsoduro waterfront",
    weatherLabel: "Light rain · 18°",
    upNext: {
      name: "Lunch at Cantine del Vino già Schiavi",
      when: "12:30",
      walkMinutes: 6,
      qcash: 8,
      pinId: "cantine-schiavi",
    },
  },
  tripSummary: {
    date: "17 September",
    nights: 5,
    vendors: 14,
    km: 23,
    paid: 140,
    unlocked: 252,
    rebated: 95,
    spent: 78,
    remaining: 17,
  },
  takeControlPersonas: {
    primary: {
      name: "Eleanor",
      q: "42",
      trip: "Venice · Day 3",
      action: "Lunch",
      advice: "Cantine del Vino già Schiavi is a 6-min walk. Use Q$8 — your full cicchetti lunch is covered.",
      targetPin: "cantine-schiavi",
    },
    cruise: {
      name: "Margaret",
      q: "28",
      trip: "Day-pass · 6h left",
      action: "Lunch",
      advice:
        "You have 6 hours before your ship leaves. Caffè Florian has a 47-min queue — Cantine del Vino is ready right now.",
      targetPin: "cantine-schiavi",
    },
    retiree: {
      name: "James",
      q: "56",
      trip: "Venice · Day 2",
      action: "Lunch",
      advice:
        "It's lunchtime. The hotel terrace is 5 minutes away. Or use Q$8 at Cantine del Vino già Schiavi around the corner.",
      targetPin: "cantine-schiavi",
    },
  },
  memoryCaption: {
    date: "13 Sep · 18°C · Light mist",
    location: "Grand Canal",
    quote: "\"The water was completely still that morning, mirrors all the way to Salute.\"",
  },
  donationCauses: "Venice In Peril · Lagoon clean-up · MOSE flood-gate maintenance",
  preBookActivity: {
    title: "Gondola ride on the Grand Canal",
    headline: "45-min gondola · Bacino Orseolo",
    detail: "Couple · Mon 13 Sep, 9:00am",
    multiplierLabel: "1.5× QCash",
    standardPrice: "$240.00",
    qcashApplied: "− Q$60 ($90 value)",
    qcashValue: "Q$60",
    youPay: "$150.00",
    infoNote:
      "Heads up: Pre-spending Q$60 reserves it from your projected balance. If your final rebate lands below Q$60, the gap stays interest-free.",
    imgLabel: "GONDOLA · BACINO ORSEOLO",
  },
  bookingLineItem: {
    suiteLine: "Grand Canal suite × 5 nights",
    suiteAmount: "$3,250.00",
    cleaningAmount: "$75.00",
    serviceAmount: "$240.00",
    taxLabel: "VAT",
    taxAmount: "$520.00",
    sustainabilityLine: "$28/night × 5 nights · funds Venice's lagoon protection",
    totalAmount: "$4,225.00",
    feeRationale: "$28 × 5 · returned as Q$95 in QCash",
    breadcrumb: "Venice, Italy · Grand Canal suite · 5 nights",
  },
  bookingWelcome: {
    eyebrow: "Welcome, Eleanor — your trip to Venice",
    rationale:
      "You're the 2,847th visitor to opt in for the week of 12 September. That puts you under Venice's daily capacity — your sustainability fee is 32% below the seasonal average, and we're projecting a strong QCash rebate.",
    liveCapacity: "● Live · Venice capacity 71% · 2,847 / 4,000",
    effectiveLine: "You'll effectively pay $45",
  },
  landing: {
    partners: [
      "Gritti Palace", "Caffè Florian", "Cipriani", "Doge's Palace", "Murano Glass",
      "Cantine Schiavi", "Trattoria alla Madonna", "Vaporetto ACTV", "Peggy Guggenheim", "Accademia",
      "Hotel Danieli", "Quadri", "Harry's Bar", "Florian Gelato", "Burano Lace",
      "Lido Beach", "Biennale", "Ponte di Rialto", "Squero San Trovaso", "Naranzaria",
      "Vino Vero", "Antiche Carampane", "Osteria alle Testiere", "Al Covo", "Acqua Pazza",
    ],
    testimonials: [
      {
        tag: "Tourist",
        quote: "We saved €200 in 5 days, ate everywhere we wanted, and didn't have to think about budgeting once. The fee paid for itself.",
        name: "Eleanor M.",
        role: "Couple · Venice September 2027",
        initials: "EM",
        bg: "linear-gradient(135deg, #d4b87a 0%, #8a6a2a 100%)",
      },
      {
        tag: "Vendor",
        quote: "Q customers tip 18% more on average and rebook us for the next year. The single-use QR settles instantly to our account.",
        name: "Lorenzo C.",
        role: "Owner · Cantine del Vino già Schiavi",
        initials: "LC",
        bg: "linear-gradient(135deg, #2a7a64 0%, #0a4d3c 100%)",
      },
      {
        tag: "Council",
        quote: "For the first time we have real-time visibility into where visitors spend, when they cluster, and what locals lose. It's the dashboard we wished we had a decade ago.",
        name: "Luigi Brugnaro",
        role: "Mayor · Comune di Venezia",
        initials: "LB",
        bg: "linear-gradient(135deg, #1a3d33 0%, #03100c 100%)",
      },
    ],
    mayor: { name: "Luigi Brugnaro", title: "Mayor", council: "Comune di Venezia" },
    capacityLine: "● Live · Venice capacity 71% · 2,847 / 4,000",
    vendorBlurbCopy:
      "Your visitor levy, returned as spendable currency at 200+ Venetian businesses. Spend on dinner, gondolas, museums, gifts — settle vendors instantly with a QR code.",
    forCityDescription:
      "The Venice visitor contribution was already going to be paid. Project Q gives the money a job. Visitors get a smarter trip. Local businesses get steadier traffic and instant settlement. The Comune gets real-time visibility into spend distribution, capacity pressure, and where money actually lands.",
  },
  walkthroughSubtitle:
    "Eleanor books a Venice trip 6 months out. The fee becomes QCash. She uses it. She goes home. We invite her back.",
  demoIndexSubtitle:
    "Eleanor, couple · Gritti Palace · 12–17 September 2027. Hardcoded demo data — every interaction is mocked but feels live.",
};

/* ---------- Router + hook ------------------------------------------------- */

export const demoDataByDestination: Record<Destination, DemoData> = {
  queenstown,
  venice,
};

export function useDemoData(): DemoData {
  const { destination } = useDestination();
  return demoDataByDestination[destination];
}
