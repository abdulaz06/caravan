// The consensus generator: everyone's plans in, one suggested group trip out.
// Deterministic (no randomness, stable tie-breaks — the same inputs always
// give the same plan) and explainable (every placed item carries its reasons).
// Pure: it takes the trip's engine explicitly and touches nothing else.
//
//   1. Dates — the typical length, then the window the most people can make.
//   2. Votes — each traveller's picks share one equal voice (drafts count less).
//   3. Slots — the chosen dates' day structure; every slot only takes what the
//      trip's own rules allow there (pools, weekdays, special dates, day trips).
//   4. Fair floor (A) → fill by score (B) → local improvement (C), then extras,
//      split suggestions, reasons and per-person satisfaction.
//
// docs/CONSENSUS.md explains it in plain language with the formulas.
import { addDays, dayLabel, parseISO } from "@/lib/dates";
import { computeBudget } from "../budget";
import { STAY_ID, type Activity, type Pair, type Slot, type SpecialDate } from "../catalog";
import { variantOf } from "../day-trip";
import { DATA_VERSION, itemAllowed, isSpecialOption, normalize, type ItineraryData, type SlotItem } from "../itinerary";
import { isHidden } from "../rules";
import { clampLength, defaultLength, isFixed, isRouteArea, planDays, tripDays, type DayPlan, type Engine } from "../structure";
import { daysLabel, distanceLabel, hoursFrom } from "../timeline";
import { medianLength, pickWindows, scoreWindow, type Availability } from "./dates";
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
 * The fairness pull at λ = 1, in people: proportional fairness on each
 * traveller's share of their picks that could fit (Σ w·ln(0.1 + share)), so
 * a pick for the least-satisfied person counts for much more than one more
 * for someone who already has most of theirs.
 */
const FAIR_WEIGHT = 8;
/** "Everyone gets a say": the floor, then a gentle fairness pull. */
const TOGETHER_LAMBDA = 0.4;
const MAX_EXTRAS = 2;
const IMPROVE_ROUNDS = 80;

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

/** The decision mode's floor and fairness pull. */
export function modeParams(mode: DecisionMode, fairness: number, autoFloor: number, floor: number | null): { lambda: number; floorK: number } {
  if (mode === "majority") return { lambda: 0, floorK: 0 };
  if (mode === "together") return { lambda: TOGETHER_LAMBDA, floorK: Math.min(MAX_FLOOR, floor ?? autoFloor) };
  const t = Math.max(0, Math.min(1, fairness));
  return { lambda: t, floorK: Math.min(MAX_FLOOR, floor ?? (t === 0 ? 0 : Math.max(1, Math.round(autoFloor * 2 * t)))) };
}

/** The fair floor that adapts to the trip: about one and a half picks per person per "share" of the slots, 1–3. */
export const autoFloor = (slots: number, people: number) => (people ? Math.max(1, Math.min(3, Math.round((1.5 * slots) / people))) : 0);
/** The most picks the floor can promise anyone. */
const MAX_FLOOR = 5;

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

type Extra = { id: string; variant?: string; locked: boolean };

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const shortTitle = (a: Activity) => a.title.split(/[:·(]/)[0].trim();

export function generatePlan(e: Engine, ballots: Ballot[], input: Partial<PlanSettings> = {}): ConsensusPlan {
  const settings: PlanSettings = { ...DEFAULT_SETTINGS, ...input, locks: input.locks ?? [], splits: input.splits ?? {} };
  const mode: DecisionMode = settings.mode ?? "together";
  const { catalog } = e;
  const byId = catalog.byId;
  const notes: string[] = [];

  // ── Voters ──────────────────────────────────────────────────────────
  const sorted = [...ballots].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
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

  // ── 1. Dates ────────────────────────────────────────────────────────
  const withDates = voters.filter((v) => v.start && v.end);
  const submittedLengths = withDates.filter((v) => v.status === "submitted").map((v) => lengthOf(v));
  const allLengths = withDates.map((v) => lengthOf(v));
  let lengthReason: string;
  let length: number;
  if (isFixed(e)) {
    length = tripDays(e);
    lengthReason = "The trip's fixed length";
  } else if (settings.length) {
    length = clampLength(e, settings.length);
    lengthReason = "Chosen by the organizers";
  } else if (submittedLengths.length) {
    length = clampLength(e, medianLength(submittedLengths)!);
    lengthReason = `The middle length of ${plural(submittedLengths.length, "submitted plan")}`;
  } else if (allLengths.length) {
    length = clampLength(e, medianLength(allLengths)!);
    lengthReason = `The middle length of ${plural(allLengths.length, "plan")} so far`;
  } else {
    length = defaultLength(e);
    lengthReason = "The suggested length (nobody has dates yet)";
  }
  const avail: Availability[] = withDates.map((v) => ({ id: v.id, start: v.start!, end: v.end! }));
  const bounds = e.rules.window;
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
  /** Item id → the travellers the fair floor placed it for. */
  const floorFor = new Map<string, Set<string>>();

  const isLate = (a: Activity) => a.vibe >= 2 || catalog.isNightlife(a);
  const isBigTrip = (a: Activity) => a.tags.includes("big day trip") || !!a.variants;
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

  /** Can this slot hold the item, under every rule the trip enforces? (`asExtra`: added alongside the main.) */
  function canHold(i: number, id: string, asExtra = false): boolean {
    const s = slots[i];
    if (id === STAY_ID) return !asExtra && !s.pair;
    const a = byId[id];
    if (!a || a.kind === "family" || a.familyOf || isHidden(e.rules, id)) return false;
    if (!asExtra && (a.kind !== "option" || a.onlyWith)) return false;
    if (!asExtra && s.pair && id !== s.pair.a && id !== s.pair.b) return false;
    if (!itemAllowed(e, id, s.slot, s.plan, !!s.pair)) return false;
    if (a.availableDays && !a.availableDays.includes(s.weekday)) return false;
    if (asExtra) {
      if (a.variants) return false;
      if (a.onlyWith && main[i] !== a.onlyWith) return false;
      if (isSpecialOption(e, id)) return false;
    }
    // A late night right before a very early day trip is never planned.
    if (s.slot === "night" && isLate(a) && earlyTripAfter(i)) return false;
    return true;
  }

  const slotHours = (i: number) => {
    const ids = [main[i], ...extras[i].map((x) => x.id)].filter((x): x is string => !!x && x !== STAY_ID);
    if (!ids.length) return 0;
    const s = slots[i];
    const travel = isRouteArea(e, s.area) ? 0 : Math.max(...ids.map((id) => 2 * hoursFrom(e, byId[id], s.area)));
    return ids.reduce((h, id) => h + byId[id].hours, 0) + travel;
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
    if (!variantTrip && slotHours(i) > catalog.preset.structure.slots[s.slot].limitHours) pen += 3 * P;
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

  const placeMain = (i: number, id: string, opts: { locked?: boolean; forced?: boolean; variant?: string } = {}) => {
    main[i] = id;
    mainVariant[i] = id === STAY_ID ? undefined : (opts.variant ?? variantFor(i, id));
    if (opts.locked) lockedMain[i] = true;
    if (opts.forced || opts.locked) forced[i] = true;
    if (id !== STAY_ID) {
      used.set(id, i);
      for (const k of supporters.get(id) ?? []) if (presence[k][slots[i].day]) made[k]++;
    }
  };
  const clearMain = (i: number) => {
    const id = main[i];
    if (!id) return;
    if (id !== STAY_ID) {
      used.delete(id);
      for (const k of supporters.get(id) ?? []) if (presence[k][slots[i].day]) made[k]--;
    }
    main[i] = null;
    mainVariant[i] = undefined;
  };
  const addExtra = (i: number, id: string, locked = false) => {
    extras[i].push({ id, locked });
    used.set(id, i);
    for (const k of supporters.get(id) ?? []) if (presence[k][slots[i].day]) made[k]++;
  };

  // ── Pre-placed: accepted splits, locks, then special dates by vote ──
  for (const [key, dec] of Object.entries(settings.splits)) {
    if (dec.status !== "accepted") continue;
    const i = slotAt.get(key);
    if (i === undefined || main[i] || used.has(dec.a) || used.has(dec.b) || !canHold(i, dec.a) || !canHold(i, dec.b)) {
      notes.push("A split the organizers accepted no longer fits these dates, so that slot is planned together.");
      continue;
    }
    placeMain(i, dec.a, { locked: true });
    splitB[i] = dec.b;
    used.set(dec.b, i);
    for (const k of supporters.get(dec.b) ?? []) if (presence[k][slots[i].day]) made[k]++;
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
    const options = [s.pair.a, s.pair.b].filter((id) => !used.has(id) && canHold(s.i, id));
    const best = options.sort((x, y) => S(y, s.day) - S(x, s.day) || headsThere(y, s.day) - headsThere(x, s.day))[0];
    placeMain(s.i, best ?? STAY_ID, { forced: true });
  }

  // Candidates per slot: everything someone picked that this slot could ever hold.
  const candidates: string[][] = slots.map((s) => [...supporters.keys()].filter((id) => canHold(s.i, id)).sort());
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

  // ── Phase A: the fair floor ─────────────────────────────────────────
  const floorAuto = autoFloor(n, voices.length);
  const { lambda, floorK } = modeParams(mode, settings.fairness, floorAuto, settings.floor);
  const exhausted = new Set<number>();
  if (floorK > 0) {
    // The slots' best support, so a floor pick goes where it costs the group least.
    const bestThere = slots.map((s) => Math.max(0, ...candidates[s.i].map((id) => S(id, s.day))));
    for (let guard = 0; guard < voters.length * floorK + 5; guard++) {
      const need = voters
        .map((v, k) => ({ v, k }))
        .filter(({ v, k }) => v.unit > 0 && made[k] < floorK && !exhausted.has(k));
      if (!need.length) break;
      // Where each traveller still short of the floor could be helped: open slots per pick.
      const optionsOf = (k: number) => {
        const per = new Map<number, number>();
        for (const id of voters[k].picks) {
          if (used.has(id)) continue;
          for (const s of slots) if (open(s.i) && presence[k][s.day] && canHold(s.i, id)) per.set(s.i, (per.get(s.i) ?? 0) + 1);
        }
        return per;
      };
      const room = new Map(need.map(({ k }) => [k, optionsOf(k)]));
      const total = (k: number) => [...room.get(k)!.values()].reduce((a, b) => a + b, 0);
      // The least satisfied first; among equals, whoever has the fewest ways left to be helped.
      need.sort((x, y) => made[x.k] - made[y.k] || total(x.k) - total(y.k) || (x.v.id < y.v.id ? -1 : 1));
      const { k } = need[0];
      // How much the others still short of the floor depend on each slot: taking it costs them.
      const reliance = (i: number) => need.reduce((r, n) => (n.k === k || !total(n.k) ? r : r + (room.get(n.k)!.get(i) ?? 0) / total(n.k)), 0);
      let top: { i: number; id: string; val: number } | null = null;
      for (const id of voters[k].picks) {
        if (used.has(id)) continue;
        for (const s of slots) {
          if (!open(s.i) || !presence[k][s.day] || !canHold(s.i, id)) continue;
          const val = gain(s.i, id) - 0.5 * Math.max(0, bestThere[s.i] - S(id, s.day)) - 5 * P * reliance(s.i);
          if (!top || val > top.val + 1e-9) top = { i: s.i, id, val };
        }
      }
      if (!top) {
        exhausted.add(k);
        continue;
      }
      placeMain(top.i, top.id);
      if (!floorFor.has(top.id)) floorFor.set(top.id, new Set());
      floorFor.get(top.id)!.add(voters[k].id);
    }
  }
  const floorReached = made.map((m) => Math.min(m, floorK));

  // ── Phase B: fill the rest by score ─────────────────────────────────
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

  // ── Phase C: local improvement (popularity + λ·fairness − penalties) ──
  const capOf = voters.map((v, k) => Math.max(1, Math.min(v.allPicks.length, slots.filter((s) => presence[k][s.day]).length)));
  const fairTerm = (k: number, m: number) => voters[k].weight * Math.log(0.1 + Math.min(1, m / capOf[k]));
  const restTotal = (t: Slot) => {
    let k = 0;
    let s = 0;
    for (const x of slots) if (x.slot === t && main[x.i] === STAY_ID) s += restValue(t, ++k, x.day);
    return s;
  };
  const popOf = (i: number) => (main[i] && main[i] !== STAY_ID ? S(main[i]!, slots[i].day) : 0);
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
  const floorOk = () => made.every((m, k) => m >= floorReached[k]);
  /** Δ objective of a tentative change: apply, measure, undo. */
  function tryMove(apply: () => void, undo: () => void, slotIdx: number[], rested: boolean): number {
    const days = slotIdx.map((i) => slots[i].day);
    // Rest only changes when a stay-in moves.
    const types = rested ? [...new Set(slotIdx.map((i) => slots[i].slot))] : [];
    const before = { pop: slotIdx.reduce((a, i) => a + popOf(i), 0), rest: types.reduce((a, t) => a + restTotal(t), 0), pen: penAround(days), made: [...made] };
    apply();
    let delta = -Infinity;
    if (floorOk()) {
      const pop = slotIdx.reduce((a, i) => a + popOf(i), 0);
      const rest = types.reduce((a, t) => a + restTotal(t), 0);
      const pen = penAround(days);
      let fair = 0;
      made.forEach((m, k) => {
        if (m !== before.made[k]) fair += fairTerm(k, m) - fairTerm(k, before.made[k]);
      });
      delta = pop - before.pop + (rest - before.rest) - (pen - before.pen) + lambda * FAIR_WEIGHT * fair;
    }
    undo();
    return delta;
  }
  const movable = slots.filter((s) => !forced[s.i]).map((s) => s.i);
  for (let round = 0; round < IMPROVE_ROUNDS; round++) {
    let best: { delta: number; run: () => void } | null = null;
    const consider = (delta: number, run: () => void) => {
      if (delta > 1e-6 && (!best || delta > best.delta + 1e-9)) best = { delta, run };
    };
    // Replace a slot's main with something else (or rest).
    for (const i of movable) {
      const cur = main[i]!;
      const curVariant = mainVariant[i];
      for (const id of [...candidates[i], STAY_ID]) {
        if (id === cur || (id !== STAY_ID && used.has(id))) continue;
        clearMain(i);
        const ok = canHold(i, id);
        placeMain(i, cur, { variant: curVariant });
        if (!ok) continue;
        const d = tryMove(
          () => {
            clearMain(i);
            placeMain(i, id);
          },
          () => {
            clearMain(i);
            placeMain(i, cur, { variant: curVariant });
          },
          [i],
          cur === STAY_ID || id === STAY_ID,
        );
        consider(d, () => {
          clearMain(i);
          placeMain(i, id);
        });
      }
    }
    // Swap two slots' mains (same kind of slot).
    for (let x = 0; x < movable.length; x++) {
      for (let y = x + 1; y < movable.length; y++) {
        const i = movable[x];
        const j = movable[y];
        if (slots[i].slot !== slots[j].slot || main[i] === main[j]) continue;
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

  // ── Splits: strong, mostly separate camps for one slot ──────────────
  const splitOf = (s: SlotDef): PlanSplit | null => {
    const a = main[s.i];
    if (!a || a === STAY_ID || s.moving || s.pair || s.special) return null;
    const there = (id: string) => (supporters.get(id) ?? []).filter((k) => presence[k][s.day]);
    const aBy = there(a);
    const present = voters.filter((_, k) => presence[k][s.day]).length;
    if (aBy.length < 3) return null;
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
    let best: { id: string; by: number[] } | null = null;
    for (const id of candidates[s.i]) {
      if (id === a || used.has(id) || byId[id]?.variants || !canHold(s.i, id)) continue;
      const by = there(id);
      if (by.length < Math.max(3, Math.ceil(0.25 * present))) continue;
      const both = by.filter((k) => aBy.includes(k)).length;
      if (both > 0.34 * Math.min(by.length, aBy.length)) continue;
      if (!best || by.length > best.by.length || (by.length === best.by.length && id < best.id)) best = { id, by };
    }
    if (!best) return null;
    const dec = settings.splits[slotKey(s.date, s.slot)];
    const status = dec?.status === "rejected" && dec.a === a && dec.b === best.id ? "rejected" : "suggested";
    return {
      a: { id: a, votes: aBy.length },
      b: { id: best.id, votes: best.by.length },
      both: best.by.filter((k) => aBy.includes(k)).length,
      status,
      aBy: aBy.map((k) => voters[k].name),
      bBy: best.by.map((k) => voters[k].name),
    };
  };

  // Splits are found before extras, so a strong second camp's pick isn't squeezed in alongside.
  const splits = slots.map((s) => splitOf(s));
  const reserved = new Set(splits.flatMap((x) => (x && x.status === "suggested" ? [x.b.id] : [])));

  // ── Extras: popular add-ons where there's time ──────────────────────
  for (const lock of lateLocks) {
    const i = slotAt.get(slotKey(lock.date, lock.slot))!;
    if (used.has(lock.id) || !canHold(i, lock.id, true)) {
      notes.push(`${byId[lock.id]?.title ?? "A locked extra"} no longer fits ${dayLabel(lock.date)} — unlocked.`);
      continue;
    }
    addExtra(i, lock.id, true);
  }
  for (;;) {
    let top: { i: number; id: string; val: number } | null = null;
    for (const s of slots) {
      const m = main[s.i];
      if (!m || m === STAY_ID || extras[s.i].length >= MAX_EXTRAS || splitB[s.i]) continue;
      const there = voters.filter((_, k) => presence[k][s.day]).length;
      const limit = catalog.preset.structure.slots[s.slot].limitHours;
      for (const id of supporters.keys()) {
        if (used.has(id) || reserved.has(id) || !canHold(s.i, id, true)) continue;
        if (headsThere(id, s.day) < Math.max(2, Math.ceil(0.3 * there))) continue;
        const a = byId[id];
        // Extras tied to a big day trip ride along; anything else needs the time.
        if (!a.onlyWith) {
          if (byId[m]?.variants) continue;
          extras[s.i].push({ id, locked: false });
          const over = slotHours(s.i) > limit;
          extras[s.i].pop();
          if (over) continue;
        }
        const val = S(id, s.day);
        if (!top || val > top.val + 1e-9 || (Math.abs(val - top.val) <= 1e-9 && (s.i < top.i || (s.i === top.i && id < top.id)))) top = { i: s.i, id, val };
      }
    }
    if (!top) break;
    addExtra(top.i, top.id);
  }

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
    out.push({ kind: "votes", text: `${h} of ${voterCount} picked this${there < h ? ` · ${there} are there that day` : ""}` });
    if (s.pair && role === "main") {
      const rival = s.pair.a === id ? s.pair.b : s.pair.a;
      out.push({ kind: "special", text: `${s.special!.name}: ${plural(heads(id), "vote")} vs ${heads(rival)} for ${shortTitle(byId[rival])}` });
    }
    if (floorFor.has(id)) out.push({ kind: "fair", text: "Added so everyone gets some of their picks" });
    if (a.availableDays) out.push({ kind: "weekday", text: `${daysLabel(a.availableDays)} — fits ${WEEKDAYS[s.weekday]} ${s.date.slice(8).replace(/^0/, "")} ${monthShort(s.date)}` });
    const variant = role === "main" ? mainVariant[s.i] : undefined;
    if (variant && a.variants) {
      const v = a.variants.find((x) => x.id === variant);
      const chose = (supporters.get(id) ?? []).filter((k) => (voters[k].variants.get(id) ?? a.variants![0].id) === variant).length;
      if (v) out.push({ kind: "variant", text: `${v.title}: ${chose} of ${h} who picked it` });
    }
    if (!isRouteArea(e, s.area) && hoursFrom(e, a, s.area) >= 0.5) out.push({ kind: "travel", text: distanceLabel(e, a, s.area) });
    if (role === "extra") out.push({ kind: "extra", text: a.onlyWith ? "Rides along with the day trip" : "Fits alongside, with time to spare" });
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
    const runner = alternatives.find((x) => x.id !== STAY_ID) ?? null;
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
    items.push(mk(id, "main", lockedMain[s.i], mainVariant[s.i]));
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
    const room = slots.filter((s) => presence[k][s.day]).length;
    const missed: MissedPick[] = v.allPicks.filter((id) => !mine.includes(id)).map((id) => ({ id, reason: whyMissed(id, k) }));
    const possible = Math.min(v.allPicks.length, room);
    return {
      id: v.id,
      name: v.name,
      status: v.status,
      daysThere,
      picks: v.allPicks.length,
      made: mine,
      missed,
      satisfaction: possible ? Math.min(1, mine.length / possible) : null,
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
    const fits = slots.filter((s) => {
      const m = main[s.i];
      const keep = m;
      main[s.i] = null;
      const ok = canHold(s.i, id) || canHold(s.i, id, true);
      main[s.i] = keep;
      return ok;
    });
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
  const xs = people.filter((p) => p.satisfaction !== null).map((p) => p.satisfaction!);
  const sum = xs.reduce((a, b) => a + b, 0);
  const sq = xs.reduce((a, b) => a + b * b, 0);
  const couldFloor = people.filter((p, k) => p.picks > 0 && voters[k].unit > 0 && slots.some((s) => presence[k][s.day]));
  const fairness: FairnessStats = {
    min: xs.length ? Math.min(...xs) : 0,
    median: median(xs),
    mean: xs.length ? sum / xs.length : 0,
    index: sq > 0 ? (sum * sum) / (xs.length * sq) : 1,
    floor: floorK,
    floorMet: couldFloor.filter((p) => p.made.length >= floorK).length,
    floorOf: couldFloor.length,
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
    settings: { ...settings, mode, lambda, floorK },
    dates: { chosen, runnersUp, length, lengthReason, pinned, withDates: withDates.length },
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

  function lengthOf(v: Voter) {
    return Math.round((Date.parse(v.end!) - Date.parse(v.start!)) / 86_400_000) + 1;
  }
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
