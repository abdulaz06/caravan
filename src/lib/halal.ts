// Halal mode: a view-only transformation of someone's own plan. Every
// nightlife item is swapped for its curated wholesome stand-in (same slot,
// same area). Never saved, never sent anywhere — it only feeds the review
// view and share images while the switch is on.
import { activitiesById } from "@/content";
import type { ItineraryData } from "./itinerary";

export function halalView(data: ItineraryData): ItineraryData {
  const out = structuredClone(data);
  for (const d of out.days) {
    for (const slot of ["day", "night"] as const) {
      d[slot] = d[slot].map((x) => {
        const swap = activitiesById[x.id]?.halalSwap;
        return swap ? { key: x.key, id: swap } : x;
      });
    }
  }
  return out;
}

/** How many items Halal mode swaps (for the banner). */
export function halalSwapCount(data: ItineraryData): number {
  return data.days.reduce((n, d) => n + [...d.day, ...d.night].filter((x) => activitiesById[x.id]?.halalSwap).length, 0);
}

/** Meter titles when the scale reads Halal ↔ Haram. */
export function halalBalanceLabel(score: number | null): { title: string; line: string } {
  if (score === null) return { title: "Blank canvas", line: "Pick a few things first." };
  if (score <= -1.2) return { title: "Certified halal", line: "Sunrises, rainforests and early nights." };
  if (score <= -0.4) return { title: "Very halal", line: "Sea breeze, good food, home by eleven." };
  if (score < 0.4) return { title: "Halal", line: "Wholesome days, lovely evenings." };
  if (score < 1.2) return { title: "Halal-ish", line: "A little mischief. Your mum would approve." };
  return { title: "Haram", line: "Your mum would like a word." };
}
