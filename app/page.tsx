"use client";

import React, { useEffect, useMemo, useState } from "react";

/* ============================================================
   BRENZ PIZZA — full simulation in mobile-first layout
   Logic is preserved from the uploaded file unchanged.
   Only the UI shell, navigation, and screen flow are restructured.
   ============================================================ */

/* ----- Types ----- */

type Screen =
  | "intro"
  | "modeSelect"
  | "dayhub"
  | "recipe"
  | "staffing"
  | "purchasing"
  | "open"
  | "running"
  | "results"
  | "weekly"
  | "money"
  | "empire"
  | "gameover";

type ResultCard = "rating" | "summary" | "shifts" | "events" | "coaching" | "books" | "reviews";
type GameMode = "learning" | "survival" | "standard" | "safetyNet";
type GMType = "none" | "operations" | "marketing" | "finance";
type StoreSize = "single" | "campus";

type DayEvent = { id: string; title: string; body: string };
type JournalLine = { account: string; debit: number; credit: number };
type JournalEntry = { id: string; day: number; memo: string; lines: JournalLine[] };

type DayResult = {
  day: number;
  dow: number;

  demand: number;
  lunchDemand: number;
  dinnerDemand: number;

  sold: number;
  lunchSold: number;
  dinnerSold: number;
  lost: number;

  lunchLost: number;
  dinnerLost: number;

  bottleneck: string | null;
  lunchBottleneck: string | null;
  dinnerBottleneck: string | null;

  revenue: number;
  foodCostUsed: number;
  spoilageCost: number;
  laborCost: number;
  fixedCost: number;
  totalCost: number;
  profit: number;

  customerRating: number;
  reputationBefore: number;
  customerReviews: string[];
  customerRatingMessage: string;

  foodPct: number;
  laborPct: number;
  primePct: number;

  cashAfterPrime: number;
  cashAfterFixed: number;

  doughSpoiled: number;
  cheeseUsedOz: number;
  pepperoniUsedOz: number;

  startInv: { dough: number; cheeseOz: number; pepperoniOz: number; boxes: number };
  endInv: { dough: number; cheeseOz: number; pepperoniOz: number; boxes: number };

  recipeCheeseOz: number;
  actualCheeseOz: number;
  recipePepperoniOz: number;
  actualPepperoniOz: number;
  overCheeseImpact: number;
  overPepperoniImpact: number;

  lunchCapacity: number;
  dinnerCapacity: number;
  totalLaborHours: number;

  brandPenaltyApplied: number;
  skimpTriggeredToday: boolean;

  events: DayEvent[];
  coaching: string[];
};

type WeeklySummary = {
  weekNumber: number;
  days: DayResult[];
  totalRevenue: number;
  totalProfit: number;
  avgPrimePct: number;
  avgLaborPct: number;
  avgFoodPct: number;
  totalLostSales: number;
  totalWasteCost: number;
  maxOwnerDistribution: number;
  verdict: string;
};

type GameState = {
  mode: GameMode;
  loanBalance: number;
  loanDailyPayment: number;

  screen: Screen;
  resultCard: ResultCard;

  day: number;
  cash: number;
  ownership: number;
  totalDistributions: number;

  brandPenalty: number;
  brandPenaltyDaysLeft: number;
  satisfactionHistory: number[];

  // Empire upgrades
  gm: GMType;
  storeSize: StoreSize;
  campusFund: number;        // money sunk toward upgrading to campus
  adBoostDays: number;        // days of demand boost remaining
  adBackfireDays: number;     // days of penalty if ad ran during a bad rating

  accountingView: "simple" | "advanced";

  inventory: { dough: number; cheeseOz: number; pepperoniOz: number; boxes: number };
  purchases: { dough: number; cheeseLbs: number; pepperoniLbs: number; boxes: number };
  decisions: {
    price: number;
    cheesePerPizza: number;
    pepperoniPerPizza: number;
    lunchStaff: number;
    dinnerStaff: number;
  };

  distributionRequest: number;

  lastResult: DayResult | null;
  weeklySummary: WeeklySummary | null;
  history: DayResult[];
  journal: JournalEntry[];
};

type Unlocks = {
  staff: boolean;
  buy: boolean;
  price: boolean;
  recipe: boolean;
  equity: boolean;
  distributions: boolean;
  allEventsOn: boolean;
};

type ModeConfig = {
  id: GameMode;
  label: string;
  tagline: string;
  startingCash: number;
  loanBalance: number;
  loanDailyPayment: number;
  lesson: string;
  color: string;
};

/* ----- Constants ----- */

const TOTAL_DAYS = 30;
const OZ_PER_LB = 16;
const LUNCH_BLOCK_HOURS = 5;
const DINNER_BLOCK_HOURS = 5;

const SKIMP_THRESHOLD_OZ = 0.5;
const SKIMP_PENALTY_START = 0.25;
const SKIMP_PENALTY_DAYS = 3;

const MODES: Record<GameMode, ModeConfig> = {
  learning: {
    id: "learning",
    label: "Learning Mode",
    tagline: "One decision at a time. A gentle first run.",
    startingCash: 3000,
    loanBalance: 0,
    loanDailyPayment: 0,
    lesson: "Teaches the game's mechanics one lever at a time. Best first play.",
    color: "#3ba55d",
  },
  survival: {
    id: "survival",
    label: "Survival Mode",
    tagline: "Under-capitalized. One bad day from the edge.",
    startingCash: 800,
    loanBalance: 0,
    loanDailyPayment: 0,
    lesson: "Teaches under-capitalization and when to raise equity.",
    color: "#b63b3b",
  },
  standard: {
    id: "standard",
    label: "Standard Startup",
    tagline: "Balanced start. Find the price-to-quality sweet spot.",
    startingCash: 1800,
    loanBalance: 0,
    loanDailyPayment: 0,
    lesson: "Teaches pricing, portioning, and operating discipline.",
    color: "#e85a2a",
  },
  safetyNet: {
    id: "safetyNet",
    label: "Safety Net",
    tagline: "Plenty of cash up front — but you borrowed most of it.",
    startingCash: 1000,
    loanBalance: 4000,
    loanDailyPayment: 50,
    lesson: "Teaches ROI and the danger of wasteful spending when cash feels plentiful.",
    color: "#3f82ff",
  },
};

const COST = {
  dough: 1.25,
  cheesePerLb: 5.0,
  pepperoniPerLb: 7.0,
  box: 0.5,
  laborPerHour: 20.0,
  fixedPerDay: 375.0,
};

const BASE_DEMAND = 125;
const PIZZAS_PER_PERSON_PER_HOUR = 6;
const OVEN_MAX_PER_DAY = 300;

const DAY_NAMES = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const DAY_MULT = [0.88, 0.93, 0.98, 1.04, 1.45, 1.62, 1.24];
const DAY_WEATHER = ["66° clear", "71° clear", "69° overcast", "73° breezy", "78° sunny", "81° sunny", "70° cool"];

// Brenz day flavor — Monday Wing Night, 25TUES, Brenzday Wednesday, weekend college rush
const DAY_VIBE = [
  "MONDAY WING NIGHT. Wings 50% off pulls a steady crowd in.",
  "25TUES is live. Specialty pizza coupon code is bringing extra orders.",
  "BRENZDAY WEDNESDAY. Free 12\" cheese with any 16\" specialty.",
  "Thursday warms up. Campus vibes building toward the weekend.",
  "Friday rush. Game day energy. Better be ready for dinner.",
  "Saturday volume. Tailgate orders + student dinner wave. Don't get buried.",
  "Sunday family traffic. Catering carryover. Softer than Saturday.",
];

// Brenz Easter eggs — featured pizzas players will recognize from the menu
const BRENZ_FEATURE_PIZZAS = [
  "the Heritage Honey",
  "the Brenz Bomber",
  "the Tres Amigos",
  "the Italiano",
  "the ATM",
  "the Bianca Rosa",
];

const LEARNING_DEFAULTS = {
  price: 15,
  cheesePerPizza: 8,
  pepperoniPerPizza: 2.5,
  lunchStaff: 2,
  dinnerStaff: 4,
  dough: 110,
  cheeseLbs: 60,
  pepperoniLbs: 18,
  boxes: 130,
};

// BRENZ brand palette (matched to brenz.com — deep brand red, warm cream, charcoal)
const BRENZ_RED = "#C8252C";        // primary brand red
const BRENZ_RED_DEEP = "#9E1B22";   // pressed / hover
const BRENZ_CREAM = "#F5EBD8";      // brand cream / paper
const BRENZ_INK = "#1A1614";        // near-black, warmer than pure black
const BRENZ_PANEL = "#241D1A";      // slightly lifted panel surface
const BRENZ_LINE = "#3D322C";       // muted divider
const BRENZ_GOLD = "#E8B257";       // accent / star color
const BRENZ_GREEN = "#7DB069";      // positive
const BRENZ_RED_BAD = "#E07A6F";    // negative (lighter red so it doesn't fight brand red)

// Aliases used throughout (kept for minimal diff)
const ORANGE = BRENZ_RED;
const GOLD = BRENZ_GOLD;
const CREAM = BRENZ_CREAM;
const NIGHT = BRENZ_INK;
const PANEL = BRENZ_PANEL;
const LINE = BRENZ_LINE;
const GREEN = BRENZ_GREEN;
const RED = BRENZ_RED_BAD;

/* ----- Empire constants: GMs, advertising, second location ----- */

const GM_HIRE_COST = 500;       // one-time hire (per your spec)
const GM_DAILY_SALARY = 0;      // simple version — no daily salary, just hire cost
const AD_CAMPAIGN_COST = 400;
const AD_BOOST_DAYS = 4;        // how long the campaign runs
const AD_BOOST_MULT = 1.18;     // demand multiplier while running
const AD_BACKFIRE_PENALTY = 0.20; // 20% demand cut if you run ads while skimping/low-rated
const AD_BACKFIRE_DAYS = 3;

const CAMPUS_TOTAL_COST = 4500;       // total to upgrade to high-volume campus location
const CAMPUS_DEMAND_MULT = 1.45;      // big demand bump
const CAMPUS_FIXED_BUMP = 250;        // bigger rent / utilities

type GMConfig = {
  id: GMType;
  label: string;
  shortName: string;
  specialty: string;
  description: string;
  color: string;
};

const GMS: Record<GMType, GMConfig> = {
  none: {
    id: "none",
    label: "No GM",
    shortName: "—",
    specialty: "",
    description: "You're running the floor yourself.",
    color: BRENZ_LINE,
  },
  operations: {
    id: "operations",
    label: "Mara · Operations",
    shortName: "MARA",
    specialty: "Cuts food waste 25%",
    description: "Mara ran a Brenz commissary for six years. She tightens prep, lowers spoilage, and cleans up over-cheesing.",
    color: "#7DB069",
  },
  marketing: {
    id: "marketing",
    label: "Devon · Marketing",
    shortName: "DEVON",
    specialty: "+10% baseline demand",
    description: "Devon runs the campus social. Constant Reels, student-rep program, line on every Brenzday Wednesday.",
    color: "#E8B257",
  },
  finance: {
    id: "finance",
    label: "Jules · Finance",
    shortName: "JULES",
    specialty: "Cuts labor cost 12%",
    description: "Jules schedules to the demand curve. Same ticket count, fewer paid hours — without burning the team out.",
    color: "#5BA3D0",
  },
};

// (palette moved up above GM defs)

/* ----- Utilities (preserved from original) ----- */

function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function money(v: number, signed = false) {
  const x = n(v);
  const sign = signed && x > 0 ? "+" : "";
  return `${sign}$${Math.round(x).toLocaleString()}`;
}

function pct(v: number) {
  return `${n(v).toFixed(1)}%`;
}

function getUnlocks(mode: GameMode, day: number): Unlocks {
  if (mode !== "learning") {
    return {
      staff: true, buy: true, price: true, recipe: true,
      equity: true, distributions: true, allEventsOn: true,
    };
  }
  return {
    staff: day >= 1,
    buy: day >= 2,
    price: day >= 3,
    recipe: day >= 4,
    equity: day >= 5,
    distributions: day >= 6,
    allEventsOn: day >= 3,
  };
}

function getLearningCoach(day: number): { title: string; body: string } | null {
  if (day === 1) return { title: "Day 1 · Start with staffing",
    body: "Today you only set staff. Inventory and recipe are handled for you. Lunch and dinner each need at least 2 people. More staff = more pizzas you can make per rush." };
  if (day === 2) return { title: "Day 2 · Now you're buying",
    body: "You now control purchasing. Dough spoils overnight. Cheese, pepperoni, and boxes carry over. Buy enough to meet demand — not so much that dough dies." };
  if (day === 3) return { title: "Day 3 · You set the price",
    body: "Price is unlocked. $15 is neutral. Drop it and demand goes up but margin shrinks. Raise it and fewer people come but each sale makes more." };
  if (day === 4) return { title: "Day 4 · The recipe is yours",
    body: "You now choose cheese and pepperoni portions. More topping = more cost per pizza, but more customers. Skimp below 0.5 oz pepperoni and your brand takes a 3-day hit." };
  if (day === 5) return { title: "Day 5 · Equity raises",
    body: "Check the Money screen. If you're running out of cash you can sell 10/20/30% of the shop for a cash injection. But you give up permanent ownership." };
  if (day === 6) return { title: "Day 6 · Owner distributions",
    body: "At the end of every week you can pay yourself. Distributions are the whole point of owning a business. Too greedy and the shop runs out of cash; too timid and you worked for free." };
  if (day === 7) return { title: "Day 7 · You have the full game",
    body: "Every lever is now unlocked. You've seen each mechanic one at a time — now it's yours to balance." };
  return null;
}

function inventoryValue(inv: GameState["inventory"]) {
  return n(inv.dough) * COST.dough +
    (n(inv.cheeseOz) / OZ_PER_LB) * COST.cheesePerLb +
    (n(inv.pepperoniOz) / OZ_PER_LB) * COST.pepperoniPerLb +
    n(inv.boxes) * COST.box;
}

function getEquityRaiseCash(pctSold: number) {
  if (pctSold === 10) return 300;
  if (pctSold === 20) return 700;
  if (pctSold === 30) return 1200;
  return 0;
}

function getPepperoniDemandEffect(pepOz: number) {
  const p = n(pepOz);
  if (p <= 0.1) return 0.1;
  if (p <= 0.25) return 0.25;
  if (p <= 0.5) return 0.45;
  if (p <= 1.0) return 0.7;
  if (p <= 1.5) return 0.9;
  if (p <= 2.0) return 1.0;
  if (p <= 2.75) return 1.1;
  if (p <= 3.5) return 1.14;
  if (p <= 4.5) return 1.06;
  return 0.95;
}

function getCustomerReputation(history: number[]) {
  if (!history || history.length === 0) return 4.1;
  const recent = history.slice(-5);
  return recent.reduce((sum, rating) => sum + n(rating), 0) / recent.length;
}

function getReputationDemandEffect(reputation: number) {
  const r = n(reputation);
  if (r >= 4.8) return 1.18;
  if (r >= 4.4) return 1.1;
  if (r >= 3.8) return 1.0;
  if (r >= 3.0) return 0.85;
  return 0.65;
}

function getCustomerRatingFeedback(rating: number): { message: string; reviews: string[] } {
  const r = n(rating);
  if (r >= 4.8) return {
    message: "LEGENDARY DAY. CUSTOMERS LOVE YOU.",
    reviews: ["Best pizza I've had in forever.", "Fast, hot, and totally worth it.", "This place is becoming my new favorite."],
  };
  if (r >= 4.3) return {
    message: "GREAT DAY. REPUTATION IS BUILDING.",
    reviews: ["Really good pizza tonight.", "Good value and solid service.", "I'd definitely order again."],
  };
  if (r >= 3.8) return {
    message: "DECENT DAY. BUT NOT MEMORABLE.",
    reviews: ["Pizza was fine.", "Nothing bad, but nothing amazing.", "Service was okay."],
  };
  if (r >= 3.0) return {
    message: "WEAK DAY. CUSTOMERS ARE NOT IMPRESSED.",
    reviews: ["Pizza was okay but too expensive.", "Took too long to get my order.", "Not sure I'd come back soon."],
  };
  return {
    message: "BAD DAY. YOU DAMAGED THE BRAND.",
    reviews: ["Way too slow.", "Not worth the price.", "They clearly were not ready for dinner."],
  };
}

type SmartReviewContext = {
  rating: number; demand: number; sold: number;
  lunchLost: number; dinnerLost: number;
  bottleneck: string | null;
  lunchBottleneck: string | null;
  dinnerBottleneck: string | null;
  price: number;
  recipeCheeseOz: number; recipePepperoniOz: number;
  actualCheeseOz: number; actualPepperoniOz: number;
  doughSpoiled: number; primePct: number; profit: number;
};

function generateSmartCustomerReviews(ctx: SmartReviewContext): string[] {
  const reviews: string[] = [];
  const badReviews: string[] = [];
  const goodReviews: string[] = [];

  const addBad = (r: string) => { if (!badReviews.includes(r)) badReviews.push(r); };
  const addGood = (r: string) => { if (!goodReviews.includes(r)) goodReviews.push(r); };

  const fulfillmentRate = n(ctx.demand) > 0 ? n(ctx.sold) / n(ctx.demand) : 1;
  const stockoutBottlenecks = [ctx.bottleneck, ctx.lunchBottleneck, ctx.dinnerBottleneck];
  const anyStockout = stockoutBottlenecks.some((b) =>
    ["dough", "cheese", "pepperoni", "boxes"].includes(String(b))
  );

  if (ctx.dinnerLost > 20) addBad("Took forever during dinner.");
  if (ctx.lunchLost > 10) addBad("Lunch service was slow.");
  if (fulfillmentRate < 0.85) addBad("They were too backed up to handle the orders.");
  if (fulfillmentRate < 0.65) addBad("I tried to order, but they were basically overwhelmed.");

  if (stockoutBottlenecks.includes("dough")) addBad("They were sold out when I tried to order.");
  if (stockoutBottlenecks.includes("cheese")) addBad("They ran out of cheese somehow.");
  if (stockoutBottlenecks.includes("pepperoni")) addBad("They ran out of pepperoni on a pepperoni pizza.");
  if (stockoutBottlenecks.includes("boxes")) addBad("They had pizzas but not enough boxes ready.");
  if (stockoutBottlenecks.includes("dinner labor")) addBad("They clearly didn't have enough people working dinner.");
  if (stockoutBottlenecks.includes("lunch labor")) addBad("The lunch rush needed more help behind the counter.");

  if (ctx.recipePepperoniOz < 0.5) addBad("Barely any pepperoni on the pizza.");
  else if (ctx.recipePepperoniOz < 1.25) addBad("The pepperoni felt pretty light.");
  if (ctx.recipeCheeseOz < 6.5) addBad("Pizza felt light on cheese.");
  if (ctx.recipeCheeseOz > 10.5 || ctx.actualCheeseOz > 11) addBad("Pizza was overloaded and greasy.");
  if (ctx.actualPepperoniOz > 4.5) addBad("Way too much pepperoni grease.");

  if (ctx.price > 22) addBad("$25 pizza better be perfect, and this was not.");
  else if (ctx.price > 19) addBad("Way too expensive for what you get.");
  else if (ctx.price > 16 && ctx.rating < 4.2) addBad("For that price, I expected better.");
  if (ctx.price < 11 && ctx.rating < 4) addBad("Cheap, but it tasted like corners were cut.");

  if (ctx.doughSpoiled > 35 && ctx.rating < 4) addBad("The dough did not taste as fresh today.");
  if (ctx.primePct > 78 && ctx.rating < 4) addBad("Something felt off about the quality tonight.");
  if (ctx.profit < 0 && ctx.rating < 3.8) addBad("The whole operation felt chaotic.");

  if (ctx.lunchLost === 0 && ctx.dinnerLost === 0 && !anyStockout) addGood("Got my food quickly, even during the rush.");
  if (ctx.recipePepperoniOz >= 2 && ctx.recipePepperoniOz <= 3.25) addGood("Perfect amount of pepperoni.");
  if (ctx.recipeCheeseOz >= 7 && ctx.recipeCheeseOz <= 9.25) addGood("Cheese was just right.");
  if (ctx.price <= 15 && ctx.rating >= 4) addGood("Great value for the price.");
  if (ctx.price >= 16 && ctx.rating >= 4.6) addGood("Pricier than some places, but worth it.");
  if (ctx.rating >= 4.7 && fulfillmentRate >= 0.95) addGood("This place is becoming my go-to.");

  if (ctx.rating < 3.8) reviews.push(...badReviews);
  else if (ctx.rating >= 4.4) reviews.push(...goodReviews, ...badReviews);
  else reviews.push(...badReviews, ...goodReviews);

  if (reviews.length === 0) {
    if (ctx.rating >= 4.4) reviews.push("Solid pizza, fair price, and smooth service.");
    else if (ctx.rating >= 3.8) reviews.push("It was fine, but not memorable.");
    else reviews.push("Something about today did not feel right.");
  }

  return reviews.slice(0, 3);
}

function calculateCustomerRating(args: {
  qualityScore: number; fulfillmentRate: number; price: number;
  doughStockout: boolean; primePct: number;
}): number {
  const fulfillmentScore = clamp(n(args.fulfillmentRate) * 5, 0, 5);

  let priceScore = 5;
  const price = n(args.price);
  if (price > 14) priceScore -= (price - 14) * 0.25;
  if (price > 18) priceScore -= (price - 18) * 0.45;
  if (price > 22) priceScore -= (price - 22) * 0.75;
  if (price < 11) priceScore -= (11 - price) * 0.15;
  priceScore = clamp(priceScore, 0, 5);

  let rating = n(args.qualityScore) * 0.5 + fulfillmentScore * 0.3 + priceScore * 0.2;
  if (args.doughStockout) rating -= 0.75;
  if (args.fulfillmentRate < 0.85) rating -= 0.5;
  if (args.fulfillmentRate < 0.65) rating -= 0.75;
  if (args.primePct > 78) rating -= 0.2;

  return Math.round(clamp(rating, 0, 5) * 10) / 10;
}

function phaseDemandSplit(totalDemand: number, dow: number) {
  let dinnerWeight = 0.65;
  if (dow === 4) dinnerWeight = 0.72;
  if (dow === 5) dinnerWeight = 0.75;
  if (dow === 6) dinnerWeight = 0.68;
  const dinnerDemand = Math.round(n(totalDemand) * dinnerWeight);
  const lunchDemand = Math.max(0, n(totalDemand) - dinnerDemand);
  return { lunchDemand, dinnerDemand };
}

function inventoryCap(
  dough: number, cheeseOz: number, pepperoniOz: number, boxes: number,
  actualCheeseOz: number, actualPepperoniOz: number
) {
  const cheeseCap = actualCheeseOz > 0 ? Math.floor(n(cheeseOz) / actualCheeseOz) : 0;
  const pepperoniCap = actualPepperoniOz > 0 ? Math.floor(n(pepperoniOz) / actualPepperoniOz) : 0;
  const caps = [
    { name: "dough", value: Math.max(0, Math.floor(n(dough))) },
    { name: "cheese", value: Math.max(0, cheeseCap) },
    { name: "pepperoni", value: Math.max(0, pepperoniCap) },
    { name: "boxes", value: Math.max(0, Math.floor(n(boxes))) },
  ];
  const max = Math.min(...caps.map((c) => c.value));
  const sorted = [...caps].sort((a, b) => a.value - b.value);
  return { max: Math.max(0, max), bottleneck: sorted[0]?.name ?? null };
}

function makeEntry(day: number, memo: string, lines: JournalLine[]): JournalEntry {
  return {
    id: `${day}-${memo}-${Math.random().toString(36).slice(2, 8)}`,
    day,
    memo,
    lines: lines.map((l) => ({ account: l.account, debit: n(l.debit), credit: n(l.credit) })),
  };
}

/* ----- Initial state ----- */

function initialState(mode: GameMode = "standard", startingScreen: Screen = "intro"): GameState {
  const cfg = MODES[mode];
  const init: GameState = {
    mode,
    loanBalance: cfg.loanBalance,
    loanDailyPayment: cfg.loanDailyPayment,
    screen: startingScreen,
    resultCard: "rating",
    day: 1,
    cash: cfg.startingCash,
    ownership: 1,
    totalDistributions: 0,
    brandPenalty: 0,
    brandPenaltyDaysLeft: 0,
    satisfactionHistory: [],
    gm: "none",
    storeSize: "single",
    campusFund: 0,
    adBoostDays: 0,
    adBackfireDays: 0,
    accountingView: "simple",
    inventory: { dough: 0, cheeseOz: 0, pepperoniOz: 0, boxes: 0 },
    purchases: { dough: 110, cheeseLbs: 60, pepperoniLbs: 18, boxes: 130 },
    decisions: { price: 15, cheesePerPizza: 8, pepperoniPerPizza: 2.5, lunchStaff: 2, dinnerStaff: 4 },
    distributionRequest: 0,
    lastResult: null,
    weeklySummary: null,
    history: [],
    journal: [],
  };

  init.journal.push(makeEntry(0, "Life savings invested", [
    { account: "Cash", debit: cfg.startingCash, credit: 0 },
    { account: "Owner Equity", debit: 0, credit: cfg.startingCash },
  ]));

  if (cfg.loanBalance > 0) {
    init.journal.push(makeEntry(0, "Took business loan", [
      { account: "Cash", debit: cfg.loanBalance, credit: 0 },
      { account: "Loan Payable", debit: 0, credit: cfg.loanBalance },
    ]));
    init.cash += cfg.loanBalance;
  }

  return init;
}
/* ============================================================
   SIMULATION (math preserved from upload)
   ============================================================ */

function simulateDay(state: GameState): DayResult {
  const { day, inventory } = state;
  const dow = (day - 1) % 7;

  const simUnlocks = getUnlocks(state.mode, day);
  const decisions = {
    price: simUnlocks.price ? n(state.decisions.price) : LEARNING_DEFAULTS.price,
    cheesePerPizza: simUnlocks.recipe ? n(state.decisions.cheesePerPizza) : LEARNING_DEFAULTS.cheesePerPizza,
    pepperoniPerPizza: simUnlocks.recipe ? n(state.decisions.pepperoniPerPizza) : LEARNING_DEFAULTS.pepperoniPerPizza,
    lunchStaff: simUnlocks.staff ? n(state.decisions.lunchStaff) : LEARNING_DEFAULTS.lunchStaff,
    dinnerStaff: simUnlocks.staff ? n(state.decisions.dinnerStaff) : LEARNING_DEFAULTS.dinnerStaff,
  };
  const purchases = {
    dough: simUnlocks.buy ? n(state.purchases.dough) : LEARNING_DEFAULTS.dough,
    cheeseLbs: simUnlocks.buy ? n(state.purchases.cheeseLbs) : LEARNING_DEFAULTS.cheeseLbs,
    pepperoniLbs: simUnlocks.buy ? n(state.purchases.pepperoniLbs) : LEARNING_DEFAULTS.pepperoniLbs,
    boxes: simUnlocks.buy ? n(state.purchases.boxes) : LEARNING_DEFAULTS.boxes,
  };

  const startInv = {
    dough: n(inventory.dough) + n(purchases.dough),
    cheeseOz: n(inventory.cheeseOz) + n(purchases.cheeseLbs) * OZ_PER_LB,
    pepperoniOz: n(inventory.pepperoniOz) + n(purchases.pepperoniLbs) * OZ_PER_LB,
    boxes: n(inventory.boxes) + n(purchases.boxes),
  };

  const events: DayEvent[] = [];

  let demandMult = 1;
  let lunchDemandFlat = 0;
  let dinnerDemandFlat = 0;
  let lunchLaborMult = 1;
  let dinnerLaborMult = 1;
  let actualCheeseOz = n(decisions.cheesePerPizza);
  let actualPepperoniOz = n(decisions.pepperoniPerPizza);
  let fixedCostExtra = 0;
  let priceAdjustment = 0;

  const roll = simUnlocks.allEventsOn ? Math.random() : 0.99;

  if (roll < 0.1) {
    actualCheeseOz = n(decisions.cheesePerPizza) * 1.25;
    events.push({ id: "new_hire_cheese", title: "New Hire Over-Cheesed",
      body: 'A new line cook poured about 25% extra cheese on the 12" pizzas.' });
  } else if (roll < 0.18) {
    dinnerDemandFlat += 18;
    events.push({ id: "local_event", title: "Local Event Boost",
      body: "A nearby event pushed extra dinner demand into the store." });
  } else if (roll < 0.26) {
    dinnerLaborMult -= 0.22;
    events.push({ id: "dinner_calloff", title: "Dinner Call-Off",
      body: "A team member called off before dinner. Capacity dropped." });
  } else if (roll < 0.34) {
    lunchLaborMult -= 0.2;
    events.push({ id: "lunch_calloff", title: "Lunch Call-Off",
      body: "A lunch call-off slowed your midday production." });
  } else if (roll < 0.42) {
    demandMult -= 0.15;
    events.push({ id: "slow_day", title: "Slow Day", body: "Traffic came in softer than expected." });
  } else if (roll < 0.5) {
    fixedCostExtra += 80;
    events.push({ id: "minor_break", title: "Minor Equipment Issue",
      body: "You had to spend extra cash today on a small repair." });
  } else if (roll < 0.58) {
    priceAdjustment = -1;
    events.push({ id: "competitor_promo", title: "Competitor Promo",
      body: "A nearby competitor ran a special and made pricing tougher." });
  } else if (roll < 0.66) {
    dinnerDemandFlat += 10;
    events.push({ id: "late_group_order", title: "Late Group Order",
      body: "A surprise group order pushed dinner demand up." });
  } else if (roll < 0.74) {
    actualPepperoniOz = Math.min(6, n(decisions.pepperoniPerPizza) * 1.2);
    events.push({ id: "heavy_hand_pepp", title: "Pepperoni Hand Was Heavy",
      body: "Your topping line used more pepperoni than planned." });
  } else if (roll < 0.81) {
    fixedCostExtra += 50;
    lunchDemandFlat -= 6;
    events.push({ id: "rainy_lunch", title: "Rainy Lunch, Better Dinner",
      body: "Lunch slowed down, but the evening stayed decent." });
  } else if (roll < 0.88) {
    dinnerDemandFlat += 14;
    events.push({ id: "social_media_pop", title: "Social Media Pop",
      body: "A local mention online drove extra customers." });
  }

  if (events.length === 0) {
    events.push({ id: "normal_day", title: "Normal Day", body: "No major disruption today." });
  }

  const effectivePrice = Math.max(10, n(decisions.price) + priceAdjustment);

  // Stronger price elasticity (preserved from upload)
  let priceEffect = Math.pow(15 / effectivePrice, 2.2);
  if (effectivePrice > 18) priceEffect *= 0.85;
  if (effectivePrice > 20) priceEffect *= 0.65;
  if (effectivePrice > 23) priceEffect *= 0.4;
  priceEffect = Math.max(0.15, priceEffect);

  const cheeseQualityEffect = 1 + (n(decisions.cheesePerPizza) - 8) * 0.05;
  const pepperoniEffect = getPepperoniDemandEffect(n(decisions.pepperoniPerPizza));
  const dayEffect = DAY_MULT[dow];
  const randomNoise = 0.92 + Math.random() * 0.16;

  const brandPenaltyMult = 1 - Math.max(0, Math.min(0.6, n(state.brandPenalty)));
  const customerReputation = getCustomerReputation(state.satisfactionHistory);
  const reputationDemandMult = getReputationDemandEffect(customerReputation);

  // Marketing GM gives a steady demand floor lift
  const gmDemandMult = state.gm === "marketing" ? 1.10 : 1.0;

  // Active ad campaign boosts demand for AD_BOOST_DAYS
  const adBoostMult = n(state.adBoostDays) > 0 ? AD_BOOST_MULT : 1.0;

  // Ad backfire: ran ads but rating tanked / skimped — customers feel mismatch
  const adBackfireMult = n(state.adBackfireDays) > 0 ? (1 - AD_BACKFIRE_PENALTY) : 1.0;

  // Campus location is just a much busier store
  const campusDemandMult = state.storeSize === "campus" ? CAMPUS_DEMAND_MULT : 1.0;

  const rawDemand = BASE_DEMAND * dayEffect * priceEffect * cheeseQualityEffect *
    pepperoniEffect * demandMult * brandPenaltyMult * reputationDemandMult *
    gmDemandMult * adBoostMult * adBackfireMult * campusDemandMult * randomNoise;

  const totalDemand = Math.max(0, Math.round(rawDemand));
  const split = phaseDemandSplit(totalDemand, dow);

  const skimpTriggeredToday = n(decisions.pepperoniPerPizza) < SKIMP_THRESHOLD_OZ;

  if (customerReputation >= 4.4) {
    events.push({ id: "strong_reputation", title: "Strong Customer Reputation",
      body: `Recent ratings averaging ${customerReputation.toFixed(1)} stars. Demand is up because customers are telling friends.` });
  } else if (customerReputation < 3.8) {
    events.push({ id: "weak_reputation", title: "Weak Customer Reputation",
      body: `Recent ratings averaging ${customerReputation.toFixed(1)} stars. Demand is down because customers are hesitant to come back.` });
  }

  if (n(state.brandPenalty) > 0.01) {
    events.push({ id: "brand_penalty", title: "Customer Satisfaction Penalty",
      body: `Word got around about past skimpy pizzas. Demand is down about ${Math.round((1 - brandPenaltyMult) * 100)}% today. ${n(state.brandPenaltyDaysLeft)} day(s) left.` });
  }

  if (skimpTriggeredToday) {
    events.push({ id: "skimp_today", title: "You Skimped Today",
      body: `You used only ${n(decisions.pepperoniPerPizza).toFixed(2)} oz of pepperoni. Customers noticed. Expect lower demand for the next ${SKIMP_PENALTY_DAYS} days.` });
  }

  // Ad campaign events
  if (n(state.adBoostDays) > 0) {
    const featurePizza = BRENZ_FEATURE_PIZZAS[(state.day - 1) % BRENZ_FEATURE_PIZZAS.length];
    events.push({
      id: "ad_running",
      title: "Ad Campaign Live",
      body: `Your campaign promoting ${featurePizza} is pulling in extra orders. Demand boosted ~${Math.round((AD_BOOST_MULT - 1) * 100)}%. ${n(state.adBoostDays)} day(s) left.`,
    });
  }

  if (n(state.adBackfireDays) > 0) {
    events.push({
      id: "ad_backfire",
      title: "Ad Campaign Backfired",
      body: `You ran ads while quality slipped. Customers showed up disappointed. Demand down ${Math.round(AD_BACKFIRE_PENALTY * 100)}%. ${n(state.adBackfireDays)} day(s) left.`,
    });
  }

  // GM-flavored events for first day of having one
  if (state.gm !== "none" && day === state.history.length + 1) {
    // (always-on flavor; cheap reminder of why they're paying for a GM)
  }

  const lunchDemand = Math.max(0, n(split.lunchDemand) + lunchDemandFlat);
  const dinnerDemand = Math.max(0, n(split.dinnerDemand) + dinnerDemandFlat);
  const demand = lunchDemand + dinnerDemand;

  const lunchCapacityFromLabor = Math.floor(
    n(decisions.lunchStaff) * LUNCH_BLOCK_HOURS * PIZZAS_PER_PERSON_PER_HOUR * lunchLaborMult
  );
  const dinnerCapacityFromLabor = Math.floor(
    n(decisions.dinnerStaff) * DINNER_BLOCK_HOURS * PIZZAS_PER_PERSON_PER_HOUR * dinnerLaborMult
  );

  let remDough = startInv.dough;
  let remCheeseOz = startInv.cheeseOz;
  let remPepperoniOz = startInv.pepperoniOz;
  let remBoxes = startInv.boxes;

  const lunchInvCap = inventoryCap(remDough, remCheeseOz, remPepperoniOz, remBoxes, actualCheeseOz, actualPepperoniOz);
  const lunchMax = Math.min(lunchCapacityFromLabor, lunchInvCap.max, OVEN_MAX_PER_DAY);
  const lunchSold = Math.max(0, Math.min(lunchDemand, lunchMax));
  const lunchLost = Math.max(0, lunchDemand - lunchSold);

  remDough -= lunchSold;
  remCheeseOz -= lunchSold * actualCheeseOz;
  remPepperoniOz -= lunchSold * actualPepperoniOz;
  remBoxes -= lunchSold;

  const dinnerInvCap = inventoryCap(remDough, remCheeseOz, remPepperoniOz, remBoxes, actualCheeseOz, actualPepperoniOz);
  const dinnerMax = Math.min(dinnerCapacityFromLabor, dinnerInvCap.max, OVEN_MAX_PER_DAY - lunchSold);
  const dinnerSold = Math.max(0, Math.min(dinnerDemand, dinnerMax));
  const dinnerLost = Math.max(0, dinnerDemand - dinnerSold);

  remDough -= dinnerSold;
  remCheeseOz -= dinnerSold * actualCheeseOz;
  remPepperoniOz -= dinnerSold * actualPepperoniOz;
  remBoxes -= dinnerSold;

  const sold = lunchSold + dinnerSold;
  const lost = lunchLost + dinnerLost;

  let bottleneck: string | null = null;
  if (dinnerLost > 0) bottleneck = dinnerCapacityFromLabor < dinnerInvCap.max ? "dinner labor" : dinnerInvCap.bottleneck;
  else if (lunchLost > 0) bottleneck = lunchCapacityFromLabor < lunchInvCap.max ? "lunch labor" : lunchInvCap.bottleneck;

  const lunchBottleneck = lunchLost > 0
    ? lunchCapacityFromLabor < lunchInvCap.max ? "lunch labor" : lunchInvCap.bottleneck
    : null;
  const dinnerBottleneck = dinnerLost > 0
    ? dinnerCapacityFromLabor < dinnerInvCap.max ? "dinner labor" : dinnerInvCap.bottleneck
    : null;

  const cheeseUsedOz = sold * actualCheeseOz;
  const pepperoniUsedOz = sold * actualPepperoniOz;
  const boxUsed = sold;
  const doughSpoiled = Math.max(0, startInv.dough - sold);

  const endInv = {
    dough: 0,
    cheeseOz: Math.max(0, startInv.cheeseOz - cheeseUsedOz),
    pepperoniOz: Math.max(0, startInv.pepperoniOz - pepperoniUsedOz),
    boxes: Math.max(0, startInv.boxes - boxUsed),
  };

  const revenue = sold * effectivePrice;

  const doughFoodCost = sold * COST.dough;
  const cheeseFoodCost = (cheeseUsedOz / OZ_PER_LB) * COST.cheesePerLb;
  const pepperoniFoodCost = (pepperoniUsedOz / OZ_PER_LB) * COST.pepperoniPerLb;
  const boxFoodCost = sold * COST.box;
  const foodCostUsed = doughFoodCost + cheeseFoodCost + pepperoniFoodCost + boxFoodCost;

  // Operations GM cuts spoilage 25%
  const spoilageMult = state.gm === "operations" ? 0.75 : 1.0;
  const spoilageCost = doughSpoiled * COST.dough * spoilageMult;

  const totalLaborHours = n(decisions.lunchStaff) * LUNCH_BLOCK_HOURS + n(decisions.dinnerStaff) * DINNER_BLOCK_HOURS;
  // Finance GM cuts labor cost 12%
  const laborMult = state.gm === "finance" ? 0.88 : 1.0;
  const laborCost = totalLaborHours * COST.laborPerHour * laborMult;

  // Campus location adds fixed costs
  const campusFixedBump = state.storeSize === "campus" ? CAMPUS_FIXED_BUMP : 0;
  const fixedCost = COST.fixedPerDay + fixedCostExtra + n(state.loanDailyPayment) + campusFixedBump;
  const totalCost = foodCostUsed + spoilageCost + laborCost + fixedCost;
  const profit = revenue - totalCost;

  const foodPct = revenue > 0 ? ((foodCostUsed + spoilageCost) / revenue) * 100 : 0;
  const laborPct = revenue > 0 ? (laborCost / revenue) * 100 : 0;
  const primePct = revenue > 0 ? ((foodCostUsed + spoilageCost + laborCost) / revenue) * 100 : 0;
  const cashAfterPrime = revenue - (foodCostUsed + spoilageCost + laborCost);
  const cashAfterFixed = cashAfterPrime - fixedCost;

  const idealCheeseCost = (sold * n(decisions.cheesePerPizza) * COST.cheesePerLb) / OZ_PER_LB;
  const actualCheeseCost = (cheeseUsedOz * COST.cheesePerLb) / OZ_PER_LB;
  const overCheeseImpact = actualCheeseCost - idealCheeseCost;

  const idealPepCost = (sold * n(decisions.pepperoniPerPizza) * COST.pepperoniPerLb) / OZ_PER_LB;
  const actualPepCost = (pepperoniUsedOz * COST.pepperoniPerLb) / OZ_PER_LB;
  const overPepperoniImpact = actualPepCost - idealPepCost;

  const coaching: string[] = [];

  if (dinnerLost > 15) {
    if (dinnerBottleneck === "dinner labor") {
      coaching.push(`Lost ${dinnerLost} pizzas during dinner because dinner staffing was too weak.`);
    } else if (dinnerBottleneck === "dough") {
      coaching.push(`Lost ${dinnerLost} pizzas during dinner because you didn't prep enough dough. More staff wouldn't have helped.`);
    } else if (dinnerBottleneck) {
      coaching.push(`Lost ${dinnerLost} pizzas during dinner because you ran out of ${dinnerBottleneck}.`);
    }
  }
  if (lunchLost > 10) coaching.push(`Missed ${lunchLost} lunch pizzas. Lunch staffing or inventory was too tight.`);
  if (doughSpoiled > 20) coaching.push(`Spoiled ${doughSpoiled} dough balls. You overbought.`);
  if (overCheeseImpact > 10) coaching.push(`Extra cheese quietly cost you ${money(overCheeseImpact)} today.`);
  if (n(decisions.pepperoniPerPizza) <= 0.5) coaching.push(`You skimped on pepperoni today. You saved a few cents per pizza, but your brand just took damage. Demand will be depressed for ${SKIMP_PENALTY_DAYS} days.`);
  if (n(state.brandPenalty) > 0.01) coaching.push(`Brand penalty active: demand was about ${Math.round((1 - brandPenaltyMult) * 100)}% lower today from past skimping.`);
  if (primePct > 70) coaching.push(`Prime cost ${pct(primePct)}. That's the danger zone.`);
  if (primePct > 75) coaching.push(`At this prime cost, fixed costs will bury you.`);
  if (cashAfterFixed < 0) coaching.push(`After fixed costs, the store was cash-negative by ${money(Math.abs(cashAfterFixed))}.`);
  if (profit < 0) coaching.push(`You lost money today. Pricing, staffing, or prep was off.`);
  else if (profit > 300) coaching.push(`Strong day. This is what a good operating day looks like.`);
  if (primePct < 55 && sold > 0) coaching.push(`Prime cost was controlled. That's how owners get paid.`);

  const fulfillmentRate = demand > 0 ? sold / demand : 1;
  const doughStockout = sold > 0 && lost > 0 &&
    (lunchBottleneck === "dough" || dinnerBottleneck === "dough" || bottleneck === "dough");
  const qualityScore = clamp(
    5 - Math.abs(n(decisions.cheesePerPizza) - 8) * 0.28 -
      Math.abs(n(decisions.pepperoniPerPizza) - 2.5) * 0.45,
    0, 5
  );
  const customerRating = calculateCustomerRating({
    qualityScore, fulfillmentRate, price: effectivePrice, doughStockout, primePct,
  });
  const ratingFeedback = getCustomerRatingFeedback(customerRating);
  const smartCustomerReviews = generateSmartCustomerReviews({
    rating: customerRating, demand, sold, lunchLost, dinnerLost,
    bottleneck, lunchBottleneck, dinnerBottleneck, price: effectivePrice,
    recipeCheeseOz: n(decisions.cheesePerPizza),
    recipePepperoniOz: n(decisions.pepperoniPerPizza),
    actualCheeseOz, actualPepperoniOz, doughSpoiled, primePct, profit,
  });

  coaching.push(`Customer rating: ${customerRating.toFixed(1)} stars. ${ratingFeedback.message}`);

  return {
    day, dow,
    demand, lunchDemand, dinnerDemand,
    sold, lunchSold, dinnerSold, lost, lunchLost, dinnerLost,
    bottleneck, lunchBottleneck, dinnerBottleneck,
    revenue, foodCostUsed, spoilageCost, laborCost, fixedCost, totalCost, profit,
    customerRating, reputationBefore: customerReputation,
    customerReviews: smartCustomerReviews,
    customerRatingMessage: ratingFeedback.message,
    foodPct, laborPct, primePct,
    cashAfterPrime, cashAfterFixed,
    doughSpoiled, cheeseUsedOz, pepperoniUsedOz,
    startInv, endInv,
    recipeCheeseOz: n(decisions.cheesePerPizza), actualCheeseOz,
    recipePepperoniOz: n(decisions.pepperoniPerPizza), actualPepperoniOz,
    overCheeseImpact, overPepperoniImpact,
    lunchCapacity: lunchCapacityFromLabor, dinnerCapacity: dinnerCapacityFromLabor, totalLaborHours,
    brandPenaltyApplied: n(state.brandPenalty),
    skimpTriggeredToday,
    events, coaching,
  };
}

function getWeeklySummary(history: DayResult[], cash: number, ownership: number): WeeklySummary | null {
  if (history.length === 0) return null;
  const latestDay = history[history.length - 1].day;
  if (latestDay % 7 !== 0) return null;

  const weekStart = latestDay - 6;
  const weekDays = history.filter((d) => d.day >= weekStart && d.day <= latestDay);

  const totalRevenue = weekDays.reduce((s, d) => s + n(d.revenue), 0);
  const totalProfit = weekDays.reduce((s, d) => s + n(d.profit), 0);
  const avgPrimePct = weekDays.length ? weekDays.reduce((s, d) => s + n(d.primePct), 0) / weekDays.length : 0;
  const avgLaborPct = weekDays.length ? weekDays.reduce((s, d) => s + n(d.laborPct), 0) / weekDays.length : 0;
  const avgFoodPct = weekDays.length ? weekDays.reduce((s, d) => s + n(d.foodPct), 0) / weekDays.length : 0;
  const totalLostSales = weekDays.reduce((s, d) => s + n(d.lost) * 15, 0);
  const totalWasteCost = weekDays.reduce((s, d) => s + n(d.spoilageCost), 0);

  const maxOwnerDistribution = Math.max(
    0,
    Math.min(n(cash) - 500, Math.max(0, totalProfit) * 0.9 * n(ownership) + 250)
  );

  let verdict = "Average week.";
  if (avgPrimePct > 70) verdict = "Too much waste or labor. Busy ≠ healthy.";
  else if (avgPrimePct > 62) verdict = "Close, but still leaking margin.";
  else if (avgPrimePct >= 55 && avgPrimePct <= 60) verdict = "Strong operator week. This is the zone.";
  else if (avgPrimePct < 55) verdict = "Very efficient week. Don't under-serve demand.";

  return {
    weekNumber: Math.ceil(latestDay / 7), days: weekDays, totalRevenue, totalProfit,
    avgPrimePct, avgLaborPct, avgFoodPct, totalLostSales, totalWasteCost,
    maxOwnerDistribution, verdict,
  };
}

function buildBalanceSheet(state: GameState) {
  const cash = n(state.cash);
  const invValue = inventoryValue(state.inventory);
  const totalAssets = cash + invValue;
  const liabilities = n(state.loanBalance);
  const equity = totalAssets - liabilities;
  return {
    assets: { cash, inventory: invValue, total: totalAssets },
    liabilities: { loan: liabilities, total: liabilities },
    equity: { ownerEquityPlug: equity },
  };
}

function buildIncomeStatement(history: DayResult[]) {
  const revenue = history.reduce((s, d) => s + n(d.revenue), 0);
  const foodUsed = history.reduce((s, d) => s + n(d.foodCostUsed), 0);
  const spoilage = history.reduce((s, d) => s + n(d.spoilageCost), 0);
  const labor = history.reduce((s, d) => s + n(d.laborCost), 0);
  const fixed = history.reduce((s, d) => s + n(d.fixedCost), 0);
  const netIncome = revenue - foodUsed - spoilage - labor - fixed;
  return { revenue, foodUsed, spoilage, labor, fixed, netIncome };
}

function buildTAccounts(state: GameState) {
  const totals: Record<string, { debit: number; credit: number }> = {};
  for (const entry of state.journal) {
    for (const line of entry.lines) {
      if (!totals[line.account]) totals[line.account] = { debit: 0, credit: 0 };
      totals[line.account].debit += n(line.debit);
      totals[line.account].credit += n(line.credit);
    }
  }
  return totals;
}
/* ============================================================
   MAIN COMPONENT
   ============================================================ */

export default function Page() {
  const [state, setState] = useState<GameState>(initialState());

  const unlocks = getUnlocks(state.mode, state.day);
  const learningCoach = state.mode === "learning" ? getLearningCoach(state.day) : null;
  const dow = (state.day - 1) % 7;

  // Display values fall back to LEARNING_DEFAULTS when locked
  const p = {
    dough: unlocks.buy ? n(state.purchases.dough) : LEARNING_DEFAULTS.dough,
    cheeseLbs: unlocks.buy ? n(state.purchases.cheeseLbs) : LEARNING_DEFAULTS.cheeseLbs,
    pepperoniLbs: unlocks.buy ? n(state.purchases.pepperoniLbs) : LEARNING_DEFAULTS.pepperoniLbs,
    boxes: unlocks.buy ? n(state.purchases.boxes) : LEARNING_DEFAULTS.boxes,
  };
  const d = {
    price: unlocks.price ? n(state.decisions.price) : LEARNING_DEFAULTS.price,
    cheesePerPizza: unlocks.recipe ? n(state.decisions.cheesePerPizza) : LEARNING_DEFAULTS.cheesePerPizza,
    pepperoniPerPizza: unlocks.recipe ? n(state.decisions.pepperoniPerPizza) : LEARNING_DEFAULTS.pepperoniPerPizza,
    lunchStaff: unlocks.staff ? n(state.decisions.lunchStaff) : LEARNING_DEFAULTS.lunchStaff,
    dinnerStaff: unlocks.staff ? n(state.decisions.dinnerStaff) : LEARNING_DEFAULTS.dinnerStaff,
  };

  const purchaseCost =
    n(p.dough) * COST.dough +
    n(p.cheeseLbs) * COST.cheesePerLb +
    n(p.pepperoniLbs) * COST.pepperoniPerLb +
    n(p.boxes) * COST.box;

  const totalLaborHours = n(d.lunchStaff) * LUNCH_BLOCK_HOURS + n(d.dinnerStaff) * DINNER_BLOCK_HOURS;
  const laborPreview = totalLaborHours * COST.laborPerHour;
  const canAfford = purchaseCost <= n(state.cash);

  const projectedDemandMid =
    BASE_DEMAND *
    DAY_MULT[dow] *
    Math.pow(15 / Math.max(10, n(d.price)), 1.4) *
    (1 + (n(d.cheesePerPizza) - 8) * 0.05) *
    getPepperoniDemandEffect(n(d.pepperoniPerPizza)) *
    getReputationDemandEffect(getCustomerReputation(state.satisfactionHistory));

  const projectedRange = {
    lo: Math.round(projectedDemandMid * 0.92),
    hi: Math.round(projectedDemandMid * 1.08),
  };

  const balanceSheet = useMemo(() => buildBalanceSheet(state), [state]);
  const incomeStatement = useMemo(() => buildIncomeStatement(state.history), [state.history]);
  const tAccounts = useMemo(() => buildTAccounts(state), [state]);
  const reputation = getCustomerReputation(state.satisfactionHistory);

  /* ----- Setters ----- */

  function setPurchase<K extends keyof GameState["purchases"]>(key: K, value: number) {
    setState((s) => ({ ...s, purchases: { ...s.purchases, [key]: Math.max(0, n(value)) } }));
  }

  function setDecision<K extends keyof GameState["decisions"]>(key: K, value: number) {
    setState((s) => ({ ...s, decisions: { ...s.decisions, [key]: n(value) } }));
  }

  function goScreen(screen: Screen) {
    setState((s) => ({ ...s, screen }));
  }

  function selectMode(mode: GameMode) {
    setState(initialState(mode, "dayhub"));
  }

  function applyEquitySale(pctSold: number) {
    if (!unlocks.equity || pctSold === 0) return;
    const MIN_OWNERSHIP = 0.1;
    setState((s) => {
      const maxPctCanSell = Math.max(0, (n(s.ownership) - MIN_OWNERSHIP) * 100);
      const actualPctSold = Math.min(pctSold, maxPctCanSell);
      if (actualPctSold <= 0) return s;
      const cashIn = getEquityRaiseCash(actualPctSold);
      return {
        ...s,
        cash: n(s.cash) + cashIn,
        ownership: Math.max(MIN_OWNERSHIP, n(s.ownership) - actualPctSold / 100),
        journal: [...s.journal, makeEntry(s.day, `Sold ${actualPctSold}% equity`, [
          { account: "Cash", debit: cashIn, credit: 0 },
          { account: "Owner Equity", debit: 0, credit: cashIn },
        ])],
      };
    });
  }

  /* ----- Empire actions ----- */

  function hireGM(gm: GMType) {
    if (gm === "none") return;
    if (n(state.cash) < GM_HIRE_COST) return;
    if (state.gm === gm) return; // already hired
    setState((s) => ({
      ...s,
      cash: n(s.cash) - GM_HIRE_COST,
      gm,
      journal: [...s.journal, makeEntry(s.day, `Hired ${GMS[gm].label}`, [
        { account: "GM Hire", debit: GM_HIRE_COST, credit: 0 },
        { account: "Cash", debit: 0, credit: GM_HIRE_COST },
      ])],
    }));
  }

  function runAdCampaign() {
    if (n(state.cash) < AD_CAMPAIGN_COST) return;
    if (state.adBoostDays > 0) return; // already running
    setState((s) => ({
      ...s,
      cash: n(s.cash) - AD_CAMPAIGN_COST,
      adBoostDays: AD_BOOST_DAYS,
      journal: [...s.journal, makeEntry(s.day, "Ran ad campaign", [
        { account: "Marketing Expense", debit: AD_CAMPAIGN_COST, credit: 0 },
        { account: "Cash", debit: 0, credit: AD_CAMPAIGN_COST },
      ])],
    }));
  }

  function investCampus(amount: number) {
    if (state.storeSize === "campus") return;
    if (n(state.cash) < amount) return;
    setState((s) => {
      const newFund = n(s.campusFund) + amount;
      const upgraded = newFund >= CAMPUS_TOTAL_COST;
      return {
        ...s,
        cash: n(s.cash) - amount,
        campusFund: upgraded ? CAMPUS_TOTAL_COST : newFund,
        storeSize: upgraded ? "campus" : "single",
        journal: [...s.journal, makeEntry(s.day,
          upgraded ? "Opened BRENZ Campus location" : "Invested in campus expansion", [
            { account: "Buildout (Campus)", debit: amount, credit: 0 },
            { account: "Cash", debit: 0, credit: amount },
          ])],
      };
    });
  }

  /* ----- Day flow ----- */

  function openStore() {
    if (purchaseCost > n(state.cash)) return;

    const stateAfterBuy: GameState = {
      ...state,
      cash: n(state.cash) - purchaseCost,
      journal: [...state.journal, makeEntry(state.day, "Bought inventory", [
        { account: "Inventory", debit: purchaseCost, credit: 0 },
        { account: "Cash", debit: 0, credit: purchaseCost },
      ])],
    };

    setState({ ...stateAfterBuy, screen: "running" });

    const sim = simulateDay(stateAfterBuy);

    window.setTimeout(() => {
      setState((s) => ({ ...s, lastResult: sim, screen: "results", resultCard: "rating" }));
    }, 4500);
  }

  function continueAfterDay() {
    setState((s) => {
      if (!s.lastResult) return s;

      const r = s.lastResult;
      const nextCash = n(s.cash) + n(r.revenue) - n(r.laborCost) - n(r.fixedCost);
      const newHistory = [...s.history, r];
      const nextDay = s.day + 1;
      const weeklySummary = getWeeklySummary(newHistory, nextCash, s.ownership);

      // Brand equity evolution
      let nextBrandPenalty = n(s.brandPenalty);
      let nextBrandDaysLeft = Math.max(0, n(s.brandPenaltyDaysLeft) - 1);
      if (nextBrandDaysLeft <= 0) nextBrandPenalty = 0;
      else nextBrandPenalty = nextBrandPenalty * 0.85;
      if (r.skimpTriggeredToday) {
        nextBrandPenalty = Math.max(nextBrandPenalty, SKIMP_PENALTY_START);
        nextBrandDaysLeft = SKIMP_PENALTY_DAYS;
      }

      // Ad timer decay + backfire check
      let nextAdBoostDays = Math.max(0, n(s.adBoostDays) - 1);
      let nextAdBackfireDays = Math.max(0, n(s.adBackfireDays) - 1);
      // If we ran ads while skimping or got a bad rating today → backfire
      if (n(s.adBoostDays) > 0 && (r.skimpTriggeredToday || r.customerRating < 3.0)) {
        nextAdBackfireDays = AD_BACKFIRE_DAYS;
      }

      // Loan payment
      const loanPayment = n(s.loanDailyPayment);
      const loanApplied = Math.min(n(s.loanBalance), loanPayment);
      const nextLoanBalance = Math.max(0, n(s.loanBalance) - loanApplied);

      // Bankruptcy check
      const bankrupt = nextCash < -1500;
      const nextScreen: Screen = bankrupt
        ? "gameover"
        : nextDay > TOTAL_DAYS
        ? "gameover"
        : weeklySummary
        ? "weekly"
        : "dayhub";

      const newJournal = [...s.journal];
      newJournal.push(makeEntry(s.day, "Recorded sales", [
        { account: "Cash", debit: r.revenue, credit: 0 },
        { account: "Sales Revenue", debit: 0, credit: r.revenue },
      ]));
      newJournal.push(makeEntry(s.day, "Recorded food + spoilage", [
        { account: "COGS + Waste", debit: r.foodCostUsed + r.spoilageCost, credit: 0 },
        { account: "Inventory", debit: 0, credit: r.foodCostUsed + r.spoilageCost },
      ]));
      newJournal.push(makeEntry(s.day, "Paid labor", [
        { account: "Labor Expense", debit: r.laborCost, credit: 0 },
        { account: "Cash", debit: 0, credit: r.laborCost },
      ]));

      const nonLoanFixed = Math.max(0, r.fixedCost - loanApplied);
      if (nonLoanFixed > 0) {
        newJournal.push(makeEntry(s.day, "Paid fixed costs", [
          { account: "Fixed Expense", debit: nonLoanFixed, credit: 0 },
          { account: "Cash", debit: 0, credit: nonLoanFixed },
        ]));
      }
      if (loanApplied > 0) {
        newJournal.push(makeEntry(s.day, "Loan payment", [
          { account: "Loan Payable", debit: loanApplied, credit: 0 },
          { account: "Cash", debit: 0, credit: loanApplied },
        ]));
      }

      return {
        ...s,
        day: nextDay,
        cash: nextCash,
        loanBalance: nextLoanBalance,
        brandPenalty: nextBrandPenalty,
        brandPenaltyDaysLeft: nextBrandDaysLeft,
        adBoostDays: nextAdBoostDays,
        adBackfireDays: nextAdBackfireDays,
        inventory: { ...r.endInv },
        purchases: {
          dough: Math.max(40, Math.round(n(r.sold) * 0.95)),
          cheeseLbs: Math.max(10, Math.round((n(r.sold) * n(s.decisions.cheesePerPizza)) / OZ_PER_LB)),
          pepperoniLbs: Math.max(4, Math.round((n(r.sold) * n(s.decisions.pepperoniPerPizza)) / OZ_PER_LB)),
          boxes: Math.max(40, n(r.sold)),
        },
        lastResult: null,
        history: newHistory,
        satisfactionHistory: [...s.satisfactionHistory.slice(-6), r.customerRating],
        weeklySummary,
        distributionRequest: 0,
        screen: nextScreen,
        resultCard: "rating",
        journal: newJournal,
      };
    });
  }

  function processWeeklyDistribution() {
    setState((s) => {
      if (!s.weeklySummary) return s;
      const maxAllowed = Math.floor(n(s.weeklySummary.maxOwnerDistribution));
      const requested = clamp(n(s.distributionRequest), 0, maxAllowed);
      return {
        ...s,
        cash: n(s.cash) - requested,
        totalDistributions: n(s.totalDistributions) + requested,
        distributionRequest: 0,
        weeklySummary: null,
        screen: s.day > TOTAL_DAYS ? "gameover" : "dayhub",
        journal: [...s.journal, makeEntry(s.day, "Owner distribution", [
          { account: "Distributions", debit: requested, credit: 0 },
          { account: "Cash", debit: 0, credit: requested },
        ])],
      };
    });
  }

  function resetGame() {
    setState(initialState("standard", "modeSelect"));
  }

  /* ----- Render ----- */

  return (
    <div style={pageWrap}>
      <style>{globalCSS}</style>

      {state.screen !== "intro" && state.screen !== "modeSelect" && (
        <div style={statusBar}>
          <span>9:41</span>
          <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <SignalIcon /> <BatteryIcon />
          </span>
        </div>
      )}

      {/* BRENZ brand header */}
      {state.screen !== "intro" && state.screen !== "modeSelect" && (
        <div style={brenzHeader}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22,
              color: BRENZ_RED, letterSpacing: 1.5 }}>BRENZ</span>
            <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 12,
              color: BRENZ_GOLD, letterSpacing: 2 }}>PIZZA CO.</span>
          </div>
          {state.storeSize === "campus" && (
            <span style={{ fontSize: 9, padding: "3px 7px", background: BRENZ_RED,
              color: "white", borderRadius: 4, fontWeight: 800, letterSpacing: 1 }}>
              CAMPUS
            </span>
          )}
        </div>
      )}

      {state.screen !== "intro" && state.screen !== "modeSelect" && state.screen !== "gameover" && (
        <div style={hud}>
          <HUDCell label="DAY" value={`${Math.min(state.day, TOTAL_DAYS)}`} sub={`/${TOTAL_DAYS}`} />
          <HUDCell label="CASH" value={money(state.cash)} />
          <HUDCell label="OWN" value={`${Math.round(n(state.ownership) * 100)}%`} />
          <HUDCell label="PAID" value={money(state.totalDistributions)} />
        </div>
      )}

      {state.screen !== "intro" && state.screen !== "modeSelect" && state.screen !== "gameover" && (
        <div style={repStrip}>
          {state.satisfactionHistory.length > 0 && (
            <>
              <span style={{ display: "flex", gap: 2 }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} filled={reputation >= i - 0.5} />
                ))}
              </span>
              <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 14, color: GOLD,
                marginLeft: 4 }}>
                {reputation.toFixed(1)}
              </span>
            </>
          )}
          <div style={{ marginLeft: "auto", display: "flex", gap: 4, flexWrap: "wrap",
            justifyContent: "flex-end" }}>
            {state.gm !== "none" && (
              <span style={{ padding: "2px 6px", background: GMS[state.gm as GMType].color,
                color: BRENZ_INK, borderRadius: 4, fontSize: 9, fontWeight: 800 }}>
                {GMS[state.gm as GMType].shortName}
              </span>
            )}
            {state.adBoostDays > 0 && (
              <span style={{ padding: "2px 6px", background: BRENZ_GOLD, color: BRENZ_INK,
                borderRadius: 4, fontSize: 9, fontWeight: 800 }}>
                AD {state.adBoostDays}D
              </span>
            )}
            {state.adBackfireDays > 0 && (
              <span style={{ padding: "2px 6px", background: RED, color: BRENZ_INK,
                borderRadius: 4, fontSize: 9, fontWeight: 800 }}>
                BACKLASH
              </span>
            )}
            {state.brandPenaltyDaysLeft > 0 && (
              <span style={{ padding: "2px 6px", background: RED, color: BRENZ_INK,
                borderRadius: 4, fontSize: 9, fontWeight: 800 }}>
                SKIMP {state.brandPenaltyDaysLeft}D
              </span>
            )}
            {state.loanBalance > 0 && (
              <span style={{ padding: "2px 6px", background: "#5BA3D0", color: BRENZ_INK,
                borderRadius: 4, fontSize: 9, fontWeight: 800 }}>
                LOAN {money(state.loanBalance)}
              </span>
            )}
          </div>
        </div>
      )}

      <div style={body}>
        {state.screen === "intro" && <IntroScreen onStart={() => goScreen("modeSelect")} />}

        {state.screen === "modeSelect" && (
          <ModeSelectScreen onSelect={selectMode} />
        )}

        {state.screen === "dayhub" && (
          <DayHub state={state} dow={dow} unlocks={unlocks} learningCoach={learningCoach}
            projDemand={Math.round(projectedDemandMid)} d={d} p={p}
            purchaseCost={purchaseCost} canAfford={canAfford}
            onRecipe={() => goScreen("recipe")}
            onStaffing={() => goScreen("staffing")}
            onPurchasing={() => goScreen("purchasing")}
            onOpen={() => goScreen("open")}
            onMoney={() => goScreen("money")}
            onEmpire={() => goScreen("empire")} />
        )}

        {state.screen === "recipe" && (
          <DecisionScreen title="RECIPE & PRICE" subtitle="What goes on the pizza, what it sells for."
            onBack={() => goScreen("dayhub")} onSave={() => goScreen("dayhub")}>
            {!unlocks.price && <LockedNote text="Price unlocks on Day 3" />}
            {unlocks.price && (
              <Slider label="Price" value={`$${d.price}`} v={d.price} min={10} max={25} step={1}
                onChange={(v) => setDecision("price", v)} hint="Lower = traffic. Higher = margin." />
            )}
            {!unlocks.recipe && <LockedNote text="Recipe unlocks on Day 4" />}
            {unlocks.recipe && (
              <>
                <Slider label="Cheese" value={`${d.cheesePerPizza.toFixed(1)} oz`} v={d.cheesePerPizza}
                  min={6} max={12} step={0.5} onChange={(v) => setDecision("cheesePerPizza", v)}
                  hint="More appeal, more cost." />
                <Slider label="Pepperoni" value={`${d.pepperoniPerPizza.toFixed(2)} oz`} v={d.pepperoniPerPizza}
                  min={0.05} max={6} step={0.05} onChange={(v) => setDecision("pepperoniPerPizza", v)}
                  hint="Below 0.5oz = brand penalty for 3 days."
                  warn={d.pepperoniPerPizza <= 0.5 ? "Skimp warning. 3-day brand hit incoming." : null} />
              </>
            )}
          </DecisionScreen>
        )}

        {state.screen === "staffing" && (
          <DecisionScreen title="STAFFING" subtitle="11am–9pm. Dinner rush is when you make money."
            onBack={() => goScreen("dayhub")} onSave={() => goScreen("dayhub")}>
            <Slider label="Lunch staff (11–4)" value={`${d.lunchStaff}`} v={d.lunchStaff} min={2} max={8} step={1}
              onChange={(v) => setDecision("lunchStaff", v)}
              hint={`Capacity: ${d.lunchStaff * LUNCH_BLOCK_HOURS * PIZZAS_PER_PERSON_PER_HOUR} pizzas`} />
            <Slider label="Dinner staff (4–9)" value={`${d.dinnerStaff}`} v={d.dinnerStaff} min={2} max={10} step={1}
              onChange={(v) => setDecision("dinnerStaff", v)}
              hint={`Capacity: ${d.dinnerStaff * DINNER_BLOCK_HOURS * PIZZAS_PER_PERSON_PER_HOUR} pizzas`} />
            <div style={costStrip}>
              <span>Total labor cost</span>
              <strong>{money(laborPreview)}</strong>
            </div>
          </DecisionScreen>
        )}

        {state.screen === "purchasing" && (
          <DecisionScreen title="PURCHASING" subtitle="Buy what you'll need. Dough dies daily."
            onBack={() => goScreen("dayhub")} onSave={() => goScreen("dayhub")}>
            {!unlocks.buy && <LockedNote text="Purchasing unlocks on Day 2. We'll buy for you today." />}
            {unlocks.buy && (
              <>
                <Slider label="Dough balls" value={`${p.dough}`} v={p.dough} min={0} max={220} step={5}
                  onChange={(v) => setPurchase("dough", v)} hint="$1.25 each — perishable" />
                <Slider label="Cheese (lbs)" value={`${p.cheeseLbs}`} v={p.cheeseLbs} min={0} max={120} step={1}
                  onChange={(v) => setPurchase("cheeseLbs", v)} hint="$5/lb — carries over" />
                <Slider label="Pepperoni (lbs)" value={`${p.pepperoniLbs}`} v={p.pepperoniLbs} min={0} max={60} step={1}
                  onChange={(v) => setPurchase("pepperoniLbs", v)} hint="$7/lb — carries over" />
                <Slider label="Boxes" value={`${p.boxes}`} v={p.boxes} min={0} max={240} step={5}
                  onChange={(v) => setPurchase("boxes", v)} hint="$0.50 each — carries over" />
              </>
            )}
            <div style={costStrip}>
              <span>Total today</span>
              <strong>{money(purchaseCost)}</strong>
            </div>
            <div style={{ marginTop: 8, fontSize: 11, color: canAfford ? GREEN : RED }}>
              Cash after buy: {money(n(state.cash) - purchaseCost)}
            </div>
          </DecisionScreen>
        )}

        {state.screen === "open" && (
          <OpenScreen state={state} d={d} projDemand={projectedRange} canAfford={canAfford}
            purchaseCost={purchaseCost} onBack={() => goScreen("dayhub")} onOpen={openStore} />
        )}

        {state.screen === "running" && <RunningScreen />}

        {state.screen === "results" && state.lastResult && (
          <ResultsStack
            result={state.lastResult}
            card={state.resultCard}
            setCard={(c: ResultCard) => setState((s) => ({ ...s, resultCard: c }))}
            onContinue={continueAfterDay}
          />
        )}

        {state.screen === "weekly" && state.weeklySummary && (
          <WeeklyScreen summary={state.weeklySummary} ownership={state.ownership}
            unlocks={unlocks}
            distributionRequest={state.distributionRequest}
            setDistributionRequest={(v: number) =>
              setState((s) => ({ ...s, distributionRequest: v }))}
            onProcess={processWeeklyDistribution} />
        )}

        {state.screen === "money" && (
          <MoneyScreen
            state={state}
            balanceSheet={balanceSheet}
            incomeStatement={incomeStatement}
            tAccounts={tAccounts}
            unlocks={unlocks}
            onBack={() => goScreen("dayhub")}
            onEquitySale={applyEquitySale}
            onAccountingView={(v: "simple" | "advanced") => setState((s) => ({ ...s, accountingView: v }))} />
        )}

        {state.screen === "empire" && (
          <EmpireScreen
            state={state}
            onBack={() => goScreen("dayhub")}
            onHireGM={hireGM}
            onRunAd={runAdCampaign}
            onInvestCampus={investCampus} />
        )}

        {state.screen === "gameover" && (
          <GameOverScreen state={state} onReset={resetGame} />
        )}
      </div>
    </div>
  );
}
/* ============================================================
   SCREEN COMPONENTS
   ============================================================ */

function IntroScreen({ onStart }: { onStart: () => void }) {
  return (
    <div style={{ padding: "40px 28px 40px", textAlign: "center", display: "flex",
      flexDirection: "column", justifyContent: "center", minHeight: "100%",
      background: `radial-gradient(circle at 50% 30%, #2a1f1a 0%, ${BRENZ_INK} 70%)` }}>

      <BrenzStamp />

      <div style={{ marginTop: 24, fontSize: 11, letterSpacing: 6, color: BRENZ_GOLD, fontWeight: 800 }}>
        BRENZ PIZZA CO. PRESENTS
      </div>

      <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 64, lineHeight: 0.85,
        margin: "8px 0 0 0", letterSpacing: 1, color: BRENZ_CREAM }}>
        THE BRENZ<br />
        <span style={{ color: BRENZ_RED }}>PIZZA GAME</span>
      </h1>

      <div style={{ width: 60, height: 3, background: BRENZ_RED, margin: "20px auto" }} />

      <p style={{ color: "#c8b48c", fontSize: 16, lineHeight: 1.6, fontFamily: "'Fraunces',serif",
        fontStyle: "italic" }}>
        Try some;<br />you'll taste the love.
      </p>

      <p style={{ color: "#c8b48c", fontSize: 14, lineHeight: 1.6, fontFamily: "'Fraunces',serif", marginTop: 18 }}>
        Run a Brenz location for 30 days.<br />
        One product, one shot: a 12" pepperoni.
      </p>

      <div style={{ marginTop: 22, padding: 14, background: `${BRENZ_RED}15`,
        border: `1px solid ${BRENZ_RED}`, borderRadius: 12 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: BRENZ_RED, fontWeight: 800 }}>
          THIS WEEK AT BRENZ
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: BRENZ_CREAM, lineHeight: 1.5 }}>
          MON · Wing Night, 50% off<br />
          TUE · 25TUES specialty pizza<br />
          WED · Brenzday Wednesday
        </div>
      </div>

      <button onClick={onStart} style={{ ...primaryBtn, marginTop: 28 }}>START MY ORDER →</button>

      <div style={{ marginTop: 16, fontSize: 10, color: "#5a4f44", letterSpacing: 1 }}>
        Locations: Chapel Hill · Columbus · Knoxville · Dublin · Durham
      </div>
    </div>
  );
}

// Brenz stamp / brand mark
function BrenzStamp() {
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div style={{
        width: 110, height: 110,
        borderRadius: "50%",
        border: `3px solid ${BRENZ_RED}`,
        background: BRENZ_INK,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column",
        position: "relative",
        boxShadow: `0 0 0 1px ${BRENZ_LINE}, 0 8px 24px rgba(200,37,44,0.3)`,
      }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 11, color: BRENZ_GOLD,
          letterSpacing: 2, marginTop: -4 }}>EST.</div>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 36, color: BRENZ_RED,
          letterSpacing: 1, lineHeight: 1, marginTop: 2 }}>BRENZ</div>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 8, color: BRENZ_CREAM,
          letterSpacing: 3, marginTop: 4 }}>PIZZA · CO.</div>
      </div>
    </div>
  );
}

function ModeSelectScreen({ onSelect }: { onSelect: (m: GameMode) => void }) {
  const modes: GameMode[] = ["learning", "standard", "survival", "safetyNet"];
  return (
    <div style={{ padding: "20px 16px 40px", overflowY: "auto", height: "100%" }}>
      <div style={{ fontSize: 11, letterSpacing: 4, color: GOLD, textAlign: "center" }}>SELECT MODE</div>
      <h2 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 36, textAlign: "center",
        marginTop: 6, letterSpacing: 1 }}>Pick your difficulty</h2>
      <p style={{ color: "#c8b48c", fontSize: 13, fontFamily: "'Fraunces',serif", fontStyle: "italic",
        textAlign: "center", marginTop: 4 }}>
        Each teaches a different lesson.
      </p>

      <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
        {modes.map((m) => {
          const cfg = MODES[m];
          return (
            <button key={m} onClick={() => onSelect(m)} style={{
              ...modeCard,
              borderColor: cfg.color,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 24, color: cfg.color, letterSpacing: 1 }}>
                  {cfg.label}
                </div>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, color: CREAM }}>
                  ${cfg.startingCash.toLocaleString()}
                </div>
              </div>
              <div style={{ marginTop: 4, fontSize: 13, fontFamily: "'Fraunces',serif",
                fontStyle: "italic", color: "#c8b48c" }}>
                "{cfg.tagline}"
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: "#8f7d5d", lineHeight: 1.5 }}>
                {cfg.lesson}
              </div>
              {cfg.loanBalance > 0 && (
                <div style={{ marginTop: 8, fontSize: 11, color: "#3F82FF", fontWeight: 700 }}>
                  Includes {money(cfg.loanBalance)} loan · {money(cfg.loanDailyPayment)}/day
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DayHub({ state, dow, unlocks, learningCoach, projDemand, d, p, purchaseCost, canAfford,
  onRecipe, onStaffing, onPurchasing, onOpen, onMoney, onEmpire }: any) {
  return (
    <div style={{ padding: "10px 16px 24px", overflowY: "auto", height: "100%" }}>
      {/* Forecast hero */}
      <div style={forecastCard}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, letterSpacing: 2 }}>
            {DAY_NAMES[dow]} · DAY {state.day}
          </div>
          <div style={{ fontSize: 11, color: "#c8b48c" }}>{DAY_WEATHER[dow]}</div>
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 16, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 48, fontFamily: "'Bebas Neue',sans-serif", lineHeight: 1, color: GOLD }}>
              ~{projDemand}
            </div>
            <div style={{ fontSize: 10, color: "#c8b48c", letterSpacing: 1.5, marginTop: 2 }}>
              EXPECTED PIZZAS
            </div>
          </div>
          <div style={{ flex: 1, fontSize: 12, color: "#c8b48c", fontFamily: "'Fraunces',serif",
            fontStyle: "italic", lineHeight: 1.45 }}>
            "{DAY_VIBE[dow]}"
          </div>
        </div>
        <div style={{ marginTop: 10, padding: "6px 10px", background: "rgba(232,90,42,0.1)",
          border: `1px solid ${ORANGE}40`, borderRadius: 8, fontSize: 11, color: "#c8b48c",
          display: "flex", justifyContent: "space-between" }}>
          <span>Mode</span>
          <strong style={{ color: MODES[state.mode as GameMode].color }}>
            {MODES[state.mode as GameMode].label}
          </strong>
        </div>
      </div>

      {/* Learning coach panel */}
      {learningCoach && (
        <div style={{ marginTop: 12, padding: 12, background: "rgba(59,165,93,0.1)",
          border: `1px solid #3BA55D`, borderRadius: 12 }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: "#3BA55D", fontWeight: 800 }}>COACH</div>
          <div style={{ marginTop: 4, fontSize: 13, fontWeight: 700, color: CREAM }}>{learningCoach.title}</div>
          <div style={{ marginTop: 6, fontSize: 12, color: "#c8b48c", lineHeight: 1.5,
            fontFamily: "'Fraunces',serif" }}>
            {learningCoach.body}
          </div>
        </div>
      )}

      <div style={{ marginTop: 16, fontSize: 10, letterSpacing: 2, color: "#8f7d5d" }}>
        TODAY'S DECISIONS
      </div>

      <DecisionTile icon="🍕" title="Recipe & Price"
        summary={
          unlocks.recipe && unlocks.price
            ? `$${d.price} · ${d.cheesePerPizza.toFixed(1)}oz cheese · ${d.pepperoniPerPizza.toFixed(2)}oz pep`
            : "Locked — handled for you"
        }
        locked={!unlocks.recipe && !unlocks.price}
        onClick={onRecipe} />

      <DecisionTile icon="👥" title="Staffing"
        summary={unlocks.staff ? `${d.lunchStaff} lunch · ${d.dinnerStaff} dinner` : "Locked"}
        locked={!unlocks.staff}
        onClick={onStaffing} />

      <DecisionTile icon="📦" title="Purchasing"
        summary={unlocks.buy
          ? `${money(purchaseCost)} · ${p.dough} dough · ${p.cheeseLbs}lb cheese`
          : "Locked — auto-bought today"}
        locked={!unlocks.buy}
        onClick={onPurchasing} />

      <button onClick={onOpen} style={{ ...primaryBtn, marginTop: 18,
        ...(canAfford ? {} : { background: "#5a5248", color: "#a89a84" }) }}>
        {canAfford ? "OPEN THE STORE →" : "NOT ENOUGH CASH FOR PURCHASES"}
      </button>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
        <button onClick={onEmpire} style={ghostBtn}>🏗 EMPIRE</button>
        <button onClick={onMoney} style={ghostBtn}>📊 BOOKS</button>
      </div>

      {/* Inventory carryover */}
      <div style={{ marginTop: 16, padding: 12, background: PANEL,
        border: `1px solid ${LINE}`, borderRadius: 12 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: "#8f7d5d" }}>CARRYOVER INVENTORY</div>
        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr",
          gap: 6, fontSize: 12 }}>
          <span>🍞 Dough: <strong>{n(state.inventory.dough)}</strong></span>
          <span>🧀 Cheese: <strong>{(n(state.inventory.cheeseOz) / OZ_PER_LB).toFixed(1)} lb</strong></span>
          <span>🌶 Pepperoni: <strong>{(n(state.inventory.pepperoniOz) / OZ_PER_LB).toFixed(1)} lb</strong></span>
          <span>📦 Boxes: <strong>{n(state.inventory.boxes)}</strong></span>
        </div>
        <div style={{ fontSize: 10, color: "#8f7d5d", marginTop: 6, fontStyle: "italic" }}>
          Dough dies daily — anything left over is spoiled.
        </div>
      </div>
    </div>
  );
}

function DecisionTile({ icon, title, summary, onClick, locked }: any) {
  return (
    <button onClick={onClick} disabled={locked} style={{
      ...tile,
      opacity: locked ? 0.5 : 1,
      cursor: locked ? "not-allowed" : "pointer",
    }}>
      <div style={{ fontSize: 26 }}>{locked ? "🔒" : icon}</div>
      <div style={{ flex: 1, textAlign: "left" }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
        <div style={{ fontSize: 11, color: "#c8b48c", marginTop: 2 }}>{summary}</div>
      </div>
      {!locked && <div style={{ color: GOLD, fontSize: 22 }}>›</div>}
    </button>
  );
}

function DecisionScreen({ title, subtitle, onBack, onSave, children }: any) {
  return (
    <div style={{ padding: "10px 16px 24px", height: "100%", overflowY: "auto" }}>
      <button onClick={onBack} style={backBtn}>‹ Back</button>
      <h2 style={screenTitle}>{title}</h2>
      <p style={screenSub}>{subtitle}</p>
      <div style={{ marginTop: 18 }}>{children}</div>
      <button onClick={onSave} style={{ ...primaryBtn, marginTop: 22 }}>SAVE & RETURN</button>
    </div>
  );
}

function LockedNote({ text }: { text: string }) {
  return (
    <div style={{ padding: 12, background: "rgba(143,125,93,0.1)",
      border: `1px solid ${LINE}`, borderRadius: 10, fontSize: 12, color: "#8f7d5d",
      marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
      🔒 <span>{text}</span>
    </div>
  );
}

type SliderProps = {
  label: string; value: string; v: number; min: number; max: number; step: number;
  onChange: (n: number) => void; hint: string; warn?: string | null;
};

function Slider({ label, value, v, min, max, step, onChange, hint, warn }: SliderProps) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontWeight: 700, fontSize: 13 }}>{label}</span>
        <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 26, color: GOLD, lineHeight: 1 }}>
          {value}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={v}
        onChange={(e) => onChange(parseFloat(e.target.value))} style={rangeStyle} />
      <div style={{ fontSize: 11, color: "#8f7d5d", marginTop: 4 }}>{hint}</div>
      {warn && (
        <div style={{ fontSize: 11, color: RED, marginTop: 6, padding: 8,
          background: "rgba(255,157,132,0.08)", borderRadius: 8 }}>⚠ {warn}</div>
      )}
    </div>
  );
}

function OpenScreen({ state, d, projDemand, canAfford, purchaseCost, onBack, onOpen }: any) {
  return (
    <div style={{ padding: "10px 16px 24px", height: "100%", overflowY: "auto" }}>
      <button onClick={onBack} style={backBtn}>‹ Back</button>
      <h2 style={screenTitle}>READY TO OPEN?</h2>
      <p style={screenSub}>Last look before doors open at 11am.</p>

      <div style={{ marginTop: 18 }}>
        <ConfirmRow label="Tonight's demand" value={`~${projDemand.lo}–${projDemand.hi}`} highlight />
        <ConfirmRow label="Price per pizza" value={`$${d.price}`} />
        <ConfirmRow label="Cheese / pepperoni" value={`${d.cheesePerPizza}oz / ${d.pepperoniPerPizza.toFixed(2)}oz`} />
        <ConfirmRow label="Lunch / dinner" value={`${d.lunchStaff} / ${d.dinnerStaff} staff`} />
        <ConfirmRow label="Purchase cost" value={money(purchaseCost)} />
        <ConfirmRow label="Cash after buy" value={money(n(state.cash) - purchaseCost)}
          color={canAfford ? GREEN : RED} />
      </div>

      {state.brandPenaltyDaysLeft > 0 && (
        <div style={{ marginTop: 14, padding: 10, background: "rgba(255,157,132,0.1)",
          border: `1px solid ${RED}`, borderRadius: 10, fontSize: 12, color: RED }}>
          ⚠ Skimp penalty active. Demand suppressed for {state.brandPenaltyDaysLeft} more day(s).
        </div>
      )}

      <button onClick={onOpen} disabled={!canAfford}
        style={{ ...primaryBtn, marginTop: 22, background: canAfford ? "#3BA55D" : "#5a5248" }}>
        🔑 {canAfford ? "UNLOCK THE DOORS" : "NOT ENOUGH CASH"}
      </button>
    </div>
  );
}

function ConfirmRow({ label, value, color, highlight }: any) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0",
      borderBottom: `1px solid ${LINE}` }}>
      <span style={{ color: "#c8b48c", fontSize: 13 }}>{label}</span>
      <span style={{ fontWeight: 700, fontSize: 14,
        color: color || (highlight ? GOLD : CREAM),
        fontFamily: highlight ? "'Bebas Neue',sans-serif" : "inherit",
        ...(highlight ? { fontSize: 18 } : {}) }}>
        {value}
      </span>
    </div>
  );
}

function RunningScreen() {
  const [revenue, setRevenue] = useState(0);
  const [pizzas, setPizzas] = useState(0);
  const [phase, setPhase] = useState("LUNCH");

  useEffect(() => {
    const targetRev = 2000 + Math.random() * 1000;
    const targetPiz = 130 + Math.random() * 30;
    const ticks = 100;
    let i = 0;
    const t = setInterval(() => {
      i++;
      setRevenue(Math.round((targetRev * i) / ticks));
      setPizzas(Math.round((targetPiz * i) / ticks));
      if (i > ticks * 0.5) setPhase("DINNER");
      if (i >= ticks) clearInterval(t);
    }, 40);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ padding: 16, height: "100%", display: "flex", flexDirection: "column",
      justifyContent: "center", alignItems: "center", textAlign: "center" }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 14, letterSpacing: 4,
        color: ORANGE, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: ORANGE,
          animation: "pulse 1s ease-in-out infinite" }} />
        {phase} SERVICE
      </div>

      <div style={{ marginTop: 32, position: "relative", width: 200, height: 200 }}>
        <div style={runningPulse} />
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 80 }}>🍕</div>
      </div>

      <div style={{ marginTop: 28, fontSize: 10, color: "#8f7d5d", letterSpacing: 2 }}>LIVE REVENUE</div>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 56, color: GOLD, lineHeight: 1 }}>
        ${revenue.toLocaleString()}
      </div>

      <div style={{ marginTop: 12, fontSize: 13, color: "#c8b48c" }}>
        {pizzas} pizzas out the door
      </div>

      <div style={{ marginTop: 24, fontSize: 11, color: "#8f7d5d", fontStyle: "italic", maxWidth: 240 }}>
        Customers are flowing through. Counting tickets and watching the line...
      </div>
    </div>
  );
}

/* ---------- Results stack with swipe ---------- */

function ResultsStack({ result, card, setCard, onContinue }: any) {
  const cards: ResultCard[] = ["rating", "summary", "shifts", "events", "reviews", "coaching", "books"];
  const idx = cards.indexOf(card);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  function handleTouchStart(e: React.TouchEvent) {
    setTouchStart(e.touches[0].clientX);
  }
  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStart === null) return;
    const dx = e.changedTouches[0].clientX - touchStart;
    if (Math.abs(dx) > 50) {
      if (dx < 0 && idx < cards.length - 1) setCard(cards[idx + 1]);
      else if (dx > 0 && idx > 0) setCard(cards[idx - 1]);
    }
    setTouchStart(null);
  }

  return (
    <div style={{ padding: "10px 16px 24px", height: "100%", display: "flex", flexDirection: "column" }}
      onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* Pagination dots */}
      <div style={{ display: "flex", gap: 5, justifyContent: "center", marginBottom: 10 }}>
        {cards.map((c, i) => (
          <button key={c} onClick={() => setCard(c)} style={{
            width: i === idx ? 22 : 6, height: 6, borderRadius: 3,
            background: i === idx ? GOLD : "#3b2d1f",
            border: 0, cursor: "pointer", padding: 0,
            transition: "all 0.3s",
          }} />
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {card === "rating" && <RatingCard result={result} />}
        {card === "summary" && <SummaryCard result={result} />}
        {card === "shifts" && <ShiftsCard result={result} />}
        {card === "events" && <EventsCard result={result} />}
        {card === "reviews" && <ReviewsCard result={result} />}
        {card === "coaching" && <CoachingCard result={result} />}
        {card === "books" && <BooksCard result={result} />}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        {idx > 0 && (
          <button onClick={() => setCard(cards[idx - 1])} style={{ ...secondaryBtn, flex: 1 }}>
            ‹ {cards[idx - 1]}
          </button>
        )}
        {idx < cards.length - 1 ? (
          <button onClick={() => setCard(cards[idx + 1])} style={{ ...primaryBtn, flex: 2, marginTop: 0 }}>
            {cards[idx + 1].toUpperCase()} →
          </button>
        ) : (
          <button onClick={onContinue} style={{ ...primaryBtn, flex: 2, marginTop: 0, background: "#3BA55D" }}>
            NEXT DAY →
          </button>
        )}
      </div>
    </div>
  );
}

function RatingCard({ result }: any) {
  const stars = Math.round(result.customerRating);
  return (
    <div style={{ textAlign: "center", padding: "20px 0" }}>
      <div style={{ fontSize: 11, letterSpacing: 3, color: "#8f7d5d" }}>CUSTOMER VERDICT</div>
      <div style={{ marginTop: 28, display: "flex", justifyContent: "center", gap: 4 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} filled={i <= stars} big />
        ))}
      </div>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 84, lineHeight: 1,
        marginTop: 16, color: result.customerRating >= 4 ? GREEN : result.customerRating >= 3 ? GOLD : RED }}>
        {result.customerRating.toFixed(1)}
      </div>
      <div style={{ fontSize: 11, color: "#8f7d5d", letterSpacing: 2 }}>OUT OF 5</div>
      <p style={{ marginTop: 24, fontSize: 16, fontFamily: "'Fraunces',serif", fontStyle: "italic",
        lineHeight: 1.5, color: CREAM, padding: "0 20px" }}>
        "{result.customerRatingMessage}"
      </p>
      {result.skimpTriggeredToday && (
        <div style={{ marginTop: 16, padding: 10, background: "rgba(255,157,132,0.1)",
          border: `1px solid ${RED}`, borderRadius: 8, fontSize: 12, color: RED, marginInline: 20 }}>
          ⚠ Skimp penalty triggered. 3-day demand hit.
        </div>
      )}
      <div style={{ marginTop: 20, fontSize: 11, color: "#8f7d5d" }}>
        Swipe → for the financial breakdown
      </div>
    </div>
  );
}

function SummaryCard({ result }: any) {
  const positive = result.profit >= 0;
  return (
    <div>
      <div style={{ fontSize: 11, letterSpacing: 3, color: "#8f7d5d" }}>SHIFT RESULTS</div>
      <div style={{ marginTop: 6, fontFamily: "'Bebas Neue',sans-serif", fontSize: 64, lineHeight: 1,
        color: positive ? GREEN : RED }}>
        {positive ? "+" : ""}{money(result.profit)}
      </div>
      <div style={{ fontSize: 12, color: "#c8b48c", marginTop: 4 }}>net profit today</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 18 }}>
        <BigStat label="Pizzas sold" value={result.sold} sub={`of ${result.demand} demand`} />
        <BigStat label="Revenue" value={money(result.revenue)} sub="" />
        <BigStat label="Prime cost" value={pct(result.primePct)}
          sub={result.primePct < 60 ? "Healthy" : result.primePct < 70 ? "Watch" : "Danger"}
          subColor={result.primePct < 60 ? GREEN : result.primePct < 70 ? GOLD : RED} />
        <BigStat label="Lost sales" value={result.lost} sub={result.bottleneck || "none"} />
      </div>

      {result.bottleneck && (
        <div style={{ marginTop: 16, padding: 12, background: "rgba(232,90,42,0.1)",
          border: `1px solid ${ORANGE}`, borderRadius: 12 }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: ORANGE, fontWeight: 800 }}>BOTTLENECK</div>
          <div style={{ marginTop: 6, fontSize: 13, fontFamily: "'Fraunces',serif", lineHeight: 1.4 }}>
            You lost <strong>{result.lost} pizzas</strong> — {result.bottleneck} capped throughput.
          </div>
        </div>
      )}
    </div>
  );
}

function ShiftsCard({ result }: any) {
  return (
    <div>
      <div style={{ fontSize: 11, letterSpacing: 3, color: "#8f7d5d" }}>LUNCH vs DINNER</div>
      <h2 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, marginTop: 4, letterSpacing: 1 }}>
        Two services
      </h2>
      <ShiftBlock title="LUNCH 11AM–4PM" sold={result.lunchSold} demand={result.lunchDemand}
        cap={result.lunchCapacity} bottleneck={result.lunchBottleneck} />
      <ShiftBlock title="DINNER 4PM–9PM" sold={result.dinnerSold} demand={result.dinnerDemand}
        cap={result.dinnerCapacity} bottleneck={result.dinnerBottleneck} />
    </div>
  );
}

function ShiftBlock({ title, sold, demand, cap, bottleneck }: any) {
  const fill = demand > 0 ? (sold / demand) * 100 : 100;
  return (
    <div style={{ marginTop: 14, padding: 14, background: PANEL,
      border: `1px solid ${LINE}`, borderRadius: 12 }}>
      <div style={{ fontSize: 10, letterSpacing: 2, color: GOLD, fontWeight: 800 }}>{title}</div>
      <div style={{ marginTop: 8, display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 36, color: CREAM }}>{sold}</span>
        <span style={{ color: "#8f7d5d", fontSize: 12 }}>of {demand} (cap {cap})</span>
      </div>
      <div style={{ marginTop: 8, height: 6, background: NIGHT, borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(100, fill)}%`, height: "100%",
          background: fill > 95 ? GREEN : fill > 85 ? GOLD : ORANGE }} />
      </div>
      {bottleneck && (
        <div style={{ marginTop: 8, fontSize: 11, color: RED }}>⚠ Capped by {bottleneck}</div>
      )}
    </div>
  );
}

function EventsCard({ result }: any) {
  return (
    <div>
      <div style={{ fontSize: 11, letterSpacing: 3, color: "#8f7d5d" }}>WHAT HAPPENED</div>
      <h2 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, marginTop: 4, letterSpacing: 1 }}>
        Today's events
      </h2>
      {result.events.map((ev: DayEvent) => (
        <div key={ev.id} style={{ marginTop: 12, padding: 14, background: PANEL,
          border: `1px solid ${LINE}`, borderRadius: 12 }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: GOLD, fontWeight: 800 }}>{ev.title}</div>
          <div style={{ marginTop: 6, fontSize: 13, fontFamily: "'Fraunces',serif", lineHeight: 1.5, color: CREAM }}>
            {ev.body}
          </div>
        </div>
      ))}
    </div>
  );
}

function ReviewsCard({ result }: any) {
  return (
    <div>
      <div style={{ fontSize: 11, letterSpacing: 3, color: "#8f7d5d" }}>CUSTOMER REVIEWS</div>
      <h2 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, marginTop: 4, letterSpacing: 1 }}>
        What people said
      </h2>
      <div style={{ marginTop: 6, fontSize: 12, color: "#c8b48c" }}>
        Reputation last 5 days:{" "}
        <strong style={{ color: GOLD, fontFamily: "'Bebas Neue',sans-serif", fontSize: 16 }}>
          {result.reputationBefore.toFixed(1)} ★
        </strong>
      </div>

      {result.customerReviews.map((review: string, i: number) => {
        // Heuristic: short positive vs negative
        const positive = /perfect|just right|love|favorite|worth it|quickly|great value|smooth|fine/i.test(review);
        return (
          <div key={i} style={{ marginTop: 12, padding: 14, background: PANEL,
            border: `1px solid ${LINE}`, borderRadius: 12 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ display: "flex", gap: 2 }}>
                {[1, 2, 3, 4, 5].map((j) => {
                  const filled = positive ? j <= 5 - i : j <= 5 - i - 2;
                  return <Star key={j} filled={filled} />;
                })}
              </div>
              <span style={{ fontSize: 10, color: "#8f7d5d" }}>
                {positive ? "Verified Customer" : "Local Diner"}
              </span>
            </div>
            <div style={{ fontSize: 14, fontFamily: "'Fraunces',serif",
              fontStyle: "italic", lineHeight: 1.5, color: CREAM }}>
              "{review}"
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CoachingCard({ result }: any) {
  return (
    <div>
      <div style={{ fontSize: 11, letterSpacing: 3, color: "#8f7d5d" }}>OWNER NOTES</div>
      <h2 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, marginTop: 4, letterSpacing: 1 }}>
        Coach's read
      </h2>
      <div style={{ marginTop: 12 }}>
        {result.coaching.length === 0 ? (
          <div style={{ fontSize: 13, color: "#8f7d5d", fontStyle: "italic" }}>
            A pretty normal day. Nothing major stood out.
          </div>
        ) : (
          result.coaching.map((tip: string, i: number) => {
            const good = /strong|controlled|great|legendary|building|good operating/i.test(tip);
            return (
              <div key={i} style={{ display: "flex", gap: 10, padding: "10px 0",
                borderTop: i > 0 ? `1px solid ${LINE}` : "none" }}>
                <div style={{ fontSize: 16 }}>{good ? "✓" : "→"}</div>
                <div style={{ flex: 1, fontSize: 13, fontFamily: "'Fraunces',serif", lineHeight: 1.5,
                  color: good ? GREEN : CREAM }}>{tip}</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function BooksCard({ result }: any) {
  return (
    <div>
      <div style={{ fontSize: 11, letterSpacing: 3, color: "#8f7d5d" }}>P&L</div>
      <h2 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, marginTop: 4, letterSpacing: 1 }}>
        The numbers
      </h2>
      <div style={{ marginTop: 14, padding: 14, background: PANEL,
        border: `1px solid ${LINE}`, borderRadius: 12 }}>
        <PLRow label="Revenue" value={result.revenue} positive />
        <PLRow label="Food used" value={-result.foodCostUsed} />
        <PLRow label="Spoilage" value={-result.spoilageCost} />
        <PLRow label="Labor" value={-result.laborCost} />
        <PLRow label="Fixed (rent + loan)" value={-result.fixedCost} />
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: `2px solid ${GOLD}` }}>
          <PLRow label="NET PROFIT" value={result.profit} positive={result.profit >= 0} bold />
        </div>
      </div>
      <div style={{ marginTop: 12, padding: 12, background: PANEL,
        border: `1px solid ${LINE}`, borderRadius: 12 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: GOLD, fontWeight: 800 }}>RECIPE IMPACT</div>
        <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.7 }}>
          <div>Recipe cheese: {result.recipeCheeseOz.toFixed(1)}oz · Actual: {result.actualCheeseOz.toFixed(1)}oz</div>
          <div>Recipe pep: {result.recipePepperoniOz.toFixed(2)}oz · Actual: {result.actualPepperoniOz.toFixed(2)}oz</div>
          {result.overCheeseImpact > 0 && (
            <div style={{ color: RED, marginTop: 4 }}>Cheese overuse cost: {money(result.overCheeseImpact)}</div>
          )}
          {result.overPepperoniImpact > 0 && (
            <div style={{ color: RED }}>Pepperoni overuse cost: {money(result.overPepperoniImpact)}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function PLRow({ label, value, positive, bold }: any) {
  const display = `${value < 0 ? "−" : "+"}$${Math.abs(Math.round(value)).toLocaleString()}`;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0",
      fontSize: bold ? 16 : 13, fontWeight: bold ? 800 : 500 }}>
      <span style={{ color: bold ? CREAM : "#c8b48c" }}>{label}</span>
      <span style={{ color: positive ? GREEN : value < 0 ? RED : CREAM }}>{display}</span>
    </div>
  );
}

function WeeklyScreen({ summary, ownership, unlocks, distributionRequest, setDistributionRequest, onProcess }: any) {
  return (
    <div style={{ padding: "10px 16px 24px", height: "100%", overflowY: "auto" }}>
      <div style={{ fontSize: 11, letterSpacing: 3, color: GOLD }}>WEEK {summary.weekNumber} REVIEW</div>
      <h2 style={screenTitle}>Owner payday</h2>
      <p style={screenSub}>Time to decide what you take home.</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 16 }}>
        <BigStat label="Week revenue" value={money(summary.totalRevenue)} sub="" />
        <BigStat label="Week profit" value={money(summary.totalProfit, true)} sub=""
          subColor={summary.totalProfit >= 0 ? GREEN : RED} />
        <BigStat label="Avg prime %" value={pct(summary.avgPrimePct)} sub="" />
        <BigStat label="Lost sales" value={money(summary.totalLostSales)} sub="missed" subColor={RED} />
      </div>

      <div style={{ marginTop: 14, padding: 14, background: PANEL, border: `1px solid ${LINE}`, borderRadius: 12 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: GOLD, fontWeight: 800 }}>VERDICT</div>
        <div style={{ marginTop: 6, fontSize: 14, fontFamily: "'Fraunces',serif", lineHeight: 1.5 }}>
          {summary.verdict}
        </div>
      </div>

      {!unlocks.distributions ? (
        <div style={{ marginTop: 14, padding: 14, background: "rgba(143,125,93,0.1)",
          border: `1px solid ${LINE}`, borderRadius: 12, fontSize: 12, color: "#8f7d5d" }}>
          🔒 Owner distributions unlock on Day 6. This week, profits stay in the business.
        </div>
      ) : (
        <div style={{ marginTop: 14, padding: 14, background: PANEL,
          border: `1px solid ${LINE}`, borderRadius: 12 }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: GOLD, fontWeight: 800 }}>YOUR DISTRIBUTION</div>
          <div style={{ marginTop: 8, fontSize: 12, color: "#c8b48c" }}>
            Ownership: <strong>{Math.round(n(ownership) * 100)}%</strong> · Max: <strong>{money(summary.maxOwnerDistribution)}</strong>
          </div>
          <input type="number" value={distributionRequest} min={0}
            max={Math.floor(n(summary.maxOwnerDistribution))}
            onChange={(e) => setDistributionRequest(e.target.value === "" ? 0 : n(e.target.value))}
            style={{ width: "100%", padding: 14, marginTop: 10, borderRadius: 10,
              border: `1px solid ${LINE}`, background: NIGHT, color: CREAM,
              fontSize: 22, fontWeight: 800, fontFamily: "'Bebas Neue',sans-serif" }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginTop: 8 }}>
            {[0.25, 0.5, 1].map((pct) => (
              <button key={pct}
                onClick={() => setDistributionRequest(Math.floor(summary.maxOwnerDistribution * pct))}
                style={{ ...secondaryBtn, padding: "8px 4px", fontSize: 11 }}>
                {pct === 1 ? "MAX" : `${pct * 100}%`}
              </button>
            ))}
          </div>
        </div>
      )}

      <button onClick={onProcess}
        style={{ ...primaryBtn, marginTop: 16,
          background: unlocks.distributions ? GOLD : "#5a5248",
          color: unlocks.distributions ? NIGHT : "#a89a84" }}>
        {unlocks.distributions ? `💰 TAKE ${money(distributionRequest)}` : "CONTINUE TO NEXT WEEK"}
      </button>
    </div>
  );
}

function MoneyScreen({ state, balanceSheet, incomeStatement, tAccounts, unlocks,
  onBack, onEquitySale, onAccountingView }: any) {
  const [tab, setTab] = useState<"summary" | "balance" | "income" | "tacct" | "equity">("summary");

  return (
    <div style={{ padding: "10px 16px 24px", height: "100%", overflowY: "auto" }}>
      <button onClick={onBack} style={backBtn}>‹ Back</button>
      <h2 style={screenTitle}>MONEY</h2>
      <p style={screenSub}>Books, equity, and the loan.</p>

      <div style={{ display: "flex", gap: 4, marginTop: 14, padding: 4, background: NIGHT,
        borderRadius: 10, border: `1px solid ${LINE}`, overflowX: "auto" }}>
        {([
          ["summary", "OVERVIEW"], ["balance", "BAL SHT"], ["income", "P&L"],
          ["tacct", "T-ACCTS"], ["equity", "EQUITY"]
        ] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k as any)} style={{
            flex: 1, minWidth: 60, padding: "8px 4px", border: 0, borderRadius: 6,
            background: tab === k ? GOLD : "transparent",
            color: tab === k ? NIGHT : "#c8b48c",
            fontSize: 10, fontWeight: 800, letterSpacing: 1, cursor: "pointer",
          }}>
            {label}
          </button>
        ))}
      </div>

      {tab === "summary" && (
        <>
          <div style={acctPanel}>
            <div style={acctHead}>QUICK SUMMARY</div>
            <PLRow label="Cash" value={state.cash} />
            <PLRow label="Inventory value" value={Math.round(inventoryValue(state.inventory))} />
            {state.loanBalance > 0 && (
              <PLRow label="Loan owed" value={-state.loanBalance} />
            )}
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${LINE}` }}>
              <PLRow label="OWNER EQUITY" value={balanceSheet.equity.ownerEquityPlug} bold />
            </div>
          </div>

          <div style={acctPanel}>
            <div style={acctHead}>ACCOUNTING VIEW</div>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button onClick={() => onAccountingView("simple")} style={{
                ...secondaryBtn, flex: 1,
                background: state.accountingView === "simple" ? GOLD : "transparent",
                color: state.accountingView === "simple" ? NIGHT : "#c8b48c",
                borderColor: state.accountingView === "simple" ? GOLD : LINE,
              }}>SIMPLE</button>
              <button onClick={() => onAccountingView("advanced")} style={{
                ...secondaryBtn, flex: 1,
                background: state.accountingView === "advanced" ? GOLD : "transparent",
                color: state.accountingView === "advanced" ? NIGHT : "#c8b48c",
                borderColor: state.accountingView === "advanced" ? GOLD : LINE,
              }}>ADVANCED</button>
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: "#8f7d5d", fontStyle: "italic" }}>
              {state.accountingView === "simple"
                ? "Plain English numbers. The other tabs above show the formal books."
                : "Full debits, credits, and reconciliation."}
            </div>
          </div>
        </>
      )}

      {tab === "balance" && (
        <div style={acctPanel}>
          <div style={acctHead}>BALANCE SHEET</div>
          <PLRow label="Cash" value={balanceSheet.assets.cash} />
          <PLRow label="Inventory" value={balanceSheet.assets.inventory} />
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${LINE}` }}>
            <PLRow label="TOTAL ASSETS" value={balanceSheet.assets.total} bold />
          </div>
          <div style={{ marginTop: 12 }}>
            <PLRow label="Loan Payable" value={-balanceSheet.liabilities.loan} />
            <PLRow label="OWNER EQUITY" value={balanceSheet.equity.ownerEquityPlug} bold />
          </div>
        </div>
      )}

      {tab === "income" && (
        <div style={acctPanel}>
          <div style={acctHead}>INCOME STATEMENT (LIFETIME)</div>
          <PLRow label="Sales Revenue" value={incomeStatement.revenue} positive />
          <PLRow label="Food Used" value={-incomeStatement.foodUsed} />
          <PLRow label="Spoilage" value={-incomeStatement.spoilage} />
          <PLRow label="Labor" value={-incomeStatement.labor} />
          <PLRow label="Fixed Expense" value={-incomeStatement.fixed} />
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: `2px solid ${GOLD}` }}>
            <PLRow label="NET INCOME" value={incomeStatement.netIncome}
              positive={incomeStatement.netIncome >= 0} bold />
          </div>
        </div>
      )}

      {tab === "tacct" && (
        <div style={acctPanel}>
          <div style={acctHead}>T-ACCOUNTS</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto",
            gap: 4, marginTop: 8, fontSize: 12 }}>
            <span style={{ color: GOLD, fontWeight: 800, fontSize: 11 }}>ACCOUNT</span>
            <span style={{ color: GOLD, fontWeight: 800, fontSize: 11, textAlign: "right" }}>DEBIT</span>
            <span style={{ color: GOLD, fontWeight: 800, fontSize: 11, textAlign: "right" }}>CREDIT</span>
            {Object.entries(tAccounts).map(([acct, totals]: any) => (
              <React.Fragment key={acct}>
                <span style={{ color: "#c8b48c" }}>{acct}</span>
                <span style={{ textAlign: "right" }}>{money(totals.debit)}</span>
                <span style={{ textAlign: "right" }}>{money(totals.credit)}</span>
              </React.Fragment>
            ))}
            {Object.keys(tAccounts).length === 0 && (
              <span style={{ gridColumn: "1/4", color: "#8f7d5d", fontStyle: "italic" }}>
                No activity yet.
              </span>
            )}
          </div>
        </div>
      )}

      {tab === "equity" && (
        <div style={acctPanel}>
          <div style={acctHead}>RAISE EQUITY</div>
          {!unlocks.equity ? (
            <div style={{ marginTop: 8, fontSize: 12, color: "#8f7d5d" }}>
              🔒 Equity raises unlock on Day 5.
            </div>
          ) : (
            <>
              <p style={{ fontSize: 12, color: "#c8b48c", fontFamily: "'Fraunces',serif", marginTop: 6 }}>
                Sell part of the shop for instant cash. Lowers ownership permanently.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                {[10, 20, 30].map((pct) => {
                  const blocked = n(state.ownership) - pct / 100 < 0.1;
                  return (
                    <button key={pct} onClick={() => onEquitySale(pct)} disabled={blocked}
                      style={{ ...equityBtn, opacity: blocked ? 0.4 : 1,
                        cursor: blocked ? "not-allowed" : "pointer" }}>
                      Sell {pct}% → +${getEquityRaiseCash(pct)}
                    </button>
                  );
                })}
              </div>
              <div style={{ marginTop: 10, fontSize: 11, color: "#8f7d5d" }}>
                Ownership: <strong style={{ color: CREAM }}>
                  {Math.round(n(state.ownership) * 100)}%</strong> · Min 10%
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function EmpireScreen({ state, onBack, onHireGM, onRunAd, onInvestCampus }: any) {
  return (
    <div style={{ padding: "10px 16px 24px", height: "100%", overflowY: "auto" }}>
      <button onClick={onBack} style={backBtn}>‹ Back</button>
      <h2 style={screenTitle}>EMPIRE</h2>
      <p style={screenSub}>The Brenz way to grow: people, marketing, location.</p>

      {/* General Manager */}
      <div style={empirePanel}>
        <div style={empireHead}>
          <span>HIRE A GM</span>
          <span style={{ color: BRENZ_GOLD, fontFamily: "'Bebas Neue',sans-serif", fontSize: 16 }}>
            ${GM_HIRE_COST}
          </span>
        </div>
        <p style={empireBody}>
          Each GM has a real specialty. One-time hire, permanent upside.
        </p>
        <div style={{ marginTop: 8, fontSize: 11, color: "#a89a84" }}>
          Currently:{" "}
          <strong style={{ color: state.gm === "none" ? "#a89a84" : GMS[state.gm as GMType].color }}>
            {GMS[state.gm as GMType].label}
          </strong>
        </div>

        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {(["operations", "marketing", "finance"] as GMType[]).map((gmId) => {
            const gm = GMS[gmId];
            const hired = state.gm === gmId;
            const blocked = !hired && (n(state.cash) < GM_HIRE_COST || state.gm !== "none");
            return (
              <button key={gmId}
                onClick={() => onHireGM(gmId)}
                disabled={blocked || hired}
                style={{
                  ...gmCard,
                  borderColor: hired ? gm.color : BRENZ_LINE,
                  background: hired ? `${gm.color}22` : BRENZ_PANEL,
                  opacity: blocked ? 0.5 : 1,
                  cursor: blocked || hired ? "default" : "pointer",
                }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18,
                    letterSpacing: 1, color: gm.color }}>
                    {gm.label}
                  </span>
                  {hired && (
                    <span style={{ fontSize: 10, color: gm.color, fontWeight: 800,
                      letterSpacing: 1.5 }}>HIRED ✓</span>
                  )}
                </div>
                <div style={{ marginTop: 4, fontSize: 13, fontWeight: 700, color: BRENZ_CREAM }}>
                  {gm.specialty}
                </div>
                <div style={{ marginTop: 6, fontSize: 12, color: "#c8b48c", lineHeight: 1.5,
                  fontFamily: "'Fraunces',serif", fontStyle: "italic" }}>
                  {gm.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Advertising */}
      <div style={empirePanel}>
        <div style={empireHead}>
          <span>AD CAMPAIGN</span>
          <span style={{ color: BRENZ_GOLD, fontFamily: "'Bebas Neue',sans-serif", fontSize: 16 }}>
            ${AD_CAMPAIGN_COST}
          </span>
        </div>
        <p style={empireBody}>
          Push the featured pizza on social. Boosts demand for {AD_BOOST_DAYS} days. <strong style={{ color: RED }}>Backfires if quality slips.</strong>
        </p>

        {state.adBoostDays > 0 ? (
          <div style={{ marginTop: 10, padding: 12, background: `${BRENZ_GOLD}15`,
            border: `1px solid ${BRENZ_GOLD}`, borderRadius: 10 }}>
            <div style={{ fontSize: 11, color: BRENZ_GOLD, fontWeight: 800, letterSpacing: 1 }}>
              CAMPAIGN LIVE
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: BRENZ_CREAM }}>
              {state.adBoostDays} day(s) of boost remaining. +{Math.round((AD_BOOST_MULT - 1) * 100)}% demand.
            </div>
          </div>
        ) : (
          <button onClick={onRunAd}
            disabled={n(state.cash) < AD_CAMPAIGN_COST}
            style={{
              ...primaryBtn,
              marginTop: 10,
              background: n(state.cash) < AD_CAMPAIGN_COST ? "#5a5248" : BRENZ_RED,
            }}>
            RUN CAMPAIGN
          </button>
        )}

        {state.adBackfireDays > 0 && (
          <div style={{ marginTop: 10, padding: 10, background: `${RED}15`,
            border: `1px solid ${RED}`, borderRadius: 10, fontSize: 12, color: RED }}>
            ⚠ Ad backlash active — {state.adBackfireDays} day(s) of suppressed demand.
          </div>
        )}
      </div>

      {/* Second location: Brenz Campus */}
      <div style={empirePanel}>
        <div style={empireHead}>
          <span>BRENZ CAMPUS</span>
          <span style={{ color: BRENZ_GOLD, fontFamily: "'Bebas Neue',sans-serif", fontSize: 16 }}>
            ${CAMPUS_TOTAL_COST.toLocaleString()}
          </span>
        </div>
        <p style={empireBody}>
          A high-volume location on Cumberland Ave–style strip. Way more demand. Way bigger fixed costs ({money(CAMPUS_FIXED_BUMP)}/day extra).
        </p>

        {state.storeSize === "campus" ? (
          <div style={{ marginTop: 10, padding: 12, background: `${BRENZ_GREEN}15`,
            border: `1px solid ${BRENZ_GREEN}`, borderRadius: 10 }}>
            <div style={{ fontSize: 11, color: BRENZ_GREEN, fontWeight: 800, letterSpacing: 1 }}>
              CAMPUS LOCATION OPEN
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: BRENZ_CREAM }}>
              Demand multiplied by {CAMPUS_DEMAND_MULT}×. Make sure your staffing keeps up.
            </div>
          </div>
        ) : (
          <>
            <div style={{ marginTop: 12, padding: 10, background: BRENZ_INK,
              border: `1px solid ${BRENZ_LINE}`, borderRadius: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11,
                color: "#c8b48c", marginBottom: 6 }}>
                <span>FUNDED</span>
                <span>{money(state.campusFund)} / {money(CAMPUS_TOTAL_COST)}</span>
              </div>
              <div style={{ height: 8, background: BRENZ_PANEL, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%",
                  width: `${(state.campusFund / CAMPUS_TOTAL_COST) * 100}%`,
                  background: `linear-gradient(90deg, ${BRENZ_RED} 0%, ${BRENZ_GOLD} 100%)`,
                  transition: "width 0.4s",
                }} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
              <button onClick={() => onInvestCampus(500)}
                disabled={n(state.cash) < 500}
                style={{ ...secondaryBtn,
                  opacity: n(state.cash) < 500 ? 0.5 : 1 }}>
                + $500
              </button>
              <button onClick={() => onInvestCampus(1500)}
                disabled={n(state.cash) < 1500}
                style={{ ...secondaryBtn,
                  opacity: n(state.cash) < 1500 ? 0.5 : 1 }}>
                + $1,500
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


function GameOverScreen({ state, onReset }: { state: GameState; onReset: () => void }) {
  const totalProfit = state.history.reduce((s: number, h: DayResult) => s + n(h.profit), 0);
  const totalLost = state.history.reduce((s: number, h: DayResult) => s + n(h.lost), 0);
  const avgRating = state.satisfactionHistory.length
    ? state.satisfactionHistory.reduce((s: number, r: number) => s + n(r), 0) / state.satisfactionHistory.length
    : 0;
  const bankrupt = n(state.cash) < -1500;

  let scoreText = "You stayed busy, but didn't pull enough cash out.";
  if (bankrupt) scoreText = "You ran out of cash. The store is closed.";
  else if (n(state.totalDistributions) >= 6000) scoreText = "Elite run. You built a real business.";
  else if (n(state.totalDistributions) >= 3500) scoreText = "Strong run. Owner got paid.";
  else if (n(state.totalDistributions) >= 1500) scoreText = "Solid effort. Margin still tight.";

  return (
    <div style={{ padding: "30px 20px", height: "100%", overflowY: "auto", textAlign: "center" }}>
      <div style={{ fontSize: 11, letterSpacing: 4, color: bankrupt ? RED : GOLD }}>
        {bankrupt ? "BANKRUPT" : "30 DAYS COMPLETE"}
      </div>
      <h2 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 48, lineHeight: 1, marginTop: 8 }}>
        {bankrupt ? "GAME OVER" : "FINAL TALLY"}
      </h2>
      <p style={{ marginTop: 10, fontSize: 14, color: "#c8b48c", fontFamily: "'Fraunces',serif",
        fontStyle: "italic", lineHeight: 1.5 }}>
        "{scoreText}"
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 20, textAlign: "left" }}>
        <BigStat label="Distributions" value={money(state.totalDistributions)} sub="taken home" subColor={GOLD} />
        <BigStat label="Net profit" value={money(totalProfit, true)} sub="lifetime"
          subColor={totalProfit >= 0 ? GREEN : RED} />
        <BigStat label="Avg rating" value={avgRating.toFixed(1)} sub="of 5"
          subColor={avgRating >= 4 ? GREEN : avgRating >= 3 ? GOLD : RED} />
        <BigStat label="Ownership" value={`${Math.round(n(state.ownership) * 100)}%`} sub="" />
        <BigStat label="Ending cash" value={money(state.cash)} sub="" />
        <BigStat label="Tickets lost" value={totalLost} sub="missed sales" />
      </div>

      <div style={{ marginTop: 16, fontSize: 11, color: "#8f7d5d" }}>
        Played: <strong style={{ color: MODES[state.mode as GameMode].color }}>
          {MODES[state.mode as GameMode].label}
        </strong>
      </div>

      <button onClick={onReset} style={{ ...primaryBtn, marginTop: 24 }}>TRY ANOTHER MODE →</button>
    </div>
  );
}

/* ---------- Sub-components ---------- */

function BigStat({ label, value, sub, subColor }: any) {
  return (
    <div style={{ padding: 12, background: PANEL, border: `1px solid ${LINE}`, borderRadius: 12 }}>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color: CREAM, lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 9, color: "#8f7d5d", letterSpacing: 1.5, marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: subColor || "#c8b48c", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function HUDCell({ label, value, sub }: any) {
  return (
    <div style={hudCell}>
      <div style={hudLabel}>{label}</div>
      <div style={hudVal}>{value}{sub && <span style={hudSub}>{sub}</span>}</div>
    </div>
  );
}

function Star({ filled, big }: { filled: boolean; big?: boolean }) {
  const size = big ? 32 : 12;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? GOLD : "transparent"}
      stroke={filled ? GOLD : "#3b2d1f"} strokeWidth={2}>
      <polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9" />
    </svg>
  );
}

function SignalIcon() {
  return (
    <svg width="14" height="10" viewBox="0 0 14 10" fill="white">
      <rect x="0" y="6" width="2" height="4" rx="0.5" />
      <rect x="3.5" y="4" width="2" height="6" rx="0.5" />
      <rect x="7" y="2" width="2" height="8" rx="0.5" />
      <rect x="10.5" y="0" width="2" height="10" rx="0.5" />
    </svg>
  );
}

function BatteryIcon() {
  return (
    <svg width="22" height="10" viewBox="0 0 22 10" fill="none">
      <rect x="0.5" y="0.5" width="18" height="9" rx="2" stroke="white" />
      <rect x="2" y="2" width="15" height="6" rx="1" fill="white" />
      <rect x="19.5" y="3.5" width="1.5" height="3" rx="0.5" fill="white" />
    </svg>
  );
}

/* ============================================================
   STYLES
   ============================================================ */

const pageWrap: React.CSSProperties = {
  minHeight: "100vh",
  width: "100%",
  maxWidth: 480,
  margin: "0 auto",
  background: NIGHT,
  color: CREAM,
  fontFamily: "'Inter',system-ui,sans-serif",
  display: "flex",
  flexDirection: "column",
  position: "relative",
};

const statusBar: React.CSSProperties = {
  height: 36,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  padding: "0 24px 6px",
  fontSize: 13,
  fontWeight: 600,
  color: "white",
  background: NIGHT,
};

const brenzHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 16px",
  background: BRENZ_INK,
  borderBottom: `2px solid ${BRENZ_RED}`,
};

const hud: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 6,
  padding: "8px 12px",
  background: "#1B140E",
  borderBottom: `1px solid ${LINE}`,
};

const hudCell: React.CSSProperties = { textAlign: "center", padding: "2px 2px" };
const hudLabel: React.CSSProperties = { fontSize: 9, letterSpacing: 1.5, color: "#8f7d5d", fontWeight: 700 };
const hudVal: React.CSSProperties = {
  fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, color: CREAM, marginTop: 2, letterSpacing: 0.5,
};
const hudSub: React.CSSProperties = { fontSize: 11, color: "#8f7d5d" };

const repStrip: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  padding: "6px 14px",
  background: NIGHT,
  borderBottom: `1px solid ${LINE}`,
};

const body: React.CSSProperties = { flex: 1, overflow: "hidden", position: "relative" };

const forecastCard: React.CSSProperties = {
  padding: 14,
  background: `linear-gradient(135deg, ${PANEL} 0%, #2a1f15 100%)`,
  border: `1px solid ${LINE}`,
  borderRadius: 14,
  marginTop: 4,
};

const tile: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  width: "100%",
  padding: 12,
  background: PANEL,
  border: `1px solid ${LINE}`,
  borderRadius: 12,
  marginTop: 8,
  color: CREAM,
};

const modeCard: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: 16,
  background: PANEL,
  border: `2px solid ${LINE}`,
  borderRadius: 14,
  color: CREAM,
  cursor: "pointer",
  textAlign: "left",
};

const primaryBtn: React.CSSProperties = {
  width: "100%",
  padding: "14px 16px",
  background: ORANGE,
  border: 0,
  borderRadius: 12,
  color: "white",
  fontFamily: "'Bebas Neue',sans-serif",
  fontSize: 18,
  letterSpacing: 2,
  fontWeight: 700,
  cursor: "pointer",
  marginTop: 10,
};

const secondaryBtn: React.CSSProperties = {
  padding: "10px 12px",
  background: "transparent",
  border: `1px solid ${LINE}`,
  borderRadius: 10,
  color: "#c8b48c",
  fontFamily: "'Bebas Neue',sans-serif",
  fontSize: 13,
  letterSpacing: 1.5,
  cursor: "pointer",
};

const ghostBtn: React.CSSProperties = {
  width: "100%",
  padding: 10,
  background: "transparent",
  border: `1px solid ${LINE}`,
  borderRadius: 10,
  color: "#c8b48c",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  letterSpacing: 1,
};

const equityBtn: React.CSSProperties = {
  padding: 12,
  background: "transparent",
  border: `1px solid ${GOLD}`,
  borderRadius: 10,
  color: GOLD,
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  textAlign: "left",
};

const backBtn: React.CSSProperties = {
  background: "transparent",
  border: 0,
  color: GOLD,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  padding: 0,
  marginBottom: 6,
};

const screenTitle: React.CSSProperties = {
  fontFamily: "'Bebas Neue',sans-serif",
  fontSize: 32,
  letterSpacing: 1,
  margin: "6px 0 4px",
  lineHeight: 1,
};

const screenSub: React.CSSProperties = {
  color: "#c8b48c",
  fontSize: 13,
  fontFamily: "'Fraunces',serif",
  fontStyle: "italic",
  margin: 0,
};

const costStrip: React.CSSProperties = {
  marginTop: 14,
  padding: "12px 14px",
  background: NIGHT,
  border: `1px solid ${GOLD}`,
  borderRadius: 12,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  color: GOLD,
  fontSize: 14,
};

const rangeStyle: React.CSSProperties = {
  width: "100%",
  height: 8,
  borderRadius: 4,
  background: NIGHT,
  outline: "none",
  WebkitAppearance: "none",
  appearance: "none",
  cursor: "pointer",
};

const runningPulse: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  borderRadius: "50%",
  background: `radial-gradient(circle, ${ORANGE}40 0%, transparent 70%)`,
  animation: "pulse 1.2s ease-in-out infinite",
};

const acctPanel: React.CSSProperties = {
  marginTop: 12,
  padding: 14,
  background: PANEL,
  border: `1px solid ${LINE}`,
  borderRadius: 12,
};

const acctHead: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: 2,
  color: GOLD,
  fontWeight: 800,
  marginBottom: 4,
};

const empirePanel: React.CSSProperties = {
  marginTop: 14,
  padding: 16,
  background: BRENZ_PANEL,
  border: `1px solid ${BRENZ_LINE}`,
  borderRadius: 14,
};

const empireHead: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  fontFamily: "'Bebas Neue',sans-serif",
  fontSize: 18,
  letterSpacing: 2,
  color: BRENZ_CREAM,
  marginBottom: 4,
};

const empireBody: React.CSSProperties = {
  fontSize: 13,
  color: "#c8b48c",
  lineHeight: 1.5,
  fontFamily: "'Fraunces',serif",
  margin: "6px 0 0 0",
};

const gmCard: React.CSSProperties = {
  padding: 14,
  border: `2px solid ${BRENZ_LINE}`,
  borderRadius: 12,
  background: BRENZ_PANEL,
  color: BRENZ_CREAM,
  textAlign: "left",
  width: "100%",
  cursor: "pointer",
};

const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Fraunces:ital,wght@0,400;0,700;1,400&family=Inter:wght@400;600;700;800&display=swap');

  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: ${NIGHT}; }

  input[type=range]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 24px; height: 24px; border-radius: 50%;
    background: ${GOLD};
    cursor: pointer;
    border: 3px solid ${NIGHT};
    box-shadow: 0 2px 6px rgba(0,0,0,0.4);
  }
  input[type=range]::-moz-range-thumb {
    width: 24px; height: 24px; border-radius: 50%;
    background: ${GOLD}; cursor: pointer;
    border: 3px solid ${NIGHT};
  }

  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 0.6; }
    50% { transform: scale(1.15); opacity: 1; }
  }

  button:active { transform: scale(0.97); }
  button { transition: transform 0.1s; }
`;