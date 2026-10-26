// A tiny made-up destination for the engine tests: three bases (Alpha 1 night
// → Beta 2 → Gamma 2), a scenic route with stops between Alpha and Beta, a
// plain transfer to Gamma, a New Year's Eve pair, one nightlife option with a
// family-friendly stand-in, an extra tied to a day trip, and a big day trip
// with two variants. Every field the schema requires, and nothing more.

const photo = (key: string) => [{ src: `images/${key}.webp`, credit: "Test", source: "https://example.com/photo", license: "CC0" }];

type Slot = "day" | "night";
function act(id: string, slot: Slot | Slot[], areas: string[], region: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    kind: Array.isArray(slot) ? "extra" : "option",
    slots: Array.isArray(slot) ? slot : [slot],
    areas,
    title: `Title ${id}`,
    region,
    categories: ["nature"],
    tagline: `Tagline ${id}`,
    loved: `Loved ${id}`,
    description: `Description ${id}`,
    highlights: [`Highlight ${id}`],
    duration: "~2 hrs",
    hours: 2,
    estCostUsd: [10, 20],
    vibe: slot === "night" ? 1 : -1,
    tags: [],
    sources: [{ label: "Example", url: "https://example.com" }],
    ...extra,
  };
}

const activities = [
  // Alpha (arrival city)
  act("a-day-1", "day", ["a"], "alpha"),
  act("a-day-2", "day", ["a"], "alpha"),
  act("a-night-1", "night", ["a"], "alpha"),
  act("a-night-2", "night", ["a"], "alpha", { categories: ["party"], tags: ["bar"], vibe: 2, familySwap: "family-a-night" }),
  // On the road Alpha → Beta
  act("road-1", "day", ["road"], "stopx", { routeKm: 20 }),
  act("road-2", "day", ["road"], "stopy", { routeKm: 40 }),
  // Beta
  act("b-day-1", "day", ["b"], "beta"),
  act("b-day-2", "day", ["b"], "cove"),
  act("b-night-1", "night", ["b"], "beta"),
  act("b-night-2", "night", ["b"], "cove"),
  // Gamma
  act("c-day-1", "day", ["c"], "gamma"),
  act("c-trip", "day", ["c"], "peak", {
    onlyBaseDays: true,
    tags: ["big day trip"],
    variants: [
      { id: "early", title: "Sunrise", emoji: "🌅", summary: "Leave at 2am", schedule: [{ time: "2am", text: "Leave" }], hours: 3, leave: "~2am", total: "~12 hrs", honest: [], eveBefore: "Early night", eveningNote: "Rest tonight" },
      { id: "late", title: "Easy", emoji: "☀️", summary: "Leave at 7am", schedule: [{ time: "7am", text: "Leave" }], hours: 5, leave: "~7am", total: "~13 hrs", honest: [], eveningNote: "Back late" },
    ],
  }),
  act("c-night-1", "night", ["c"], "gamma"),
  act("c-night-2", "night", ["c"], "gamma"),
  // New Year's Eve (Beta and Gamma)
  act("nye-b-1", "night", ["b"], "beta"),
  act("nye-b-2", "night", ["b"], "cove"),
  act("nye-c-1", "night", ["c"], "gamma"),
  act("nye-c-2", "night", ["c"], "gamma"),
  // Quick extras
  act("x-anywhere", ["day", "night"], ["a", "b", "c"], "beta"),
  act("x-with-trip", ["day"], ["c"], "peak", { onlyWith: "c-trip" }),
  // Family-friendly stand-in
  { ...act("family-a-night", "night", ["a"], "alpha"), kind: "family" },
];

const pairs = [
  { id: "p-a-day", slot: "day", area: "a", a: "a-day-1", b: "a-day-2" },
  { id: "p-a-night", slot: "night", area: "a", a: "a-night-1", b: "a-night-2" },
  { id: "p-road", slot: "day", area: "road", a: "road-1", b: "road-2" },
  { id: "p-b-day", slot: "day", area: "b", a: "b-day-1", b: "b-day-2" },
  { id: "p-b-night", slot: "night", area: "b", a: "b-night-1", b: "b-night-2" },
  { id: "p-c-day", slot: "day", area: "c", a: "c-day-1", b: "c-trip" },
  { id: "p-c-night", slot: "night", area: "c", a: "c-night-1", b: "c-night-2" },
  { id: "nye-b", slot: "night", area: "b", a: "nye-b-1", b: "nye-b-2", special: "nye" },
  { id: "nye-c", slot: "night", area: "c", a: "nye-c-1", b: "nye-c-2", special: "nye" },
];

const region = (id: string, lat: number, lng: number) => ({ id, name: `Region ${id}`, short: id, lat, lng, blurb: "", photos: [`region-${id}`] });
const regions = [
  region("port", 10, 10),
  region("alpha", 10.1, 10.1),
  region("stopx", 10.0, 10.3),
  region("stopy", 9.9, 10.5),
  region("beta", 9.8, 10.7),
  region("cove", 9.75, 10.8),
  region("gamma", 9.6, 11.0),
  region("peak", 9.2, 11.6),
];

const choices = (...ids: string[]) => ids.map((id) => ({ id, label: id }));
const scale = (keys: string[]) => Object.fromEntries(keys.map((k) => [k, "#336699"]));

export const miniPreset = {
  id: "mini",
  version: 1,
  name: "Miniland",
  destination: {
    country: "Miniland",
    timezone: "UTC",
    headline: ["Miniland,", "your way."],
    tagline: "Small but lovely",
    season: "Dec 2026 – Jan 2027",
    blurb: "A test trip.",
    heroPhoto: "hero",
    farewell: "Bye!",
    stampText: "MINI · ",
  },
  currency: { local: "USD", default: "USD" },
  dates: { window: { start: "2026-12-01", end: "2027-01-31" }, outer: { start: "2026-11-01", end: "2027-02-28" } },
  structure: {
    bases: [
      { id: "alpha", name: "Alpha", region: "alpha", area: "a", nights: { default: 1, min: 1, max: 3 }, tagline: "City", covers: "Alpha", photo: "base-alpha", dayName: "Alpha day", arrivalName: "Land in Alpha" },
      { id: "beta", name: "Beta", region: "beta", area: "b", nights: { default: 2, min: 1, max: 4 }, tagline: "Coast", covers: "Beta", photo: "base-beta", dayName: "Beta base" },
      { id: "gamma", name: "Gamma", region: "gamma", area: "c", nights: { default: 2, min: 2, max: 4 }, tagline: "Hills", covers: "Gamma", photo: "base-gamma", dayName: "Gamma base" },
    ],
    arrival: { leg: "arrival", label: "Land" },
    transfers: [
      { from: "alpha", to: "beta", name: "Road to Beta", dayArea: "road", leg: "ab", scenicLeg: "ab-scenic", route: "r1" },
      { from: "beta", to: "gamma", name: "Over to Gamma", leg: "bc" },
    ],
    departure: { name: "Fly home", short: "Fly", leg: "departure", text: "Off you go." },
    preview: true,
    slots: { day: { label: "Daytime", limitHours: 10 }, night: { label: "Evening", limitHours: 7 } },
  },
  areas: [
    { id: "a", name: "Alpha", home: "alpha" },
    { id: "road", name: "On the way", home: "alpha" },
    { id: "b", name: "Beta area", home: "beta", movable: true },
    { id: "c", name: "Gamma area", home: "gamma", movable: true },
  ],
  regions,
  travel: {
    known: [["port", "alpha", 1]],
    estimate: { detour: 1.3, kmh: 50, overhead: 0 },
    legs: {
      arrival: { from: "port", to: "alpha", title: "Port → Alpha", hours: 1, label: "~1 hr", vehicleCostUsd: [20, 30] },
      ab: { from: "alpha", to: "beta", title: "Alpha → Beta", hours: 2, label: "~2 hrs", vehicleCostUsd: [40, 60] },
      "ab-scenic": { from: "alpha", to: "beta", title: "Alpha → Beta the long way", hours: 3, label: "~3 hrs", vehicleCostUsd: [60, 80] },
      bc: { from: "beta", to: "gamma", title: "Beta → Gamma", hours: 1.5, label: "~1.5 hrs", vehicleCostUsd: [30, 40] },
      departure: { from: "gamma", to: "port", title: "Gamma → Port", hours: 3, label: "~3 hrs", vehicleCostUsd: [50, 70] },
    },
    routes: { r1: { from: "alpha", to: "beta", stops: [{ region: "alpha", km: 0 }, { region: "stopx", km: 20 }, { region: "stopy", km: 40 }, { region: "beta", km: 60 }], label: "the long way" } },
    vehicle: "van",
  },
  map: {
    projection: { minLng: 9.5, maxLat: 10.5, scale: 100, pad: 5 },
    width: 230,
    height: 150,
    outline: ["M0 0L200 0L200 140Z"],
    detail: "M0 0L200 0L200 140Z",
    focus: [[10.2, 9.9], [9.1, 11.7]],
    chains: [["alpha", "stopx", "stopy", "beta"]],
    roads: [{ from: "gamma", to: "peak", via: [[9.4, 11.3]] }],
    label: "Miniland",
  },
  stayIn: {
    day: { title: "Stay in", tagline: "Slow day", description: "Nothing planned.", highlights: ["Rest"], photos: ["stay"], meta: "No travel" },
    night: { title: "Stay in", tagline: "Quiet night", description: "Dinner in.", highlights: ["Rest"], photos: ["stay"], meta: "No travel" },
    transfer: { title: "Straight there", tagline: "Skip the stops", description: "Fast road.", highlights: ["Fast"], photos: ["stay"], meta: "~2 hrs" },
  },
  specialDates: [
    {
      id: "nye",
      date: "12-31",
      name: "New Year's Eve",
      short: "NYE",
      slot: "night",
      pairs: { b: "nye-b", c: "nye-c" },
      intro: "The big one.",
      departureNote: "Flying on NYE!",
      calendarNote: "31 Dec is special",
    },
  ],
  categories: [
    { id: "nature", label: "Nature", emoji: "🌿" },
    { id: "party", label: "Party", emoji: "🪩" },
    { id: "chill", label: "Chill", emoji: "🌴" },
  ],
  activities,
  pairs,
  costs: {
    groupSize: 10,
    vehicles: 2,
    perHourUsd: [10, 20],
    accommodation: { budget: { alpha: [10, 20], beta: [10, 20], gamma: [10, 20] }, mix: { alpha: [20, 30], beta: [20, 30], gamma: [20, 30] } },
  },
  preferences: {
    budgets: [
      { id: "low", label: "Low", usd: [0, 500] },
      { id: "high", label: "High", usd: [500, null] },
    ],
    stays: choices("budget", "mix"),
    sharedRooms: choices("yes", "no"),
    interests: choices("hiking", "food"),
    earlyMornings: choices("yes", "no"),
    transport: choices("van", "any"),
    dietary: choices("vegan"),
    flexibility: choices("exact", "few_days", "very"),
  },
  theme: {
    palette: {
      primary: scale(["950", "900", "800", "700", "600", "500", "300", "100"]),
      secondary: scale(["900", "800", "700", "600", "400", "100"]),
      accent: scale(["700", "600", "500", "300", "100"]),
      highlight: scale(["600", "500", "400", "200", "100"]),
      pop: scale(["600", "500", "300", "100"]),
      night: scale(["950", "900", "800", "700"]),
      surface: scale(["50", "100", "200", "300", "400"]),
      paper: "#ffffff",
      ink: { "1": "#000000", "2": "#333333", "3": "#666666" },
    },
    fonts: { display: "fraunces", body: "instrument" },
    illustrations: "alpine",
    dayColors: ["#111111", "#222222", "#333333", "#444444"],
    confetti: ["#111111", "#222222", "#333333"],
  },
};

const photoKeys = [
  "hero",
  "stay",
  "base-alpha",
  "base-beta",
  "base-gamma",
  ...regions.map((r) => `region-${r.id}`),
  ...activities.map((a) => a.id),
];
export const miniPhotos = Object.fromEntries(photoKeys.map((k) => [k, photo(k)]));

/** A deep copy to break in a test. */
export const freshMini = () => structuredClone(miniPreset) as typeof miniPreset & Record<string, unknown>;
