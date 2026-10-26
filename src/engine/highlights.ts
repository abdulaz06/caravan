// "Trip highlights": what a plan adds up to — 3 beaches · 2 hikes · 1 temple
// · 4 sunsets — counted from its picks (each pick once per kind). Shown in
// family-friendly mode instead of the vibe meter, on the page and in the share
// images. Kinds match on tags, so any destination's activities light them up;
// a preset can relabel a kind (temples → monasteries). The icons are plain
// path data (24×24) so React and the canvas draw the same art.
import type { Activity } from "./catalog";
import type { ItineraryData } from "./itinerary";
import type { Engine } from "./structure";

export type HighlightKind =
  | "beach"
  | "sunset"
  | "hike"
  | "temple"
  | "safari"
  | "whale"
  | "turtle"
  | "boat"
  | "surf"
  | "dive"
  | "rainforest"
  | "waterfall"
  | "sunrise"
  | "tea"
  | "train"
  | "culture"
  | "food"
  | "fireworks"
  | "wellness"
  | "games"
  | "ski"
  | "mountain";

export type Highlight = { kind: HighlightKind; count: number; label: string };

type Def = { kind: HighlightKind; one: string; many: string; title: string; match: (a: Activity) => boolean };

const has = (a: Activity, tags: string[]) => a.tags.some((t) => tags.includes(t));

/** In tie-break order. `title` = the card's headline when this kind leads. */
const DEFS: Def[] = [
  { kind: "beach", one: "beach", many: "beaches", title: "Salt, sand & sea", match: (a) => has(a, ["beach", "swimming", "swim", "rock pools"]) },
  { kind: "sunset", one: "sunset", many: "sunsets", title: "Chasing golden hours", match: (a) => has(a, ["sunset"]) },
  { kind: "hike", one: "hike", many: "hikes", title: "Trails & big views", match: (a) => has(a, ["hike", "trek"]) },
  { kind: "ski", one: "ski day", many: "ski days", title: "Fresh tracks", match: (a) => has(a, ["ski", "skiing", "snowboard"]) },
  { kind: "mountain", one: "mountain view", many: "mountain views", title: "Big mountain air", match: (a) => has(a, ["mountain", "alpine", "snow"]) && !has(a, ["ski", "skiing"]) },
  { kind: "temple", one: "temple", many: "temples", title: "Old stones & stupas", match: (a) => has(a, ["temple", "church", "monastery"]) || /\btemples?\b/i.test(a.title) },
  { kind: "safari", one: "safari", many: "safaris", title: "Into the wild", match: (a) => has(a, ["safari", "elephants"]) },
  { kind: "whale", one: "whale watch", many: "whale watches", title: "Big blue days", match: (a) => /\bwhales?\b/i.test(a.title) },
  { kind: "turtle", one: "turtle stop", many: "turtle stops", title: "Shell spotting", match: (a) => has(a, ["turtles"]) },
  { kind: "boat", one: "boat trip", many: "boat trips", title: "Life on the water", match: (a) => has(a, ["boat", "kayak", "lagoon"]) && !/\bwhales?\b/i.test(a.title) },
  { kind: "surf", one: "surf session", many: "surf sessions", title: "Waves & warm water", match: (a) => has(a, ["surf", "surfing"]) },
  { kind: "dive", one: "reef dive", many: "reef dives", title: "Under the surface", match: (a) => has(a, ["snorkeling", "diving", "wreck"]) },
  { kind: "rainforest", one: "rainforest", many: "rainforests", title: "Deep in the green", match: (a) => has(a, ["rainforest"]) },
  { kind: "waterfall", one: "waterfall", many: "waterfalls", title: "Falls & cool pools", match: (a) => has(a, ["waterfall"]) },
  { kind: "sunrise", one: "sunrise", many: "sunrises", title: "Up with the sun", match: (a) => has(a, ["sunrise"]) },
  { kind: "tea", one: "tea estate", many: "tea estates", title: "Tea-country air", match: (a) => has(a, ["tea"]) },
  { kind: "train", one: "railway view", many: "railway views", title: "Rails & arches", match: (a) => has(a, ["train"]) },
  { kind: "culture", one: "heritage stop", many: "heritage stops", title: "Forts & old stories", match: (a) => has(a, ["history", "culture", "museum", "architecture", "crafts", "art", "walking tour"]) },
  { kind: "food", one: "feast", many: "feasts", title: "A feast of a trip", match: (a) => has(a, ["food", "street food", "seafood", "dessert", "cooking", "dinner"]) },
  { kind: "fireworks", one: "fireworks night", many: "fireworks nights", title: "Lights over the sea", match: (a) => has(a, ["fireworks"]) },
  { kind: "wellness", one: "slow morning", many: "slow mornings", title: "Slow & restored", match: (a) => has(a, ["spa", "yoga", "wellness", "baths"]) },
  { kind: "games", one: "game night", many: "game nights", title: "Fun & games", match: (a) => has(a, ["games", "bowling", "arcade"]) },
];

const ORDER = new Map(DEFS.map((d, i) => [d.kind, i]));

/** A kind's words for this destination (the preset may relabel it). */
function words(e: Engine, kind: HighlightKind) {
  const d = DEFS[ORDER.get(kind)!];
  return { ...d, ...e.catalog.preset.highlightLabels[kind] };
}

/** Every highlight in a plan, most first (ties in the order above). */
export function tripHighlights(e: Engine, data: Pick<ItineraryData, "days">): Highlight[] {
  const counts = new Map<HighlightKind, number>();
  for (const day of data.days) {
    for (const x of [...day.day, ...day.night]) {
      const a = e.catalog.byId[x.id];
      if (!a) continue;
      for (const d of DEFS) if (d.match(a)) counts.set(d.kind, (counts.get(d.kind) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || ORDER.get(a[0])! - ORDER.get(b[0])!)
    .map(([kind, count]) => {
      const w = words(e, kind);
      return { kind, count, label: count === 1 ? w.one : w.many };
    });
}

/** The card's headline: from the leading highlight ("Salt, sand & sea"). */
export function highlightsTitle(e: Engine, h: Highlight[]): string {
  return h.length ? (words(e, h[0].kind).title ?? "A trip of highlights") : "A blank canvas";
}

/** "3 beaches · 2 hikes · 1 temple" */
export const highlightsLine = (h: Highlight[], max = 5) => h.slice(0, max).map((x) => `${x.count} ${x.label}`).join(" · ");

// ── Icons: flat, two-to-four colour, on a round tile ─────────────────

export type IconPart = { d: string; fill?: string; stroke?: string; w?: number };
export type HighlightIcon = { tile: string; parts: IconPart[] };

const P = {
  ocean: "#1a8e9c",
  oceanDeep: "#0d5a69",
  aqua: "#8fd3dd",
  jungle: "#2b6a48",
  leaf: "#6aa06a",
  saffron: "#f2a33a",
  saffronLight: "#f7ba5c",
  sunset: "#ec6437",
  hibiscus: "#d6467a",
  pink: "#f08fb0",
  sand: "#f3e3c7",
  paper: "#fffbf4",
  ink: "#1f1a17",
  dusk: "#252050",
  duskLight: "#352d68",
  grey: "#7d8190",
  greyDark: "#5f6372",
  tea: "#b8682a",
};

export const HIGHLIGHT_ICONS: Record<HighlightKind, HighlightIcon> = {
  beach: {
    tile: P.ocean,
    parts: [
      { d: "M2 19.2c3-1.6 7-2.2 10-2.2s7 .6 10 2.2V22H2Z", fill: P.saffronLight },
      { d: "M11.4 9.6 13.2 19", stroke: P.paper, w: 1.4 },
      { d: "M3.4 10.6C4.4 5.9 8.5 3 12.9 3.4c4.3.4 7.6 3.7 7.7 7.9-1.3-1.1-3-1.4-4.4-.6-1.2-1.3-3.1-1.6-4.6-.6-1.4-1.1-3.4-1.1-4.7 0-1.1-.8-2.5-.4-3.5.5Z", fill: P.sunset },
      { d: "M12.2 3.5c-1.6 2-2.3 4.3-2.4 6.8M14.6 3.9c.6 2 .7 4.3.3 6.5", stroke: P.paper, w: 1.1 },
    ],
  },
  sunset: {
    tile: P.dusk,
    parts: [
      { d: "M5 15.5a7 7 0 0 1 14 0Z", fill: P.saffron },
      { d: "M12 4.6v2M4.7 7.7l1.4 1.4M19.3 7.7l-1.4 1.4M2.2 12.8h2M19.8 12.8h2", stroke: P.saffronLight, w: 1.6 },
      { d: "M3 18h18M6.5 21h11", stroke: P.ocean, w: 1.7 },
    ],
  },
  sunrise: {
    tile: P.duskLight,
    parts: [
      { d: "M5.5 17a6.5 6.5 0 0 1 13 0Z", fill: P.saffron },
      { d: "M9.6 5.6 12 3.2l2.4 2.4M12 3.6v4", stroke: P.saffronLight, w: 1.6 },
      { d: "M1 21.5c3.4-3.6 6.6-3.8 10.4-1.2 3.2-2.4 7.2-2.8 11.6 1.2V23H1Z", fill: P.leaf },
    ],
  },
  hike: {
    tile: "#dcebd5",
    parts: [
      { d: "M1 21.5 9 7.5l4 6.2 2.2-3.2 7.8 11Z", fill: P.jungle },
      { d: "M9 7.5l2.3 3.6-1.3-.5-1 1.2-1-1.2-1.3.5Z", fill: P.paper },
      { d: "M15.2 10.5V3.6", stroke: P.ink, w: 1.3 },
      { d: "M15.2 3.6h4.4l-1.1 1.6 1.1 1.6h-4.4Z", fill: P.sunset },
    ],
  },
  temple: {
    tile: P.oceanDeep,
    parts: [
      { d: "M12 2.4 13.1 8h-2.2Z", fill: P.saffron },
      { d: "M9.9 8h4.2v2.1H9.9Z", fill: P.sand },
      { d: "M4.6 17.2a7.4 7.2 0 0 1 14.8 0Z", fill: P.paper },
      { d: "M3 17.2h18v2.3H3Z", fill: P.sand },
      { d: "M2 19.5h20v1.9H2Z", fill: P.saffronLight },
    ],
  },
  safari: {
    tile: P.sand,
    parts: [
      { d: "M7 9.6C7 7.6 8.6 6 10.6 6h6C19 6 21 8 21 10.5V14c0 .8-.4 1.5-1 1.9V19.5h-2v-2.8h-1.7v2.8h-2v-2.8H11v2.8H9v-3.3C7.8 15.3 7 14 7 12.5Z", fill: P.grey },
      { d: "M3 9.6a3.6 3.6 0 1 1 7.2 0 3.6 3.6 0 0 1-7.2 0Z", fill: P.grey },
      { d: "M3.7 10.6c-.7 1.7-1 3.7-.5 5.8.2.8 1.2.8 1.4.1.4-1.5.4-3.1.9-4.5Z", fill: P.grey },
      { d: "M6.8 6.9c1.8 0 3.1 1.4 3.1 3.1 0 1.8-1.3 3.2-2.8 3.6-.6-2.1-.7-4.4-.3-6.7Z", fill: P.greyDark },
      { d: "M4.9 9.2a.7.7 0 1 0 1.4 0 .7.7 0 0 0-1.4 0Z", fill: P.ink },
    ],
  },
  whale: {
    tile: "#d6efeb",
    parts: [
      { d: "M12 20.5v-5.2c0-2-1.5-3.6-3.1-4.6C7 9.6 4.4 8.6 3 6.6c2.6.5 5 0 7.1 1.2 1 .6 1.6 1.3 1.9 2.2.3-.9.9-1.6 1.9-2.2 2.1-1.2 4.5-.7 7.1-1.2-1.4 2-4 3-5.9 4.1-1.6 1-3.1 2.6-3.1 4.6Z", fill: P.oceanDeep },
      { d: "M2 21.2c1.7-1 3.3-1 5 0s3.3 1 5 0 3.3-1 5 0 3.3 1 5 0", stroke: P.ocean, w: 1.6 },
      { d: "M18.5 3.5a.9.9 0 1 0 1.8 0 .9.9 0 0 0-1.8 0ZM4.4 3.1a.7.7 0 1 0 1.4 0 .7.7 0 0 0-1.4 0Z", fill: P.ocean },
    ],
  },
  turtle: {
    tile: "#d6efeb",
    parts: [
      { d: "M4.6 8.1a1.9 1.4 0 1 0 3.8 0 1.9 1.4 0 0 0-3.8 0ZM4.6 15.9a1.9 1.4 0 1 0 3.8 0 1.9 1.4 0 0 0-3.8 0ZM13.6 8.1a1.9 1.4 0 1 0 3.8 0 1.9 1.4 0 0 0-3.8 0ZM13.6 15.9a1.9 1.4 0 1 0 3.8 0 1.9 1.4 0 0 0-3.8 0Z", fill: P.leaf },
      { d: "M18 12a1.9 1.7 0 1 0 3.8 0 1.9 1.7 0 0 0-3.8 0Z", fill: P.leaf },
      { d: "M4 12a7 5.4 0 1 0 14 0 7 5.4 0 1 0-14 0Z", fill: P.jungle },
      { d: "M11 7.2v9.6M6.4 9.6l9.2 4.8M15.6 9.6l-9.2 4.8", stroke: P.leaf, w: 1.2 },
    ],
  },
  boat: {
    tile: "#d6efeb",
    parts: [
      { d: "M12 3v12", stroke: P.ink, w: 1.3 },
      { d: "M12.6 3.4 19 13.2h-6.4Z", fill: P.paper },
      { d: "M11.4 6 6 13.2h5.4Z", fill: P.sand },
      { d: "M3 15h18l-2.6 4.6H5.6Z", fill: P.sunset },
      { d: "M2 21.6c1.7-1 3.3-1 5 0s3.3 1 5 0 3.3-1 5 0 3.3 1 5 0", stroke: P.ocean, w: 1.6 },
    ],
  },
  surf: {
    tile: "#fbe0ae",
    parts: [
      { d: "M2 21c0-6.2 4.1-11.4 10.2-11.4 3.6 0 6.2 2.1 6.2 5.2-1.7-1.5-4.7-1.3-5.7 1.2-.7 1.8.3 3.5 2 5Z", fill: P.ocean },
      { d: "M12.2 9.6c3.6 0 6.2 2.1 6.2 5.2", stroke: P.paper, w: 1.4 },
      { d: "M15.6 3.6c2.6-1.1 5.1-.6 5.6.5.5 1.1-1 3-3.6 4.1l-6.1 2.5c-.8.3-1.6-.6-1-1.3Z", fill: P.sunset },
      { d: "M12.6 9.2 19.8 4.4", stroke: P.paper, w: 1 },
    ],
  },
  dive: {
    tile: P.oceanDeep,
    parts: [
      { d: "M2.6 13c2.6-4.2 7.8-5.2 12.4-2.1l4.2-3.1v10.4L15 15.1c-4.6 3.1-9.8 2.1-12.4-2.1Z", fill: P.saffron },
      { d: "M9.4 9.4c-.8 2.4-.8 4.8 0 7.2", stroke: P.sunset, w: 1.3 },
      { d: "M6 12.2a.9.9 0 1 0 1.8 0 .9.9 0 0 0-1.8 0Z", fill: P.ink },
      { d: "M18.4 3.9a1.3 1.3 0 1 0 2.6 0 1.3 1.3 0 0 0-2.6 0ZM15.6 2.6a.8.8 0 1 0 1.6 0 .8.8 0 0 0-1.6 0Z", stroke: P.paper, w: 1 },
    ],
  },
  rainforest: {
    tile: "#dcebd5",
    parts: [
      { d: "M12 21.5V10.5", stroke: P.jungle, w: 1.6 },
      { d: "M12 12.2C8 12.2 4.5 9.6 3.5 5c4 .2 7.6 2.6 8.5 7.2Z", fill: P.leaf },
      { d: "M12 10.4c.8-4.3 4.1-7.1 8.6-7.3-.6 4.5-3.9 7.3-8.6 7.3Z", fill: P.jungle },
      { d: "M12 15.6c3-.3 6.1 1 7.6 4.1-3.1.4-6.1-1-7.6-4.1Z", fill: P.jungle },
      { d: "M12 17.4c-2.6-.6-5.4.4-7 3 2.8.6 5.5-.5 7-3Z", fill: P.leaf },
    ],
  },
  waterfall: {
    tile: "#dcebd5",
    parts: [
      { d: "M2 21V7.2c2.2-1.1 4.8-1.1 7 0V21ZM15 21V7.2c2.2-1.1 4.8-1.1 7 0V21Z", fill: P.jungle },
      { d: "M9 7.4h6V18H9Z", fill: P.aqua },
      { d: "M10.6 8.4v8.4M13.4 8.4v8.4", stroke: P.paper, w: 1.2 },
      { d: "M4.6 21.4c2.2-2.6 12.6-2.6 14.8 0Z", fill: P.ocean },
    ],
  },
  tea: {
    tile: P.jungle,
    parts: [
      { d: "M3.8 10.4h12.4v3.6a6.2 6.2 0 0 1-12.4 0Z", fill: P.paper },
      { d: "M16.2 11.4h1.4a2.5 2.5 0 0 1 0 5h-2", stroke: P.paper, w: 1.6 },
      { d: "M3.8 10.4h12.4v1.5H3.8Z", fill: P.tea },
      { d: "M2 21h16", stroke: P.sand, w: 1.6 },
      { d: "M12.6 7.6c0-3.2 2.6-5.3 6.4-5.3 0 3.6-2.6 5.6-6.4 5.3Z", fill: P.leaf },
    ],
  },
  train: {
    tile: P.sand,
    parts: [
      { d: "M1 21v-7.6h22V21h-2.6v-2.4a2.6 2.6 0 0 0-5.2 0V21h-2.4v-2.4a2.6 2.6 0 0 0-5.2 0V21H5.2v-2.4", fill: P.saffronLight, stroke: P.saffronLight, w: 0.2 },
      { d: "M3.6 7h12.8l3 3V13H3.6Z", fill: P.ocean },
      { d: "M5.6 8.4h2.6v1.7H5.6ZM9.6 8.4h2.6v1.7H9.6ZM13.6 8.4h2.4v1.7h-2.4Z", fill: P.paper },
      { d: "M1 13.4h22", stroke: P.sunset, w: 1.2 },
    ],
  },
  culture: {
    tile: P.oceanDeep,
    parts: [
      { d: "M9.4 8.2h5.2l1.3 12H8.1Z", fill: P.paper },
      { d: "M8.9 13.1h6.2l.3 2.4H8.6Z", fill: P.sunset },
      { d: "M10 5.2h4v3h-4Z", fill: P.saffron },
      { d: "M9.4 5.2 12 2.6l2.6 2.6Z", fill: P.sand },
      { d: "M5 20.2h14v1.6H5Z", fill: P.sand },
      { d: "M15.4 6.2 21 4.6M15.4 7.2 21 8.8", stroke: P.saffronLight, w: 1.2 },
    ],
  },
  food: {
    tile: "#fbe0ae",
    parts: [
      { d: "M9 7.2c-1-1.5 1-2.6 0-4.2M13 7.2c-1-1.5 1-2.6 0-4.2", stroke: P.sunset, w: 1.4 },
      { d: "M5 12.2c1.1-2.1 3.3-3.2 7-3.2s5.9 1.1 7 3.2Z", fill: P.paper },
      { d: "M3 12.2h18c0 4.7-4 8.2-9 8.2s-9-3.5-9-8.2Z", fill: P.sunset },
      { d: "M6.4 15.4c3.6 1.4 7.6 1.4 11.2 0", stroke: P.saffronLight, w: 1.2 },
    ],
  },
  fireworks: {
    tile: "#1a1638",
    parts: [
      { d: "M13 9.5V3M13 9.5 17.6 4.9M13 9.5H19.5M13 9.5 17.6 14.1M13 9.5 8.4 4.9M13 9.5H6.5", stroke: P.saffron, w: 1.6 },
      { d: "M6 17.5v-3.6M6 17.5l2.6-2.6M6 17.5H9.6M6 17.5l2.6 2.6M6 17.5V21.1M6 17.5 3.4 20.1M6 17.5H2.4M6 17.5 3.4 14.9", stroke: P.pink, w: 1.3 },
      { d: "M18.4 18.6a1 1 0 1 0 2 0 1 1 0 0 0-2 0Z", fill: P.saffronLight },
    ],
  },
  wellness: {
    tile: "#fde3ec",
    parts: [
      { d: "M12 19.8c-3.5-.5-7-3-7.5-7.6 3 .2 6.1 2.6 7.5 7.6ZM12 19.8c3.5-.5 7-3 7.5-7.6-3 .2-6.1 2.6-7.5 7.6Z", fill: P.pink },
      { d: "M12 19.8c-2.6-2.6-3.1-7.2 0-11.2 3.1 4 2.6 8.6 0 11.2Z", fill: P.hibiscus },
      { d: "M3 21.4h18", stroke: P.ocean, w: 1.6 },
    ],
  },
  ski: {
    tile: "#d9e8f5",
    parts: [
      { d: "M1 22.5 23 9.5v13Z", fill: P.paper },
      { d: "M21.2 11.2c-2.6 1.4-.4 3-3.6 4.1-2.6.9-.6 2.8-4.4 3.6-2.2.5-3.6 1.4-4.8 2.6", stroke: P.ocean, w: 1.4 },
      { d: "M17.6 3.1a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0Z", fill: P.sunset },
      { d: "M18.8 5.4 16.6 9l2.6 1.6M16.6 9l-2.8.6M17.4 6.8l2.6.8", stroke: P.ink, w: 1.5 },
      { d: "M12.6 12.4 21 10", stroke: P.sunset, w: 1.6 },
    ],
  },
  mountain: {
    tile: "#d9e8f5",
    parts: [
      { d: "M18.6 5.4a2.2 2.2 0 1 0 4.4 0 2.2 2.2 0 0 0-4.4 0Z", fill: P.saffron },
      { d: "M1 21.5 9 7.6l4.1 6.6 2.7-3.7 7.2 11Z", fill: P.oceanDeep },
      { d: "M9 7.6l2.5 4-1.4-.6-1.1 1.3-1-1.3-1.5.7ZM15.8 10.5l1.8 2.7-1.1-.4-.8.9-.9-.8-.8.3Z", fill: P.paper },
    ],
  },
  games: {
    tile: P.dusk,
    parts: [
      { d: "M7 3c1.3 0 2 1 2 2.3 0 1-.6 1.6-.6 2.6 0 1.5 1.6 3 1.6 6.1 0 3-1.3 6-3 6s-3-3-3-6c0-3.1 1.6-4.6 1.6-6.1 0-1-.6-1.6-.6-2.6C5 4 5.7 3 7 3Z", fill: P.paper },
      { d: "M5.6 8.6h2.8", stroke: P.sunset, w: 1.3 },
      { d: "M11.4 15.6a5.2 5.2 0 1 0 10.4 0 5.2 5.2 0 0 0-10.4 0Z", fill: P.hibiscus },
      { d: "M15.3 13.6a.8.8 0 1 0 1.6 0 .8.8 0 0 0-1.6 0ZM17.6 13.2a.8.8 0 1 0 1.6 0 .8.8 0 0 0-1.6 0ZM16.6 15.6a.8.8 0 1 0 1.6 0 .8.8 0 0 0-1.6 0Z", fill: P.dusk },
    ],
  },
};
