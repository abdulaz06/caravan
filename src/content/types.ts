export type RegionId =
  | "airport"
  | "colombo"
  | "negombo"
  | "kandy"
  | "bentota"
  | "hikkaduwa"
  | "galle"
  | "mirissa"
  | "hiriketiya";

/** The two bases every trip is split into: Colombo first, then Galle. */
export type BaseId = "colombo" | "galle";

export type Slot = "day" | "night";
export type Vibe = -2 | -1 | 0 | 1 | 2;

export type Photo = {
  src: string; // local path under /public
  credit: string; // author
  source: string; // Wikimedia Commons / Unsplash page
  license: string;
  width?: number;
  height?: number;
  blurDataURL?: string;
};

/** One way of getting to a day trip (e.g. Kandy by train or by road). */
export type TransportChoice = {
  mode: "train" | "road";
  title: string; // "Scenic train"
  out: string; // "Colombo Fort → Kandy"
  back: string; // "Kandy → Colombo Fort"
  hours: number; // each way
  label: string; // "~2.5 hrs each way"
  detail: string;
  costUsd: [number, number]; // per person, return
};

export type CourseHole = { venue: string; area: string; par: number; note?: string };

export type Option = {
  id: string;
  slot: Slot;
  base: BaseId;
  title: string;
  region: RegionId;
  /** Hours each way from the base, if it differs from the region's drive time. */
  travelFromBase?: number;
  tagline: string;
  description: string;
  highlights: string[];
  duration: string;
  estCostUsd?: [number, number]; // per person
  vibe: Vibe; // -2 pure nature/adventure … +2 pure nightlife
  intensity?: "easy" | "moderate" | "tough";
  tags: string[];
  images: Photo[]; // first = cover
  /** Honest caveat shown in the detail sheet (seasonality, schedules…). */
  goodToKnow?: string;
  /** Days of the week it runs (0 = Sun … 6 = Sat). Omit = every day. */
  availableDays?: number[];
  /** Day trips where people choose train vs road. */
  transport?: { train: TransportChoice; road: TransportChoice };
  /** A fun rules card in the detail view (e.g. Pub Golf). */
  rules?: { title: string; items: string[] };
  course?: CourseHole[];
};

/** Smaller extras that can be attached to any pick in the same base and time of day. */
export type AddOn = {
  id: string;
  base: BaseId;
  slots: Slot[];
  title: string;
  venue: string;
  region: RegionId;
  emoji: string;
  tagline: string;
  description: string;
  duration: string;
  estCostUsd: [number, number]; // per person
  tags: string[];
  images: Photo[];
  goodToKnow?: string;
};

export type Pair = {
  id: string;
  slot: Slot | "nye";
  base: BaseId;
  a: string; // option id
  b: string; // option id
  theme?: string;
};

export type Region = {
  id: RegionId;
  name: string;
  short: string;
  blurb: string;
  /** approx. coordinates, used for the route map */
  lat: number;
  lng: number;
  images: Photo[];
};
