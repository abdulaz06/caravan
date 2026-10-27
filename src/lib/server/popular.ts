import "server-only";
import { computePopular, type PopularPayload } from "@/engine/popular";
import { isTestName } from "@/lib/test-users";
import { isUsingLocalStore } from "./db";
import { loadPeople } from "./group";
import type { TripContext } from "./trip";

// 🔥 Popular picks, computed from every real participant's plan (drafts too;
// test users and hidden options left out) and cached for a few minutes.
// The organizers' on/off toggle is read fresh on every call.
const TTL_MS = isUsingLocalStore() ? 5_000 : 3 * 60_000;
const cache = new Map<string, { at: number; key: string; value: PopularPayload }>();

export async function getPopular(trip: TripContext): Promise<PopularPayload> {
  const { rules } = trip;
  if (!rules.popularBadges) return { on: false, counts: {}, threshold: 0, updatedAt: new Date().toISOString() };
  const key = rules.hidden.join(",");
  const hit = cache.get(trip.trip.id);
  if (hit && hit.key === key && Date.now() - hit.at < TTL_MS) return hit.value;
  try {
    const people = (await loadPeople(trip)).filter((p) => p.data && !isTestName(p.name) && !p.guest);
    const r = computePopular(trip.engine, people.map((p) => p.data!), rules.hidden);
    const value: PopularPayload = { on: true, counts: r.counts, threshold: r.threshold, updatedAt: new Date().toISOString() };
    cache.set(trip.trip.id, { at: Date.now(), key, value });
    return value;
  } catch {
    // Never let popularity break a page: no badges this time.
    return hit?.value ?? { on: true, counts: {}, threshold: 0, updatedAt: new Date().toISOString() };
  }
}
