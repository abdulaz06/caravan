import { addOns, addOnsById } from "./addons";
import { dayOptions, nightOptions, nyeOptions, stayIn, type StayIn } from "./options";
import { dayPairs, nightPairs, nyePairs } from "./pairs";
import { photos } from "./photos.generated";
import type { BaseId, Option, Pair } from "./types";

export * from "./types";
export { regions, regionList, travelHours, formatHours, bases, LEGS } from "./regions";
export type { Base, FixedLeg } from "./regions";
export { stayIn, dayPairs, nightPairs, nyePairs, addOns, addOnsById };
export type { StayIn };

export const allOptions: Option[] = [...dayOptions, ...nightOptions, ...nyeOptions];
export const optionsById: Record<string, Option> = Object.fromEntries(allOptions.map((o) => [o.id, o]));
export const allPairs: Pair[] = [...dayPairs, ...nightPairs, nyePairs.colombo, nyePairs.galle];
export const pairsById: Record<string, Pair> = Object.fromEntries(allPairs.map((p) => [p.id, p]));
export const BASE_IDS: BaseId[] = ["colombo", "galle"];

export const heroPhotos = photos["hero"] ?? [];

/** Trip window everyone can choose from. */
export const TRIP_WINDOW = { start: "2026-12-01", end: "2027-01-31" } as const;
export const NYE_DATE = "2026-12-31";
export const MAX_TRIP_DAYS = 14;
export const RECOMMENDED_DAYS = "4–5 days";

// Fail fast in dev if the content files drift out of sync.
for (const p of allPairs) {
  for (const id of [p.a, p.b]) {
    const o = optionsById[id];
    if (!o) throw new Error(`Pair ${p.id} references unknown option ${id}`);
    const expected = p.slot === "day" ? "day" : "night";
    if (o.slot !== expected) throw new Error(`Option ${id} has slot ${o.slot} but pair ${p.id} is ${p.slot}`);
    if (o.base !== p.base) throw new Error(`Option ${id} is in base ${o.base} but pair ${p.id} is ${p.base}`);
  }
}
for (const a of addOns) {
  if (!a.slots.length) throw new Error(`Add-on ${a.id} has no slots`);
}
