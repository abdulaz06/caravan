import "server-only";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { emptyItinerary, makeItem, normalize, setStart, type ItineraryData, type Preferences } from "@/engine/itinerary";
import { defaultRules } from "@/engine/rules";
import { createEngine, tripDays, type Engine } from "@/engine/structure";
import { quickFill } from "@/engine/quickfill";
import { loadPreset } from "@/presets/registry";
import { db, type Role } from "./db";

/** The public demo trip (seeded on first visit, reset nightly), at /t/<DEMO_SLUG>. */
export const DEMO_SLUG = process.env.DEMO_TRIP_SLUG?.trim() || "demo-sri-lanka";
export const DEMO_PRESET = "sri-lanka";
export const DEMO_NAME = "Sri Lanka crew '26";
/** Guests a demo can hold before new ones are turned away (until the nightly reset). */
export const MAX_DEMO_GUESTS = 250;

/**
 * Twelve fictional travellers. `lean` nudges their matchup picks towards
 * nature (-) or nightlife (+); `stage` is how far they've got.
 */
type Persona = {
  name: string;
  role?: Role;
  start: string;
  lean: number;
  stage: "submitted" | "draft" | "new";
  prefs: Preferences;
  roommates?: string[];
};

const PEOPLE: Persona[] = [
  { name: "Maya", role: "owner", start: "2026-12-27", lean: 0, stage: "submitted", roommates: ["Priya", "Lena"],
    prefs: { budget: "700_1000", stay: "villa", sharedRooms: "depends", interests: ["food", "beaches", "photography"], earlyMornings: "some", transport: "van", flyingFrom: "London", mustDo: "Whale watching — non-negotiable.", hardNo: "Anything before 5am." } },
  { name: "Theo", role: "admin", start: "2026-12-27", lean: 1, stage: "submitted", roommates: ["Jonah", "Kai"],
    prefs: { budget: "1000_1500", stay: "villa", sharedRooms: "yes", interests: ["surfing", "nightlife", "food"], earlyMornings: "no", transport: "any", flyingFrom: "Dubai", mustDo: "One proper surf lesson." } },
  { name: "Priya", start: "2026-12-27", lean: -1, stage: "submitted", roommates: ["Maya", "Nadia"],
    prefs: { budget: "700_1000", stay: "boutique", sharedRooms: "depends", interests: ["hiking", "tea", "wellness"], earlyMornings: "yes", transport: "train", dietary: ["vegetarian"], flyingFrom: "Mumbai" } },
  { name: "Jonah", start: "2026-12-28", lean: 2, stage: "submitted", roommates: ["Theo", "Omar"],
    prefs: { budget: "400_700", stay: "hostel", sharedRooms: "yes", interests: ["nightlife", "surfing"], earlyMornings: "no", transport: "tuktuk", flyingFrom: "Manchester", hardNo: "Temples on back-to-back days." } },
  { name: "Lena", start: "2026-12-27", lean: -1, stage: "submitted", roommates: ["Sofia", "Maya"],
    prefs: { budget: "700_1000", stay: "villa", sharedRooms: "yes", interests: ["safari", "photography", "beaches"], earlyMornings: "some", transport: "van", flyingFrom: "Berlin" } },
  { name: "Omar", start: "2026-12-26", lean: 1, stage: "submitted", roommates: ["Ravi"],
    prefs: { budget: "1000_1500", stay: "boutique", sharedRooms: "no", interests: ["food", "culture", "nightlife"], earlyMornings: "some", transport: "van", dietary: ["halal"], flyingFrom: "Doha" } },
  { name: "Sofia", start: "2026-12-28", lean: -2, stage: "submitted", roommates: ["Lena", "Elle"],
    prefs: { budget: "400_700", stay: "hostel", sharedRooms: "yes", interests: ["hiking", "snorkeling", "safari"], earlyMornings: "yes", transport: "train", dietary: ["pescatarian"], flyingFrom: "Lisbon", mustDo: "A rainforest hike." } },
  { name: "Kai", start: "2026-12-29", lean: 2, stage: "submitted", roommates: ["Theo"],
    prefs: { budget: "gt1500", stay: "villa", sharedRooms: "depends", interests: ["nightlife", "surfing", "wellness"], earlyMornings: "no", transport: "any", flyingFrom: "Sydney" } },
  { name: "Nadia", start: "2026-12-27", lean: 0, stage: "draft", roommates: ["Priya"],
    prefs: { budget: "700_1000", stay: "mix", interests: ["culture", "food"], earlyMornings: "some", flyingFrom: "Toronto" } },
  { name: "Ravi", start: "2026-12-26", lean: -1, stage: "draft",
    prefs: { budget: "400_700", interests: ["trains", "tea", "hiking"], flyingFrom: "Bengaluru" } },
  { name: "Elle", start: "2027-01-02", lean: 1, stage: "draft", roommates: ["Sofia", "Someone's plus-one"],
    prefs: { interests: ["beaches", "nightlife"] } },
  { name: "Tomás", start: "2026-12-27", lean: 0, stage: "new", prefs: {} },
];

/** Who peeked at whom (peeker → targets). */
const PEEKS: [string, string[]][] = [
  ["Jonah", ["Theo", "Kai", "Maya"]],
  ["Nadia", ["Maya", "Priya"]],
  ["Elle", ["Kai", "Jonah", "Sofia", "Theo"]],
  ["Ravi", ["Priya"]],
  ["Lena", ["Sofia"]],
];

/** A small seeded RNG so every reset builds the same demo. */
function rngFrom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A balanced quick fill, then each matchup flipped to the side that suits the persona. */
function planFor(e: Engine, p: Persona, seed: number): ItineraryData {
  const rng = rngFrom(seed);
  let data = setStart(e, { ...emptyItinerary(), flexibility: ["exact", "few_days", "very"][seed % 3] }, p.start, tripDays(e));
  data = quickFill(e, data, { rng });
  const vibe = (id: string) => e.catalog.byId[id]?.vibe ?? 0;
  data.days = data.days.map((d) => {
    const flip = (items: typeof d.day) =>
      items.map((it) => {
        const pair = it.pairId ? e.catalog.pairsById[it.pairId] : null;
        if (!pair) return it;
        const other = it.id === pair.a ? pair.b : pair.a;
        const better = Math.abs(vibe(other) - p.lean) < Math.abs(vibe(it.id) - p.lean);
        return better || rng() < 0.2 ? makeItem(e, other, pair.id) : it;
      });
    return { ...d, day: flip(d.day), night: flip(d.night) };
  });
  // Drafts are part-way through: the last days are still empty.
  if (p.stage === "draft") data.days = data.days.map((d, i) => (i >= 3 ? { ...d, day: [], night: [] } : d));
  return normalize(e, { ...data, preferences: { ...p.prefs, currency: "USD" } });
}

/** Deletes the demo trip (and its guests) and builds it again from scratch. */
export async function resetDemoTrip(): Promise<{ slug: string; people: number }> {
  const store = db();
  const old = await store.getTripBySlug(DEMO_SLUG);
  if (old) await store.deleteTrip(old.id);
  const trip = await store.createTrip({ slug: DEMO_SLUG, name: DEMO_NAME, preset_id: DEMO_PRESET, kind: "demo" });
  if (!trip) throw new Error("Couldn't create the demo trip");

  const { preset, catalog } = loadPreset(DEMO_PRESET);
  const e = createEngine(catalog, defaultRules(preset));
  // Nobody can sign in as a demo traveller: every PIN is a random, unguessable hash.
  const pinHash = await bcrypt.hash(randomBytes(16).toString("hex"), 8);
  const ids = new Map<string, string>();
  const day = 86400_000;
  const now = Date.now();

  for (const p of PEOPLE) {
    const row = await store.createParticipant(trip.id, { name: p.name, pinHash, role: p.role ?? "member" });
    if (!row) continue;
    ids.set(p.name, row.id);
  }
  for (const [i, p] of PEOPLE.entries()) {
    const id = ids.get(p.name);
    if (!id || p.stage === "new") continue;
    const data = planFor(e, p, i + 11);
    data.preferences.roommates = (p.roommates ?? []).map((name) => (ids.has(name) ? { id: ids.get(name), name } : { name }));
    const updated = new Date(now - (PEOPLE.length - i) * 0.4 * day).toISOString();
    await store.saveItinerary({
      participant_id: id,
      data,
      status: p.stage,
      submitted_at: p.stage === "submitted" ? updated : null,
      updated_at: updated,
    });
  }
  for (const [peeker, targets] of PEEKS) {
    for (const target of targets) {
      const a = ids.get(peeker);
      const b = ids.get(target);
      if (a && b) await store.recordPeek(a, b);
    }
  }
  const owner = { id: ids.get("Maya") ?? null, name: "Maya" };
  await store.addLog({ trip_id: trip.id, actor_id: owner.id, actor_name: owner.name, action: "Started the trip", target_id: null, target_name: null, details: { preset: DEMO_PRESET } });
  await store.addLog({ trip_id: trip.id, actor_id: owner.id, actor_name: owner.name, action: "Made Theo an admin", target_id: ids.get("Theo") ?? null, target_name: "Theo", details: {} });
  return { slug: trip.slug, people: ids.size };
}

/** The demo trip's slug, building it first if it isn't there yet. */
export async function ensureDemoTrip(): Promise<string> {
  const row = await db().getTripBySlug(DEMO_SLUG);
  return row ? row.slug : (await resetDemoTrip()).slug;
}
