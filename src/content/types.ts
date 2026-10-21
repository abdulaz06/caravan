export type RegionId =
  | "airport"
  | "colombo"
  | "mount-lavinia"
  | "negombo"
  | "kalutara"
  | "bentota"
  | "kosgoda"
  | "balapitiya"
  | "ambalangoda"
  | "hikkaduwa"
  | "galle"
  | "unawatuna"
  | "koggala"
  | "ahangama"
  | "weligama"
  | "mirissa"
  | "madiha"
  | "hiriketiya"
  | "mulkirigala"
  | "kottawa"
  | "hiyare"
  | "kanneliya"
  | "sinharaja"
  | "udawalawe"
  | "ella";

/**
 * Where an activity can be picked:
 * - colombo: Day 1 (the only Colombo day)
 * - enroute: Day 2 daytime, stops along the coast road to Galle
 * - galle:   Day 2 evening and Days 3–5 (the Galle base)
 */
export type Where = "colombo" | "enroute" | "galle";

export type Slot = "day" | "night";
export type Vibe = -2 | -1 | 0 | 1 | 2;

/** Catalog filter categories ("chill" also covers Stay in). */
export type Category = "adventure" | "water" | "nature" | "culture" | "food" | "party" | "chill";

export type Photo = {
  src: string; // local path under /public
  credit: string; // author
  source: string; // Wikimedia Commons / Unsplash page
  license: string;
  width?: number;
  height?: number;
  blurDataURL?: string;
};

export type Source = { label: string; url: string };

export type CourseHole = { venue: string; area: string; par: number; note?: string };

/**
 * Anything that can go in a Daytime or Evening slot: curated options (which
 * appear in the A-vs-B matchups) and smaller Quick extras (catalog only).
 */
export type Activity = {
  id: string;
  /** "halal" = a wholesome stand-in only used by Halal mode (never in the catalog). */
  kind: "option" | "extra" | "halal";
  /** Options have exactly one slot; extras may fit both. */
  slots: Slot[];
  where: Where[];
  title: string;
  region: RegionId;
  /** Quick extras: who/where runs it ("Playdium, One Galle Face"). */
  venue?: string;
  emoji?: string;
  categories: Category[];
  tagline: string;
  /** "Why people love it" — distilled from recent traveller reviews. */
  loved: string;
  description: string;
  highlights: string[];
  duration: string;
  /** Rough hours it takes on the day (for slot time totals). */
  hours: number;
  estCostUsd: [number, number]; // per person
  vibe: Vibe; // -2 pure nature/adventure … +2 pure nightlife
  intensity?: "easy" | "moderate" | "tough";
  tags: string[];
  images: Photo[]; // first = cover
  sources: Source[];
  /** Honest caveat shown in the detail sheet (seasonality, schedules…). */
  goodToKnow?: string;
  /** Days of the week it runs (0 = Sun … 6 = Sat). Omit = every day. */
  availableDays?: number[];
  /** A fun rules card in the detail view (e.g. Pub Golf). */
  rules?: { title: string; items: string[] };
  course?: CourseHole[];
  /** En-route stops: km from Colombo along the coast road (A2). */
  routeKm?: number;
  /** Nightlife items: the wholesome stand-in shown in Halal mode (an activity id). */
  halalSwap?: string;
  /** Only placeable on days with this role (the Ella day trip: Galle days 3–5). */
  onlyRole?: "galle";
  /** Ways to do it the user picks between (stored as SlotItem.variant). First = default. */
  variants?: ActivityVariant[];
  /** What to pack (detail sheet). */
  bring?: string[];
  /** Extras that only make sense alongside another pick in the same slot (Ella extras need the Ella day trip). */
  onlyWith?: string;
  /** A quoted private-van price for the round trip (per van), used instead of the hourly estimate. */
  vanRoundTripUsd?: [number, number];
};

/** One way of doing a multi-variant option (Ella: sunrise at Little Adam's Peak vs an easy morning). */
export type ActivityVariant = {
  id: string;
  title: string;
  emoji: string;
  /** One line under the title in the chooser. */
  summary: string;
  /** Times through the day, shown as a little schedule. */
  schedule: { time: string; text: string }[];
  /** Hours there (the drives come from the travel model). */
  hours: number;
  /** When the van leaves Galle, e.g. "~12:30am". */
  leave: string;
  /** Door to door, e.g. "~14 hrs". */
  total: string;
  /** Honest trade-offs. */
  honest: string[];
  /** A soft note on the previous evening (no lock), e.g. an early night before a very early start. */
  eveBefore?: string;
  /** A note on the same day's evening (rest / back late). */
  eveningNote: string;
};

/** Kept for readability where only curated options make sense. */
export type Option = Activity;

export type Pair = {
  id: string;
  slot: Slot | "nye";
  where: Where;
  a: string; // option id
  b: string; // option id
  theme?: string;
};

export type Region = {
  id: RegionId;
  name: string;
  short: string;
  blurb: string;
  /** approx. coordinates, used for drive-time estimates and the route map */
  lat: number;
  lng: number;
  images: Photo[];
};
