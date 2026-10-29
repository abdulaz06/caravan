// The demo trips' fictional crew: twelve travellers, their dates, answers and
// how their plans get built (a seeded quick fill nudged towards each person's
// taste). Pure — the server seeds it into a trip (src/lib/server/demo.ts) and
// the unit tests and the generator report use it without a database.
import { emptyItinerary, isSpecialOption, makeItem, normalize, setStart, type ItineraryData, type Preferences } from "@/engine/itinerary";
import { quickFill } from "@/engine/quickfill";
import { clampLength, isFixed, planDays, tripDays, type Engine } from "@/engine/structure";
import type { Ballot } from "@/engine/consensus/types";
import { addDays, diffDays, parseISO } from "@/lib/dates";

type Role = "owner" | "admin" | "member"; // as in src/lib/server/db.ts

/**
 * The public demo trips, one per destination, at /t/demo-<preset>: built on
 * first visit (/demo/<preset>) and rebuilt nightly by the cron.
 */
export type Demo = {
  id: string;
  slug: string;
  name: string;
  /** Each traveller's own dates (first and last day): varied lengths, overlapping around New Year. */
  dates: Record<string, [string, string]>;
  /** Each traveller's answers on the preferences step (ids from the preset). */
  prefs: Record<string, Preferences>;
};

/**
 * Twelve fictional travellers, shared by every demo. `lean` nudges their
 * matchup picks towards nature (-) or nightlife (+); `stage` is how far they've got.
 */
export type Person = { name: string; role?: Role; lean: number; stage: "submitted" | "draft" | "new"; roommates?: string[]; from?: string; dietary?: string[] };

export const CREW: Person[] = [
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
export const PEEKS: [string, string[]][] = [
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
    dates: {
      Maya: ["2026-12-27", "2027-01-03"], Theo: ["2026-12-26", "2027-01-01"], Priya: ["2026-12-27", "2027-01-02"], Jonah: ["2026-12-28", "2027-01-02"],
      Lena: ["2026-12-26", "2027-01-04"], Omar: ["2026-12-29", "2027-01-02"], Sofia: ["2026-12-24", "2027-01-03"], Kai: ["2026-12-30", "2027-01-04"],
      Nadia: ["2026-12-27", "2026-12-31"], Ravi: ["2026-12-20", "2026-12-30"], Elle: ["2027-01-02", "2027-01-08"], Tomás: ["2026-12-27", "2027-01-02"],
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
    dates: {
      Maya: ["2026-12-26", "2027-01-03"], Theo: ["2026-12-27", "2027-01-04"], Priya: ["2026-12-23", "2026-12-31"], Jonah: ["2026-12-28", "2027-01-02"],
      Lena: ["2026-12-26", "2027-01-05"], Omar: ["2026-12-29", "2027-01-06"], Sofia: ["2026-12-27", "2027-01-07"], Kai: ["2026-12-30", "2027-01-03"],
      Nadia: ["2026-12-26", "2027-01-01"], Ravi: ["2027-01-02", "2027-01-10"], Elle: ["2026-12-28", "2027-01-02"], Tomás: ["2026-12-26", "2027-01-03"],
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
export function rngFrom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A balanced quick fill on the traveller's own dates, then each matchup flipped to the side that suits them. */
export function planFor(e: Engine, p: Person, [start, end]: [string, string], prefs: Preferences, seed: number): ItineraryData {
  const rng = rngFrom(seed);
  // A trip with a fixed length gets that length from their first day.
  const len = isFixed(e) ? tripDays(e) : clampLength(e, diffDays(start, end) + 1);
  let data = setStart(e, { ...emptyItinerary(), flexibility: ["exact", "few_days", "very"][seed % 3] }, start, len);
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
  data = followInterests(e, data, prefs.interests ?? [], rng);
  // Drafts are part-way through: the last days are still empty.
  if (p.stage === "draft") data.days = data.days.map((d, i) => (i >= 3 ? { ...d, day: [], night: [] } : d));
  return normalize(e, {
    ...data,
    preferences: { ...prefs, ...(p.from ? { flyingFrom: p.from } : {}), ...(p.dietary ? { dietary: p.dietary } : {}), currency: "USD" },
  });
}

/** Words in an activity that match a preferences-step interest (both destinations' interest ids). */
const LIKES: Record<string, string[]> = {
  hiking: ["hike", "trek", "rainforest", "walk"],
  surfing: ["surf"],
  safari: ["safari", "wildlife", "elephants", "birds"],
  beaches: ["beach", "swim", "lagoon"],
  tea: ["tea"],
  food: ["street food", "cooking", "seafood", "dinner", "food"],
  culture: ["temple", "history", "museum", "monastery", "church", "architecture"],
  photography: ["photo", "views", "sunset", "sunrise"],
  nightlife: ["party", "club", "dj", "bars", "cocktails", "techno", "late"],
  wellness: ["wellness", "spa", "yoga", "baths"],
  snorkeling: ["snorkel", "diving", "turtles"],
  trains: ["train"],
  shopping: ["shopping", "market", "crafts"],
  skiing: ["ski", "snowboard"],
  snow: ["snow", "mountain"],
  roadtrips: ["driving", "big day trip", "off-road"],
  adrenaline: ["adrenaline", "paragliding", "zipline", "karting", "jet ski"],
  markets: ["market"],
  music: ["music", "opera", "dj"],
};

/**
 * Real groups aren't twelve copies of one quick fill: about half of each
 * traveller's slots go to an option that matches what they said they're into
 * (seeded, so every reset builds the same crew).
 */
function followInterests(e: Engine, data: ItineraryData, interests: string[], rng: () => number): ItineraryData {
  const words = interests.flatMap((i) => LIKES[i] ?? []);
  if (!words.length) return data;
  const plans = planDays(e, data.days.length);
  const used = new Set(data.days.flatMap((d) => [...d.day, ...d.night].map((x) => x.id)));
  const match = (id: string) => {
    const a = e.catalog.byId[id];
    const text = [...a.tags, ...a.categories, a.title.toLowerCase()].join(" ");
    return words.filter((w) => text.includes(w)).length;
  };
  const days = data.days.map((d, i) => {
    const next = { ...d };
    for (const slot of ["day", "night"] as const) {
      const area = plans[i].areas[slot];
      if (!area || rng() < 0.5) continue;
      const date = data.startDate ? addDays(data.startDate, i) : null;
      const weekday = date ? parseISO(date).getUTCDay() : null;
      const options = e.catalog.options
        .filter((a) => a.areas.includes(area) && a.slots.includes(slot) && !a.variants && !used.has(a.id) && !isSpecialOption(e, a.id))
        .filter((a) => !a.availableDays || (weekday !== null && a.availableDays.includes(weekday)))
        .map((a) => ({ a, m: match(a.id) }))
        .filter((x) => x.m > 0)
        .sort((x, y) => y.m - x.m || (x.a.id < y.a.id ? -1 : 1));
      const pick = options[Math.floor(rng() * Math.min(3, options.length))]?.a;
      if (!pick || isSpecialOption(e, d[slot][0]?.id ?? "")) continue;
      used.add(pick.id);
      next[slot] = [makeItem(e, pick.id), ...d[slot].slice(1)];
    }
    return next;
  });
  return { ...data, days };
}

/** The crew's plans as ballots for the plan generator (no database: ids are their names). */
export function demoBallots(e: Engine, demo: Demo): Ballot[] {
  return CREW.flatMap((p, i) =>
    p.stage === "new" ? [] : [{ id: `demo-${p.name.toLowerCase()}`, name: p.name, status: p.stage, data: planFor(e, p, demo.dates[p.name], demo.prefs[p.name] ?? {}, i + 11) }],
  );
}
