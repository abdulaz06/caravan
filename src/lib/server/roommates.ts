import "server-only";
import { isTestName } from "@/lib/test-users";
import { db } from "./db";

export type RoommateCandidate = { id: string; name: string };

/** People you can pick as a roommate: everyone who has started a plan, except you (and test users). */
export async function roommateCandidates(tripId: string, excludeId: string): Promise<RoommateCandidate[]> {
  const [people, plans] = await Promise.all([db().listParticipants(tripId), db().listItineraries(tripId)]);
  const started = new Set(plans.map((p) => p.participant_id));
  return people
    .filter((p) => p.id !== excludeId && started.has(p.id) && !isTestName(p.display_name) && !p.guest)
    .map((p) => ({ id: p.id, name: p.display_name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
