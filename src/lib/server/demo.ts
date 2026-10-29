import "server-only";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { defaultRules } from "@/engine/rules";
import { createEngine, type Engine } from "@/engine/structure";
import { DEFAULT_SETTINGS, generatePlan } from "@/engine/consensus";
import { normalize } from "@/engine/itinerary";
import { CREW, DEMOS, PEEKS, planFor, rngFrom, type Demo } from "@/lib/demo-crew";
import { loadPreset } from "@/presets/registry";
import { db, type RsvpRow, type TripRow } from "./db";

export { DEMOS, demoById, demoBySlug } from "@/lib/demo-crew";

/** Guests a demo can hold before new ones are turned away (until the nightly reset). */
export const MAX_DEMO_GUESTS = 250;

/**
 * Bump when the demo's seed changes shape (dates, plans, the published plan):
 * a demo built from an older seed is rebuilt — in the background, while the
 * old one keeps serving — after the next production build
 * (scripts/warm-demos.ts), on its next visit and at the nightly reset.
 */
export const DEMO_SEED = 7;
const seedOf = (rules: unknown) => (rules && typeof rules === "object" ? (rules as { demoSeed?: unknown }).demoSeed : undefined);
/** Built from this seed or a newer one (while a deploy rolls out, older code leaves a newer demo alone). */
export const isCurrentDemo = (rules: unknown) => {
  const seed = seedOf(rules);
  return typeof seed === "number" && seed >= DEMO_SEED;
};
/** A rebuild some server instance started recently (the marker rides in the rules blob, like the seed). */
const REBUILD_GRACE_MS = 10 * 60_000;
const rebuildingSince = (rules: unknown) => {
  const at = rules && typeof rules === "object" ? (rules as { demoRebuildingAt?: unknown }).demoRebuildingAt : undefined;
  return typeof at === "string" ? Date.parse(at) : Number.NaN;
};
const tempSlug = (demo: Demo, kind: "next" | "old") => `${demo.slug}-${kind}-${randomBytes(4).toString("hex")}`;

/**
 * Builds one demo trip from scratch under a temporary slug, then swaps it in
 * for the old one (whose guests go with it). Visitors keep seeing the old demo
 * until the moment the new one takes its place — never a half-built one.
 */
export async function resetDemoTrip(demo: Demo): Promise<{ slug: string; people: number }> {
  const store = db();
  const trip = await store.createTrip({ slug: tempSlug(demo, "next"), name: demo.name, preset_id: demo.id, kind: "demo" });
  if (!trip) throw new Error(`Couldn't create the ${demo.id} demo`);
  try {
    const { preset, catalog } = loadPreset(demo.id);
    const engine = createEngine(catalog, defaultRules(preset));
    const ids = await seedDemoCrew(trip.id, demo, engine);
    const owner = { id: ids.get("Maya") ?? null, name: "Maya" };
    await store.addLog({ trip_id: trip.id, actor_id: owner.id, actor_name: owner.name, action: "Started the trip", target_id: null, target_name: null, details: { preset: demo.id } });
    await store.addLog({ trip_id: trip.id, actor_id: owner.id, actor_name: owner.name, action: "Made Theo an admin", target_id: ids.get("Theo") ?? null, target_name: "Theo", details: {} });
    await publishDemoPlan(trip.id, engine, ids, owner);
    // Ready: the seed version rides along in the rules blob (parseRules ignores it).
    await store.updateTrip(trip.id, { rules: { demoSeed: DEMO_SEED } });
    // The swap: the old demo steps aside, the new one takes its slug, then the old one goes.
    const old = await store.getTripBySlug(demo.slug);
    if (old) await store.renameTrip(old.id, tempSlug(demo, "old"));
    if (!(await store.renameTrip(trip.id, demo.slug))) throw new Error(`Another ${demo.id} demo build finished first`);
    if (old) await store.deleteTrip(old.id);
    return { slug: demo.slug, people: ids.size };
  } catch (err) {
    await store.deleteTrip(trip.id).catch(() => undefined);
    throw err;
  }
}

/**
 * The organizers have already published a group plan ("Everyone gets a say"),
 * and most of the crew have answered "I'm in" or "I'll skip" — so visitors see
 * the traveller side too. Their own picks are nearly always a yes.
 */
export async function publishDemoPlan(tripId: string, e: Engine, ids: Map<string, string>, owner: { id: string | null; name: string }) {
  const store = db();
  const [people, rows] = await Promise.all([store.listParticipants(tripId), store.listItineraries(tripId)]);
  const byId = new Map(rows.map((r) => [r.participant_id, r]));
  const ballots = people.flatMap((p) => {
    const row = byId.get(p.id);
    return row && !p.guest ? [{ id: p.id, name: p.display_name, status: row.status, data: normalize(e, row.data) }] : [];
  });
  const settings = { ...DEFAULT_SETTINGS, mode: "together" as const };
  const plan = generatePlan(e, ballots, settings);
  const at = new Date(Date.now() - 6 * 3600_000).toISOString();
  await store.savePlanVersion({ trip_id: tripId, data: plan, settings, created_by: owner.id, created_by_name: owner.name, published_at: at });
  await store.addLog({ trip_id: tripId, actor_id: owner.id, actor_name: owner.name, action: "publish_plan", target_id: null, target_name: null, details: { version: 1, mode: "together" } });

  const rng = rngFrom(4242);
  const answers: Omit<RsvpRow, "updated_at">[] = [];
  for (const [k, p] of CREW.entries()) {
    const id = ids.get(p.name);
    const me = plan.people.find((x) => x.id === id);
    if (!id || (k % 6 === 5 && p.stage !== "submitted")) continue; // a couple haven't looked yet
    const dates = ballots.find((b) => b.id === id)?.data;
    for (const slot of plan.slots) {
      // Only for the days they're there.
      if (dates?.startDate && (slot.date < dates.startDate || slot.date > dates.endDate!)) continue;
      for (const item of slot.items) {
        if (item.id === "stay" || rng() < 0.15) continue;
        const mine = me?.made.includes(item.id);
        const status = mine || rng() < 0.7 ? "in" : "skip";
        answers.push({ trip_id: tripId, item_key: item.key, participant_id: id, status, choice: null });
      }
    }
  }
  await store.addRsvps(answers);
}

/**
 * Adds the twelve fictional travellers to a trip: their plans (on the demo's
 * start dates), roles and peeks. Anyone already in the trip under one of their
 * names (say, the owner who started it) is kept as they are. Name → participant id.
 */
export async function seedDemoCrew(tripId: string, demo: Demo, e: Engine): Promise<Map<string, string>> {
  const store = db();
  // Nobody can sign in as a demo traveller: every PIN is a random, unguessable hash.
  const pinHash = await bcrypt.hash(randomBytes(16).toString("hex"), 8);
  const ids = new Map<string, string>();
  const kept = new Set<string>();
  const day = 86400_000;
  const now = Date.now();

  const existing = await store.listParticipants(tripId);
  for (const p of CREW) {
    const there = existing.find((x) => x.display_name.toLowerCase() === p.name.toLowerCase());
    if (there) {
      ids.set(p.name, there.id);
      kept.add(p.name);
      continue;
    }
    const row = await store.createParticipant(tripId, { name: p.name, pinHash, role: p.role ?? "member" });
    if (row) ids.set(p.name, row.id);
  }
  for (const [i, p] of CREW.entries()) {
    const id = ids.get(p.name);
    if (!id || kept.has(p.name) || p.stage === "new") continue;
    const data = planFor(e, p, demo.dates[p.name], demo.prefs[p.name] ?? {}, i + 11);
    data.preferences.roommates = (p.roommates ?? []).map((name) => (ids.has(name) ? { id: ids.get(name), name } : { name }));
    const updated = new Date(now - (CREW.length - i) * 0.4 * day).toISOString();
    await store.saveItinerary({ participant_id: id, data, status: p.stage, submitted_at: p.stage === "submitted" ? updated : null, updated_at: updated });
  }
  for (const [peeker, targets] of PEEKS) {
    for (const target of targets) {
      const a = ids.get(peeker);
      const b = ids.get(target);
      if (a && b) await store.recordPeek(a, b);
    }
  }
  return ids;
}

/** Builds that never finished (a crash mid-build, a lost swap), once they're a few minutes old. */
async function sweepLeftovers(demo: Demo) {
  const store = db();
  const cutoff = Date.now() - REBUILD_GRACE_MS;
  for (const t of await store.listTripsBySlugPrefix(`${demo.slug}-`)) {
    if (t.kind === "demo" && /-(next|old)-[0-9a-f]{8}$/.test(t.slug) && Date.parse(t.created_at) < cutoff) await store.deleteTrip(t.id);
  }
}

/** Rebuilds every demo trip (the nightly cron), and clears any leftover builds. */
export async function resetDemoTrips() {
  const out = [];
  for (const d of DEMOS) {
    out.push(await resetDemoTrip(d));
    await sweepLeftovers(d);
  }
  return out;
}

/** Rebuilds only the demos that are missing or from an older seed (after a production build). */
export async function warmDemoTrips() {
  const out: { slug: string; rebuilt: boolean }[] = [];
  for (const d of DEMOS) {
    const row = await db().getTripBySlug(d.slug);
    if (row && isCurrentDemo(row.rules)) out.push({ slug: d.slug, rebuilt: false });
    else out.push({ slug: (await resetDemoTrip(d)).slug, rebuilt: true });
  }
  return out;
}

/** Demo builds running in this server instance: a second visitor shares the first build. */
const building = new Map<string, Promise<string>>();

function buildOnce(demo: Demo): Promise<string> {
  const running = building.get(demo.slug);
  if (running) return running;
  const build = resetDemoTrip(demo)
    .then((r) => r.slug)
    .finally(() => building.delete(demo.slug));
  building.set(demo.slug, build);
  return build;
}

/**
 * A demo trip's slug, right away. A demo from an older seed keeps serving
 * while a fresh one is built in the background (`later` runs the build after
 * the response — Next's `after`); only a demo that doesn't exist at all
 * (before the first warm-up) is built while the visitor waits.
 */
export async function ensureDemoTrip(demo: Demo, later: (task: () => Promise<unknown>) => void = (task) => void task()): Promise<string> {
  const store = db();
  let row = await store.getTripBySlug(demo.slug);
  // The blink of a swap-in: the old demo has stepped aside and the new one is about to take its slug.
  if (!row) row = await new Promise<TripRow | null>((resolve) => setTimeout(() => resolve(store.getTripBySlug(demo.slug)), 400));
  if (!row) return buildOnce(demo);
  const recently = Date.now() - rebuildingSince(row.rules) < REBUILD_GRACE_MS;
  if (!isCurrentDemo(row.rules) && !building.has(demo.slug) && !recently) {
    await store.updateTrip(row.id, { rules: { ...(row.rules as object), demoRebuildingAt: new Date().toISOString() } });
    const build = buildOnce(demo);
    later(() => build.catch((err) => console.error(`Couldn't rebuild the ${demo.id} demo`, err)));
  }
  return row.slug;
}
