// What other people may see of a plan. Private answers (budget, dietary,
// free text, roommate picks) never leave the server for them.
import type { ItineraryData } from "./itinerary";

/** Browsing a submitted plan: picks, dates and day notes; of the answers only their interests. */
export function browsePlan(d: ItineraryData): ItineraryData {
  const interests = d.preferences.interests;
  return {
    version: d.version,
    startDate: d.startDate,
    endDate: d.endDate,
    flexibility: d.flexibility,
    days: d.days,
    preferences: interests?.length ? { interests } : {},
  };
}

/** A 👀 peek (drafts too): picks and dates only — no notes, no answers at all. */
export function peekPlan(d: ItineraryData): ItineraryData {
  return {
    version: d.version,
    startDate: d.startDate,
    endDate: d.endDate,
    flexibility: d.flexibility,
    days: d.days.map((x) => ({ id: x.id, day: x.day, night: x.night })),
    preferences: {},
  };
}
