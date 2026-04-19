"use client";

import React, { useMemo, useState } from "react";

type Phase = "intro" | "setup" | "running" | "results" | "weekly" | "gameover";
type MainTab = "game" | "accounting";

type DayEvent = {
  id: string;
  title: string;
  body: string;
};

type JournalLine = {
  account: string;
  debit: number;
  credit: number;
};

type JournalEntry = {
  id: string;
  day: number;
  memo: string;
  lines: JournalLine[];
};

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

  foodPct: number;
  laborPct: number;
  primePct: number;

  cashAfterPrime: number;
  cashAfterFixed: number;

  doughSpoiled: number;
  cheeseUsedOz: number;
  pepperoniUsedOz: number;

  startInv: {
    dough: number;
    cheeseOz: number;
    pepperoniOz: number;
    boxes: number;
  };
  endInv: {
    dough: number;
    cheeseOz: number;
    pepperoniOz: number;
    boxes: number;
  };

  recipeCheeseOz: number;
  actualCheeseOz: number;
  recipePepperoniOz: number;
  actualPepperoniOz: number;
  overCheeseImpact: number;
  overPepperoniImpact: number;

  lunchCapacity: number;
  dinnerCapacity: number;
  totalLaborHours: number;

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
  day: number;
  cash: number;
  ownership: number;
  totalDistributions: number;
  phase: Phase;
  activeTab: MainTab;

  inventory: {
    dough: number;
    cheeseOz: number;
    pepperoniOz: number;
    boxes: number;
  };

  purchases: {
    dough: number;
    cheeseLbs: number;
    pepperoniLbs: number;
    boxes: number;
  };

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

const TOTAL_DAYS = 30;
const STARTING_CASH = 1800;
const OZ_PER_LB = 16;

const LUNCH_BLOCK_HOURS = 5;
const DINNER_BLOCK_HOURS = 5;

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
const DAY_WEATHER = [
  "66° CLEAR",
  "71° CLEAR",
  "69° OVERCAST",
  "73° BREEZY",
  "78° SUNNY",
  "81° SUNNY",
  "70° COOL",
];
const DAY_VIBE = [
  'Slow start. Office orders and regulars for the 12" pepperoni pizza.',
  "Tuesday trickle. Stay lean and do not overbuy.",
  "Midweek lull. Easy to waste product if you get aggressive.",
  "Thursday warms up. Demand is building.",
  "Friday rush. Better be ready for dinner.",
  "Saturday volume. Dinner rush can bury you.",
  "Sunday family traffic. Softer than Saturday, but dinner still matters.",
];

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

function inventoryValue(inv: GameState["inventory"]) {
  return (
    n(inv.dough) * COST.dough +
    (n(inv.cheeseOz) / OZ_PER_LB) * COST.cheesePerLb +
    (n(inv.pepperoniOz) / OZ_PER_LB) * COST.pepperoniPerLb +
    n(inv.boxes) * COST.box
  );
}

function getEquityRaiseCash(pctSold: number) {
  if (pctSold === 10) return 300;
  if (pctSold === 20) return 700;
  if (pctSold === 30) return 1200;
  return 0;
}

function getPepperoniDemandEffect(pepOz: number) {
  const p = n(pepOz);
  if (p <= 0.1) return 0.10;
  if (p <= 0.25) return 0.25;
  if (p <= 0.5) return 0.45;
  if (p <= 1.0) return 0.70;
  if (p <= 1.5) return 0.90;
  if (p <= 2.0) return 1.00;
  if (p <= 2.75) return 1.10;
  if (p <= 3.5) return 1.14;
  if (p <= 4.5) return 1.06;
  return 0.95;
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
  dough: number,
  cheeseOz: number,
  pepperoniOz: number,
  boxes: number,
  actualCheeseOz: number,
  actualPepperoniOz: number
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
  const bottleneck = sorted[0]?.name ?? null;

  return { max: Math.max(0, max), bottleneck };
}

function makeEntry(day: number, memo: string, lines: JournalLine[]): JournalEntry {
  return {
    id: `${day}-${memo}-${Math.random().toString(36).slice(2, 8)}`,
    day,
    memo,
    lines: lines.map((l) => ({
      account: l.account,
      debit: n(l.debit),
      credit: n(l.credit),
    })),
  };
}

function initialState(): GameState {
  const init: GameState = {
    day: 1,
    cash: STARTING_CASH,
    ownership: 1,
    totalDistributions: 0,
    phase: "intro",
    activeTab: "game",

    inventory: {
      dough: 0,
      cheeseOz: 0,
      pepperoniOz: 0,
      boxes: 0,
    },

    purchases: {
      dough: 110,
      cheeseLbs: 60,
      pepperoniLbs: 18,
      boxes: 130,
    },

    decisions: {
      price: 15,
      cheesePerPizza: 8,
      pepperoniPerPizza: 2.5,
      lunchStaff: 2,
      dinnerStaff: 4,
    },

    distributionRequest: 0,

    lastResult: null,
    weeklySummary: null,
    history: [],
    journal: [],
  };

  init.journal.push(
    makeEntry(0, "Life savings invested", [
      { account: "Cash", debit: STARTING_CASH, credit: 0 },
      { account: "Owner Equity", debit: 0, credit: STARTING_CASH },
    ])
  );

  return init;
}

function simulateDay(state: GameState): DayResult {
  const { day, purchases, inventory, decisions } = state;
  const dow = (day - 1) % 7;

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

  const roll = Math.random();

  if (roll < 0.10) {
    actualCheeseOz = n(decisions.cheesePerPizza) * 1.25;
    events.push({
      id: "new_hire_cheese",
      title: "New Hire Over-Cheesed",
      body: 'A new line cook poured about 25% extra cheese on the 12" pizzas.',
    });
  } else if (roll < 0.18) {
    dinnerDemandFlat += 18;
    events.push({
      id: "local_event",
      title: "Local Event Boost",
      body: 'A nearby event pushed extra dinner demand into the 12" pepperoni pizza.',
    });
  } else if (roll < 0.26) {
    dinnerLaborMult -= 0.22;
    events.push({
      id: "dinner_calloff",
      title: "Dinner Call-Off",
      body: "A team member called off before dinner. Your dinner capacity dropped.",
    });
  } else if (roll < 0.34) {
    lunchLaborMult -= 0.2;
    events.push({
      id: "lunch_calloff",
      title: "Lunch Call-Off",
      body: "A lunch call-off slowed your midday production.",
    });
  } else if (roll < 0.42) {
    demandMult -= 0.15;
    events.push({
      id: "slow_day",
      title: "Slow Day",
      body: "Traffic came in softer than expected.",
    });
  } else if (roll < 0.50) {
    fixedCostExtra += 80;
    events.push({
      id: "minor_break",
      title: "Minor Equipment Issue",
      body: "You had to spend extra cash today on a small repair.",
    });
  } else if (roll < 0.58) {
    priceAdjustment = -1;
    events.push({
      id: "competitor_promo",
      title: "Competitor Promo",
      body: "A nearby competitor ran a special and made pricing tougher.",
    });
  } else if (roll < 0.66) {
    dinnerDemandFlat += 10;
    events.push({
      id: "late_group_order",
      title: "Late Group Order",
      body: 'A surprise group order pushed dinner demand up for the 12" pizzas.',
    });
  } else if (roll < 0.74) {
    actualPepperoniOz = Math.min(6, n(decisions.pepperoniPerPizza) * 1.2);
    events.push({
      id: "heavy_hand_pepp",
      title: "Pepperoni Hand Was Heavy",
      body: "Your topping line used more pepperoni than planned.",
    });
  } else if (roll < 0.81) {
    fixedCostExtra += 50;
    lunchDemandFlat -= 6;
    events.push({
      id: "rainy_lunch",
      title: "Rainy Lunch, Better Dinner",
      body: "Lunch slowed down, but the evening stayed decent.",
    });
  } else if (roll < 0.88) {
    dinnerDemandFlat += 14;
    events.push({
      id: "social_media_pop",
      title: "Social Media Pop",
      body: 'A local mention online drove more people to try the 12" pepperoni pizza.',
    });
  }

  if (events.length === 0) {
    events.push({
      id: "normal_day",
      title: "Normal Day",
      body: "No major disruption hit the store today.",
    });
  }

  const effectivePrice = Math.max(10, n(decisions.price) + priceAdjustment);

  const priceEffect = Math.pow(15 / effectivePrice, 1.4);
  const cheeseQualityEffect = 1 + (n(decisions.cheesePerPizza) - 8) * 0.05;
  const pepperoniEffect = getPepperoniDemandEffect(n(decisions.pepperoniPerPizza));
  const dayEffect = DAY_MULT[dow];
  const randomNoise = 0.92 + Math.random() * 0.16;

  const rawDemand =
    BASE_DEMAND *
    dayEffect *
    priceEffect *
    cheeseQualityEffect *
    pepperoniEffect *
    demandMult *
    randomNoise;

  const totalDemand = Math.max(0, Math.round(rawDemand));
  const split = phaseDemandSplit(totalDemand, dow);

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

  const lunchInvCap = inventoryCap(
    remDough,
    remCheeseOz,
    remPepperoniOz,
    remBoxes,
    actualCheeseOz,
    actualPepperoniOz
  );

  const lunchMax = Math.min(lunchCapacityFromLabor, lunchInvCap.max, OVEN_MAX_PER_DAY);
  const lunchSold = Math.max(0, Math.min(lunchDemand, lunchMax));
  const lunchLost = Math.max(0, lunchDemand - lunchSold);

  remDough -= lunchSold;
  remCheeseOz -= lunchSold * actualCheeseOz;
  remPepperoniOz -= lunchSold * actualPepperoniOz;
  remBoxes -= lunchSold;

  const dinnerInvCap = inventoryCap(
    remDough,
    remCheeseOz,
    remPepperoniOz,
    remBoxes,
    actualCheeseOz,
    actualPepperoniOz
  );

  const dinnerMax = Math.min(
    dinnerCapacityFromLabor,
    dinnerInvCap.max,
    OVEN_MAX_PER_DAY - lunchSold
  );
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

  const lunchBottleneck =
    lunchLost > 0
      ? lunchCapacityFromLabor < lunchInvCap.max
        ? "lunch labor"
        : lunchInvCap.bottleneck
      : null;

  const dinnerBottleneck =
    dinnerLost > 0
      ? dinnerCapacityFromLabor < dinnerInvCap.max
        ? "dinner labor"
        : dinnerInvCap.bottleneck
      : null;

  const doughUsed = sold;
  const cheeseUsedOz = sold * actualCheeseOz;
  const pepperoniUsedOz = sold * actualPepperoniOz;
  const boxUsed = sold;

  const doughSpoiled = Math.max(0, startInv.dough - doughUsed);

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
  const spoilageCost = doughSpoiled * COST.dough;

  const totalLaborHours =
    n(decisions.lunchStaff) * LUNCH_BLOCK_HOURS +
    n(decisions.dinnerStaff) * DINNER_BLOCK_HOURS;

  const laborCost = totalLaborHours * COST.laborPerHour;
  const fixedCost = COST.fixedPerDay + fixedCostExtra;
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

  if (dinnerLost > 15) coaching.push(`You lost ${dinnerLost} pizzas during dinner because dinner staffing was too weak.`);
  if (lunchLost > 10) coaching.push(`You missed ${lunchLost} lunch pizzas. Lunch staffing or inventory was too tight.`);
  if (doughSpoiled > 20) coaching.push(`You spoiled ${doughSpoiled} dough balls. You overbought inventory.`);
  if (overCheeseImpact > 10) coaching.push(`Extra cheese quietly cost you ${money(overCheeseImpact)} today.`);
  if (n(decisions.pepperoniPerPizza) <= 0.5) coaching.push(`Your pepperoni portion was too light. Demand likely collapsed because customers hate skimpy toppings.`);
  if (primePct > 70) coaching.push(`Prime cost was ${pct(primePct)}. That is the danger zone.`);
  if (primePct > 75) coaching.push(`At this prime cost, fixed costs will bury you.`);
  if (cashAfterFixed < 0) coaching.push(`After paying fixed costs, the store was cash negative by ${money(Math.abs(cashAfterFixed))}.`);
  if (profit < 0) coaching.push(`You lost money today. Something in pricing, staffing, or prep was off.`);
  else if (profit > 300) coaching.push(`Strong day. This is what a good operating day looks like.`);
  if (primePct < 55 && sold > 0) coaching.push(`Prime cost was controlled. That is how owners get paid.`);

  return {
    day,
    dow,
    demand,
    lunchDemand,
    dinnerDemand,
    sold,
    lunchSold,
    dinnerSold,
    lost,
    lunchLost,
    dinnerLost,
    bottleneck,
    lunchBottleneck,
    dinnerBottleneck,
    revenue,
    foodCostUsed,
    spoilageCost,
    laborCost,
    fixedCost,
    totalCost,
    profit,
    foodPct,
    laborPct,
    primePct,
    cashAfterPrime,
    cashAfterFixed,
    doughSpoiled,
    cheeseUsedOz,
    pepperoniUsedOz,
    startInv,
    endInv,
    recipeCheeseOz: n(decisions.cheesePerPizza),
    actualCheeseOz,
    recipePepperoniOz: n(decisions.pepperoniPerPizza),
    actualPepperoniOz,
    overCheeseImpact,
    overPepperoniImpact,
    lunchCapacity: lunchCapacityFromLabor,
    dinnerCapacity: dinnerCapacityFromLabor,
    totalLaborHours,
    events,
    coaching,
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
  if (avgPrimePct > 70) verdict = "Too much waste or labor. Busy does not equal healthy.";
  else if (avgPrimePct > 62) verdict = "Close, but still leaking margin.";
  else if (avgPrimePct >= 55 && avgPrimePct <= 60) verdict = "Strong operator week. This is the zone.";
  else if (avgPrimePct < 55) verdict = "Very efficient week. Make sure you are not under-serving demand.";

  return {
    weekNumber: Math.ceil(latestDay / 7),
    days: weekDays,
    totalRevenue,
    totalProfit,
    avgPrimePct,
    avgLaborPct,
    avgFoodPct,
    totalLostSales,
    totalWasteCost,
    maxOwnerDistribution,
    verdict,
  };
}

function buildBalanceSheet(state: GameState) {
  const cash = n(state.cash);
  const invValue = inventoryValue(state.inventory);

  const assets = {
    cash,
    inventory: invValue,
    total: cash + invValue,
  };

  const liabilities = { total: 0 };
  const equity = { ownerEquityPlug: assets.total - liabilities.total };

  return { assets, liabilities, equity };
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

export default function Page() {
  const [state, setState] = useState<GameState>(initialState());

  const p = state.purchases;
  const d = state.decisions;
  const dow = (state.day - 1) % 7;

  const purchaseCost =
    n(p.dough) * COST.dough +
    n(p.cheeseLbs) * COST.cheesePerLb +
    n(p.pepperoniLbs) * COST.pepperoniPerLb +
    n(p.boxes) * COST.box;

  const totalLaborHours =
    n(d.lunchStaff) * LUNCH_BLOCK_HOURS +
    n(d.dinnerStaff) * DINNER_BLOCK_HOURS;

  const laborPreview = totalLaborHours * COST.laborPerHour;
  const canAfford = purchaseCost <= n(state.cash);

  const projectedDemandMid =
    BASE_DEMAND *
    DAY_MULT[dow] *
    Math.pow(15 / Math.max(10, n(d.price)), 1.4) *
    (1 + (n(d.cheesePerPizza) - 8) * 0.05) *
    getPepperoniDemandEffect(n(d.pepperoniPerPizza));

  const projectedRange = {
    lo: Math.round(projectedDemandMid * 0.92),
    hi: Math.round(projectedDemandMid * 1.08),
  };

  const projectedSplit = phaseDemandSplit(projectedRange.hi, dow);

  const avgPrime =
    state.history.length > 0
      ? state.history.reduce((sum, h) => sum + n(h.primePct), 0) / state.history.length
      : 0;

  const totalProfit = state.history.reduce((sum, h) => sum + n(h.profit), 0);

  const balanceSheet = useMemo(() => buildBalanceSheet(state), [state]);
  const incomeStatement = useMemo(() => buildIncomeStatement(state.history), [state.history]);
  const tAccounts = useMemo(() => buildTAccounts(state), [state]);

  function setPurchase<K extends keyof GameState["purchases"]>(key: K, value: number) {
    setState((s) => ({
      ...s,
      purchases: { ...s.purchases, [key]: Math.max(0, n(value)) },
    }));
  }

  function setDecision<K extends keyof GameState["decisions"]>(key: K, value: number) {
    setState((s) => ({
      ...s,
      decisions: { ...s.decisions, [key]: n(value) },
    }));
  }

  function startGame() {
    setState((s) => ({ ...s, phase: "setup" }));
  }

  function goBankrupt() {
    setState(initialState());
  }

  function applyInstantEquitySale(pctSold: number) {
    if (pctSold === 0) return;
    const cashIn = getEquityRaiseCash(pctSold);

    setState((s) => ({
      ...s,
      cash: n(s.cash) + cashIn,
      ownership: clamp(n(s.ownership) - pctSold / 100, 0.05, 1),
      journal: [
        ...s.journal,
        makeEntry(s.day, `Sold ${pctSold}% equity`, [
          { account: "Cash", debit: cashIn, credit: 0 },
          { account: "Owner Equity", debit: 0, credit: cashIn },
        ]),
      ],
    }));
  }

  function openStore() {
    if (purchaseCost > n(state.cash)) return;

    setState((s) => ({
      ...s,
      phase: "running",
      journal: [
        ...s.journal,
        makeEntry(s.day, "Bought inventory", [
          { account: "Inventory", debit: purchaseCost, credit: 0 },
          { account: "Cash", debit: 0, credit: purchaseCost },
        ]),
      ],
      cash: n(s.cash) - purchaseCost,
    }));

    const sim = simulateDay({
      ...state,
      cash: n(state.cash) - purchaseCost,
    });

    window.setTimeout(() => {
      setState((s) => ({
        ...s,
        lastResult: sim,
        phase: "results",
      }));
    }, 5000);
  }

  function continueAfterDay() {
    setState((s) => {
      if (!s.lastResult) return s;

      const nextCash =
        n(s.cash) +
        n(s.lastResult.revenue) -
        n(s.lastResult.laborCost) -
        n(s.lastResult.fixedCost);

      const finalized = s.lastResult;
      const newHistory = [...s.history, finalized];
      const nextDay = s.day + 1;
      const weeklySummary = getWeeklySummary(newHistory, nextCash, s.ownership);
      const nextPhase = nextDay > TOTAL_DAYS ? "gameover" : weeklySummary ? "weekly" : "setup";

      const newJournal = [...s.journal];

      newJournal.push(
        makeEntry(s.day, "Recorded sales", [
          { account: "Cash", debit: finalized.revenue, credit: 0 },
          { account: "Sales Revenue", debit: 0, credit: finalized.revenue },
        ])
      );

      newJournal.push(
        makeEntry(s.day, "Recorded food and spoilage", [
          { account: "COGS + Waste", debit: finalized.foodCostUsed + finalized.spoilageCost, credit: 0 },
          { account: "Inventory", debit: 0, credit: finalized.foodCostUsed + finalized.spoilageCost },
        ])
      );

      newJournal.push(
        makeEntry(s.day, "Paid labor", [
          { account: "Labor Expense", debit: finalized.laborCost, credit: 0 },
          { account: "Cash", debit: 0, credit: finalized.laborCost },
        ])
      );

      if (finalized.fixedCost > 0) {
        newJournal.push(
          makeEntry(s.day, "Paid fixed costs", [
            { account: "Fixed Expense", debit: finalized.fixedCost, credit: 0 },
            { account: "Cash", debit: 0, credit: finalized.fixedCost },
          ])
        );
      }

      return {
        ...s,
        day: nextDay,
        cash: nextCash,
        inventory: {
          dough: n(finalized.endInv.dough),
          cheeseOz: n(finalized.endInv.cheeseOz),
          pepperoniOz: n(finalized.endInv.pepperoniOz),
          boxes: n(finalized.endInv.boxes),
        },
        purchases: {
          dough: Math.max(40, Math.round(n(finalized.sold) * 0.95)),
          cheeseLbs: Math.max(10, Math.round((n(finalized.sold) * n(d.cheesePerPizza)) / OZ_PER_LB)),
          pepperoniLbs: Math.max(4, Math.round((n(finalized.sold) * n(d.pepperoniPerPizza)) / OZ_PER_LB)),
          boxes: Math.max(40, n(finalized.sold)),
        },
        lastResult: null,
        history: newHistory,
        weeklySummary,
        distributionRequest: 0,
        phase: nextPhase,
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
        phase: s.day > TOTAL_DAYS ? "gameover" : "setup",
        journal: [
          ...s.journal,
          makeEntry(s.day, "Owner distribution", [
            { account: "Distributions", debit: requested, credit: 0 },
            { account: "Cash", debit: 0, credit: requested },
          ]),
        ],
      };
    });
  }

  function resetGame() {
    setState(initialState());
  }

  const gameScoreText = useMemo(() => {
    if (n(state.totalDistributions) >= 5000) return "Strong run. You got paid and kept the store alive.";
    if (n(state.totalDistributions) >= 2500) return "Solid run. You made money, but too much stayed trapped.";
    return "You stayed busy, but did not pull enough cash out.";
  }, [state.totalDistributions]);

  return (
    <div className="min-h-screen bg-[#16110c] text-[#f3e7c9]">
      <style>{`
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; }
        .wrap {
          min-height: 100vh;
          background:
            radial-gradient(circle at top, rgba(232,90,42,0.08), transparent 28%),
            linear-gradient(180deg, #16110c 0%, #1d1711 100%);
          font-family: Inter, system-ui, sans-serif;
        }
        .topbar {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 12px;
          padding: 12px;
          background: #1b140e;
          border-bottom: 1px solid #3b2d1f;
          position: sticky;
          top: 0;
          z-index: 20;
        }
        .topbox {
          background: #221a12;
          border: 1px solid #3b2d1f;
          border-radius: 12px;
          padding: 10px 12px;
          text-align: center;
        }
        .tl { color: #c8b48c; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; }
        .tv { margin-top: 4px; font-size: 22px; font-weight: 800; }
        .layout {
          display: grid;
          grid-template-columns: 390px 1fr;
          min-height: calc(100vh - 86px);
        }
        .controls {
          background: #1d1711;
          border-right: 1px solid #3b2d1f;
          padding: 16px;
        }
        .stage {
          padding: 16px;
          display: grid;
          gap: 16px;
          align-content: start;
        }
        .panel {
          background: #221a12;
          border: 1px solid #3b2d1f;
          border-radius: 16px;
          padding: 14px;
        }
        .brandTitle { font-size: 28px; font-weight: 900; line-height: 1; }
        .brandSub { margin-top: 8px; color: #c8b48c; font-size: 14px; }
        .secHead {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin: 0 0 12px 0;
          font-size: 15px;
          letter-spacing: .05em;
          font-weight: 800;
        }
        .tail { color: #f2b443; }
        .rowLine {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 10px;
          align-items: center;
          padding: 10px 0;
          border-top: 1px solid #2d2217;
        }
        .rowLine:first-child { border-top: 0; padding-top: 0; }
        .ctrlName { font-weight: 700; font-size: 14px; }
        .ctrlSub { margin-top: 3px; color: #8f7d5d; font-size: 12px; }
        .stepper {
          display: grid;
          grid-template-columns: 40px 110px 40px;
          gap: 8px;
          align-items: center;
        }
        .stepper button {
          height: 40px;
          border: 0;
          border-radius: 10px;
          background: #3b2d1f;
          color: #f3e7c9;
          font-size: 22px;
          cursor: pointer;
        }
        .stepVal {
          text-align: center;
          padding: 10px 8px;
          border-radius: 10px;
          background: #16110c;
          border: 1px solid #3b2d1f;
          font-weight: 800;
        }
        .sceneCard, .resultCard {
          background: #221a12;
          border: 1px solid #3b2d1f;
          border-radius: 18px;
          overflow: hidden;
        }
        .sceneTop {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          padding: 14px;
          background: #1b140e;
          border-bottom: 1px solid #3b2d1f;
        }
        .chip, .tabBtn {
          border-radius: 999px;
          background: #2a2016;
          border: 1px solid #3b2d1f;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 800;
          color: #f3e7c9;
        }
        .tabRow {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 12px;
        }
        .tabBtn.active {
          background: #e85a2a;
          border-color: #e85a2a;
          color: white;
        }
        .sceneAnimWrap {
          position: relative;
          overflow: hidden;
        }
        .sceneImg {
          width: 100%;
          height: 430px;
          object-fit: cover;
          display: block;
        }
        .walkPlane {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
        }
        .walker {
          position: absolute;
          bottom: 2%;
          width: 42px;
          height: 96px;
          opacity: 0;
          filter: drop-shadow(0 2px 2px rgba(0,0,0,0.35));
        }
        .w1 { animation: walk-right 5s linear 0s 1; }
        .w2 { animation: walk-left 4.8s linear 0.4s 1; bottom: 0%; transform: scale(1.05); }
        .w3 { animation: walk-right 4.6s linear 1s 1; bottom: 3%; transform: scale(0.9); }
        .w4 { animation: walk-left 4.2s linear 1.5s 1; bottom: 1%; transform: scale(1.1); }
        .w5 { animation: walk-right 3.8s linear 2s 1; bottom: 4%; transform: scale(0.82); }
        @keyframes walk-right {
          0%   { left: -8%; opacity: 0; transform: translateY(0) scale(1); }
          8%   { opacity: 0.95; }
          50%  { transform: translateY(-2px) scale(1); }
          92%  { opacity: 0.95; }
          100% { left: 104%; opacity: 0; transform: translateY(0) scale(1); }
        }
        @keyframes walk-left {
          0%   { left: 104%; opacity: 0; transform: translateY(0) scaleX(-1); }
          8%   { opacity: 0.95; }
          50%  { transform: translateY(-2px) scaleX(-1); }
          92%  { opacity: 0.95; }
          100% { left: -8%; opacity: 0; transform: translateY(0) scaleX(-1); }
        }
        .activeBadge {
          position: absolute;
          right: 16px;
          top: 16px;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(232, 90, 42, 0.92);
          color: white;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.08em;
          box-shadow: 0 6px 16px rgba(0,0,0,0.25);
        }
        .sceneBottom { padding: 16px; }
        .vibe { font-size: 18px; font-weight: 800; }
        .meta { margin-top: 8px; color: #c8b48c; }
        .bigBtn {
          width: 100%;
          border: 0;
          border-radius: 14px;
          padding: 16px 18px;
          color: white;
          font-size: 16px;
          font-weight: 900;
          cursor: pointer;
          margin-top: 10px;
        }
        .orange { background: #e85a2a; }
        .blue { background: #3f82ff; }
        .gold { background: #d49d25; }
        .gray { background: #5a5248; }
        .green { background: #3ba55d; }
        .red { background: #b63b3b; }
        .disabled { background: #4d4032; color: #a89a84; cursor: not-allowed; }
        .smallNote { margin-top: 10px; color: #c8b48c; font-size: 13px; line-height: 1.45; }
        .metricGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-top: 14px;
        }
        .metricBox {
          padding: 12px;
          border-radius: 14px;
          background: #1b140e;
          border: 1px solid #3b2d1f;
        }
        .mv { font-size: 24px; font-weight: 900; }
        .ml { margin-top: 4px; color: #c8b48c; font-size: 12px; text-transform: uppercase; letter-spacing: .07em; }
        .event {
          margin-top: 12px;
          padding: 12px;
          border-radius: 14px;
          background: #2a2016;
          border: 1px solid #3b2d1f;
        }
        .eventTitle { color: #f2b443; font-weight: 900; letter-spacing: .08em; }
        .eventBody { margin-top: 6px; line-height: 1.5; }
        .detailGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-top: 14px;
        }
        .detailBox {
          padding: 12px;
          border-radius: 14px;
          background: #1b140e;
          border: 1px solid #3b2d1f;
        }
        .detailHead { color: #f2b443; font-weight: 900; letter-spacing: .08em; margin-bottom: 8px; }
        .row {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          padding: 6px 0;
          font-size: 14px;
        }
        .good { color: #9edf83; }
        .bad { color: #ff9d84; }
        .goWrap, .introWrap {
          padding: 26px;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: calc(100vh - 86px);
        }
        .goCard, .introCard {
          width: min(920px, 100%);
          padding: 22px;
          background: #221a12;
          border: 1px solid #3b2d1f;
          border-radius: 18px;
        }
        .goTitle, .introTitle { color: #f2b443; font-size: 28px; font-weight: 900; }
        .goSub, .introSub { margin-top: 8px; color: #c8b48c; line-height: 1.6; }
        .goGrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
          margin-top: 18px;
        }
        .goCell {
          padding: 16px;
          border-radius: 14px;
          background: #1b140e;
          border: 1px solid #3b2d1f;
        }
        .goV { font-size: 30px; font-weight: 900; }
        .goL { margin-top: 6px; color: #c8b48c; }
        input.moneyInput {
          width: 100%;
          padding: 12px;
          border-radius: 10px;
          border: 1px solid #3b2d1f;
          background: #16110c;
          color: #f3e7c9;
          font-size: 18px;
          font-weight: 800;
        }
        table.acctTable {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }
        table.acctTable th, table.acctTable td {
          border-bottom: 1px solid #3b2d1f;
          padding: 8px 10px;
          text-align: left;
          font-size: 14px;
        }
        table.acctTable th {
          color: #f2b443;
        }
        @media (max-width: 1100px) {
          .layout { grid-template-columns: 1fr; }
          .controls { border-right: 0; border-bottom: 1px solid #3b2d1f; }
          .metricGrid, .detailGrid, .goGrid { grid-template-columns: repeat(2, 1fr); }
          .topbar { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 700px) {
          .topbar { grid-template-columns: repeat(2, 1fr); }
          .metricGrid, .detailGrid, .goGrid { grid-template-columns: 1fr; }
          .sceneImg { height: 260px; }
          .rowLine { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="wrap">
        <header className="topbar">
          <div className="topbox"><div className="tl">Day</div><div className="tv">{Math.min(state.day, TOTAL_DAYS)}/{TOTAL_DAYS}</div></div>
          <div className="topbox"><div className="tl">Cash</div><div className="tv">{money(state.cash)}</div></div>
          <div className="topbox"><div className="tl">Ownership</div><div className="tv">{Math.round(n(state.ownership) * 100)}%</div></div>
          <div className="topbox"><div className="tl">Distributions</div><div className="tv">{money(state.totalDistributions)}</div></div>
          <div className="topbox">
            <div className="tl">Mode</div>
            <div className="tv" style={{ fontSize: 16 }}>
              {state.activeTab === "game" ? "Game" : "Accounting"}
            </div>
          </div>
        </header>

        {state.phase === "intro" ? (
          <div className="introWrap">
            <div className="introCard">
              <div className="introTitle">Welcome to Brenz Pizza Game</div>
              <div className="introSub">
                Congratulations. You invested your life’s savings and built this location.
                <br /><br />
                You have your last <b>{money(STARTING_CASH)}</b> to start your first day.
                <br /><br />
                You are selling one product only: a <b>12" pepperoni pizza</b>.
                I hope you make the right decisions to make money.
              </div>
              <button className="bigBtn green" onClick={startGame}>
                START YOUR FIRST DAY →
              </button>
            </div>
          </div>
        ) : state.phase === "gameover" ? (
          <div className="goWrap">
            <div className="goCard">
              <div className="goTitle">BANKRUPT / GAME COMPLETE</div>
              <div className="goSub">{gameScoreText}</div>

              <div className="goGrid">
                <div className="goCell"><div className="goV">{money(state.totalDistributions)}</div><div className="goL">Total distributions</div></div>
                <div className="goCell"><div className="goV">{pct(avgPrime)}</div><div className="goL">Avg prime cost</div></div>
                <div className="goCell"><div className="goV">{money(totalProfit, true)}</div><div className="goL">Net profit</div></div>
                <div className="goCell"><div className="goV">{Math.round(n(state.ownership) * 100)}%</div><div className="goL">Ownership left</div></div>
                <div className="goCell"><div className="goV">{money(state.cash)}</div><div className="goL">Ending cash</div></div>
                <div className="goCell"><div className="goV">{state.history.reduce((s, h) => s + n(h.lost), 0)}</div><div className="goL">Tickets lost</div></div>
              </div>

              <button className="bigBtn red" onClick={resetGame}>GO BANKRUPT / RESTART</button>
            </div>
          </div>
        ) : (
          <div className="layout">
            <aside className="controls">
              <div className="panel">
                <div className="brandTitle">BRENZ PIZZA GAME</div>
                <div className="brandSub">
                  One product only: a 12" pepperoni pizza. The store is open 11am–9pm. You need at least 2 people at lunch and 2 at dinner.
                </div>
              </div>

              <div className="panel">
                <div className="tabRow">
                  <button
                    className={`tabBtn ${state.activeTab === "game" ? "active" : ""}`}
                    onClick={() => setState((s) => ({ ...s, activeTab: "game" }))}
                  >
                    GAME
                  </button>
                  <button
                    className={`tabBtn ${state.activeTab === "accounting" ? "active" : ""}`}
                    onClick={() => setState((s) => ({ ...s, activeTab: "accounting" }))}
                  >
                    ACCOUNTING
                  </button>
                </div>
              </div>

              <div className="panel">
                <div className="secHead"><span>CURRENT INVENTORY</span></div>
                <div className="row"><span>Dough</span><span>{n(state.inventory.dough)}</span></div>
                <div className="row"><span>Cheese</span><span>{(n(state.inventory.cheeseOz) / OZ_PER_LB).toFixed(1)} lbs</span></div>
                <div className="row"><span>Pepperoni</span><span>{(n(state.inventory.pepperoniOz) / OZ_PER_LB).toFixed(1)} lbs</span></div>
                <div className="row"><span>Boxes</span><span>{n(state.inventory.boxes)}</span></div>
              </div>

              <div className="panel">
                <div className="secHead">
                  <span>PURCHASING</span>
                  <span className="tail">{money(purchaseCost)}</span>
                </div>

                <ControlRow name="Dough balls" sub={`${money(COST.dough)} each · dough dies daily`} value={n(p.dough)} setValue={(v) => setPurchase("dough", v)} min={0} max={220} step={5} />
                <ControlRow name="Cheese (lbs)" sub={`${money(COST.cheesePerLb)} / lb`} value={n(p.cheeseLbs)} setValue={(v) => setPurchase("cheeseLbs", v)} min={0} max={120} step={1} />
                <ControlRow name="Pepperoni (lbs)" sub={`${money(COST.pepperoniPerLb)} / lb`} value={n(p.pepperoniLbs)} setValue={(v) => setPurchase("pepperoniLbs", v)} min={0} max={60} step={1} />
                <ControlRow name="Boxes" sub={`${money(COST.box)} each`} value={n(p.boxes)} setValue={(v) => setPurchase("boxes", v)} min={0} max={240} step={5} />
              </div>

              <div className="panel">
                <div className="secHead"><span>12" PEPPERONI PIZZA RECIPE + PRICE</span></div>

                <ControlRow name='Cheese per 12" pizza' sub="Higher cheese helps appeal but hurts cost" value={n(d.cheesePerPizza)} setValue={(v) => setDecision("cheesePerPizza", v)} min={6} max={12} step={0.5} format={(v) => `${v.toFixed(1)} oz`} />
                <ControlRow name='Pepperoni per 12" pizza' sub="Too little pepperoni will crush demand" value={n(d.pepperoniPerPizza)} setValue={(v) => setDecision("pepperoniPerPizza", v)} min={0.05} max={6} step={0.05} format={(v) => `${v.toFixed(2)} oz`} />
                <ControlRow name='Price per 12" pepperoni pizza' sub="Lower price drives traffic. Higher price protects margin." value={n(d.price)} setValue={(v) => setDecision("price", v)} min={10} max={25} step={1} format={(v) => `$${v}`} />

                {n(d.pepperoniPerPizza) <= 0.5 && (
                  <div className="smallNote bad">
                    Warning: this pepperoni level is too low. Customers will hate this pizza.
                  </div>
                )}
              </div>

              <div className="panel">
                <div className="secHead">
                  <span>LABOR (11AM–9PM)</span>
                  <span className="tail">{money(laborPreview)}</span>
                </div>

                <ControlRow name="Lunch staff (11am–4pm)" sub="Minimum 2 people" value={n(d.lunchStaff)} setValue={(v) => setDecision("lunchStaff", v)} min={2} max={8} step={1} format={(v) => `${v} people`} />
                <ControlRow name="Dinner staff (4pm–9pm)" sub="Minimum 2 people · dinner rush matters most" value={n(d.dinnerStaff)} setValue={(v) => setDecision("dinnerStaff", v)} min={2} max={10} step={1} format={(v) => `${v} people`} />

                <div className="smallNote">
                  Total labor hours: <b>{totalLaborHours}</b>
                  <br />
                  Lunch capacity: <b>{n(d.lunchStaff) * LUNCH_BLOCK_HOURS * PIZZAS_PER_PERSON_PER_HOUR}</b> pizzas
                  <br />
                  Dinner capacity: <b>{n(d.dinnerStaff) * DINNER_BLOCK_HOURS * PIZZAS_PER_PERSON_PER_HOUR}</b> pizzas
                </div>
              </div>

              {state.activeTab === "game" && state.phase === "setup" && (
                <>
                  <div className="panel">
                    <div className="secHead"><span>TONIGHT’S FORECAST</span></div>
                    <div className="row"><span>Total demand</span><span>{projectedRange.lo}–{projectedRange.hi}</span></div>
                    <div className="row"><span>Lunch demand</span><span>~{projectedSplit.lunchDemand}</span></div>
                    <div className="row"><span>Dinner demand</span><span>~{projectedSplit.dinnerDemand}</span></div>
                    <div className="row"><span>Weather</span><span>{DAY_WEATHER[dow]}</span></div>
                    <div className="row"><span>Cash after buy</span><span className={canAfford ? "" : "bad"}>{money(n(state.cash) - purchaseCost)}</span></div>
                    <div className="smallNote">
                      If prime cost gets above 70%, fixed costs will usually start to bury you.
                    </div>
                  </div>

                  <button className={`bigBtn green ${canAfford ? "" : "disabled"}`} onClick={openStore} disabled={!canAfford}>
                    {canAfford ? "OPEN THE STORE →" : "NOT ENOUGH CASH"}
                  </button>

                  <div className="panel">
                    <button className="bigBtn red" onClick={goBankrupt}>
                      GO BANKRUPT / RESTART
                    </button>
                  </div>
                </>
              )}

              {state.activeTab === "game" && state.phase !== "setup" && (
                <div className="panel">
                  <button className="bigBtn red" onClick={goBankrupt}>
                    GO BANKRUPT / RESTART
                  </button>
                </div>
              )}

              {state.phase === "results" && state.activeTab === "game" && (
                <button className="bigBtn blue" onClick={continueAfterDay}>
                  CONTINUE →
                </button>
              )}

              {state.phase === "weekly" && state.activeTab === "game" && state.weeklySummary && (
                <div className="panel">
                  <div className="secHead"><span>WEEKLY DISTRIBUTION</span></div>
                  <div className="row"><span>Week</span><span>{n(state.weeklySummary.weekNumber)}</span></div>
                  <div className="row"><span>Week profit</span><span>{money(n(state.weeklySummary.totalProfit), true)}</span></div>
                  <div className="row"><span>Avg prime cost</span><span>{pct(n(state.weeklySummary.avgPrimePct))}</span></div>
                  <div className="row"><span>Your ownership</span><span>{Math.round(n(state.ownership) * 100)}%</span></div>
                  <div className="row"><span>Max distribution to you</span><span>{money(n(state.weeklySummary.maxOwnerDistribution))}</span></div>

                  <div className="smallNote">
                    Choose the dollar amount you want to distribute to yourself this week.
                  </div>

                  <input
                    className="moneyInput"
                    type="number"
                    value={n(state.distributionRequest)}
                    min={0}
                    max={Math.floor(n(state.weeklySummary.maxOwnerDistribution))}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        distributionRequest: e.target.value === "" ? 0 : n(e.target.value),
                      }))
                    }
                  />

                  <button className="bigBtn gold" onClick={processWeeklyDistribution}>
                    TAKE WEEKLY DISTRIBUTION
                  </button>
                </div>
              )}
            </aside>

            <main className="stage">
              {state.activeTab === "game" ? (
                <>
                  <AnimatedStoreScene day={state.day} dow={dow} running={state.phase === "running"} />

                  {state.phase === "setup" && (
                    <div className="panel">
                      <div className="secHead"><span>HOW TO WIN</span></div>
                      <div className="smallNote" style={{ fontSize: 15 }}>
                        Sell the best 12" pepperoni pizza business you can. Manage dough, cheese, pepperoni, boxes, lunch staffing, dinner staffing, price, equity, and weekly distributions.
                      </div>
                    </div>
                  )}

                  {state.phase === "running" && (
                    <div className="panel">
                      <div className="secHead"><span>STORE ACTIVE</span></div>
                      <div className="smallNote" style={{ fontSize: 15 }}>
                        Customers are moving through the store. The day is playing out...
                      </div>
                    </div>
                  )}

                  {state.phase === "results" && state.lastResult && (
                    <div className="resultCard" style={{ padding: 16 }}>
                      <div className="secHead" style={{ marginBottom: 0 }}>
                        <span>SHIFT RESULTS</span>
                        <span className={n(state.lastResult.profit) >= 0 ? "good" : "bad"}>
                          {money(n(state.lastResult.profit), true)}
                        </span>
                      </div>

                      <div className="metricGrid">
                        <MetricBox label="Demand" value={`${n(state.lastResult.demand)}`} />
                        <MetricBox label="Sold" value={`${n(state.lastResult.sold)}`} />
                        <MetricBox label="Lost" value={`${n(state.lastResult.lost)}`} />
                        <MetricBox label="Revenue" value={money(n(state.lastResult.revenue))} />
                        <MetricBox label="Food %" value={pct(n(state.lastResult.foodPct))} />
                        <MetricBox label="Labor %" value={pct(n(state.lastResult.laborPct))} />
                        <MetricBox label="Prime %" value={pct(n(state.lastResult.primePct))} />
                        <MetricBox label="Profit" value={money(n(state.lastResult.profit), true)} />
                      </div>

                      <div className="detailGrid">
                        <div className="detailBox">
                          <div className="detailHead">CASH LESSON</div>
                          <DetailRow label="Cash after prime" value={money(n(state.lastResult.cashAfterPrime), true)} />
                          <DetailRow label="Fixed costs" value={money(n(state.lastResult.fixedCost))} />
                          <DetailRow label="Cash after fixed" value={money(n(state.lastResult.cashAfterFixed), true)} />
                          <DetailRow label="Prime %" value={pct(n(state.lastResult.primePct))} />
                        </div>

                        <div className="detailBox">
                          <div className="detailHead">Lunch vs Dinner</div>
                          <DetailRow label="Lunch demand / sold" value={`${n(state.lastResult.lunchDemand)} / ${n(state.lastResult.lunchSold)}`} />
                          <DetailRow label="Dinner demand / sold" value={`${n(state.lastResult.dinnerDemand)} / ${n(state.lastResult.dinnerSold)}`} />
                          <DetailRow label="Lunch bottleneck" value={state.lastResult.lunchBottleneck ?? "none"} />
                          <DetailRow label="Dinner bottleneck" value={state.lastResult.dinnerBottleneck ?? "none"} />
                        </div>

                        <div className="detailBox">
                          <div className="detailHead">Labor Reality</div>
                          <DetailRow label="Total labor hours" value={`${n(state.lastResult.totalLaborHours)}`} />
                          <DetailRow label="Lunch capacity" value={`${n(state.lastResult.lunchCapacity)}`} />
                          <DetailRow label="Dinner capacity" value={`${n(state.lastResult.dinnerCapacity)}`} />
                          <DetailRow label="Overall bottleneck" value={state.lastResult.bottleneck ?? "none"} />
                        </div>
                      </div>

                      {state.lastResult.events.map((ev) => (
                        <div className="event" key={ev.id}>
                          <div className="eventTitle">{ev.title}</div>
                          <div className="eventBody">{ev.body}</div>
                        </div>
                      ))}

                      <div className="panel" style={{ marginTop: 14 }}>
                        <div className="secHead"><span>WHAT HAPPENED TODAY</span></div>
                        {(state.lastResult.coaching ?? []).length === 0 ? (
                          <div className="smallNote">A pretty normal day. Nothing major stood out.</div>
                        ) : (
                          (state.lastResult.coaching ?? []).map((c, i) => (
                            <div key={i} className="row">
                              <span>•</span>
                              <span style={{ flex: 1 }}>{c}</span>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="detailGrid">
                        <div className="detailBox">
                          <div className="detailHead">P&L</div>
                          <DetailRow label="Food used" value={money(n(state.lastResult.foodCostUsed))} />
                          <DetailRow label="Spoilage" value={money(n(state.lastResult.spoilageCost))} />
                          <DetailRow label="Labor" value={money(n(state.lastResult.laborCost))} />
                          <DetailRow label="Fixed" value={money(n(state.lastResult.fixedCost))} />
                        </div>

                        <div className="detailBox">
                          <div className="detailHead">Inventory</div>
                          <DetailRow label="Dough spoiled" value={`${n(state.lastResult.doughSpoiled)}`} />
                          <DetailRow label="Boxes left" value={`${n(state.lastResult.endInv.boxes)}`} />
                          <DetailRow label="Pepperoni left" value={`${(n(state.lastResult.endInv.pepperoniOz) / OZ_PER_LB).toFixed(1)} lbs`} />
                          <DetailRow label="Cheese left" value={`${(n(state.lastResult.endInv.cheeseOz) / OZ_PER_LB).toFixed(1)} lbs`} />
                        </div>

                        <div className="detailBox">
                          <div className="detailHead">Recipe Impact</div>
                          <DetailRow label='Cheese per 12" pizza' value={`${n(state.lastResult.recipeCheeseOz).toFixed(1)} oz`} />
                          <DetailRow label='Actual cheese used' value={`${n(state.lastResult.actualCheeseOz).toFixed(1)} oz`} />
                          <DetailRow label='Pepperoni per 12" pizza' value={`${n(state.lastResult.recipePepperoniOz).toFixed(2)} oz`} />
                          <DetailRow label='Actual pepperoni used' value={`${n(state.lastResult.actualPepperoniOz).toFixed(2)} oz`} />
                        </div>
                      </div>
                    </div>
                  )}

                  {state.phase === "weekly" && state.weeklySummary && (
                    <div className="panel">
                      <div className="secHead"><span>WEEKLY OWNER REVIEW</span></div>
                      <div className="metricGrid">
                        <MetricBox label="Week Revenue" value={money(n(state.weeklySummary.totalRevenue))} />
                        <MetricBox label="Week Profit" value={money(n(state.weeklySummary.totalProfit), true)} />
                        <MetricBox label="Avg Prime %" value={pct(n(state.weeklySummary.avgPrimePct))} />
                        <MetricBox label="Ownership" value={`${Math.round(n(state.ownership) * 100)}%`} />
                      </div>

                      <div className="detailGrid">
                        <div className="detailBox">
                          <div className="detailHead">WEEK SCORECARD</div>
                          <DetailRow label="Revenue" value={money(n(state.weeklySummary.totalRevenue))} />
                          <DetailRow label="Profit" value={money(n(state.weeklySummary.totalProfit), true)} />
                          <DetailRow label="Avg food %" value={pct(n(state.weeklySummary.avgFoodPct))} />
                          <DetailRow label="Avg labor %" value={pct(n(state.weeklySummary.avgLaborPct))} />
                        </div>

                        <div className="detailBox">
                          <div className="detailHead">LEAKS</div>
                          <DetailRow label="Lost sales" value={money(n(state.weeklySummary.totalLostSales))} />
                          <DetailRow label="Waste cost" value={money(n(state.weeklySummary.totalWasteCost))} />
                          <DetailRow label="Prime cost" value={pct(n(state.weeklySummary.avgPrimePct))} />
                          <DetailRow label="Max owner distribution" value={money(n(state.weeklySummary.maxOwnerDistribution))} />
                        </div>

                        <div className="detailBox">
                          <div className="detailHead">OWNER VERDICT</div>
                          <div className="smallNote" style={{ fontSize: 15 }}>
                            {state.weeklySummary.verdict}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="panel">
                    <div className="secHead"><span>ACCOUNTING DASHBOARD</span></div>
                    <div className="smallNote">
                      Financing lives here. Sell equity here, then review your T-accounts, balance sheet, and total income statement.
                    </div>
                  </div>

                  <div className="panel">
                    <div className="secHead"><span>EQUITY RAISE</span></div>
                    <div className="smallNote">
                      Sell part of the shop for instant cash. This lowers your ownership immediately.
                    </div>

                    <div className="row">
                      <span>Sell 10%</span>
                      <button className="bigBtn blue" onClick={() => applyInstantEquitySale(10)}>
                        +{money(300)}
                      </button>
                    </div>

                    <div className="row">
                      <span>Sell 20%</span>
                      <button className="bigBtn gold" onClick={() => applyInstantEquitySale(20)}>
                        +{money(700)}
                      </button>
                    </div>

                    <div className="row">
                      <span>Sell 30%</span>
                      <button className="bigBtn orange" onClick={() => applyInstantEquitySale(30)}>
                        +{money(1200)}
                      </button>
                    </div>

                    <div className="smallNote">
                      Ownership remaining: <b>{Math.round(n(state.ownership) * 100)}%</b>
                    </div>
                  </div>

                  <div className="panel">
                    <button className="bigBtn red" onClick={goBankrupt}>
                      GO BANKRUPT / RESTART
                    </button>
                  </div>

                  <div className="detailGrid">
                    <div className="detailBox">
                      <div className="detailHead">BALANCE SHEET</div>
                      <table className="acctTable">
                        <thead>
                          <tr><th>Account</th><th>Amount</th></tr>
                        </thead>
                        <tbody>
                          <tr><td>Cash</td><td>{money(balanceSheet.assets.cash)}</td></tr>
                          <tr><td>Inventory</td><td>{money(balanceSheet.assets.inventory)}</td></tr>
                          <tr><td><b>Total Assets</b></td><td><b>{money(balanceSheet.assets.total)}</b></td></tr>
                          <tr><td>Liabilities</td><td>{money(balanceSheet.liabilities.total)}</td></tr>
                          <tr><td><b>Owner Equity</b></td><td><b>{money(balanceSheet.equity.ownerEquityPlug)}</b></td></tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="detailBox">
                      <div className="detailHead">TOTAL INCOME STATEMENT</div>
                      <table className="acctTable">
                        <thead>
                          <tr><th>Account</th><th>Amount</th></tr>
                        </thead>
                        <tbody>
                          <tr><td>Sales Revenue</td><td>{money(incomeStatement.revenue)}</td></tr>
                          <tr><td>Food Used</td><td>{money(incomeStatement.foodUsed)}</td></tr>
                          <tr><td>Spoilage</td><td>{money(incomeStatement.spoilage)}</td></tr>
                          <tr><td>Labor</td><td>{money(incomeStatement.labor)}</td></tr>
                          <tr><td>Fixed Expense</td><td>{money(incomeStatement.fixed)}</td></tr>
                          <tr><td><b>Net Income</b></td><td><b>{money(incomeStatement.netIncome, true)}</b></td></tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="detailBox">
                      <div className="detailHead">T-ACCOUNTS</div>
                      <table className="acctTable">
                        <thead>
                          <tr><th>Account</th><th>Debit</th><th>Credit</th></tr>
                        </thead>
                        <tbody>
                          {Object.entries(tAccounts).map(([account, totals]) => (
                            <tr key={account}>
                              <td>{account}</td>
                              <td>{money(totals.debit)}</td>
                              <td>{money(totals.credit)}</td>
                            </tr>
                          ))}
                          {Object.keys(tAccounts).length === 0 && (
                            <tr>
                              <td colSpan={3}>No accounting activity yet.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </main>
          </div>
        )}
      </div>
    </div>
  );
}

function AnimatedStoreScene({
  day,
  dow,
  running,
}: {
  day: number;
  dow: number;
  running: boolean;
}) {
  return (
    <div className="sceneCard">
      <div className="sceneTop">
        <div className="chip">Day {day} · {DAY_NAMES[dow]}</div>
        <div className="chip">{DAY_WEATHER[dow]}</div>
        <div className="chip">{running ? "STORE ACTIVE" : "READY"}</div>
      </div>

      <div className="sceneAnimWrap">
        <img src="/storefront.jpeg" alt="Brenz storefront" className="sceneImg" />

        {running && (
          <div className="walkPlane">
            <Silhouette className="walker w1" />
            <Silhouette className="walker w2" />
            <Silhouette className="walker w3" />
            <Silhouette className="walker w4" />
            <Silhouette className="walker w5" />
          </div>
        )}

        {running && <div className="activeBadge">OPEN • LUNCH / DINNER FLOW</div>}
      </div>

      <div className="sceneBottom">
        <div className="vibe">{DAY_VIBE[dow]}</div>
        <div className="meta">
          {running
            ? "Customers are moving through the day..."
            : "The store is open 11am–9pm. Dinner rush can break a weak labor plan."}
        </div>
      </div>
    </div>
  );
}

function Silhouette({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 46 110" fill="rgba(14,10,8,0.88)" aria-hidden="true">
      <circle cx="23" cy="11" r="9" />
      <rect x="15" y="21" width="16" height="34" rx="7" />
      <rect x="10" y="25" width="5" height="26" rx="2" />
      <rect x="31" y="25" width="5" height="26" rx="2" />
      <rect x="16" y="55" width="6" height="35" rx="2" />
      <rect x="24" y="55" width="6" height="35" rx="2" />
      <rect x="14" y="88" width="10" height="6" rx="1" />
      <rect x="22" y="88" width="10" height="6" rx="1" />
    </svg>
  );
}

function ControlRow({
  name,
  sub,
  value,
  setValue,
  min,
  max,
  step,
  format,
}: {
  name: string;
  sub: string;
  value: number;
  setValue: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
}) {
  return (
    <div className="rowLine">
      <div>
        <div className="ctrlName">{name}</div>
        <div className="ctrlSub">{sub}</div>
      </div>
      <div className="stepper">
        <button onClick={() => setValue(clamp(n(value) - step, min, max))}>−</button>
        <div className="stepVal">{format ? format(n(value)) : n(value)}</div>
        <button onClick={() => setValue(clamp(n(value) + step, min, max))}>+</button>
      </div>
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="metricBox">
      <div className="mv">{value}</div>
      <div className="ml">{label}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="row">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}