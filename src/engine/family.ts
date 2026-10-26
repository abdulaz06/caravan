// Family-friendly mode: a view-only transformation of someone's own plan.
// Every nightlife item is swapped for its curated stand-in (same slot, same
// area), and anything whose words mention drinks or nightlife is shown as its
// family copy. Never saved, never sent anywhere — it only feeds the review
// view, the budget panel and share images while the switch is on.
import type { ItineraryData } from "./itinerary";
import type { Engine } from "./structure";

export function familyView(e: Engine, data: ItineraryData): ItineraryData {
  const out = structuredClone(data);
  for (const d of out.days) {
    for (const slot of ["day", "night"] as const) {
      d[slot] = d[slot].map((x) => {
        const id = e.catalog.familyIdFor(x.id);
        if (id === x.id) return x;
        // A swapped stand-in is a different pick; a copy keeps the pick's own details (its variant).
        return e.catalog.byId[x.id]?.familySwap ? { key: x.key, id } : { ...x, id };
      });
    }
  }
  return out;
}

/** How many items family mode swaps (for the banner). */
export function familySwapCount(e: Engine, data: ItineraryData): number {
  return data.days.reduce((n, d) => n + [...d.day, ...d.night].filter((x) => e.catalog.byId[x.id]?.familySwap).length, 0);
}
