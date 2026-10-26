// Halal mode: a view-only transformation of someone's own plan. Every
// nightlife item is swapped for its curated wholesome stand-in (same slot,
// same area), and anything whose words mention bars or drinks is shown as its
// Halal-mode copy. Never saved, never sent anywhere — it only feeds the review
// view, the budget panel and share images while the switch is on.
import { activitiesById, halalIdFor } from "@/content";
import type { ItineraryData } from "./itinerary";

export function halalView(data: ItineraryData): ItineraryData {
  const out = structuredClone(data);
  for (const d of out.days) {
    for (const slot of ["day", "night"] as const) {
      d[slot] = d[slot].map((x) => {
        const id = halalIdFor(x.id);
        if (id === x.id) return x;
        // A swapped stand-in is a different pick; a copy keeps the pick's own details (the Ella variant).
        return activitiesById[x.id]?.halalSwap ? { key: x.key, id } : { ...x, id };
      });
    }
  }
  return out;
}

/** How many items Halal mode swaps (for the banner). */
export function halalSwapCount(data: ItineraryData): number {
  return data.days.reduce((n, d) => n + [...d.day, ...d.night].filter((x) => activitiesById[x.id]?.halalSwap).length, 0);
}
