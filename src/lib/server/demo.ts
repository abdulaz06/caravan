import "server-only";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { defaultRules } from "@/engine/rules";
import { createEngine, type Engine } from "@/engine/structure";
import { DEFAULT_SETTINGS, generatePlan } from "@/engine/consensus";
import { normalize } from "@/engine/itinerary";
import { CREW, DEMOS, PEEKS, planFor, rngFrom, type Demo } from "@/lib/demo-crew";
import { loadPreset } from "@/presets/registry";
import { db, type RsvpRow } from "./db";

export { DEMOS, demoById, demoBySlug } from "@/lib/demo-crew";

/** Guests a demo can hold before new ones are turned away (until the nightly reset). */
export const MAX_DEMO_GUESTS = 250;

/**
 * Bump when the demo's seed changes shape (dates, plans, the published plan):
 * a demo built from an older seed is rebuilt on its next visit, not just at the nightly reset.
 */
export const DEMO_SEED = 6;
const seedOf = (rules: unknown) => (rules && typeof rules === "object" ? (rules as { demoSeed?: unknown }).demoSeed : undefined);

/** Deletes one demo trip (and its guests) and builds it again from scratch. */
export async function resetDemoTrip(demo: Demo): Promise<{ slug: string; people: number }> {
  const store = db();
  const old = await store.getTripBySlug(demo.slug);
  if (old) await store.deleteTrip(old.id);
  // Built without a seed version: a half-built demo is never taken as ready.
  const trip = await store.createTrip({ slug: demo.slug, name: demo.name, preset_id: demo.id, kind: "demo" });
  if (!trip) throw new Error(`Couldn't create the ${demo.id} demo`);

  const { preset, catalog } = loadPreset(demo.id);
  const engine = createEngine(catalog, defaultRules(preset));
  const ids = await seedDemoCrew(trip.id, demo, engine);
  const owner = { id: ids.get("Maya") ?? null, name: "Maya" };
  await store.addLog({ trip_id: trip.id, actor_id: owner.id, actor_name: owner.name, action: "Started the trip", target_id: null, target_name: null, details: { preset: demo.id } });
  await store.addLog({ trip_id: trip.id, actor_id: owner.id, actor_name: owner.name, action: "Made Theo an admin", target_id: ids.get("Theo") ?? null, target_name: "Theo", details: {} });
  await publishDemoPlan(trip.id, engine, ids, owner);
  // Ready: the seed version rides along in the rules blob (parseRules ignores it).
  await store.updateTrip(trip.id, { rules: { demoSeed: DEMO_SEED } });
  return { slug: trip.slug, people: ids.size };
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

/** Rebuilds every demo trip (the nightly cron). */
export async function resetDemoTrips() {
  const out = [];
  for (const d of DEMOS) out.push(await resetDemoTrip(d));
  return out;
}

/** Demo builds running in this server instance: a second visitor waits for the first build. */
const building = new Map<string, Promise<string>>();

/** A demo trip's slug, building it first if it isn't there yet (or was built from an older seed). */
export async function ensureDemoTrip(demo: Demo): Promise<string> {
  const running = building.get(demo.slug);
  if (running) return running;
  const row = await db().getTripBySlug(demo.slug);
  if (row && seedOf(row.rules) === DEMO_SEED) return row.slug;
  const build = resetDemoTrip(demo)
    .then((r) => r.slug)
    .finally(() => building.delete(demo.slug));
  building.set(demo.slug, build);
  return build;
}
