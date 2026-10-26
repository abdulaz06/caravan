// What a 👀 peek returns: the person's plan as a read-only itinerary — picks
// and dates only (see privacy.peekPlan). Never day notes or private answers.
import type { ItineraryData } from "./itinerary";

export type PeekResponse = {
  name: string;
  role: "owner" | "admin" | "member";
  /** "new" = hasn't started a plan yet. */
  status: "new" | "draft" | "submitted";
  data: ItineraryData | null;
};
