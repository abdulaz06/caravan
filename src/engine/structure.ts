// The day-structure engine: turns a preset's bases (and the nights the rules
// give each) into the shape of the trip, day by day.
//
//   Day 1            arrival at the first base (its pool for both slots)
//   …                ordinary days at that base
//   first day at     a transfer day: the road from the previous base, with
//   each next base   its own daytime pool (stops on the way) if the preset has one
//   …                ordinary days at that base (reorderable)
//   last day         check out & fly home — no slots
//
// Sri Lanka (Colombo 1 + Galle 4): arrival · transfer · Galle · Galle · Galle · departure.
// Georgia (Tbilisi 8): arrival · seven Tbilisi days · departure.
import type { Area, Base, Catalog, Slot, Transfer } from "./catalog";
import type { TripRules } from "./rules";

export type DayKind = "base" | "transfer" | "departure";

export type DayPlan = {
  index: number;
  kind: DayKind;
  /** Where you sleep tonight (the departure day: the base you leave from). */
  base: Base;
  /** The trip's very first day. */
  arrival: boolean;
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

/** Full trip length in days (all nights + 1). */
export const tripDays = (e: Engine) => basesOf(e).reduce((n, b) => n + nightsAt(e, b), 0) + 1;
/** The shorter "preview" length: one night less at the last base. */
export const previewDays = (e: Engine) => tripDays(e) - 1;
export const previewAvailable = (e: Engine) =>
  e.rules.previewEnabled && e.catalog.preset.structure.preview && nightsAt(e, basesOf(e)[basesOf(e).length - 1]) >= 2;
/** Lengths a plan may be saved/submitted at. */
export const allowedLengths = (e: Engine) => (e.rules.requireFullTrip || !previewAvailable(e) ? [tripDays(e)] : [tripDays(e), previewDays(e)]);
export const isPreviewLength = (e: Engine, n: number) => n === previewDays(e) && n !== tripDays(e);

/**
 * Nights per base for a trip of `length` days: the rules' split, with the
 * last base absorbing any difference (the preview has one night less there).
 */
export function nightsFor(e: Engine, length: number): { base: Base; nights: number }[] {
  const bases = basesOf(e);
  let left = Math.max(0, length - 1);
  return bases.map((base, i) => {
    const n = i === bases.length - 1 ? left : Math.min(nightsAt(e, base), left);
    left -= n;
    return { base, nights: n };
  });
}

export function totalNights(length: number) {
  return Math.max(0, length - 1);
}

/** The shape of a trip of `length` days. */
export function planDays(e: Engine, length: number): DayPlan[] {
  const hit = e.plans.get(length);
  if (hit) return hit;
  const { transfers } = e.catalog;
  const out: DayPlan[] = [];
  const split = nightsFor(e, length);
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
    const last = split.filter((s) => s.nights > 0).at(-1)?.base ?? basesOf(e)[0];
    out.push({
      index: out.length,
      kind: "departure",
      base: last,
      arrival: false,
      areas: { day: null, night: null },
      transfer: null,
      name: e.catalog.preset.structure.departure.name,
      hasSlots: false,
      reorderable: false,
    });
  }
  // A 1-day "trip" is just an arrival with no nights.
  if (length === 1 && !out.length) {
    const base = basesOf(e)[0];
    out.push({ index: 0, kind: "base", base, arrival: true, areas: { day: base.area, night: base.area }, transfer: null, name: base.arrivalName ?? base.dayName, hasSlots: true, reorderable: false });
  }
  e.plans.set(length, out);
  return out;
}

export const dayPlan = (e: Engine, index: number, length: number): DayPlan | undefined => planDays(e, length)[index];

export const areaOf = (e: Engine, id: string | null): Area | null => (id ? (e.catalog.areas[id] ?? null) : null);

/** Is this pool a transfer day's "on the way" daytime (stops along a route)? */
export const isRouteArea = (e: Engine, area: string | null) => !!area && e.catalog.transfers.some((t) => t.dayArea === area);

const w = (n: number) => `${n} ${n === 1 ? "night" : "nights"}`;

/** "Colombo · 1 night → Galle · 4 nights" */
export function nightsLine(e: Engine, length: number): string {
  return nightsFor(e, length)
    .filter((s) => s.nights > 0)
    .map((s) => `${s.base.name} · ${w(s.nights)}`)
    .join(" → ");
}

/** "6 days · 5 nights" */
export const daysNightsLabel = (n: number) => `${n} ${n === 1 ? "day" : "days"} · ${n - 1} ${n - 1 === 1 ? "night" : "nights"}`;
