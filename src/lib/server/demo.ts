import "server-only";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { defaultRules } from "@/engine/rules";
import { createEngine, type Engine } from "@/engine/structure";
import { CREW, DEMOS, PEEKS, planFor, type Demo } from "@/lib/demo-crew";
import { loadPreset } from "@/presets/registry";
import { db } from "./db";

export { DEMOS, demoById, demoBySlug } from "@/lib/demo-crew";

/** Guests a demo can hold before new ones are turned away (until the nightly reset). */
export const MAX_DEMO_GUESTS = 250;

/**
 * Bump when the demo's seed changes shape (dates, plans, the published plan):
 * a demo built from an older seed is rebuilt on its next visit, not just at the nightly reset.
 */
export const DEMO_SEED = 2;
const seedOf = (rules: unknown) => (rules && typeof rules === "object" ? (rules as { demoSeed?: unknown }).demoSeed : undefined);

/** Deletes one demo trip (and its guests) and builds it again from scratch. */
export async function resetDemoTrip(demo: Demo): Promise<{ slug: string; people: number }> {
  const store = db();
  const old = await store.getTripBySlug(demo.slug);
  if (old) await store.deleteTrip(old.id);
  // The seed version rides along in the rules blob (parseRules ignores it).
  const trip = await store.createTrip({ slug: demo.slug, name: demo.name, preset_id: demo.id, kind: "demo", rules: { demoSeed: DEMO_SEED } });
  if (!trip) throw new Error(`Couldn't create the ${demo.id} demo`);

  const { preset, catalog } = loadPreset(demo.id);
  const ids = await seedDemoCrew(trip.id, demo, createEngine(catalog, defaultRules(preset)));
  const owner = { id: ids.get("Maya") ?? null, name: "Maya" };
  await store.addLog({ trip_id: trip.id, actor_id: owner.id, actor_name: owner.name, action: "Started the trip", target_id: null, target_name: null, details: { preset: demo.id } });
  await store.addLog({ trip_id: trip.id, actor_id: owner.id, actor_name: owner.name, action: "Made Theo an admin", target_id: ids.get("Theo") ?? null, target_name: "Theo", details: {} });
  return { slug: trip.slug, people: ids.size };
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

/** A demo trip's slug, building it first if it isn't there yet. */
export async function ensureDemoTrip(demo: Demo): Promise<string> {
  const row = await db().getTripBySlug(demo.slug);
  return row && seedOf(row.rules) === DEMO_SEED ? row.slug : (await resetDemoTrip(demo)).slug;
}
