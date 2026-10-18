import { photos } from "./photos.generated";
import type { Region, RegionId } from "./types";

/**
 * Regions used by every option. Travel times below are approximate private-van
 * drive times in hours (December traffic, expressways where they exist).
 * Edit freely — the matrix is symmetric, so each pair is listed once.
 */
export const regions: Record<RegionId, Region> = {
  airport: {
    id: "airport",
    name: "Colombo Airport (CMB)",
    short: "Airport",
    blurb: "Bandaranaike International, Katunayake — where the road trip begins.",
    lat: 7.18,
    lng: 79.884,
    images: photos["region-airport"],
  },
  negombo: {
    id: "negombo",
    name: "Negombo",
    short: "Negombo",
    blurb: "Lagoon fishing town 20 minutes from the airport. Easy first or last night.",
    lat: 7.208,
    lng: 79.836,
    images: photos["region-negombo"],
  },
  colombo: {
    id: "colombo",
    name: "Colombo",
    short: "Colombo",
    blurb: "The capital: rooftop bars, street food, colonial buildings and the best clubs.",
    lat: 6.927,
    lng: 79.861,
    images: photos["region-colombo"],
  },
  hikkaduwa: {
    id: "hikkaduwa",
    name: "Hikkaduwa",
    short: "Hikkaduwa",
    blurb: "Reef, turtles and a long party beach on the south-west coast.",
    lat: 6.14,
    lng: 80.106,
    images: photos["region-hikkaduwa"],
  },
  galle: {
    id: "galle",
    name: "Galle & Unawatuna",
    short: "Galle",
    blurb: "A walled Dutch fort town next to Unawatuna's sheltered party bay.",
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
  yala: {
    id: "yala",
    name: "Yala & Tissa",
    short: "Yala",
    blurb: "Dry-zone jungle with the world's densest leopard population.",
    lat: 6.29,
    lng: 81.33,
    images: photos["region-yala"],
  },
  ella: {
    id: "ella",
    name: "Ella",
    short: "Ella",
    blurb: "A misty hill-country village of hikes, tea, waterfalls and the Nine Arches.",
    lat: 6.867,
    lng: 81.047,
    images: photos["region-ella"],
  },
  "nuwara-eliya": {
    id: "nuwara-eliya",
    name: "Nuwara Eliya",
    short: "Nuwara Eliya",
    blurb: "'Little England' at 1,900 m — tea estates, cool nights and cloud forest.",
    lat: 6.95,
    lng: 80.789,
    images: photos["region-nuwara-eliya"],
  },
  kandy: {
    id: "kandy",
    name: "Kandy",
    short: "Kandy",
    blurb: "The last royal capital, around a lake and the Temple of the Tooth.",
    lat: 7.291,
    lng: 80.634,
    images: photos["region-kandy"],
  },
  sigiriya: {
    id: "sigiriya",
    name: "Sigiriya & Dambulla",
    short: "Sigiriya",
    blurb: "The Cultural Triangle: rock fortresses, cave temples and wild elephants.",
    lat: 7.957,
    lng: 80.76,
    images: photos["region-sigiriya"],
  },
};

export const regionList = Object.values(regions);

/** Approx. private-van hours between regions (listed once; looked up both ways). */
const DRIVE: [RegionId, RegionId, number][] = [
  ["airport", "negombo", 0.5],
  ["airport", "colombo", 1],
  ["airport", "hikkaduwa", 2.5],
  ["airport", "galle", 2.5],
  ["airport", "mirissa", 3],
  ["airport", "yala", 4.5],
  ["airport", "ella", 6],
  ["airport", "nuwara-eliya", 5],
  ["airport", "kandy", 3],
  ["airport", "sigiriya", 4],

  ["negombo", "colombo", 1],
  ["negombo", "hikkaduwa", 2.5],
  ["negombo", "galle", 2.5],
  ["negombo", "mirissa", 3],
  ["negombo", "yala", 4.5],
  ["negombo", "ella", 6],
  ["negombo", "nuwara-eliya", 5],
  ["negombo", "kandy", 3],
  ["negombo", "sigiriya", 3.5],

  ["colombo", "hikkaduwa", 2],
  ["colombo", "galle", 2],
  ["colombo", "mirissa", 2.5],
  ["colombo", "yala", 4],
  ["colombo", "ella", 5.5],
  ["colombo", "nuwara-eliya", 5],
  ["colombo", "kandy", 3],
  ["colombo", "sigiriya", 4],

  ["hikkaduwa", "galle", 0.5],
  ["hikkaduwa", "mirissa", 1.5],
  ["hikkaduwa", "yala", 3.5],
  ["hikkaduwa", "ella", 5],
  ["hikkaduwa", "nuwara-eliya", 6],
  ["hikkaduwa", "kandy", 4.5],
  ["hikkaduwa", "sigiriya", 5.5],

  ["galle", "mirissa", 1],
  ["galle", "yala", 3],
  ["galle", "ella", 4.5],
  ["galle", "nuwara-eliya", 5.5],
  ["galle", "kandy", 4.5],
  ["galle", "sigiriya", 5.5],

  ["mirissa", "yala", 2.5],
  ["mirissa", "ella", 4],
  ["mirissa", "nuwara-eliya", 5],
  ["mirissa", "kandy", 5],
  ["mirissa", "sigiriya", 6],

  ["yala", "ella", 2],
  ["yala", "nuwara-eliya", 4],
  ["yala", "kandy", 5.5],
  ["yala", "sigiriya", 6],

  ["ella", "nuwara-eliya", 2.5],
  ["ella", "kandy", 5],
  ["ella", "sigiriya", 5.5],

  ["nuwara-eliya", "kandy", 3],
  ["nuwara-eliya", "sigiriya", 5],

  ["kandy", "sigiriya", 2.5],
];

/** Scenic-rail alternatives worth mentioning on a road-trip segment. */
const TRAIN: [RegionId, RegionId, string][] = [
  ["kandy", "ella", "Or ride the famous Kandy → Ella train (~7 hrs) through tea country"],
  ["kandy", "nuwara-eliya", "Or take the scenic hill-country train to Nanu Oya (~4 hrs)"],
  ["nuwara-eliya", "ella", "Or the scenic train from Nanu Oya to Ella (~3 hrs)"],
  ["colombo", "kandy", "Or the train (~3 hrs) climbing up through the hills"],
  ["colombo", "galle", "Or the coastal train (~2.5 hrs) right along the ocean"],
  ["colombo", "hikkaduwa", "Or the coastal train (~2 hrs) right along the ocean"],
];

const key = (a: RegionId, b: RegionId) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const driveMap = new Map(DRIVE.map(([a, b, h]) => [key(a, b), h]));
const trainMap = new Map(TRAIN.map(([a, b, note]) => [key(a, b), note]));

export function travelHours(a: RegionId, b: RegionId): number {
  if (a === b) return 0;
  return driveMap.get(key(a, b)) ?? 4;
}

export function trainNote(a: RegionId, b: RegionId): string | undefined {
  return trainMap.get(key(a, b));
}

export function formatHours(h: number): string {
  if (h <= 0.5) return "~30 min";
  if (h < 1) return "~45 min";
  return `~${Number.isInteger(h) ? h : h.toFixed(1)} hr${h === 1 ? "" : "s"}`;
}
