import "server-only";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { emptyItinerary, makeItem, normalize, setStart, type ItineraryData, type Preferences } from "@/engine/itinerary";
import { defaultRules } from "@/engine/rules";
import { createEngine, tripDays, type Engine } from "@/engine/structure";
import { quickFill } from "@/engine/quickfill";
import { loadPreset } from "@/presets/registry";
import { db, type Role } from "./db";

/** Guests a demo can hold before new ones are turned away (until the nightly reset). */
export const MAX_DEMO_GUESTS = 250;

/**
 * The public demo trips, one per destination, at /t/demo-<preset>: built on
 * first visit (/demo/<preset>) and rebuilt nightly by the cron.
 */
type Demo = {
  id: string;
  slug: string;
  name: string;
  /** Each traveller's first day. */
  starts: Record<string, string>;
  /** Each traveller's answers on the preferences step (ids from the preset). */
  prefs: Record<string, Preferences>;
};

/**
 * Twelve fictional travellers, shared by every demo. `lean` nudges their
 * matchup picks towards nature (-) or nightlife (+); `stage` is how far they've got.
 */
type Person = { name: string; role?: Role; lean: number; stage: "submitted" | "draft" | "new"; roommates?: string[]; from?: string; dietary?: string[] };

const CREW: Person[] = [
  { name: "Maya", role: "owner", lean: 0, stage: "submitted", roommates: ["Priya", "Lena"], from: "London" },
  { name: "Theo", role: "admin", lean: 1, stage: "submitted", roommates: ["Jonah", "Kai"], from: "Dubai" },
  { name: "Priya", lean: -1, stage: "submitted", roommates: ["Maya", "Nadia"], from: "Mumbai", dietary: ["vegetarian"] },
  { name: "Jonah", lean: 2, stage: "submitted", roommates: ["Theo", "Omar"], from: "Manchester" },
  { name: "Lena", lean: -1, stage: "submitted", roommates: ["Sofia", "Maya"], from: "Berlin" },
  { name: "Omar", lean: 1, stage: "submitted", roommates: ["Ravi"], from: "Doha", dietary: ["halal"] },
  { name: "Sofia", lean: -2, stage: "submitted", roommates: ["Lena", "Elle"], from: "Lisbon", dietary: ["pescatarian"] },
  { name: "Kai", lean: 2, stage: "submitted", roommates: ["Theo"], from: "Sydney" },
  { name: "Nadia", lean: 0, stage: "draft", roommates: ["Priya"], from: "Toronto" },
  { name: "Ravi", lean: -1, stage: "draft", from: "Bengaluru" },
  { name: "Elle", lean: 1, stage: "draft", roommates: ["Sofia", "Someone's plus-one"] },
  { name: "Tomás", lean: 0, stage: "new" },
];

/** Who peeked at whom (peeker → targets). */
const PEEKS: [string, string[]][] = [
  ["Jonah", ["Theo", "Kai", "Maya"]],
  ["Nadia", ["Maya", "Priya"]],
  ["Elle", ["Kai", "Jonah", "Sofia", "Theo"]],
  ["Ravi", ["Priya"]],
  ["Lena", ["Sofia"]],
];

export const DEMOS: Demo[] = [
  {
    id: "sri-lanka",
    slug: "demo-sri-lanka",
    name: "Sri Lanka crew '26",
    starts: {
      Maya: "2026-12-27", Theo: "2026-12-27", Priya: "2026-12-27", Jonah: "2026-12-28", Lena: "2026-12-27", Omar: "2026-12-26",
      Sofia: "2026-12-28", Kai: "2026-12-29", Nadia: "2026-12-27", Ravi: "2026-12-26", Elle: "2027-01-02", Tomás: "2026-12-27",
    },
    prefs: {
      Maya: { budget: "700_1000", stay: "villa", sharedRooms: "depends", interests: ["food", "beaches", "photography"], earlyMornings: "some", transport: "van", mustDo: "Whale watching — non-negotiable.", hardNo: "Anything before 5am." },
      Theo: { budget: "1000_1500", stay: "villa", sharedRooms: "yes", interests: ["surfing", "nightlife", "food"], earlyMornings: "no", transport: "any", mustDo: "One proper surf lesson." },
      Priya: { budget: "700_1000", stay: "boutique", sharedRooms: "depends", interests: ["hiking", "tea", "wellness"], earlyMornings: "yes", transport: "train" },
      Jonah: { budget: "400_700", stay: "hostel", sharedRooms: "yes", interests: ["nightlife", "surfing"], earlyMornings: "no", transport: "tuktuk", hardNo: "Temples on back-to-back days." },
      Lena: { budget: "700_1000", stay: "villa", sharedRooms: "yes", interests: ["safari", "photography", "beaches"], earlyMornings: "some", transport: "van" },
      Omar: { budget: "1000_1500", stay: "boutique", sharedRooms: "no", interests: ["food", "culture", "nightlife"], earlyMornings: "some", transport: "van" },
      Sofia: { budget: "400_700", stay: "hostel", sharedRooms: "yes", interests: ["hiking", "snorkeling", "safari"], earlyMornings: "yes", transport: "train", mustDo: "A rainforest hike." },
      Kai: { budget: "gt1500", stay: "villa", sharedRooms: "depends", interests: ["nightlife", "surfing", "wellness"], earlyMornings: "no", transport: "any" },
      Nadia: { budget: "700_1000", stay: "mix", interests: ["culture", "food"], earlyMornings: "some" },
      Ravi: { budget: "400_700", interests: ["trains", "tea", "hiking"] },
      Elle: { interests: ["beaches", "nightlife"] },
      Tomás: {},
    },
  },
  {
    id: "georgia",
    slug: "demo-georgia",
    name: "Georgia crew '26",
    starts: {
      Maya: "2026-12-25", Theo: "2026-12-25", Priya: "2026-12-26", Jonah: "2026-12-27", Lena: "2026-12-25", Omar: "2026-12-24",
      Sofia: "2026-12-26", Kai: "2026-12-28", Nadia: "2026-12-25", Ravi: "2026-12-24", Elle: "2027-01-02", Tomás: "2026-12-25",
    },
    prefs: {
      Maya: { budget: "800_1200", stay: "villa", sharedRooms: "depends", interests: ["food", "culture", "photography"], earlyMornings: "some", transport: "self-drive", mustDo: "Gergeti in the snow.", hardNo: "More than one 5-hour drive." },
      Theo: { budget: "1200_1800", stay: "villa", sharedRooms: "yes", interests: ["skiing", "nightlife", "adrenaline"], earlyMornings: "no", transport: "self-drive", mustDo: "Bassiani on the Saturday." },
      Priya: { budget: "800_1200", stay: "boutique", sharedRooms: "depends", interests: ["hiking", "snow", "wellness"], earlyMornings: "yes", transport: "van" },
      Jonah: { budget: "500_800", stay: "hostel", sharedRooms: "yes", interests: ["nightlife", "skiing"], earlyMornings: "no", transport: "taxi", hardNo: "Monasteries on back-to-back days." },
      Lena: { budget: "800_1200", stay: "villa", sharedRooms: "yes", interests: ["photography", "snow", "roadtrips"], earlyMornings: "some", transport: "self-drive" },
      Omar: { budget: "1200_1800", stay: "boutique", sharedRooms: "no", interests: ["food", "culture", "music"], earlyMornings: "some", transport: "van" },
      Sofia: { budget: "500_800", stay: "hostel", sharedRooms: "yes", interests: ["hiking", "snow", "adrenaline"], earlyMornings: "yes", transport: "self-drive", mustDo: "Paragliding over Gudauri." },
      Kai: { budget: "gt1800", stay: "villa", sharedRooms: "depends", interests: ["nightlife", "skiing", "wellness"], earlyMornings: "no", transport: "any" },
      Nadia: { budget: "800_1200", stay: "mix", interests: ["culture", "food", "markets"], earlyMornings: "some" },
      Ravi: { budget: "500_800", interests: ["roadtrips", "hiking", "snow"] },
      Elle: { interests: ["nightlife", "music"] },
      Tomás: {},
    },
  },
];

export const demoBySlug = (slug: string) => DEMOS.find((d) => d.slug === slug) ?? null;
export const demoById = (id: string) => DEMOS.find((d) => d.id === id) ?? null;

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

/** A balanced quick fill, then each matchup flipped to the side that suits the traveller. */
function planFor(e: Engine, p: Person, start: string, prefs: Preferences, seed: number): ItineraryData {
  const rng = rngFrom(seed);
  let data = setStart(e, { ...emptyItinerary(), flexibility: ["exact", "few_days", "very"][seed % 3] }, start, tripDays(e));
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
  return normalize(e, {
    ...data,
    preferences: { ...prefs, ...(p.from ? { flyingFrom: p.from } : {}), ...(p.dietary ? { dietary: p.dietary } : {}), currency: "USD" },
  });
}

/** Deletes one demo trip (and its guests) and builds it again from scratch. */
export async function resetDemoTrip(demo: Demo): Promise<{ slug: string; people: number }> {
  const store = db();
  const old = await store.getTripBySlug(demo.slug);
  if (old) await store.deleteTrip(old.id);
  const trip = await store.createTrip({ slug: demo.slug, name: demo.name, preset_id: demo.id, kind: "demo" });
  if (!trip) throw new Error(`Couldn't create the ${demo.id} demo`);

  const { preset, catalog } = loadPreset(demo.id);
  const e = createEngine(catalog, defaultRules(preset));
  // Nobody can sign in as a demo traveller: every PIN is a random, unguessable hash.
  const pinHash = await bcrypt.hash(randomBytes(16).toString("hex"), 8);
  const ids = new Map<string, string>();
  const day = 86400_000;
  const now = Date.now();

  for (const p of CREW) {
    const row = await store.createParticipant(trip.id, { name: p.name, pinHash, role: p.role ?? "member" });
    if (row) ids.set(p.name, row.id);
  }
  for (const [i, p] of CREW.entries()) {
    const id = ids.get(p.name);
    if (!id || p.stage === "new") continue;
    const data = planFor(e, p, demo.starts[p.name], demo.prefs[p.name] ?? {}, i + 11);
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
  const owner = { id: ids.get("Maya") ?? null, name: "Maya" };
  await store.addLog({ trip_id: trip.id, actor_id: owner.id, actor_name: owner.name, action: "Started the trip", target_id: null, target_name: null, details: { preset: demo.id } });
  await store.addLog({ trip_id: trip.id, actor_id: owner.id, actor_name: owner.name, action: "Made Theo an admin", target_id: ids.get("Theo") ?? null, target_name: "Theo", details: {} });
  return { slug: trip.slug, people: ids.size };
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
  return row ? row.slug : (await resetDemoTrip(demo)).slug;
}
