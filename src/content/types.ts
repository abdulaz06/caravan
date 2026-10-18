export type RegionId =
  | "airport"
  | "negombo"
  | "colombo"
  | "hikkaduwa"
  | "galle"
  | "mirissa"
  | "yala"
  | "ella"
  | "nuwara-eliya"
  | "kandy"
  | "sigiriya";

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

export type Option = {
  id: string;
  slot: Slot;
  title: string;
  region: RegionId;
  tagline: string;
  description: string;
  highlights: string[];
  duration: string;
  estCostUsd?: [number, number]; // per person
  vibe: Vibe; // -2 pure nature/adventure … +2 pure nightlife
  intensity?: "easy" | "moderate" | "tough";
  tags: string[];
  images: Photo[]; // first = cover
  /** Optional honest caveat shown in the detail sheet (seasonality, schedules…) */
  goodToKnow?: string;
};

export type Pair = {
  id: string;
  slot: Slot | "nye";
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
