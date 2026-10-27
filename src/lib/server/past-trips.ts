import "server-only";
import { z } from "zod";
import type { Photo } from "@/engine/catalog";
import { makeItem, newId, normalize, type ItineraryData } from "@/engine/itinerary";
import { defaultRules, type TripRules } from "@/engine/rules";
import { createEngine } from "@/engine/structure";
import { addDays } from "@/lib/dates";
import { loadPreset, type LoadedPreset } from "@/presets/registry";
import georgia2024 from "../../../content/past-trips/georgia-2024.json";

// Past trips: real trips, anonymised, kept as an archive. Each one is plain
// JSON in content/past-trips/ — its days are picks from a preset, so the app
// draws the same poster, route map and day-by-day timeline as for a live plan,
// plus a story (9:16 slides) told in the trip's own words.

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const slideSchema = z.strictObject({
  day: z.number().int().min(0),
  title: z.string().min(1),
  place: z.string().min(1),
  time: z.string().optional(),
  text: z.string().optional(),
  photo: z.string().min(1),
});
const pastTripSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  presetId: z.string().min(1),
  title: z.string().min(1),
  kicker: z.string().min(1),
  crew: z.string().min(1),
  start: isoDate,
  end: isoDate,
  summary: z.string().min(1),
  days: z.array(z.strictObject({ day: z.array(z.string()), night: z.array(z.string()), note: z.string().optional() })).min(2),
  cover: z.strictObject({ photo: z.string().min(1) }),
  slides: z.array(slideSchema).min(1),
  teaser: z.strictObject({ kicker: z.string(), title: z.string(), text: z.string(), photo: z.string().min(1) }).optional(),
});
type PastTripJson = z.output<typeof pastTripSchema>;

const ALL: PastTripJson[] = [pastTripSchema.parse(georgia2024)];

export type StorySlide = { kicker: string; title: string; place: string; time?: string; text?: string; photo: Photo | null };

export type PastTrip = {
  id: string;
  title: string;
  kicker: string;
  crew: string;
  start: string;
  end: string;
  summary: string;
  days: number;
  places: number;
  cover: Photo | null;
  slides: StorySlide[];
  teaser: StorySlide | null;
};

export type LoadedPastTrip = PastTrip & { preset: LoadedPreset; rules: TripRules; data: ItineraryData };

function build(t: PastTripJson): LoadedPastTrip {
  const preset = loadPreset(t.presetId);
  const { catalog } = preset;
  // The archive keeps the trip's real dates and length, whatever the preset's defaults are now.
  const base = defaultRules(preset.preset);
  const nights = t.days.length - 1;
  const rules: TripRules = {
    ...base,
    window: { start: addDays(t.start, -1), end: addDays(t.end, 1) },
    nights: Object.fromEntries(Object.keys(base.nights).map((id, i) => [id, i === 0 ? nights : 0])),
  };
  const e = createEngine(catalog, rules);
  const pairOf = (id: string) => catalog.pairs.find((p) => p.a === id || p.b === id)?.id;
  const raw: ItineraryData = {
    version: 3,
    startDate: t.start,
    endDate: t.end,
    flexibility: "exact",
    days: t.days.map((d) => ({
      id: newId(),
      day: d.day.map((id) => makeItem(e, id, pairOf(id))),
      night: d.night.map((id) => makeItem(e, id, pairOf(id))),
      ...(d.note ? { note: d.note } : {}),
    })),
    preferences: {},
  };
  const data = normalize(e, raw, t.days.length);
  const photo = (key: string) => catalog.photos(key)[0] ?? null;
  const visited = new Set(data.days.flatMap((d) => [...d.day, ...d.night]).map((it) => catalog.byId[it.id]?.region).filter(Boolean));
  return {
    id: t.id,
    title: t.title,
    kicker: t.kicker,
    crew: t.crew,
    start: t.start,
    end: t.end,
    summary: t.summary,
    days: t.days.length,
    places: visited.size,
    cover: photo(t.cover.photo),
    slides: t.slides.map((s) => ({ kicker: `Day ${s.day}`, title: s.title, place: s.place, time: s.time, text: s.text, photo: photo(s.photo) })),
    teaser: t.teaser ? { kicker: t.teaser.kicker, title: t.teaser.title, place: "", text: t.teaser.text, photo: photo(t.teaser.photo) } : null,
    preset,
    rules,
    data,
  };
}

const cache = new Map<string, LoadedPastTrip>();

export function loadPastTrip(id: string): LoadedPastTrip | null {
  const t = ALL.find((x) => x.id === id);
  if (!t) return null;
  if (!cache.has(id)) cache.set(id, build(t));
  return cache.get(id)!;
}

/** Every past trip, newest first (without the heavy bits). */
export function pastTrips(): PastTrip[] {
  return ALL.map((t) => loadPastTrip(t.id)!)
    .sort((a, b) => b.start.localeCompare(a.start))
    .map((t) => ({
      id: t.id,
      title: t.title,
      kicker: t.kicker,
      crew: t.crew,
      start: t.start,
      end: t.end,
      summary: t.summary,
      days: t.days,
      places: t.places,
      cover: t.cover,
      slides: t.slides,
      teaser: t.teaser,
    }));
}
