import { chillNight, dayOptions, nightOptions, nyeOptions } from "./options";
import { dayPairs, nightPairs, nyePair } from "./pairs";
import { photos } from "./photos.generated";
import type { Option, Pair } from "./types";

export * from "./types";
export { regions, regionList, travelHours, trainNote, formatHours } from "./regions";
export { chillNight, dayPairs, nightPairs, nyePair };

export const allOptions: Option[] = [...dayOptions, ...nightOptions, ...nyeOptions];
export const optionsById: Record<string, Option> = Object.fromEntries(
  allOptions.map((o) => [o.id, o]),
);
export const allPairs: Pair[] = [...dayPairs, ...nightPairs, nyePair];
export const pairsById: Record<string, Pair> = Object.fromEntries(allPairs.map((p) => [p.id, p]));

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
  }
}
