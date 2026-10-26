// A preset compiled for use: photos resolved, everything indexed by id, and
// the travel model ready to answer "how long from A to B?". Pure and
// memoised per preset, so the server and the browser build the same thing.
import { bannedIn } from "./family-words";
import type {
  ActivityVariant,
  PhotoSet,
  PresetActivity,
  PresetArea,
  PresetBase,
  PresetLeg,
  PresetPair,
  PresetRegion,
  PresetRoute,
  PresetSpecialDate,
  PresetTransfer,
  StayInCopy,
  TripPreset,
} from "./preset-schema";

export type Slot = "day" | "night";
export type Category = PresetActivity["categories"][number];
export type Vibe = PresetActivity["vibe"];

export type Photo = {
  /** Absolute URL path, e.g. /presets/sri-lanka/images/galle/galle-fort-1.webp */
  src: string;
  credit: string;
  source: string;
  license: string;
  width?: number;
  height?: number;
  blurDataURL?: string;
};

type FamilyText = NonNullable<PresetActivity["familyText"]>;

export type Activity = Omit<PresetActivity, "photo"> & {
  images: Photo[];
  /** Set on the family-friendly copy of an activity (never saved, never offered): the original id. */
  familyOf?: string;
};
export type { ActivityVariant };
export type Pair = PresetPair;
export type Region = PresetRegion & { images: Photo[] };
export type Base = PresetBase & { images: Photo[] };
export type Area = PresetArea;
export type Leg = PresetLeg & { id: string };
export type Route = PresetRoute & { id: string; totalKm: number };
export type Transfer = PresetTransfer;
export type SpecialDate = PresetSpecialDate;

/** "Stay in": a first-class pick on every slot, as often as people like. Vibe 0, no travel, free. */
export type StayIn = {
  id: "stay";
  slot: Slot;
  title: string;
  tagline: string;
  description: string;
  highlights: string[];
  meta: string;
  vibe: 0;
  categories: Category[];
  images: Photo[];
  familyText?: FamilyText;
};

/** The suffix of an activity's family-friendly copy ("unawatuna-jungle-beach~family"). Never a saved id. */
export const FAMILY_COPY = "~family";
export const STAY_ID = "stay";

/** Tags that make an activity nightlife (alcohol- or party-centric), whatever the destination. */
const NIGHTLIFE_TAGS = ["cocktails", "bar", "bars", "club", "casino", "pub crawl", "beach party", "beach bars", "speakeasy", "techno", "dj", "karaoke", "nightlife"];

export type Catalog = {
  preset: TripPreset;
  id: string;
  /** Options + Quick extras: everything that can be offered in a slot (besides Stay in). */
  activities: Activity[];
  options: Activity[];
  extras: Activity[];
  /** Family-friendly stand-ins (view only). */
  familyStandIns: Activity[];
  /** Every activity, stand-in and family copy by id. */
  byId: Record<string, Activity>;
  pairs: Pair[];
  pairsById: Record<string, Pair>;
  /** Ordinary (non-special) matchups for a pool and slot. */
  pairsFor: (area: string, slot: Slot) => Pair[];
  specialDates: SpecialDate[];
  /** Options that only appear in a special date's matchups (pinned to that date). */
  specialOptionIds: Set<string>;
  regions: Record<string, Region>;
  regionList: Region[];
  bases: Base[];
  basesById: Record<string, Base>;
  areas: Record<string, Area>;
  transfers: Transfer[];
  legs: Record<string, Leg>;
  routes: Record<string, Route>;
  stayIn: { day: StayIn; night: StayIn; transfer: StayIn | null };
  heroPhotos: Photo[];
  photos: (key: string) => Photo[];
  /** Approx. drive hours between two places (known table, else a distance estimate). */
  travelHours: (a: string, b: string) => number;
  isNightlife: (a: Pick<Activity, "categories" | "tags">) => boolean;
  /** The id family mode shows for a pick: nightlife → its stand-in, then its family copy if it has one. */
  familyIdFor: (id: string) => string;
};

/** Every piece of text an activity can show (detail sheet, cards, timeline, budget, share images). */
export function shownText(a: Activity): string[] {
  return [
    a.title,
    a.tagline,
    a.loved,
    a.description,
    a.duration,
    a.venue ?? "",
    a.goodToKnow ?? "",
    ...a.highlights,
    ...a.tags,
    ...(a.bring ?? []),
    ...a.sources.map((s) => s.label),
    ...(a.variants ?? []).flatMap((v) => [v.title, v.summary, v.total, v.eveningNote, v.eveBefore ?? "", ...v.honest, ...v.schedule.map((x) => x.text)]),
    ...(a.rules ? [a.rules.title, ...a.rules.items] : []),
    ...(a.course ?? []).map((c) => `${c.venue} ${c.area} ${c.note ?? ""}`),
  ];
}

const R = 6371;
function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const compiled = new WeakMap<TripPreset, Catalog>();

/** Compile a (validated) preset and its photos. Memoised per preset object. */
export function compileCatalog(preset: TripPreset, photoSet: PhotoSet): Catalog {
  const hit = compiled.get(preset);
  if (hit) return hit;

  const base = `/presets/${preset.id}/`;
  const resolved = new Map<string, Photo[]>();
  const photos = (key: string): Photo[] => {
    let list = resolved.get(key);
    if (!list) {
      list = (photoSet[key] ?? []).map((p) => ({ ...p, src: p.src.startsWith("/") ? p.src : `${base}${p.src}` }));
      resolved.set(key, list);
    }
    return list;
  };
  const firstPhotos = (keys: string[]) => keys.map(photos).find((l) => l.length) ?? [];

  const toActivity = ({ photo, ...a }: PresetActivity): Activity => ({ ...a, images: photos(photo ?? a.id) });
  const all = preset.activities.map(toActivity);
  const options = all.filter((a) => a.kind === "option");
  const extras = all.filter((a) => a.kind === "extra");
  const familyStandIns = all.filter((a) => a.kind === "family");
  const activities = [...options, ...extras];

  const nightTags = new Set([...NIGHTLIFE_TAGS, ...preset.nightlifeTags]);
  const isNightlife = (a: Pick<Activity, "categories" | "tags">) => a.categories.includes("party") || a.tags.some((t) => nightTags.has(t));

  // Family mode shows a copy of any activity whose own words mention drinks or
  // nightlife: its familyText applied, tags and source labels naming nightlife left out.
  const familyCopies: Activity[] = [...activities, ...familyStandIns]
    .filter((a) => !isNightlife(a))
    .flatMap((a) => {
      const tags = a.tags.filter((t) => !bannedIn(t).length);
      const sources = a.sources.filter((s) => !bannedIn(s.label).length);
      if (!a.familyText && tags.length === a.tags.length && sources.length === a.sources.length) return [];
      return [{ ...a, ...a.familyText, id: `${a.id}${FAMILY_COPY}`, tags, sources, familyOf: a.id }];
    });
  const byId: Record<string, Activity> = Object.fromEntries([...all, ...familyCopies].map((a) => [a.id, a]));
  const familyIdFor = (id: string) => {
    const shown = byId[id]?.familySwap ?? id;
    return byId[`${shown}${FAMILY_COPY}`] ? `${shown}${FAMILY_COPY}` : shown;
  };

  const pairs = preset.pairs;
  const pairsById = Object.fromEntries(pairs.map((p) => [p.id, p]));
  const ordinary = pairs.filter((p) => !p.special);
  const pairsFor = (area: string, slot: Slot) => ordinary.filter((p) => p.area === area && p.slot === slot);
  const specialOptionIds = new Set(pairs.filter((p) => p.special).flatMap((p) => [p.a, p.b]));

  const regionList: Region[] = preset.regions.map((r) => ({ ...r, images: firstPhotos(r.photos) }));
  const regions = Object.fromEntries(regionList.map((r) => [r.id, r]));
  const bases: Base[] = preset.structure.bases.map((b) => ({ ...b, images: photos(b.photo) }));

  const legs = Object.fromEntries(Object.entries(preset.travel.legs).map(([id, l]) => [id, { ...l, id }]));
  const routes = Object.fromEntries(
    Object.entries(preset.travel.routes).map(([id, r]) => [id, { ...r, id, totalKm: r.stops[r.stops.length - 1].km }]),
  );

  const stay = (slot: Slot, c: StayInCopy): StayIn => ({
    id: STAY_ID,
    slot,
    title: c.title,
    tagline: c.tagline,
    description: c.description,
    highlights: c.highlights,
    meta: c.meta,
    vibe: 0,
    categories: ["chill"],
    images: firstPhotos(c.photos),
    familyText: c.familyText,
  });

  // Drive times: the known table first, else straight-line km × detour at the preset's road speed.
  const known = new Map<string, number>();
  const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  for (const [a, b, h] of preset.travel.known) known.set(key(a, b), h);
  const est = preset.travel.estimate;
  const travelHours = (a: string, b: string): number => {
    if (a === b) return 0;
    const k = known.get(key(a, b));
    if (k !== undefined) return k;
    const A = regions[a];
    const B = regions[b];
    if (!A || !B) return 0;
    const h = (km(A, B) * est.detour) / est.kmh + est.overhead;
    return Math.max(0.25, Math.round(h * 4) / 4);
  };

  const catalog: Catalog = {
    preset,
    id: preset.id,
    activities,
    options,
    extras,
    familyStandIns,
    byId,
    pairs,
    pairsById,
    pairsFor,
    specialDates: preset.specialDates,
    specialOptionIds,
    regions,
    regionList,
    bases,
    basesById: Object.fromEntries(bases.map((b) => [b.id, b])),
    areas: Object.fromEntries(preset.areas.map((a) => [a.id, a])),
    transfers: preset.structure.transfers,
    legs,
    routes,
    stayIn: {
      day: stay("day", preset.stayIn.day),
      night: stay("night", preset.stayIn.night),
      transfer: preset.stayIn.transfer ? stay("day", preset.stayIn.transfer) : null,
    },
    heroPhotos: photos(preset.destination.heroPhoto),
    photos,
    travelHours,
    isNightlife,
    familyIdFor,
  };
  compiled.set(preset, catalog);
  return catalog;
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
