// 🔥 Popular picks: how many people picked each option or Quick extra (each
// person once, drafts and submitted plans alike), and which ones count as
// popular — the top few per slot type, and only once enough people agree.
// Counts only: never who picked what. Pure; the server caches it.
import type { Activity } from "./catalog";
import type { ItineraryData } from "./itinerary";
import type { Engine } from "./structure";

/** Nobody's "popular" with one or two picks. */
export const POPULAR_MIN = 3;
/** …and at least this share of the people who've picked anything. */
export const POPULAR_SHARE = 0.2;
/** At most this many popular items per slot type (ties at the cut-off stay in). */
export const POPULAR_TOP = 5;

/** Activity id → number of people who picked it — popular ones only. */
export type PopularCounts = Record<string, number>;

/** What the server hands the app (GET /api/popular, page props). `on` = the organizers' toggle. */
export type PopularPayload = { on: boolean; counts: PopularCounts; threshold: number; updatedAt: string };

export type PopularResult = {
  counts: PopularCounts;
  /** The minimum count that made the cut (for copy and tests). */
  threshold: number;
  /** People who've picked at least one thing. */
  pickers: number;
};

const slotType = (a: Activity) => (a.slots.includes("day") ? "day" : "night");

/** `plans`: real participants' plans only (no test users); `hidden`: options the organizers took off the list. */
export function computePopular(e: Engine, plans: Pick<ItineraryData, "days">[], hidden: readonly string[] = []): PopularResult {
  const activitiesById = e.catalog.byId;
  const people = new Map<string, number>();
  let pickers = 0;
  for (const plan of plans) {
    const ids = new Set<string>();
    for (const d of plan.days) for (const x of [...d.day, ...d.night]) ids.add(x.id);
    for (const id of ids) {
      const a = activitiesById[id];
      if (!a || a.kind === "family" || a.familyOf || hidden.includes(id)) continue;
      people.set(id, (people.get(id) ?? 0) + 1);
    }
    if (ids.size) pickers++;
  }
  const threshold = Math.max(POPULAR_MIN, Math.ceil(pickers * POPULAR_SHARE));
  const counts: PopularCounts = {};
  for (const type of ["day", "night"] as const) {
    const ranked = [...people.entries()]
      .filter(([id, n]) => n >= threshold && slotType(activitiesById[id]) === type)
      .sort((a, b) => b[1] - a[1]);
    const cutoff = ranked[Math.min(POPULAR_TOP, ranked.length) - 1]?.[1] ?? Infinity;
    for (const [id, n] of ranked) if (n >= cutoff) counts[id] = n;
  }
  return { counts, threshold, pickers };
}
