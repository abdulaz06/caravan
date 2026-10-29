// The consensus generator: everyone's plans in, one suggested group trip out.
// Deterministic (no randomness, stable tie-breaks — the same inputs always
// give the same plan) and explainable (every placed item carries its reasons).
// Pure: it takes the trip's engine explicitly and touches nothing else.
//
//   1. Dates — the length that best balances days against full attendance,
//      then the window the most people can make.
//   2. Votes — each traveller's picks share one equal voice (drafts count less).
//   3. Slots — the chosen dates' day structure; every slot only takes what the
//      trip's own rules allow there (pools, weekdays, special dates, day trips,
//      one main meal per slot, extras close by).
//   4. The most popular plan: fill by score, improve, add popular extras.
//      That's "Majority rules" — and the yardstick for the other modes.
//   5. Fairness (Everyone gets a say / Custom): lift the lowest share of
//      feasible picks, then the next lowest (leximin), while the plan keeps at
//      least (1 − tolerance) of its score; then improve without ever lowering
//      the minimum share.
//   6. Splits, reasons, per-person satisfaction.
//
// docs/CONSENSUS.md explains it in plain language with the formulas.
import { addDays, dayLabel, parseISO } from "@/lib/dates";
import { computeBudget } from "../budget";
import { STAY_ID, type Activity, type Pair, type Slot, type SpecialDate } from "../catalog";
import { variantOf } from "../day-trip";
import { DATA_VERSION, itemAllowed, isSpecialOption, normalize, type ItineraryData, type SlotItem } from "../itinerary";
import { isHidden } from "../rules";
import { allowedLengths, clampLength, defaultLength, isFixed, isRouteArea, planDays, tripDays, type DayPlan, type Engine } from "../structure";
import { daysLabel, distanceLabel, homeRegion, hoursFrom } from "../timeline";
import { lengthOptions, pickWindows, recommendLength, scoreWindow, type Availability } from "./dates";
import {
  DEFAULT_SETTINGS,
  type Ballot,
  type ConsensusPlan,
  type DecisionMode,
  type FairnessStats,
  type MissedPick,
  type PersonResult,
  type PlanItem,
  type PlanSettings,
  type PlanSlot,
  type PlanSplit,
  type Reason,
} from "./types";

// ── Tuning (all penalties are in "tenths of the group", see docs/CONSENSUS.md) ──

/**
 * The fairness pull in local improvement, at full strength: proportional
 * fairness on each traveller's share of their feasible picks
 * (λ · 8 · Σ w·ln(0.1 + share)), so a pick for the least-satisfied person
 * counts for much more than one more for someone who already has most of theirs.
 */
const FAIR_WEIGHT = 8;
/** λ at full strength (Everyone gets a say); Custom scales it with the slider. */
const FAIR_LAMBDA = 0.5;
const MAX_EXTRAS = 2;
const IMPROVE_ROUNDS = 80;
const LIFT_ROUNDS = 400;

const SLOTS: Slot[] = ["day", "night"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** A short stable key (FNV-1a): the same thing in the same slot on the same date keeps its key across versions. */
export function itemKey(date: string, slot: Slot, id: string): string {
  let h = 0x811c9dc5;
  for (const ch of `${date}:${slot}:${id}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export const slotKey = (date: string, slot: Slot) => `${date}:${slot}`;

/**
 * How strongly a mode pursues fairness: Majority rules 0, Everyone gets a
 * say 1, Custom the slider. The popularity it may give up (the tolerance)
 * and the fairness pull λ scale together with it.
 */
export function modeParams(mode: DecisionMode, fairness: number, tolerance: number): { strength: number; lambda: number; tolerance: number } {
  const strength = mode === "majority" ? 0 : mode === "together" ? 1 : Math.max(0, Math.min(1, fairness));
  return { strength, lambda: strength * FAIR_LAMBDA, tolerance: strength * Math.max(0, Math.min(0.5, tolerance)) };
}

/** A main meal (dinner, a restaurant, a food crawl): at most one per slot. Presets tag them "meal". */
export const isMeal = (a: Pick<Activity, "tags">) => a.tags.includes("meal");
/** A big day trip is the day: only ever a day's main item. */
export const isBigTrip = (a: Pick<Activity, "tags" | "variants" | "onlyBaseDays">) => a.tags.includes("big day trip") || !!a.variants || !!a.onlyBaseDays;

type Voter = {
  id: string;
  name: string;
  status: "submitted" | "draft";
  weight: number;
  start: string | null;
  end: string | null;
  /** Distinct activity picks that can still be placed (not hidden). */
  picks: string[];
  /** Every distinct activity pick (for "your picks made it"). */
  allPicks: string[];
  variants: Map<string, string>;
  stays: Record<Slot, number>;
  slotsHad: Record<Slot, number>;
  /** Their share of one equal voice per pick unit (weight ÷ picks + stay-ins). */
  unit: number;
};

type SlotDef = {
  i: number;
  day: number;
  date: string;
  slot: Slot;
  area: string;
  plan: DayPlan;
  weekday: number;
  special: SpecialDate | null;
  pair: Pair | null;
  /** Arrival, transfer or fly-home day: never split. */
  moving: boolean;
};

type Extra = { id: string; locked: boolean };

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const jain = (xs: number[]) => {
  const sum = xs.reduce((a, b) => a + b, 0);
  const sq = xs.reduce((a, b) => a + b * b, 0);
  return sq > 0 ? (sum * sum) / (xs.length * sq) : 1;
};
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const shortTitle = (a: Activity) => a.title.split(/[:·(]/)[0].trim();
const pctText = (x: number) => `${Math.round(x * 100)}%`;

export function generatePlan(e: Engine, ballots: Ballot[], input: Partial<PlanSettings> = {}): ConsensusPlan {
  const settings: PlanSettings = { ...DEFAULT_SETTINGS, ...input, locks: input.locks ?? [], splits: input.splits ?? {} };
  const mode: DecisionMode = settings.mode ?? "together";
  const { strength, lambda, tolerance } = modeParams(mode, settings.fairness, settings.tolerance);
  const { catalog } = e;
  const byId = catalog.byId;
  const notes: string[] = [];

  // ── Voters ──────────────────────────────────────────────────────────
  // In name order (unique in a trip), then id: ties never hang on a random id, so a rebuilt trip plans the same.
  const voterKey = (b: Ballot) => `${b.name.toLowerCase()}\u0000${b.id}`;
  const sorted = [...ballots].sort((a, b) => (voterKey(a) < voterKey(b) ? -1 : voterKey(a) > voterKey(b) ? 1 : 0));
  const voters: Voter[] = [];
  for (const b of sorted) {
    const d = b.data;
    const weight = b.status === "submitted" ? 1 : Math.max(0, Math.min(1, settings.draftWeight));
    const all = new Set<string>();
    const variants = new Map<string, string>();
    const stays: Record<Slot, number> = { day: 0, night: 0 };
    const slotsHad: Record<Slot, number> = { day: 0, night: 0 };
    const plans = d.days.length ? planDays(e, d.days.length) : [];
    d.days.forEach((day, i) => {
      for (const slot of SLOTS) {
        if (plans[i]?.areas[slot]) slotsHad[slot]++;
        for (const x of day[slot]) {
          if (x.id === STAY_ID) {
            stays[slot]++;
            continue;
          }
          const a = byId[x.id];
          if (!a || a.kind === "family" || a.familyOf) continue;
          all.add(x.id);
          if (x.variant && !variants.has(x.id)) variants.set(x.id, x.variant);
        }
      }
    });
    const allPicks = [...all].sort();
    const picks = allPicks.filter((id) => !isHidden(e.rules, id));
    const units = picks.length + stays.day + stays.night;
    voters.push({
      id: b.id,
      name: b.name,
      status: b.status,
      weight,
      start: d.startDate,
      end: d.endDate,
      picks,
      allPicks,
      variants,
      stays,
      slotsHad,
      unit: units && weight ? weight / units : 0,
    });
  }
  const voices = voters.filter((v) => v.unit > 0);
  // Scale so a pick everyone made scores about the number of people (equal voice keeps each person's total the same).
  const meanUnits = voices.length ? voices.reduce((s, v) => s + v.weight / v.unit, 0) / voices.length : 1;
  const groupWeight = voices.reduce((s, v) => s + v.weight, 0);
  const P = Math.max(1, groupWeight) / 10;

  // ── 1. Dates: length vs attendance, then the window ─────────────────
  const withDates = voters.filter((v) => v.start && v.end);
  const avail: Availability[] = withDates.map((v) => ({ id: v.id, start: v.start!, end: v.end! }));
  const bounds = e.rules.window;
  const fixed = isFixed(e);
  // With a fixed trip length there's nothing to weigh: only the window is chosen.
  const options = fixed || !avail.length ? [] : lengthOptions(avail, bounds, [...allowedLengths(e)].sort((a, b) => a - b));
  const minLength = e.rules.recommended?.min ?? (options[0]?.length ?? 1);
  const best = recommendLength(options, minLength);
  let length: number;
  let lengthReason: string;
  if (fixed) {
    length = tripDays(e);
    lengthReason = "The trip's fixed length";
  } else if (settings.length) {
    length = clampLength(e, settings.length);
    lengthReason = "Chosen by the organizers";
  } else if (best) {
    length = best.length;
    lengthReason = "The best balance of days and full attendance";
  } else {
    length = defaultLength(e);
    lengthReason = avail.length ? "The suggested length (nobody is free for a whole trip yet)" : "The suggested length (nobody has dates yet)";
  }
  const lengths = options.map((o) => ({ ...o, recommended: o.length === best?.length }));
  const picked = pickWindows(avail, bounds, length, 3);
  let pinned = false;
  let chosen = picked.best ?? scoreWindow(avail, bounds.start, length);
  if (settings.start) {
    const last = addDays(bounds.end, -(length - 1));
    const start = settings.start < bounds.start ? bounds.start : settings.start > last ? last : settings.start;
    chosen = scoreWindow(avail, start, length);
    pinned = true;
  }
  const runnersUp = (pinned ? [picked.best, ...picked.runnersUp].filter((w) => !!w && w.start !== chosen.start) : picked.runnersUp).slice(0, 3) as typeof picked.runnersUp;

  // ── 2. Slots ────────────────────────────────────────────────────────
  const plans = planDays(e, length);
  const slots: SlotDef[] = [];
  plans.forEach((plan, day) => {
    const date = addDays(chosen.start, day);
    const md = date.slice(5);
    const special = catalog.specialDates.find((s) => s.date === md) ?? null;
    for (const slot of SLOTS) {
      const area = plan.areas[slot];
      if (!area) continue;
      const isSpecial = !!special && special.slot === slot;
      const pairId = isSpecial ? special!.pairs[area] : undefined;
      const pair = pairId ? (catalog.pairsById[pairId] ?? null) : null;
      slots.push({
        i: slots.length,
        day,
        date,
        slot,
        area,
        plan,
        weekday: parseISO(date).getUTCDay(),
        special: isSpecial ? special : null,
        pair,
        moving: plan.arrival || plan.departs || plan.kind !== "base",
      });
    }
  });
  const slotAt = new Map(slots.map((s) => [slotKey(s.date, s.slot), s.i]));
  const other = (s: SlotDef, day: number, slot: Slot) => slotAt.get(slotKey(addDays(chosen.start, day), slot));

  // Who's there: a traveller with dates is there on the days inside them; without dates, every day.
  const presentOn = (v: Voter, day: number) => {
    if (!v.start || !v.end) return true;
    const d = addDays(chosen.start, day);
    return d >= v.start && d <= v.end;
  };
  const presence: boolean[][] = voters.map((v) => plans.map((_, d) => presentOn(v, d)));
  const thereCount = plans.map((_, d) => voters.filter((_, k) => presence[k][d]).length);

  // ── 3. Votes ────────────────────────────────────────────────────────
  const supporters = new Map<string, number[]>();
  voters.forEach((v, k) => {
    // A traveller whose plan counts for nothing (a draft at weight 0) doesn't vote.
    if (v.unit > 0) for (const id of v.picks) supporters.set(id, [...(supporters.get(id) ?? []), k]);
  });
  const scoreCache = new Map<string, number>();
  /** Equal-voice support for an item on a day: Σ over its pickers who are there of their unit, scaled to ≈ people. */
  const S = (id: string, day: number) => {
    const key = `${id}@${day}`;
    let s = scoreCache.get(key);
    if (s === undefined) {
      s = 0;
      for (const k of supporters.get(id) ?? []) if (presence[k][day]) s += voters[k].unit * meanUnits;
      scoreCache.set(key, s);
    }
    return s;
  };
  const heads = (id: string) => supporters.get(id)?.length ?? 0;
  const headsThere = (id: string, day: number) => (supporters.get(id) ?? []).filter((k) => presence[k][day]).length;

  // Stay-in: each traveller wants about their own share of rest slots, scaled to this plan.
  const slotsOfType: Record<Slot, number> = { day: slots.filter((s) => s.slot === "day").length, night: slots.filter((s) => s.slot === "night").length };
  const want: Record<Slot, number>[] = voters.map((v) => {
    const w = (t: Slot) => (v.stays[t] ? Math.max(1, Math.round((v.stays[t] / Math.max(1, v.slotsHad[t])) * slotsOfType[t])) : 0);
    return { day: w("day"), night: w("night") };
  });
  /** The k-th rest slot of a type (k from 1) on a day is worth the voice of those there who wanted at least k. */
  const restValue = (t: Slot, k: number, day: number) => {
    let s = 0;
    voters.forEach((v, j) => {
      if (want[j][t] >= k && presence[j][day]) s += v.unit * meanUnits;
    });
    return s;
  };

  // Budget fit: a per-slot activity budget from the group's tiers, after places to stay and transport.
  const budgetRef = (() => {
    const tiers = voters.flatMap((v) => {
      const b = ballots.find((x) => x.id === v.id)?.data.preferences.budget;
      const t = b ? catalog.preset.preferences.budgets.find((x) => x.id === b) : undefined;
      return t ? [t.usd[1] ?? t.usd[0] * 1.5] : [];
    });
    if (!tiers.length) return null;
    const skeleton = skeletonData(e, chosen.start, length);
    const base = computeBudget(e, skeleton).total;
    const left = median(tiers) - (base[0] + base[1]) / 2;
    return Math.max(10, left / Math.max(1, slots.length));
  })();

  // ── State ───────────────────────────────────────────────────────────
  const n = slots.length;
  const main: (string | null)[] = Array(n).fill(null);
  const mainVariant: (string | undefined)[] = Array(n).fill(undefined);
  const forced: boolean[] = Array(n).fill(false);
  const lockedMain: boolean[] = Array(n).fill(false);
  const extras: Extra[][] = slots.map(() => []);
  const splitB: (string | null)[] = Array(n).fill(null);
  const used = new Map<string, number>();
  const made: number[] = voters.map(() => 0);
  /** Item id → the travellers the fairness step placed it for. */
  const floorFor = new Map<string, Set<string>>();
  const radius = catalog.preset.structure.extraRadiusHours;
  const landing = catalog.legs[catalog.preset.structure.arrival.leg]?.from ?? null;

  const isLate = (a: Activity) => a.vibe >= 2 || catalog.isNightlife(a);
  // A main meal, or a night out that family-friendly view shows as one (so neither view has two dinners in a slot).
  const mealish = (a: Activity) => isMeal(a) || (!!a.familySwap && !!byId[a.familySwap] && isMeal(byId[a.familySwap]));
  const variantFor = (i: number, id: string): string | undefined => {
    const a = byId[id];
    if (!a?.variants) return undefined;
    const counts = new Map<string, number>();
    for (const k of supporters.get(id) ?? []) {
      if (!presence[k][slots[i].day]) continue;
      const v = voters[k].variants.get(id) ?? a.variants[0].id;
      counts.set(v, (counts.get(v) ?? 0) + voters[k].unit);
    }
    // Most-wanted variant whose early start doesn't clash with a late night before.
    const order = [...a.variants].sort((x, y) => (counts.get(y.id) ?? 0) - (counts.get(x.id) ?? 0));
    return (order.find((v) => !v.eveBefore || !lateNightBefore(i)) ?? order[0]).id;
  };
  const lateNightBefore = (i: number) => {
    const j = other(slots[i], slots[i].day - 1, "night");
    if (j === undefined) return false;
    return [main[j], ...extras[j].map((x) => x.id)].some((id) => !!id && id !== STAY_ID && !!byId[id] && isLate(byId[id]));
  };
  const earlyTripAfter = (i: number) => {
    const j = other(slots[i], slots[i].day + 1, "day");
    if (j === undefined || !main[j]) return false;
    const a = byId[main[j]!];
    return !!a?.variants && !!variantOf(a, mainVariant[j])?.eveBefore;
  };

  /** The rules that hold whatever else is in the slot: pools, weekdays, special dates, transfer evenings, hidden. */
  function fitsStatic(i: number, id: string, asExtra: boolean): boolean {
    const s = slots[i];
    const a = byId[id];
    if (!a || a.kind === "family" || a.familyOf || isHidden(e.rules, id)) return false;
    if (!asExtra && (a.kind !== "option" || a.onlyWith)) return false;
    if (!asExtra && s.pair && id !== s.pair.a && id !== s.pair.b) return false;
    if (!itemAllowed(e, id, s.slot, s.plan, !!s.pair)) return false;
    if (a.availableDays && !a.availableDays.includes(s.weekday)) return false;
    // A transfer day's evening is at the base you've just arrived at.
    if (s.plan.kind === "transfer" && s.slot === "night" && !a.areas.includes(s.plan.base.area)) return false;
    // Landing day stays close: near the base or the airport.
    if (s.plan.arrival && !isRouteArea(e, s.area) && catalog.travelHours(homeRegion(e, s.area), a.region) > radius && !(landing && catalog.travelHours(landing, a.region) <= radius)) return false;
    if (asExtra && (isBigTrip(a) || isSpecialOption(e, id))) return false;
    return true;
  }

  /**
   * Can `id` sit in slot i next to `others` (the slot's other items)? One main
   * meal per slot; an extra stays within the preset's radius of the main item
   * (or of the base, when the main item is close to it too); and two of the
   * same kind in one slot only when at least half of those there picked it.
   */
  function sitsWith(i: number, id: string, others: string[], asExtra: boolean): boolean {
    const s = slots[i];
    const a = byId[id];
    const rest = others.filter((x) => x && x !== STAY_ID && byId[x]).map((x) => byId[x]);
    if (mealish(a) && rest.some(mealish)) return false;
    if (asExtra) {
      const m = rest[0];
      if (a.onlyWith) {
        if (!m || m.id !== a.onlyWith) return false;
      } else if (!isRouteArea(e, s.area)) {
        // Out on a day trip (or anything beyond the radius), extras are near it — not back at the base.
        const away = !!m && (isBigTrip(m) || catalog.travelHours(s.plan.base.region, m.region) > radius);
        const near = (m && catalog.travelHours(m.region, a.region) <= radius) || (!away && catalog.travelHours(s.plan.base.region, a.region) <= radius);
        if (!near) return false;
      }
    }
    const kind = a.categories[0];
    if (rest.some((x) => x.categories[0] === kind) && headsThere(id, s.day) < Math.ceil(0.5 * thereCount[s.day])) return false;
    return true;
  }

  /** Can this slot hold the item, under every rule the trip enforces? (`asExtra`: added alongside the main.) */
  function canHold(i: number, id: string, asExtra = false): boolean {
    const s = slots[i];
    if (id === STAY_ID) return !asExtra && !s.pair;
    if (!fitsStatic(i, id, asExtra)) return false;
    const a = byId[id];
    // A late night right before a very early day trip is never planned.
    if (s.slot === "night" && isLate(a) && earlyTripAfter(i)) return false;
    const others = asExtra ? [main[i] ?? "", ...extras[i].map((x) => x.id)] : extras[i].map((x) => x.id);
    if (!sitsWith(i, id, others, asExtra)) return false;
    // A new main must still suit the extras already there.
    if (!asExtra) return extras[i].every((x, k) => sitsWith(i, x.id, [id, ...extras[i].filter((_, j) => j !== k).map((y) => y.id)], true));
    return true;
  }

  /** A slot's hours; on landing and road days the drive comes out of the daytime. */
  const limitOf = (i: number) => {
    const s = slots[i];
    const limit = catalog.preset.structure.slots[s.slot].limitHours;
    if (s.slot !== "day") return limit;
    const leg = s.plan.arrival ? catalog.legs[catalog.preset.structure.arrival.leg] : s.plan.transfer ? catalog.legs[s.plan.transfer.leg] : undefined;
    return limit - (leg?.hours ?? 0);
  };
  const slotHours = (i: number) => {
    const ids = [main[i], ...extras[i].map((x) => x.id)].filter((x): x is string => !!x && x !== STAY_ID);
    if (!ids.length) return 0;
    const s = slots[i];
    // Out from the base, to each item in turn, and back (on a road day the drive is the day's travel).
    let travel = 0;
    if (!isRouteArea(e, s.area)) {
      const stops = [homeRegion(e, s.area), ...ids.map((id) => byId[id].region), homeRegion(e, s.area)];
      for (let k = 1; k < stops.length; k++) travel += catalog.travelHours(stops[k - 1], stops[k]);
    }
    return ids.reduce((h, id) => h + byId[id].hours, 0) + travel;
  };
  /** Would this extra fit the slot's time? (A big day trip's tied extras always ride along.) */
  const extraFitsTime = (i: number, id: string) => {
    const m = main[i];
    if (!m || m === STAY_ID || splitB[i] || extras[i].length >= MAX_EXTRAS) return false;
    if (byId[id].onlyWith) return true;
    if (byId[m]?.variants) return false;
    extras[i].push({ id, locked: false });
    const ok = slotHours(i) <= limitOf(i);
    extras[i].pop();
    return ok;
  };

  /** The soft costs of a slot's main item, including how it sits next to the day before (owned here, so never counted twice). */
  function localPen(i: number): number {
    const id = main[i];
    if (!id) return 0;
    const s = slots[i];
    const v = settings.variety;
    let pen = 0;
    if (id === STAY_ID) {
      // Rest fits after a big day trip and before a very early one.
      if (s.slot === "night") {
        const today = other(s, s.day, "day");
        if (today !== undefined && main[today] && byId[main[today]!]?.variants) pen -= 1.5 * P;
        if (earlyTripAfter(i)) pen -= 1 * P;
      }
      return pen;
    }
    const a = byId[id];
    const variantTrip = !!a.variants;
    const route = isRouteArea(e, s.area);
    if (!route) pen += Math.max(0, hoursFrom(e, a, s.area) - 0.75) * 0.8 * P;
    if (!variantTrip && slotHours(i) > limitOf(i)) pen += 3 * P;
    if (s.plan.kind === "transfer" && s.slot === "night" && hoursFrom(e, a, s.area) > 1) pen += 2 * P;
    if (s.day === plans.length - 2 && !s.plan.arrival && a.tags.includes("diving")) pen += 5 * P;
    if (s.slot === "night" && isLate(a)) {
      const next = other(s, s.day + 1, "day");
      const tomorrow = next !== undefined && main[next] ? byId[main[next]!] : null;
      if (tomorrow && (tomorrow.tags.includes("early") || tomorrow.tags.includes("big day trip"))) pen += 2 * P;
    }
    if (budgetRef) {
      const mid = (a.estCostUsd[0] + a.estCostUsd[1]) / 2;
      pen += settings.budgetFit * Math.max(0, (mid - budgetRef) / budgetRef) * 2 * P;
    }
    // Variety, against the day before (and the other slot today).
    const prev = other(s, s.day - 1, s.slot);
    const before = prev !== undefined && main[prev] && main[prev] !== STAY_ID ? byId[main[prev]!] : null;
    if (before) {
      if (before.region === a.region && a.region !== s.plan.base.region) pen += v * 2 * P;
      if (before.categories[0] === a.categories[0]) pen += v * 0.5 * P;
      if (s.slot === "day" && isBigTrip(a) && isBigTrip(before)) pen += v * 3 * P;
    }
    if (s.slot === "night") {
      const today = other(s, s.day, "day");
      const dayItem = today !== undefined && main[today] && main[today] !== STAY_ID ? byId[main[today]!] : null;
      if (dayItem && dayItem.categories[0] === a.categories[0]) pen += v * 0.5 * P;
    }
    return pen;
  }

  const credit = (i: number, id: string, by: number) => {
    for (const k of supporters.get(id) ?? []) if (presence[k][slots[i].day]) made[k] += by;
  };
  const placeMain = (i: number, id: string, opts: { locked?: boolean; forced?: boolean; variant?: string } = {}) => {
    main[i] = id;
    mainVariant[i] = id === STAY_ID ? undefined : (opts.variant ?? variantFor(i, id));
    if (opts.locked) lockedMain[i] = true;
    if (opts.forced || opts.locked) forced[i] = true;
    if (id !== STAY_ID) {
      used.set(id, i);
      credit(i, id, 1);
    }
  };
  const clearMain = (i: number) => {
    const id = main[i];
    if (!id) return;
    if (id !== STAY_ID) {
      used.delete(id);
      credit(i, id, -1);
    }
    main[i] = null;
    mainVariant[i] = undefined;
  };
  const addExtra = (i: number, id: string, locked = false) => {
    extras[i].push({ id, locked });
    used.set(id, i);
    credit(i, id, 1);
  };
  const removeExtra = (i: number, id: string) => {
    extras[i] = extras[i].filter((x) => x.id !== id);
    used.delete(id);
    credit(i, id, -1);
  };

  // ── Pre-placed: accepted splits, locks, then special dates by vote ──
  for (const [key, dec] of Object.entries(settings.splits)) {
    if (dec.status !== "accepted") continue;
    const i = slotAt.get(key);
    if (i === undefined || main[i] || used.has(dec.a) || used.has(dec.b) || !canHold(i, dec.a) || !canHold(i, dec.b)) {
      notes.push("A split the organizers accepted no longer fits these dates, so that slot is planned together.");
      continue;
    }
    // Kept in place (not a lock the organizers set: it says "split", not "locked").
    placeMain(i, dec.a, { forced: true });
    splitB[i] = dec.b;
    used.set(dec.b, i);
    credit(i, dec.b, 1);
  }
  const lateLocks: typeof settings.locks = [];
  for (const lock of settings.locks) {
    const i = slotAt.get(slotKey(lock.date, lock.slot));
    if (i === undefined) {
      notes.push(`${byId[lock.id]?.title ?? "A locked pick"} was locked on ${dayLabel(lock.date)}, outside these dates — unlocked.`);
      continue;
    }
    if (lock.role === "extra") {
      lateLocks.push(lock);
      continue;
    }
    if (main[i] || (lock.id !== STAY_ID && used.has(lock.id)) || !canHold(i, lock.id)) {
      notes.push(`${byId[lock.id]?.title ?? "A locked pick"} no longer fits ${dayLabel(lock.date)}'s ${catalog.preset.structure.slots[lock.slot].label.toLowerCase()} — unlocked.`);
      continue;
    }
    placeMain(i, lock.id, { locked: true, variant: lock.variant });
  }
  for (const s of slots) {
    if (!s.pair || main[s.i]) continue;
    const opts = [s.pair.a, s.pair.b].filter((id) => !used.has(id) && canHold(s.i, id));
    const top = opts.sort((x, y) => S(y, s.day) - S(x, s.day) || headsThere(y, s.day) - headsThere(x, s.day))[0];
    placeMain(s.i, top ?? STAY_ID, { forced: true });
  }

  // Candidates per slot: everything someone picked that this slot could ever hold.
  const candidates: string[][] = slots.map((s) => [...supporters.keys()].filter((id) => fitsStatic(s.i, id, false)).sort());
  const value = (i: number, id: string): number => {
    const s = slots[i];
    if (id === STAY_ID) {
      const k = slots.filter((x) => x.slot === s.slot && main[x.i] === STAY_ID).length + 1;
      return restValue(s.slot, k, s.day);
    }
    return S(id, s.day);
  };
  /** Value of putting `id` in empty slot `i` right now: support minus the soft costs it brings. */
  const gain = (i: number, id: string) => {
    main[i] = id;
    mainVariant[i] = variantFor(i, id);
    const pen = localPen(i) + nextPenDelta(i);
    main[i] = null;
    mainVariant[i] = undefined;
    return value(i, id) - pen;
  };
  /** Placing in slot i can change the next slots' own penalties (variety, evening-before): count that too. */
  function nextPenDelta(i: number): number {
    const s = slots[i];
    const affected = [other(s, s.day + 1, s.slot), s.slot === "day" ? other(s, s.day, "night") : undefined, s.slot === "day" ? other(s, s.day - 1, "night") : undefined];
    let d = 0;
    for (const j of affected) {
      if (j === undefined || !main[j]) continue;
      const after = localPen(j);
      const id = main[i];
      main[i] = null;
      const before = localPen(j);
      main[i] = id;
      d += after - before;
    }
    return d;
  }
  const open = (i: number) => !main[i];

  // ── The score, and how to measure a change ──────────────────────────
  const restTotal = (t: Slot) => {
    let k = 0;
    let s = 0;
    for (const x of slots) if (x.slot === t && main[x.i] === STAY_ID) s += restValue(t, ++k, x.day);
    return s;
  };
  const popOf = (i: number) => (main[i] && main[i] !== STAY_ID ? S(main[i]!, slots[i].day) : 0) + extras[i].reduce((a, x) => a + S(x.id, slots[i].day), 0);
  const penAround = (days: number[]) => {
    const set = new Set<number>();
    for (const d of days) for (let x = d - 1; x <= d + 1; x++) for (const t of SLOTS) {
      const j = slotAt.get(slotKey(addDays(chosen.start, x), t));
      if (j !== undefined) set.add(j);
    }
    let p = 0;
    for (const j of set) p += localPen(j);
    return p;
  };
  /** The plan's score: popularity of everything in it, rest where it's wanted, minus the soft costs. */
  const score = () => slots.reduce((a, s) => a + popOf(s.i) - localPen(s.i), 0) + restTotal("day") + restTotal("night");
  /** The part of the score a change to these slots can move. */
  const localScore = (idx: number[], rested: boolean) => {
    const types = rested ? [...new Set(idx.map((i) => slots[i].slot))] : [];
    return idx.reduce((a, i) => a + popOf(i), 0) + types.reduce((a, t) => a + restTotal(t), 0) - penAround(idx.map((i) => slots[i].day));
  };

  // Each traveller's feasible picks: ones that could fit a slot on a day they're there.
  const feasible = voters.map((v, k) => v.picks.filter((id) => slots.some((s) => presence[k][s.day] && (fitsStatic(s.i, id, false) || fitsStatic(s.i, id, true)))).length);
  const shareOf = (k: number, m = made[k]) => (feasible[k] ? Math.min(1, m / feasible[k]) : null);
  const counted = voters.map((v, k) => v.unit > 0 && feasible[k] > 0);
  const minShare = () => Math.min(1, ...voters.flatMap((_, k) => (counted[k] ? [shareOf(k)!] : [])));
  const fairTerm = (k: number, m: number) => (feasible[k] ? voters[k].weight * Math.log(0.1 + Math.min(1, m / feasible[k])) : 0);

  /**
   * Local improvement: replace or swap main items while the score (plus λ ×
   * the fairness pull) rises, never breaking a hard rule, moving a locked or
   * special item, or crossing `guard` (the minimum share and the score floor).
   */
  function improve(lam: number, guard: () => boolean) {
    const movable = slots.filter((s) => !forced[s.i]).map((s) => s.i);
    const tryMove = (apply: () => void, undo: () => void, idx: number[], rested: boolean) => {
      const before = { local: localScore(idx, rested), made: [...made] };
      apply();
      let delta = -Infinity;
      if (guard()) {
        let fair = 0;
        if (lam) made.forEach((m, k) => (m !== before.made[k] ? (fair += fairTerm(k, m) - fairTerm(k, before.made[k])) : 0));
        delta = localScore(idx, rested) - before.local + lam * FAIR_WEIGHT * fair;
      }
      undo();
      return delta;
    };
    for (let round = 0; round < IMPROVE_ROUNDS; round++) {
      let best: { delta: number; run: () => void } | null = null;
      const consider = (delta: number, run: () => void) => {
        if (delta > 1e-6 && (!best || delta > best.delta + 1e-9)) best = { delta, run };
      };
      // Replace a slot's main with something else (or rest) — not one whose extras were chosen around it.
      for (const i of movable) {
        if (extras[i].length) continue;
        const cur = main[i]!;
        const curVariant = mainVariant[i];
        for (const id of [...candidates[i], STAY_ID]) {
          if (id === cur || (id !== STAY_ID && used.has(id))) continue;
          clearMain(i);
          const ok = canHold(i, id);
          placeMain(i, cur, { variant: curVariant });
          if (!ok) continue;
          const swapIn = () => {
            clearMain(i);
            placeMain(i, id);
          };
          const back = () => {
            clearMain(i);
            placeMain(i, cur, { variant: curVariant });
          };
          consider(tryMove(swapIn, back, [i], cur === STAY_ID || id === STAY_ID), swapIn);
        }
      }
      // Swap two slots' mains (same kind of slot, neither carrying extras).
      for (let x = 0; x < movable.length; x++) {
        for (let y = x + 1; y < movable.length; y++) {
          const i = movable[x];
          const j = movable[y];
          if (slots[i].slot !== slots[j].slot || main[i] === main[j] || extras[i].length || extras[j].length) continue;
          const a = main[i]!;
          const b = main[j]!;
          const va = mainVariant[i];
          const vb = mainVariant[j];
          const swap = () => {
            clearMain(i);
            clearMain(j);
            placeMain(i, b);
            placeMain(j, a);
          };
          const back = () => {
            clearMain(i);
            clearMain(j);
            placeMain(i, a, { variant: va });
            placeMain(j, b, { variant: vb });
          };
          clearMain(i);
          clearMain(j);
          const ok = canHold(i, b) && canHold(j, a);
          placeMain(i, a, { variant: va });
          placeMain(j, b, { variant: vb });
          if (!ok) continue;
          consider(tryMove(swap, back, [i, j], a === STAY_ID || b === STAY_ID), swap);
        }
      }
      if (!best) break;
      (best as { run: () => void }).run();
    }
  }

  // ── 4. The most popular plan: fill, improve, popular extras ─────────
  for (;;) {
    let top: { i: number; id: string; val: number } | null = null;
    for (const s of slots) {
      if (!open(s.i)) continue;
      for (const id of [...candidates[s.i], STAY_ID]) {
        if (id !== STAY_ID && used.has(id)) continue;
        if (id !== STAY_ID && !canHold(s.i, id)) continue;
        const val = gain(s.i, id);
        if (!top || val > top.val + 1e-9) top = { i: s.i, id, val };
      }
    }
    if (!top) break;
    placeMain(top.i, top.id);
  }
  improve(0, () => true);

  // Splits are found before extras, so a strong second camp's pick isn't squeezed in alongside.
  const splitShare = Math.max(0.15, Math.min(0.75, settings.splitShare));
  const findSplits = (): (PlanSplit | null)[] => {
    const splitOf = (s: SlotDef): PlanSplit | null => {
      const a = main[s.i];
      if (!a || a === STAY_ID || s.moving || s.pair || s.special) return null;
      const there = (id: string) => (supporters.get(id) ?? []).filter((k) => presence[k][s.day]);
      const aBy = there(a);
      if (splitB[s.i]) {
        const bBy = there(splitB[s.i]!);
        return {
          a: { id: a, votes: aBy.length },
          b: { id: splitB[s.i]!, votes: bBy.length },
          both: aBy.filter((k) => bBy.includes(k)).length,
          status: "accepted",
          aBy: aBy.map((k) => voters[k].name),
          bBy: bBy.map((k) => voters[k].name),
        };
      }
      // Both camps strong — at least 3 people and the organizers' share of those there — and mostly different people.
      const need = Math.max(3, Math.ceil(splitShare * thereCount[s.day] - 1e-9));
      if (aBy.length < need) return null;
      let top: { id: string; by: number[] } | null = null;
      for (const id of candidates[s.i]) {
        if (id === a || used.has(id) || byId[id]?.variants || !fitsStatic(s.i, id, false)) continue;
        const by = there(id);
        if (by.length < need) continue;
        const both = by.filter((k) => aBy.includes(k)).length;
        if (both > Math.min(by.length, aBy.length) / 3) continue;
        if (!top || by.length > top.by.length || (by.length === top.by.length && id < top.id)) top = { id, by };
      }
      if (!top) return null;
      const dec = settings.splits[slotKey(s.date, s.slot)];
      const status = dec?.status === "rejected" && dec.a === a && dec.b === top.id ? "rejected" : "suggested";
      return {
        a: { id: a, votes: aBy.length },
        b: { id: top.id, votes: top.by.length },
        both: top.by.filter((k) => aBy.includes(k)).length,
        status,
        aBy: aBy.map((k) => voters[k].name),
        bBy: top.by.map((k) => voters[k].name),
      };
    };
    const found = slots.map((s) => splitOf(s));
    // Each option is suggested as a split once: where its camp is biggest (then the earliest day).
    const bestFor = new Map<string, number>();
    found.forEach((x, i) => {
      if (!x || x.status === "accepted") return;
      const at = bestFor.get(x.b.id);
      if (at === undefined || x.b.votes > found[at]!.b.votes) bestFor.set(x.b.id, i);
    });
    return found.map((x, i) => (x && (x.status === "accepted" || bestFor.get(x.b.id) === i) ? x : null));
  };
  const reserved = new Set(findSplits().flatMap((x) => (x && x.status === "suggested" ? [x.b.id] : [])));

  for (const lock of lateLocks) {
    const i = slotAt.get(slotKey(lock.date, lock.slot))!;
    if (used.has(lock.id) || !canHold(i, lock.id, true)) {
      notes.push(`${byId[lock.id]?.title ?? "A locked extra"} no longer fits ${dayLabel(lock.date)} — unlocked.`);
      continue;
    }
    addExtra(i, lock.id, true);
  }
  // Popular add-ons where there's time: picked by at least 30% of those there (and 2 people).
  for (;;) {
    let top: { i: number; id: string; val: number } | null = null;
    for (const s of slots) {
      for (const id of supporters.keys()) {
        if (used.has(id) || reserved.has(id)) continue;
        if (headsThere(id, s.day) < Math.max(2, Math.ceil(0.3 * thereCount[s.day]))) continue;
        if (!extraFitsTime(s.i, id) || !canHold(s.i, id, true)) continue;
        const val = S(id, s.day);
        if (!top || val > top.val + 1e-9 || (Math.abs(val - top.val) <= 1e-9 && (s.i < top.i || (s.i === top.i && id < top.id)))) top = { i: s.i, id, val };
      }
    }
    if (!top) break;
    addExtra(top.i, top.id);
  }

  // The yardstick: the most popular plan's score and shares (what Majority rules is).
  const popularScore = score();
  const popularShares = voters.flatMap((_, k) => (counted[k] ? [shareOf(k)!] : []));
  const popularMade = [...made];

  // ── 5. Fairness: lift the lowest shares, within the tolerance ───────
  const scoreFloor = popularScore - tolerance * Math.abs(popularScore);
  let note: string | null = null;
  if (strength > 0) {
    let current = popularScore;
    const stuck = new Set<number>();
    /** Why the person with the lowest share couldn't be lifted (for the compare view). */
    let blocked: "none" | "budget" | "others" | null = null;
    for (let round = 0; round < LIFT_ROUNDS; round++) {
      // Lowest share first; ties in voter order (by name).
      const lowest = voters
        .map((_, k) => k)
        .filter((k) => counted[k] && !stuck.has(k))
        .sort((x, y) => shareOf(x)! - shareOf(y)! || x - y);
      if (!lowest.length) break;
      const t = lowest[0];
      const target = shareOf(t)!;
      // Accept only moves that lift t and leave nobody below min(their share, t's new share): the leximin order rises.
      const fairEnough = (beforeMade: number[]) => {
        if (made[t] <= beforeMade[t]) return false;
        const lifted = shareOf(t)!;
        return voters.every((_, k) => k === t || !counted[k] || shareOf(k)! >= Math.min(shareOf(k, beforeMade[k])!, lifted) - 1e-9);
      };
      let pick: { loss: number; run: () => void; id: string } | null = null;
      let sawBudget = false;
      let sawOthers = false;
      let sawAny = false;
      const consider = (idx: number[], rested: boolean, apply: () => void, undo: () => void, id: string) => {
        sawAny = true;
        const beforeMade = [...made];
        const before = localScore(idx, rested);
        apply();
        const fair = fairEnough(beforeMade);
        const after = localScore(idx, rested);
        undo();
        if (!fair) sawOthers = true;
        else if (current + (after - before) < scoreFloor - 1e-9) sawBudget = true;
        else if (!pick || before - after < pick.loss - 1e-9) pick = { loss: before - after, run: apply, id };
      };
      for (const id of voters[t].picks) {
        if (used.has(id)) {
          // In the plan on a day they're away: move it to a day they're there (a swap of mains).
          const j = used.get(id)!;
          if (presence[t][slots[j].day] || main[j] !== id || forced[j] || extras[j].length) continue;
          for (const s of slots) {
            const i = s.i;
            if (i === j || !presence[t][s.day] || forced[i] || s.slot !== slots[j].slot || extras[i].length || !main[i]) continue;
            const a = main[i]!;
            const va = mainVariant[i];
            const vj = mainVariant[j];
            clearMain(i);
            clearMain(j);
            const ok = canHold(i, id) && canHold(j, a);
            placeMain(i, a, { variant: va });
            placeMain(j, id, { variant: vj });
            if (!ok) continue;
            consider(
              [i, j],
              a === STAY_ID,
              () => {
                clearMain(i);
                clearMain(j);
                placeMain(i, id);
                placeMain(j, a);
              },
              () => {
                clearMain(i);
                clearMain(j);
                placeMain(i, a, { variant: va });
                placeMain(j, id, { variant: vj });
              },
              id,
            );
          }
          continue;
        }
        for (const s of slots) {
          const i = s.i;
          if (!presence[t][s.day]) continue;
          // Added alongside, where there's time and it's close by (costs no popularity).
          if (extraFitsTime(i, id) && canHold(i, id, true)) consider([i], false, () => addExtra(i, id), () => removeExtra(i, id), id);
          // Or instead of the slot's main item.
          if (forced[i] || !main[i]) continue;
          const cur = main[i]!;
          const cv = mainVariant[i];
          clearMain(i);
          const ok = canHold(i, id);
          placeMain(i, cur, { variant: cv });
          if (!ok) continue;
          consider(
            [i],
            cur === STAY_ID,
            () => {
              clearMain(i);
              placeMain(i, id);
            },
            () => {
              clearMain(i);
              placeMain(i, cur, { variant: cv });
            },
            id,
          );
        }
      }
      if (pick) {
        const chosenMove = pick as { run: () => void; id: string };
        chosenMove.run();
        current = score();
        if (!floorFor.has(chosenMove.id)) floorFor.set(chosenMove.id, new Set());
        floorFor.get(chosenMove.id)!.add(voters[t].id);
        stuck.clear();
        continue;
      }
      // The lowest share can't go higher: remember why (for the person at the very bottom).
      if (blocked === null && target <= minShare() + 1e-9) blocked = !sawAny ? "none" : sawBudget ? "budget" : sawOthers ? "others" : "none";
      stuck.add(t);
    }
    const floorShare = minShare();
    improve(lambda, () => minShare() >= floorShare - 1e-9 && score() >= scoreFloor - 1e-9);
    if (minShare() <= Math.min(1, ...popularShares) + 1e-9) {
      note =
        blocked === "budget"
          ? `Lifting whoever gets the smallest share would cost more than the ${pctText(tolerance)} of popularity this mode may give up — allow more in Knobs to go further.`
          : blocked === "others"
            ? "Lifting whoever gets the smallest share would push someone else even lower, so the most popular plan is already the fairest."
            : "Whoever gets the smallest share has no other picks that fit the days they're there, so nothing can lift them.";
    }
  }

  // ── 6. Final splits (the plan may have changed) ─────────────────────
  const splits = findSplits();

  // ── Explanations ────────────────────────────────────────────────────
  const voterCount = voters.length;
  const reasonsFor = (s: SlotDef, id: string, role: "main" | "extra", locked: boolean): Reason[] => {
    const out: Reason[] = [];
    if (locked) out.push({ kind: "locked", text: "Locked by the organizers" });
    if (id === STAY_ID) {
      const wanted = voters.filter((_, k) => want[k][s.slot] > 0 && presence[k][s.day]).length;
      const today = other(s, s.day, "day");
      if (s.slot === "night" && today !== undefined && main[today] && byId[main[today]!]?.variants) out.push({ kind: "rest", text: "Rest after the big day trip" });
      else if (s.slot === "night" && earlyTripAfter(s.i)) out.push({ kind: "rest", text: "An early night before tomorrow's early start" });
      if (wanted) out.push({ kind: "rest", text: `${plural(wanted, "person wants", "people want")} some slower ${s.slot === "day" ? "days" : "evenings"}` });
      if (!wanted && !out.length) {
        out.push({
          kind: "free",
          text: isRouteArea(e, s.area) ? "Nobody picked a stop on the way — straight there" : "Nothing anyone picked fits here — free time",
        });
      }
      return out;
    }
    const a = byId[id];
    const h = heads(id);
    const there = headsThere(id, s.day);
    out.push({ kind: "votes", text: `${h} of ${voterCount} picked this${there < h ? ` · ${there} ${there === 1 ? "is" : "are"} there that day` : ""}` });
    if (s.pair && role === "main") {
      const rival = s.pair.a === id ? s.pair.b : s.pair.a;
      out.push({ kind: "special", text: `${s.special!.name}: ${plural(heads(id), "vote")} vs ${heads(rival)} for ${shortTitle(byId[rival])}` });
    }
    if (floorFor.has(id)) out.push({ kind: "fair", text: "Added to lift someone who'd otherwise get little of what they picked" });
    if (a.availableDays) out.push({ kind: "weekday", text: `${daysLabel(a.availableDays)} — fits ${WEEKDAYS[s.weekday]} ${s.date.slice(8).replace(/^0/, "")} ${monthShort(s.date)}` });
    const variant = role === "main" ? mainVariant[s.i] : undefined;
    if (variant && a.variants) {
      const v = a.variants.find((x) => x.id === variant);
      const chose = (supporters.get(id) ?? []).filter((k) => (voters[k].variants.get(id) ?? a.variants![0].id) === variant).length;
      if (v) out.push({ kind: "variant", text: `${v.title}: ${chose} of ${h} who picked it` });
    }
    if (!isRouteArea(e, s.area) && hoursFrom(e, a, s.area) >= 0.5) out.push({ kind: "travel", text: distanceLabel(e, a, s.area) });
    if (role === "extra") out.push({ kind: "extra", text: a.onlyWith ? "Rides along with the day trip" : "Fits alongside, close by and with time to spare" });
    return out;
  };
  const alternativesFor = (s: SlotDef) => {
    const cur = main[s.i];
    const list = candidates[s.i]
      .filter((id) => id !== cur && id !== splitB[s.i])
      .map((id) => ({ id, votes: heads(id), present: headsThere(id, s.day), elsewhere: used.has(id), score: S(id, s.day) }))
      .sort((x, y) => y.score - x.score || (x.id < y.id ? -1 : 1))
      .slice(0, 8)
      .map(({ id, votes, present, elsewhere }) => ({ id, votes, present, elsewhere }));
    if (cur !== STAY_ID && !s.pair) list.push({ id: STAY_ID, votes: voters.filter((_, k) => want[k][s.slot] > 0).length, present: voters.filter((_, k) => want[k][s.slot] > 0 && presence[k][s.day]).length, elsewhere: false });
    return list;
  };

  const planSlots: PlanSlot[] = slots.map((s) => {
    const alternatives = alternativesFor(s);
    // The best thing that isn't in the plan at all (something placed on another day isn't a runner-up).
    const runner = alternatives.find((x) => x.id !== STAY_ID && !x.elsewhere) ?? null;
    const items: PlanItem[] = [];
    const id = main[s.i]!;
    const mk = (itemId: string, role: "main" | "extra", locked: boolean, variant?: string): PlanItem => ({
      key: itemKey(s.date, s.slot, itemId),
      id: itemId,
      ...(variant ? { variant } : {}),
      role,
      locked,
      votes: itemId === STAY_ID ? 0 : heads(itemId),
      present: itemId === STAY_ID ? 0 : headsThere(itemId, s.day),
      score: itemId === STAY_ID ? Math.round(value(s.i, STAY_ID) * 100) / 100 : Math.round(S(itemId, s.day) * 100) / 100,
      reasons: reasonsFor(s, itemId, role, locked),
      runnerUp: role === "main" && runner ? { id: runner.id, votes: runner.votes } : null,
      pickedBy: itemId === STAY_ID ? [] : (supporters.get(itemId) ?? []).map((k) => voters[k].name),
      floorFor: [...(floorFor.get(itemId) ?? [])].map((vid) => voters.find((v) => v.id === vid)!.name),
    });
    const first = mk(id, "main", lockedMain[s.i], mainVariant[s.i]);
    // When the runner-up had more pickers, say why it still lost.
    if (runner && id !== STAY_ID && !lockedMain[s.i] && !s.pair && runner.votes > first.votes) {
      const rival = byId[runner.id];
      const text =
        runner.present < runner.votes && runner.present <= first.present
          ? `More of its fans are here that day than ${shortTitle(rival)}'s`
          : floorFor.has(id)
            ? `Chosen over ${shortTitle(rival)} to lift someone who'd otherwise get little`
            : S(id, s.day) >= S(runner.id, s.day)
              ? `Beat ${shortTitle(rival)} on equal voice: its fans had picked fewer things, so each pick counted for more`
              : `Fits the day better than ${shortTitle(rival)} (travel, timing or variety)`;
      first.reasons.push({ kind: "votes", text });
    }
    items.push(first);
    for (const x of extras[s.i]) items.push(mk(x.id, "extra", x.locked));
    return {
      key: slotKey(s.date, s.slot),
      day: s.day,
      date: s.date,
      slot: s.slot,
      area: s.area,
      special: s.special?.id ?? null,
      items,
      split: splits[s.i],
      alternatives,
    };
  });

  // ── The itinerary ───────────────────────────────────────────────────
  const itinerary = skeletonData(e, chosen.start, length);
  for (const ps of planSlots) {
    itinerary.days[ps.day][ps.slot] = ps.items.map((it): SlotItem => ({ key: it.key, id: it.id, ...(it.variant ? { variant: it.variant } : {}) }));
  }
  const final = normalize(e, itinerary, length);

  // ── Satisfaction ────────────────────────────────────────────────────
  const placedOn = new Map<string, number>();
  for (const ps of planSlots) {
    for (const it of ps.items) if (it.id !== STAY_ID) placedOn.set(it.id, ps.day);
    if (ps.split?.status === "accepted") placedOn.set(ps.split.b.id, ps.day);
  }
  const people: PersonResult[] = voters.map((v, k) => {
    const daysThere = plans.filter((_, d) => presence[k][d]).length;
    const mine = v.allPicks.filter((id) => placedOn.has(id) && presence[k][placedOn.get(id)!]);
    const missed: MissedPick[] = v.allPicks.filter((id) => !mine.includes(id)).map((id) => ({ id, reason: whyMissed(id, k) }));
    return {
      id: v.id,
      name: v.name,
      status: v.status,
      daysThere,
      picks: v.allPicks.length,
      feasible: feasible[k],
      made: mine,
      missed,
      satisfaction: feasible[k] ? Math.min(1, mine.length / feasible[k]) : null,
      floorAdded: [...floorFor.entries()].filter(([id, set]) => set.has(v.id) && placedOn.has(id)).length,
    };
  });

  function whyMissed(id: string, k: number): string {
    const a = byId[id];
    if (!a) return "It's no longer on the list";
    if (isHidden(e.rules, id)) return "The organizers took it off the list";
    const special = catalog.specialDates.find((sd) => Object.values(sd.pairs).some((p) => catalog.pairsById[p]?.a === id || catalog.pairsById[p]?.b === id));
    if (special) {
      const slot = slots.find((s) => s.special?.id === special.id);
      if (!slot) return `${special.name} isn't in the chosen dates`;
      const winner = main[slot.i];
      if (winner && winner !== STAY_ID && winner !== id) return `${special.short} went to ${shortTitle(byId[winner])}, ${plural(heads(winner), "vote")}`;
    }
    if (placedOn.has(id)) return "It's in the plan on a day you're away";
    const others = heads(id) - 1;
    const fits = slots.filter((s) => fitsStatic(s.i, id, false) || fitsStatic(s.i, id, true));
    if (!fits.length) {
      if (special) return `${special.short} is somewhere else on these dates`;
      const pools = new Set(slots.map((s) => s.area));
      if (!a.areas.some((ar) => pools.has(ar))) {
        const base = catalog.bases.find((b) => a.areas.includes(b.area));
        return base ? `This trip doesn't stay in ${base.name}` : "It doesn't fit the chosen dates";
      }
      if (a.availableDays) {
        const inPool = slots.filter((s) => a.areas.includes(s.area) && a.slots.includes(s.slot));
        const right = inPool.filter((s) => a.availableDays!.includes(s.weekday));
        const label = daysLabel(a.availableDays);
        const where = catalog.bases.find((b) => a.areas.includes(b.area))?.name;
        const when = catalog.preset.structure.slots[a.slots[0]].label.toLowerCase();
        if (!right.length) return `${label}, and the dates have no ${label.replace(/s only$/, "")} ${when}${where ? ` in ${where}` : ""}`;
      }
      if (a.onlyBaseDays) return "It needs a full day at its base, and there's none to spare";
      return "It doesn't fit the chosen dates";
    }
    if (!fits.some((s) => presence[k][s.day])) return "You're away on the days it could go";
    if (a.availableDays) {
      const day = fits.find((s) => presence[k][s.day])!;
      const winner = main[day.i];
      if (winner && winner !== STAY_ID) return `${daysLabel(a.availableDays)}, and ${WEEKDAYS[day.weekday]}'s ${catalog.preset.structure.slots[day.slot].label.toLowerCase()} went to ${shortTitle(byId[winner])} (${plural(heads(winner), "vote")})`;
    }
    if (others <= 0) return "Only you picked it";
    if (others <= 2) return `Only ${plural(others, "other")} picked it`;
    return `${heads(id)} picked it — the slots it fits went to more popular picks`;
  }

  // ── Fairness numbers ────────────────────────────────────────────────
  // The same people the fairness step weighs: everyone with a say (a draft at weight 0 has none) and a pick that could fit.
  const xs = people.flatMap((p, k) => (counted[k] && p.satisfaction !== null ? [p.satisfaction] : []));
  const finalScore = score();
  const fairness: FairnessStats = {
    min: xs.length ? Math.min(...xs) : 0,
    median: median(xs),
    mean: xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0,
    index: jain(xs),
    tolerance,
    majority: { min: popularShares.length ? Math.min(...popularShares) : 0, median: median(popularShares), index: jain(popularShares) },
    scoreKept: popularScore ? finalScore / popularScore : 1,
    lifted: voters.filter((_, k) => counted[k] && made[k] > popularMade[k]).length,
    note,
  };

  // ── Budget ──────────────────────────────────────────────────────────
  const total = computeBudget(e, final).total;
  const tierMax = voters.flatMap((v) => {
    const id = ballots.find((x) => x.id === v.id)?.data.preferences.budget;
    const t = id ? catalog.preset.preferences.budgets.find((x) => x.id === id) : undefined;
    return t ? [t.usd[1] ?? Number.POSITIVE_INFINITY] : [];
  });
  const over = tierMax.filter((m) => (total[0] + total[1]) / 2 > m).length;
  const budget = {
    perPerson: total,
    withBudget: tierMax.length,
    over,
    note: over ? `About $${Math.round((total[0] + total[1]) / 2)} each — over the budget ${over} of ${tierMax.length} people set` : null,
  };

  return {
    engine: 1,
    settings: { ...settings, mode, strength, lambda, effectiveTolerance: tolerance },
    dates: { chosen, runnersUp, length, lengthReason, lengths, pinned, withDates: withDates.length },
    itinerary: final,
    slots: planSlots,
    people,
    fairness,
    budget,
    notes,
    stats: {
      voters: voters.length,
      submitted: voters.filter((v) => v.status === "submitted").length,
      drafts: voters.filter((v) => v.status === "draft").length,
      picks: voters.reduce((s, v) => s + v.allPicks.length, 0),
    },
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthShort = (date: string) => MONTHS[Number(date.slice(5, 7)) - 1];

/** An empty plan on these dates (the shape the generator fills). */
function skeletonData(e: Engine, start: string, length: number): ItineraryData {
  return {
    version: DATA_VERSION,
    startDate: start,
    endDate: addDays(start, length - 1),
    flexibility: null,
    days: Array.from({ length }, (_, i) => ({ id: `d${i + 1}`, day: [], night: [] })),
    preferences: {},
  };
}
