// The day-structure engine: turns a preset's bases (and the nights each one
// gets) into the shape of the trip, day by day.
//
//   Day 1            arrival at the first base (its pool for both slots)
//   …                ordinary days at that base
//   first day at     a transfer day: the road from the previous base, with
//   each next base   its own daytime pool (stops on the way) if the preset has one
//   …                ordinary days at that base (reorderable)
//   last day         check out & fly home — no slots
//
// How many nights each base gets depends on the Trip rules:
// - Free dates (the default): any length the rules allow. The nights are
//   shared out by each base's weight, every base gets at least its minimum,
//   and a trip too short for every base drops the last ones (the first base,
//   where you land, always stays). A 1-day trip lands and flies home the same day.
// - Fixed length: the organizers' nights per base; the shorter preview has one
//   night less at the last base.
//
// Sri Lanka, 6 days (Colombo 1 + Galle 4): arrival · transfer · Galle · Galle · Galle · departure.
// Sri Lanka, 3 days: too short for Galle — arrival · Colombo · departure.
// Georgia (Tbilisi only): arrival · Tbilisi days · departure.
import type { Area, Base, Catalog, Slot, Transfer } from "./catalog";
import { fixedLengthOf, type TripRules } from "./rules";

export type DayKind = "base" | "transfer" | "departure";

export type DayPlan = {
  index: number;
  kind: DayKind;
  /** Where you sleep tonight (the departure day: the base you leave from). */
  base: Base;
  /** The trip's very first day. */
  arrival: boolean;
  /** A 1-day trip: land and fly home the same day (the evening is the flight). */
  departs: boolean;
  /** The pool each slot draws from (null = no slot that day). */
  areas: Record<Slot, string | null>;
  /** On transfer days: the road from the previous base. */
  transfer: Transfer | null;
  /** "Land in Colombo", "Road trip to Galle", "Galle base", "Check out & fly home". */
  name: string;
  hasSlots: boolean;
  /** Whole days can be dragged among other reorderable days of the same base. */
  reorderable: boolean;
};

export type Engine = {
  catalog: Catalog;
  rules: TripRules;
  /** Day plans per trip length (memoised). */
  plans: Map<number, DayPlan[]>;
};

/** A trip engine: a compiled preset plus the rules in force for one trip. Cheap to create. */
export function createEngine(catalog: Catalog, rules: TripRules): Engine {
  return { catalog, rules, plans: new Map() };
}

const basesOf = (e: Engine) => e.catalog.bases;
const nightsAt = (e: Engine, b: Base) => e.rules.nights[b.id] ?? b.nights.default;

/** "Fixed trip length" is on: one length for everyone. */
export const isFixed = (e: Engine) => e.rules.fixedLength;

/** The fixed trip length in days (all nights + 1). Free-date trips: the preset's usual length. */
export const tripDays = (e: Engine) => fixedLengthOf({ nights: Object.fromEntries(basesOf(e).map((b) => [b.id, nightsAt(e, b)])) });
/** The shorter "preview" length: one night less at the last base (fixed length only). */
export const previewDays = (e: Engine) => tripDays(e) - 1;
export const previewAvailable = (e: Engine) =>
  isFixed(e) && e.rules.previewEnabled && e.catalog.preset.structure.preview && nightsAt(e, basesOf(e)[basesOf(e).length - 1]) >= 2;

/** The shortest and longest trip that can be saved. */
export function lengthBounds(e: Engine): { min: number; max: number } {
  if (!isFixed(e)) return { ...e.rules.length };
  const lens = allowedLengths(e);
  return { min: Math.min(...lens), max: Math.max(...lens) };
}

/** Lengths a plan may be saved/submitted at. */
export function allowedLengths(e: Engine): number[] {
  if (!isFixed(e)) {
    const { min, max } = e.rules.length;
    return Array.from({ length: max - min + 1 }, (_, i) => max - i);
  }
  return e.rules.requireFullTrip || !previewAvailable(e) ? [tripDays(e)] : [tripDays(e), previewDays(e)];
}
export const isPreviewLength = (e: Engine, n: number) => isFixed(e) && n === previewDays(e) && n !== tripDays(e);
/** The nearest length a plan can be saved at. */
export function clampLength(e: Engine, n: number): number {
  if (isFixed(e)) return allowedLengths(e).includes(n) ? n : tripDays(e);
  const { min, max } = e.rules.length;
  return Math.max(min, Math.min(max, Math.round(n) || min));
}

/** The length a new plan starts at: the fixed length, else the middle of the suggested range (or the preset's usual trip). */
export function defaultLength(e: Engine): number {
  if (isFixed(e)) return tripDays(e);
  const r = e.rules.recommended;
  return clampLength(e, r ? Math.floor((r.min + r.max) / 2) : tripDays(e));
}

const weightOf = (b: Base) => b.weight ?? b.nights.default;
const minNightsOf = (b: Base) => b.minNights ?? b.nights.min;

/**
 * Free dates: share `nights` across the bases. Each kept base gets its
 * minimum, then every further night goes to the base furthest below its
 * weighted share (ties: the earlier base). Bases are dropped from the end
 * until the minimums fit; the first base always stays.
 */
function freeSplit(bases: Base[], nights: number): number[] {
  let kept = bases.length;
  while (kept > 1 && bases.slice(0, kept).reduce((n, b) => n + minNightsOf(b), 0) > nights) kept--;
  const out = bases.map((b, i) => (i === 0 ? Math.min(minNightsOf(b), nights) : i < kept ? minNightsOf(b) : 0));
  const total = bases.slice(0, kept).reduce((n, b) => n + weightOf(b), 0);
  let left = nights - out.reduce((a, b) => a + b, 0);
  while (left > 0) {
    let best = 0;
    let deficit = -Infinity;
    for (let i = 0; i < kept; i++) {
      const d = (nights * weightOf(bases[i])) / total - out[i];
      if (d > deficit + 1e-9) {
        best = i;
        deficit = d;
      }
    }
    out[best]++;
    left--;
  }
  return out;
}

/**
 * Nights per base for a trip of `length` days. Fixed length: the rules'
 * split, with the last base absorbing any difference (the preview has one
 * night less there). Free dates: shared out by weight (bases that don't fit get 0).
 */
export function nightsFor(e: Engine, length: number): { base: Base; nights: number }[] {
  const bases = basesOf(e);
  let left = Math.max(0, length - 1);
  if (!isFixed(e)) return freeSplit(bases, left).map((nights, i) => ({ base: bases[i], nights }));
  return bases.map((base, i) => {
    const n = i === bases.length - 1 ? left : Math.min(nightsAt(e, base), left);
    left -= n;
    return { base, nights: n };
  });
}

/** Bases a trip of this length skips (free dates only: too short to fit them). */
export const droppedBases = (e: Engine, length: number): Base[] =>
  length < 1 ? [] : nightsFor(e, length).filter((s) => s.nights === 0 && (s.base !== basesOf(e)[0] || length > 1)).map((s) => s.base);

const list = (names: string[]) => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} or ${names.at(-1)}`);

/** "Too short for Galle; this trip stays in Colombo" — or null when every base fits. */
export function structureNote(e: Engine, length: number): string | null {
  const dropped = droppedBases(e, length);
  if (!dropped.length) return null;
  const kept = nightsFor(e, length).filter((s) => s.nights > 0 || s.base === basesOf(e)[0]).map((s) => s.base.name);
  return `Too short for ${list(dropped.map((b) => b.name))}; this trip stays in ${kept.join(" and ")}`;
}

export function totalNights(length: number) {
  return Math.max(0, length - 1);
}

/** The leg to the airport from where the trip ends. */
export function departureLegId(e: Engine, base: Base): string {
  return base.departureLeg ?? e.catalog.preset.structure.departure.leg;
}

/** The shape of a trip of `length` days. */
export function planDays(e: Engine, length: number): DayPlan[] {
  const hit = e.plans.get(length);
  if (hit) return hit;
  const { transfers } = e.catalog;
  const out: DayPlan[] = [];
  const split = nightsFor(e, length).filter((s) => s.nights > 0);
  split.forEach(({ base, nights }, b) => {
    for (let k = 0; k < nights; k++) {
      const index = out.length;
      const transfer = b > 0 && k === 0 ? (transfers.find((t) => t.from === split[b - 1].base.id && t.to === base.id) ?? null) : null;
      const arrival = index === 0;
      if (transfer) {
        out.push({
          index,
          kind: "transfer",
          base,
          arrival,
          departs: false,
          areas: { day: transfer.dayArea ?? base.area, night: base.area },
          transfer,
          name: transfer.name,
          hasSlots: true,
          reorderable: false,
        });
      } else {
        out.push({
          index,
          kind: "base",
          base,
          arrival,
          departs: false,
          areas: { day: base.area, night: base.area },
          transfer: null,
          name: arrival ? (base.arrivalName ?? base.dayName) : base.dayName,
          hasSlots: true,
          reorderable: !arrival && base.reorderable,
        });
      }
    }
  });
  if (length > 1) {
    const last = split.at(-1)?.base ?? basesOf(e)[0];
    out.push({
      index: out.length,
      kind: "departure",
      base: last,
      arrival: false,
      departs: true,
      areas: { day: null, night: null },
      transfer: null,
      name: e.catalog.preset.structure.departure.name,
      hasSlots: false,
      reorderable: false,
    });
  }
  // A 1-day trip: land, a daytime, and fly home that evening.
  if (length === 1) {
    const base = basesOf(e)[0];
    out.push({
      index: 0,
      kind: "base",
      base,
      arrival: true,
      departs: true,
      areas: { day: base.area, night: null },
      transfer: null,
      name: `${base.arrivalName ?? base.dayName} · fly home tonight`,
      hasSlots: true,
      reorderable: false,
    });
  }
  e.plans.set(length, out);
  return out;
}

export const dayPlan = (e: Engine, index: number, length: number): DayPlan | undefined => planDays(e, length)[index];

export const areaOf = (e: Engine, id: string | null): Area | null => (id ? (e.catalog.areas[id] ?? null) : null);

/** Is this pool a transfer day's "on the way" daytime (stops along a route)? */
export const isRouteArea = (e: Engine, area: string | null) => !!area && e.catalog.transfers.some((t) => t.dayArea === area);

const w = (n: number) => `${n} ${n === 1 ? "night" : "nights"}`;

/** "Colombo · 1 night → Galle · 4 nights" ("Colombo · day trip" for a 1-day trip). */
export function nightsLine(e: Engine, length: number): string {
  if (length === 1) return `${basesOf(e)[0].name} · day trip`;
  return nightsFor(e, length)
    .filter((s) => s.nights > 0)
    .map((s) => `${s.base.name} · ${w(s.nights)}`)
    .join(" → ");
}

/** "6 days · 5 nights" ("1 day · no nights") */
export const daysNightsLabel = (n: number) =>
  `${n} ${n === 1 ? "day" : "days"} · ${n - 1 === 0 ? "no nights" : `${n - 1} ${n - 1 === 1 ? "night" : "nights"}`}`;

/** "1–14 days" */
export const lengthRangeLabel = (r: { min: number; max: number }) => (r.min === r.max ? `${r.min} ${r.min === 1 ? "day" : "days"}` : `${r.min}–${r.max} days`);
