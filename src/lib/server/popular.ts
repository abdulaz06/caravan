import "server-only";
import { computePopular, type PopularPayload } from "@/lib/popular";
import { isTestName } from "@/lib/test-users";
import { isUsingLocalStore } from "./db";
import { loadPeople } from "./group";
import { loadRules } from "./rules";

// 🔥 Popular picks, computed from every real participant's plan (drafts too;
// test users and hidden options left out) and cached for a few minutes.
// The organizers' on/off toggle is read fresh on every call.
const TTL_MS = isUsingLocalStore() ? 5_000 : 3 * 60_000;
let cache: { at: number; key: string; value: PopularPayload } | null = null;

export async function getPopular(): Promise<PopularPayload> {
  const { rules } = await loadRules();
  if (!rules.popularBadges) return { on: false, counts: {}, threshold: 0, updatedAt: new Date().toISOString() };
  const key = rules.hidden.join(",");
  if (cache && cache.key === key && Date.now() - cache.at < TTL_MS) return cache.value;
  try {
    const people = (await loadPeople()).filter((p) => p.data && !isTestName(p.name));
    const r = computePopular(
      people.map((p) => p.data!),
      rules.hidden,
    );
    const value: PopularPayload = { on: true, counts: r.counts, threshold: r.threshold, updatedAt: new Date().toISOString() };
    cache = { at: Date.now(), key, value };
    return value;
  } catch {
    // Never let popularity break a page: no badges this time.
    return cache?.value ?? { on: true, counts: {}, threshold: 0, updatedAt: new Date().toISOString() };
  }
}
