import { extras, halalAlternatives, isNightlife, options, stayIn, type StayIn } from "./options";
import { nyePairs, pairs, pairsFor } from "./pairs";
import { photos } from "./photos.generated";
import type { Activity, Category, Pair } from "./types";

export * from "./types";
export { regions, regionList, travelHours, formatHours, stays, COAST_ROAD, COAST_ROAD_KM, LEGS } from "./regions";
export type { Stay, FixedLeg } from "./regions";
export { stayIn, pairs, pairsFor, nyePairs, options, extras, isNightlife };
export type { StayIn };

/** Options + Quick extras — everything that can sit in a slot (besides Stay in). */
export const activities: Activity[] = [...options, ...extras];
/** Includes the Halal-mode stand-ins so swapped plans still resolve. */
export const activitiesById: Record<string, Activity> = Object.fromEntries([...activities, ...halalAlternatives].map((a) => [a.id, a]));
/** @deprecated name kept for older call sites — same as activitiesById. */
export const optionsById = activitiesById;

export const allPairs: Pair[] = [...pairs, nyePairs.colombo, nyePairs.galle];
export const pairsById: Record<string, Pair> = Object.fromEntries(allPairs.map((p) => [p.id, p]));

export const heroPhotos = photos["hero"] ?? [];

export const NYE_DATE = "2026-12-31";

/**
 * Full-moon Poya holidays around the trip (Central Bank of Sri Lanka bank-holiday
 * lists for 2026 and 2027). Bars and liquor shops close by law; temples — and
 * Adam's Peak — are packed.
 */
export const POYA_DAYS = [
  { date: "2026-11-24", name: "Il Poya" },
  { date: "2026-12-23", name: "Unduvap Poya" },
  { date: "2027-01-22", name: "Duruthu Poya" },
  { date: "2027-02-20", name: "Navam Poya" },
] as const;
export const poyaOn = (date: string | null) => (date ? (POYA_DAYS.find((p) => p.date === date) ?? null) : null);
/** The Adam's Peak pilgrimage season (lights on, tea stalls open) starts on Unduvap Poya. */
export const ADAMS_PEAK_SEASON_START = "2026-12-23";
// Trip length, nights split and the date window are live Trip rules — see lib/rules.ts.

export const CATEGORIES: { id: Category; label: string; emoji: string }[] = [
  { id: "adventure", label: "Adventure", emoji: "🥾" },
  { id: "water", label: "Beach & Water", emoji: "🌊" },
  { id: "nature", label: "Nature", emoji: "🌿" },
  { id: "culture", label: "Culture", emoji: "🛕" },
  { id: "food", label: "Food", emoji: "🍛" },
  { id: "party", label: "Party", emoji: "🪩" },
  { id: "chill", label: "Chill / Stay in", emoji: "🌴" },
];

// Fail fast in dev if the content files drift out of sync.
{
  const seen = new Set<string>();
  for (const a of activities) {
    if (seen.has(a.id) || a.id === "stay") throw new Error(`Duplicate activity id ${a.id}`);
    seen.add(a.id);
    if (!a.slots.length || !a.where.length || !a.categories.length) throw new Error(`Activity ${a.id} is missing slots/where/categories`);
    if (a.kind === "option" && a.slots.length !== 1) throw new Error(`Option ${a.id} must have exactly one slot`);
  }
  for (const p of allPairs) {
    for (const id of [p.a, p.b]) {
      const o = activitiesById[id];
      if (!o || o.kind !== "option") throw new Error(`Pair ${p.id} references unknown option ${id}`);
      const slot = p.slot === "day" ? "day" : "night";
      if (!o.slots.includes(slot)) throw new Error(`Option ${id} isn't a ${slot} option but pair ${p.id} is`);
      if (!o.where.includes(p.where)) throw new Error(`Option ${id} isn't valid in ${p.where} (pair ${p.id})`);
    }
  }
  // Every nightlife item needs a curated Halal-mode swap: same slot, overlapping area, not nightlife itself.
  for (const a of [...activities, ...halalAlternatives]) {
    if (seen.has(a.id) && a.kind === "halal") throw new Error(`Halal stand-in ${a.id} clashes with an activity id`);
    if (!isNightlife(a)) continue;
    if (a.kind === "halal") throw new Error(`Halal stand-in ${a.id} looks like nightlife`);
    const swap = a.halalSwap ? activitiesById[a.halalSwap] : undefined;
    if (!swap) throw new Error(`Nightlife item ${a.id} has no halalSwap`);
    if (isNightlife(swap)) throw new Error(`halalSwap for ${a.id} (${swap.id}) is nightlife too`);
    if (!a.slots.every((s) => swap.slots.includes(s))) throw new Error(`halalSwap for ${a.id} doesn't fit the same slot`);
    if (!a.where.some((w) => swap.where.includes(w))) throw new Error(`halalSwap for ${a.id} is in a different area`);
  }
  void pairsFor;
}
