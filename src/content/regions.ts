import { photos } from "./photos.generated";
import type { Photo, Region, RegionId } from "./types";

/**
 * Towns and places activities happen in. Coordinates drive the travel-time
 * estimates (see `travelHours`) and the route map. Region photos fall back to
 * a matching activity's photos when there's no dedicated region shot.
 */
const pics = (...keys: string[]): Photo[] => {
  for (const k of keys) if (photos[k]?.length) return photos[k];
  return [];
};

const R = (
  id: RegionId,
  name: string,
  short: string,
  lat: number,
  lng: number,
  blurb: string,
  ...photoKeys: string[]
): Region => ({ id, name, short, lat, lng, blurb, images: pics(...photoKeys) });

export const regions: Record<RegionId, Region> = {
  airport: R("airport", "Colombo Airport (CMB)", "CMB airport", 7.18, 79.884, "Bandaranaike International, Katunayake — where the trip begins and ends.", "region-airport"),
  colombo: R("colombo", "Colombo", "Colombo", 6.927, 79.861, "The capital: rooftop bars, street food, casinos and Bawa's design legacy.", "region-colombo"),
  "mount-lavinia": R("mount-lavinia", "Mount Lavinia", "Mount Lavinia", 6.838, 79.863, "Colombo's beach suburb and its 1806 governor's mansion.", "mount-lavinia-beach", "region-colombo"),
  negombo: R("negombo", "Negombo", "Negombo", 7.208, 79.836, "Lagoon fishing town by the airport.", "region-negombo"),
  kalutara: R("kalutara", "Kalutara", "Kalutara", 6.583, 79.96, "River-mouth town with a hollow white stupa, 40 km down the coast.", "kalutara-bodhiya", "region-bentota"),
  bentota: R("bentota", "Bentota", "Bentota", 6.421, 79.998, "Golden beach and the island's water-sports river.", "region-bentota"),
  kosgoda: R("kosgoda", "Kosgoda", "Kosgoda", 6.332, 80.027, "Turtle-hatchery beaches south of Bentota.", "kosgoda-turtles", "region-bentota"),
  balapitiya: R("balapitiya", "Balapitiya · Madu River", "Madu River", 6.278, 80.05, "Mangrove lagoon of islands and cinnamon gardens.", "madu-river-safari", "region-bentota"),
  ambalangoda: R("ambalangoda", "Ambalangoda", "Ambalangoda", 6.235, 80.054, "Sri Lanka's mask-carving town.", "ambalangoda-masks", "region-bentota"),
  hikkaduwa: R("hikkaduwa", "Hikkaduwa", "Hikkaduwa", 6.14, 80.101, "Reef, turtles and a long party beach, 30 minutes north of Galle.", "region-hikkaduwa"),
  galle: R("galle", "Galle", "Galle", 6.027, 80.217, "A walled Dutch fort town on the sea — our base for four nights.", "region-galle"),
  unawatuna: R("unawatuna", "Unawatuna & Dalawella", "Unawatuna", 6.01, 80.249, "Sheltered swimming bay and party beach, 15 minutes from Galle.", "unawatuna-jungle-beach", "region-galle"),
  koggala: R("koggala", "Koggala", "Koggala", 5.993, 80.323, "Lagoon islands, stilt fishermen and a folk museum.", "koggala-lake-safari", "region-galle"),
  ahangama: R("ahangama", "Ahangama & Midigama", "Ahangama", 5.973, 80.37, "Surf breaks, café culture and the coolest little party scene.", "ahangama-cafes-yoga", "region-mirissa"),
  weligama: R("weligama", "Weligama", "Weligama", 5.974, 80.429, "A wide beginner surf bay and its rooftop bars.", "weligama-surf-lesson", "region-mirissa"),
  mirissa: R("mirissa", "Mirissa", "Mirissa", 5.946, 80.459, "Whales, palm-fringed coves and beach bars.", "region-mirissa"),
  madiha: R("madiha", "Madiha", "Madiha", 5.937, 80.508, "Surf point and party villa just east of Mirissa.", "doctors-house-madiha", "region-mirissa"),
  hiriketiya: R("hiriketiya", "Hiriketiya & Dikwella", "Hiriketiya", 5.964, 80.705, "A horseshoe surf cove with Asia's best bar and a Friday jungle party.", "region-hiriketiya"),
  mulkirigala: R("mulkirigala", "Mulkirigala", "Mulkirigala", 6.12, 80.738, "A rock monastery of cave temples, inland from Dikwella.", "mulkirigala-climb"),
  kottawa: R("kottawa", "Kottawa rainforest", "Kottawa", 6.097, 80.336, "A pocket of lowland rainforest half an hour inland.", "kottawa-rainforest"),
  hiyare: R("hiyare", "Hiyare reservoir", "Hiyare", 6.063, 80.312, "Rainforest around a 100-year-old reservoir.", "hiyare-rainforest"),
  kanneliya: R("kanneliya", "Kanneliya Forest Reserve", "Kanneliya", 6.252, 80.343, "UNESCO biosphere rainforest with waterfalls.", "kanneliya-trek"),
  sinharaja: R("sinharaja", "Sinharaja (Deniyaya side)", "Sinharaja", 6.385, 80.555, "Sri Lanka's last great rainforest, a World Heritage Site.", "sinharaja-day-trip"),
  udawalawe: R("udawalawe", "Udawalawe National Park", "Udawalawe", 6.474, 80.898, "Open grassland where elephant herds are almost guaranteed.", "udawalawe-safari"),
};

export const regionList = Object.values(regions);

// ── Travel times ──────────────────────────────────────────────────────

/** Known private-van times (hours) that beat the distance estimate, e.g. expressway legs. */
const KNOWN: [RegionId, RegionId, number][] = [
  ["airport", "colombo", 1],
  ["airport", "negombo", 0.5],
  ["airport", "galle", 2.5],
  ["colombo", "negombo", 1],
  ["colombo", "mount-lavinia", 0.5],
  ["colombo", "bentota", 1.5],
  ["colombo", "galle", 2],
  ["galle", "mirissa", 1],
  ["galle", "kanneliya", 1.25],
  ["galle", "hiriketiya", 1.75],
  ["galle", "sinharaja", 2.75],
  ["galle", "udawalawe", 2.5],
];

const key = (a: RegionId, b: RegionId) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const known = new Map(KNOWN.map(([a, b, h]) => [key(a, b), h]));

function km(a: RegionId, b: RegionId): number {
  const A = regions[a];
  const B = regions[b];
  const rad = Math.PI / 180;
  const dLat = (B.lat - A.lat) * rad;
  const dLng = (B.lng - A.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(A.lat * rad) * Math.cos(B.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/**
 * Approx. private-van hours between two places: a known value where we have
 * one, otherwise straight-line distance × 1.25 at ~40 km/h (south-coast
 * roads), rounded to the quarter hour.
 */
export function travelHours(a: RegionId, b: RegionId): number {
  if (a === b) return 0;
  const k = known.get(key(a, b));
  if (k !== undefined) return k;
  const h = (km(a, b) * 1.25) / 40 + 0.05;
  return Math.max(0.25, Math.round(h * 4) / 4);
}

const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** "~15 min", "~45 min", "~1 hr", "~2.5 hrs", "~1.5–2 hrs" (odd quarter hours show as a range). */
export function formatHours(h: number): string {
  if (h <= 0.25) return "~15 min";
  if (h <= 0.5) return "~30 min";
  if (h < 1) return "~45 min";
  if (h === 1) return "~1 hr";
  const quarter = Math.round(h * 4) % 2 === 1;
  if (quarter) return `~${num(h - 0.25)}–${num(h + 0.25)} hrs`;
  return `~${num(h)} hrs`;
}

// ── The two places we sleep ───────────────────────────────────────────

export type Stay = {
  id: "colombo" | "galle";
  name: string;
  region: RegionId;
  tagline: string;
  covers: string;
  images: Photo[];
};

export const stays: Record<"colombo" | "galle", Stay> = {
  colombo: {
    id: "colombo",
    name: "Colombo",
    region: "colombo",
    tagline: "One night in the capital: street food, rooftops, casinos",
    covers: "Colombo, Mount Lavinia and Negombo (by the airport)",
    images: pics("region-colombo"),
  },
  galle: {
    id: "galle",
    name: "Galle",
    region: "galle",
    tagline: "Four nights on the south coast: fort, beaches, whales, parties",
    covers: "Galle Fort, Unawatuna, Hikkaduwa, Koggala, Ahangama, Weligama, Mirissa, Hiriketiya + the rainforests inland",
    images: pics("region-galle"),
  },
};

// ── The coast road, Colombo → Galle (Day 2) ────────────────────────────

/** Towns along the A2 coast road with km from Colombo, for the en-route strip. */
export const COAST_ROAD: { region: RegionId; km: number }[] = [
  { region: "colombo", km: 0 },
  { region: "kalutara", km: 42 },
  { region: "bentota", km: 62 },
  { region: "kosgoda", km: 72 },
  { region: "balapitiya", km: 80 },
  { region: "ambalangoda", km: 87 },
  { region: "hikkaduwa", km: 98 },
  { region: "galle", km: 116 },
];
export const COAST_ROAD_KM = 116;

// ── Fixed travel legs ─────────────────────────────────────────────────

export type FixedLeg = {
  id: "arrival" | "transfer" | "coast" | "departure";
  from: RegionId;
  to: RegionId;
  title: string;
  hours: number;
  label: string;
  detail?: string;
  /** Per van; split across the group in the budget tracker. */
  vanCostUsd: [number, number];
};

export const LEGS: Record<FixedLeg["id"], FixedLeg> = {
  arrival: {
    id: "arrival",
    from: "airport",
    to: "colombo",
    title: "CMB → Colombo",
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
    detail: "Straight down the Southern Expressway. Pick a stop or two above to take the coast road instead.",
    vanCostUsd: [65, 95],
  },
  coast: {
    id: "coast",
    from: "colombo",
    to: "galle",
    title: "Road trip · Colombo → Galle along the coast",
    hours: 3.75,
    label: "~3.5–4 hrs driving + stops",
    detail: "The old Galle Road hugs the sea the whole way — slower than the expressway, but that's where the stops are.",
    vanCostUsd: [90, 130],
  },
  departure: {
    id: "departure",
    from: "galle",
    to: "airport",
    title: "Road trip · Galle → CMB airport",
    hours: 2.5,
    label: "~2.5 hrs",
    detail: "Southern + Outer Circular + Airport expressways. Leave ~4 hrs before your flight.",
    vanCostUsd: [85, 115],
  },
};
