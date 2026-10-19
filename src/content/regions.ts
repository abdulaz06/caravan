import { photos } from "./photos.generated";
import type { BaseId, Region, RegionId } from "./types";

/**
 * Regions used by options. Travel times below are approximate private-van
 * times in hours (December traffic, Southern Expressway where it helps).
 * The matrix is symmetric, so each pair is listed once.
 */
export const regions: Record<RegionId, Region> = {
  airport: {
    id: "airport",
    name: "Colombo Airport (CMB)",
    short: "CMB airport",
    blurb: "Bandaranaike International, Katunayake — where the trip begins and ends.",
    lat: 7.18,
    lng: 79.884,
    images: photos["region-airport"],
  },
  colombo: {
    id: "colombo",
    name: "Colombo",
    short: "Colombo",
    blurb: "The capital: rooftop bars, street food, Bawa's design legacy and the best clubs.",
    lat: 6.927,
    lng: 79.861,
    images: photos["region-colombo"],
  },
  negombo: {
    id: "negombo",
    name: "Negombo",
    short: "Negombo",
    blurb: "Lagoon fishing town by the airport, an hour north of Colombo.",
    lat: 7.208,
    lng: 79.836,
    images: photos["region-negombo"],
  },
  kandy: {
    id: "kandy",
    name: "Kandy",
    short: "Kandy",
    blurb: "The last royal capital, around a lake and the Temple of the Tooth — a day trip from Colombo.",
    lat: 7.291,
    lng: 80.634,
    images: photos["region-kandy"],
  },
  bentota: {
    id: "bentota",
    name: "Bentota & Madu River",
    short: "Bentota",
    blurb: "Golden beach, river water sports and mangrove lagoons between Colombo and Galle.",
    lat: 6.42,
    lng: 79.998,
    images: photos["region-bentota"],
  },
  hikkaduwa: {
    id: "hikkaduwa",
    name: "Hikkaduwa",
    short: "Hikkaduwa",
    blurb: "Reef, turtles and a long party beach, 30 minutes north of Galle.",
    lat: 6.14,
    lng: 80.106,
    images: photos["region-hikkaduwa"],
  },
  galle: {
    id: "galle",
    name: "Galle & Unawatuna",
    short: "Galle",
    blurb: "A walled Dutch fort town next to Unawatuna's sheltered party bay. Base #2.",
    lat: 6.027,
    lng: 80.217,
    images: photos["region-galle"],
  },
  mirissa: {
    id: "mirissa",
    name: "Mirissa & Weligama",
    short: "Mirissa",
    blurb: "Whales, surf breaks, palm-fringed coves and the south coast's party circuit.",
    lat: 5.948,
    lng: 80.472,
    images: photos["region-mirissa"],
  },
  hiriketiya: {
    id: "hiriketiya",
    name: "Hiriketiya & Dikwella",
    short: "Hiriketiya",
    blurb: "A horseshoe surf cove east of Mirissa with a cult jungle party on Fridays.",
    lat: 5.964,
    lng: 80.705,
    images: photos["region-hiriketiya"],
  },
};

export const regionList = Object.values(regions);

/** Approx. private-van hours between regions (listed once; looked up both ways). */
const DRIVE: [RegionId, RegionId, number][] = [
  ["airport", "colombo", 1],
  ["airport", "negombo", 0.5],
  ["airport", "kandy", 3],
  ["airport", "bentota", 2],
  ["airport", "hikkaduwa", 2.25],
  ["airport", "galle", 2.5],
  ["airport", "mirissa", 3],
  ["airport", "hiriketiya", 3.25],

  ["colombo", "negombo", 1],
  ["colombo", "kandy", 3.25],
  ["colombo", "bentota", 1.5],
  ["colombo", "hikkaduwa", 1.75],
  ["colombo", "galle", 2],
  ["colombo", "mirissa", 2.5],
  ["colombo", "hiriketiya", 3],

  ["negombo", "kandy", 3],
  ["negombo", "bentota", 2],
  ["negombo", "hikkaduwa", 2.25],
  ["negombo", "galle", 2.5],
  ["negombo", "mirissa", 3],
  ["negombo", "hiriketiya", 3.25],

  ["kandy", "bentota", 4],
  ["kandy", "hikkaduwa", 4.25],
  ["kandy", "galle", 4.5],
  ["kandy", "mirissa", 5],
  ["kandy", "hiriketiya", 5.25],

  ["bentota", "hikkaduwa", 0.75],
  ["bentota", "galle", 1.25],
  ["bentota", "mirissa", 2],
  ["bentota", "hiriketiya", 2.5],

  ["hikkaduwa", "galle", 0.5],
  ["hikkaduwa", "mirissa", 1.5],
  ["hikkaduwa", "hiriketiya", 2.25],

  ["galle", "mirissa", 1],
  ["galle", "hiriketiya", 1.75],

  ["mirissa", "hiriketiya", 0.75],
];

const key = (a: RegionId, b: RegionId) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const driveMap = new Map(DRIVE.map(([a, b, h]) => [key(a, b), h]));

export function travelHours(a: RegionId, b: RegionId): number {
  if (a === b) return 0;
  return driveMap.get(key(a, b)) ?? 3;
}

const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** "~30 min", "~1 hr", "~2.5 hrs", "~1.5–2 hrs" (quarter hours show as a range). */
export function formatHours(h: number): string {
  if (h <= 0.25) return "~15 min";
  if (h <= 0.5) return "~30 min";
  if (h < 1) return "~45 min";
  if (h === 1) return "~1 hr";
  const quarter = Math.round(h * 4) % 2 === 1;
  if (quarter) return `~${num(h - 0.25)}–${num(h + 0.25)} hrs`;
  return `~${num(h)} hrs`;
}

// ── Bases ─────────────────────────────────────────────────────────────

export type Base = {
  id: BaseId;
  name: string;
  region: RegionId;
  tagline: string;
  /** Places options in this base cover, for copy. */
  covers: string;
  images: typeof photos[string];
};

export const bases: Record<BaseId, Base> = {
  colombo: {
    id: "colombo",
    name: "Colombo",
    region: "colombo",
    tagline: "City nights, street food & a Kandy day trip",
    covers: "Colombo, Mount Lavinia, Negombo + a Kandy day trip",
    images: photos["region-colombo"],
  },
  galle: {
    id: "galle",
    name: "Galle",
    region: "galle",
    tagline: "Fort, beaches, whales & the south-coast party circuit",
    covers: "Galle Fort, Unawatuna, Hikkaduwa, Koggala, Weligama, Mirissa, Hiriketiya, Bentota",
    images: photos["region-galle"],
  },
};

// ── Fixed travel legs ─────────────────────────────────────────────────

export type FixedLeg = {
  id: "arrival" | "transfer" | "departure";
  from: RegionId;
  to: RegionId;
  title: string;
  hours: number;
  label: string;
  detail?: string;
  stops?: { name: string; note: string }[];
  /** Per van; split across the group in the budget tracker. */
  vanCostUsd: [number, number];
};

export const LEGS: Record<"arrival" | "transfer" | "departure" | "departureFromColombo", FixedLeg> = {
  arrival: {
    id: "arrival",
    from: "airport",
    to: "colombo",
    title: "Land at Colombo airport (CMB) → Colombo",
    hours: 1,
    label: "~1 hr",
    detail: "Airport Expressway into the city; longer at rush hour.",
    vanCostUsd: [25, 40],
  },
  transfer: {
    id: "transfer",
    from: "colombo",
    to: "galle",
    title: "Road trip · Colombo → Galle",
    hours: 2,
    label: "~2 hrs",
    detail: "Southern Expressway, door to door. Taking the coast road instead adds ~1.5–2 hrs but lets you stop on the way:",
    stops: [
      { name: "Bentota beach", note: "lunch on the sand, river water sports" },
      { name: "Madu River, Balapitiya", note: "1-hr mangrove boat ride" },
      { name: "Kosgoda turtle hatchery", note: "baby turtles, ~30 min stop" },
    ],
    vanCostUsd: [65, 95],
  },
  departure: {
    id: "departure",
    from: "galle",
    to: "airport",
    title: "Road trip · Galle → Colombo airport (CMB)",
    hours: 2.5,
    label: "~2.5 hrs",
    detail: "Southern + Outer Circular + Airport expressways. Leave ~4 hrs before your flight.",
    vanCostUsd: [85, 115],
  },
  departureFromColombo: {
    id: "departure",
    from: "colombo",
    to: "airport",
    title: "Colombo → Colombo airport (CMB)",
    hours: 1,
    label: "~1 hr",
    detail: "Leave ~3 hrs before your flight.",
    vanCostUsd: [25, 40],
  },
};
