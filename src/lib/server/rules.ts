import "server-only";
import { applyRules, lockedNow, parseRules, type TripRules } from "@/lib/rules";
import { db } from "./db";

export type LiveSettings = {
  rules: TripRules;
  /** Locked by hand in the console. */
  editsLocked: boolean;
  /** Locked by hand or by the scheduled auto-lock. */
  locked: boolean;
};

/**
 * Read the live Trip rules and put them in force for this request (the trip
 * structure helpers in lib/itinerary read them). Call it before anything that
 * normalises, validates or lays out an itinerary.
 */
export async function loadRules(): Promise<LiveSettings> {
  const s = await db().getSettings();
  const rules = parseRules(s.rules);
  applyRules(rules);
  return { rules, editsLocked: s.edits_locked, locked: lockedNow(s.edits_locked, rules) };
}
