import { extras, halalAlternatives, isNightlife, options, stayIn, type StayIn } from "./options";
import { nyePairs, pairs, pairsFor } from "./pairs";
import { bannedIn } from "@/lib/halal-words";
import { photos } from "./photos.generated";
import type { Activity, Category, Pair } from "./types";

export * from "./types";
export { regions, regionList, travelHours, formatHours, stays, COAST_ROAD, COAST_ROAD_KM, LEGS } from "./regions";
export type { Stay, FixedLeg } from "./regions";
export { stayIn, pairs, pairsFor, nyePairs, options, extras, isNightlife };
export type { StayIn };

/** Options + Quick extras — everything that can sit in a slot (besides Stay in). */
export const activities: Activity[] = [...options, ...extras];
/** The suffix of an activity's Halal-mode copy ("unawatuna-jungle-beach~halal"). Never a saved id. */
export const HALAL_COPY = "~halal";

/**
 * Halal mode shows a copy of an activity whose own words mention bars or
 * drinks: its `halalText` applied, with any tag or source label naming
 * nightlife left out. Copies resolve like any activity but are never in the
 * catalog, matchups or saved plans (`halalOf` marks them).
 */
const halalCopies: Activity[] = [...activities, ...halalAlternatives]
  .filter((a) => !isNightlife(a))
  .flatMap((a) => {
    const tags = a.tags.filter((t) => !bannedIn(t).length);
    const sources = a.sources.filter((s) => !bannedIn(s.label).length);
    if (!a.halalText && tags.length === a.tags.length && sources.length === a.sources.length) return [];
    return [{ ...a, ...a.halalText, id: `${a.id}${HALAL_COPY}`, tags, sources, halalOf: a.id }];
  });

/** Includes the Halal-mode stand-ins and copies so swapped plans still resolve. */
export const activitiesById: Record<string, Activity> = Object.fromEntries(
  [...activities, ...halalAlternatives, ...halalCopies].map((a) => [a.id, a]),
);

/** The activity id Halal mode shows for a pick: nightlife → its stand-in, then its Halal-mode copy if it has one. */
export function halalIdFor(id: string): string {
  const shown = activitiesById[id]?.halalSwap ?? id;
  return activitiesById[`${shown}${HALAL_COPY}`] ? `${shown}${HALAL_COPY}` : shown;
}

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
/** @deprecated name kept for older call sites — same as activitiesById. */
export const optionsById = activitiesById;

export const allPairs: Pair[] = [...pairs, nyePairs.colombo, nyePairs.galle];
export const pairsById: Record<string, Pair> = Object.fromEntries(allPairs.map((p) => [p.id, p]));

export const heroPhotos = photos["hero"] ?? [];

export const NYE_DATE = "2026-12-31";

// Trip length, nights split and the date window are live Trip rules — see lib/rules.ts.

export const CATEGORIES: { id: Category; label: string; emoji: string }[] = [
  { id: "adventure", label: "Adventure", emoji: "🥾" },
  { id: "water", label: "Beach & Water", emoji: "🌊" },
  { id: "nature", label: "Nature", emoji: "🌿" },
  { id: "culture", label: "Culture", emoji: "🛕" },
  { id: "food", label: "Food", emoji: "🍛" },
  { id: "party", label: "Party", emoji: "🪩" },
  { id: "chill", label: "Chill / Stay in", emoji: "🌴" },
];

// Fail fast in dev if the content files drift out of sync.
{
  const seen = new Set<string>();
  for (const a of activities) {
    if (seen.has(a.id) || a.id === "stay") throw new Error(`Duplicate activity id ${a.id}`);
    seen.add(a.id);
    if (!a.slots.length || !a.where.length || !a.categories.length) throw new Error(`Activity ${a.id} is missing slots/where/categories`);
    if (a.kind === "option" && a.slots.length !== 1) throw new Error(`Option ${a.id} must have exactly one slot`);
  }
  for (const p of allPairs) {
    for (const id of [p.a, p.b]) {
      const o = activitiesById[id];
      if (!o || o.kind !== "option") throw new Error(`Pair ${p.id} references unknown option ${id}`);
      const slot = p.slot === "day" ? "day" : "night";
      if (!o.slots.includes(slot)) throw new Error(`Option ${id} isn't a ${slot} option but pair ${p.id} is`);
      if (!o.where.includes(p.where)) throw new Error(`Option ${id} isn't valid in ${p.where} (pair ${p.id})`);
    }
  }
  // Every nightlife item needs a curated Halal-mode swap: same slot, overlapping area, not nightlife itself.
  for (const a of [...activities, ...halalAlternatives]) {
    if (seen.has(a.id) && a.kind === "halal") throw new Error(`Halal stand-in ${a.id} clashes with an activity id`);
    if (!isNightlife(a)) continue;
    if (a.kind === "halal") throw new Error(`Halal stand-in ${a.id} looks like nightlife`);
    const swap = a.halalSwap ? activitiesById[a.halalSwap] : undefined;
    if (!swap) throw new Error(`Nightlife item ${a.id} has no halalSwap`);
    if (isNightlife(swap)) throw new Error(`halalSwap for ${a.id} (${swap.id}) is nightlife too`);
    if (!a.slots.every((s) => swap.slots.includes(s))) throw new Error(`halalSwap for ${a.id} doesn't fit the same slot`);
    if (!a.where.some((w) => swap.where.includes(w))) throw new Error(`halalSwap for ${a.id} is in a different area`);
  }
  // Nothing Halal mode can show may mention nightlife (the word list: content/halal-banned-words.json).
  for (const a of [...activities, ...halalAlternatives]) {
    const shown = activitiesById[halalIdFor(a.id)];
    const bad = shownText(shown).flatMap(bannedIn);
    if (bad.length) throw new Error(`Halal mode would show "${[...new Set(bad)].join(", ")}" for ${a.id} — add halalText or reword it`);
  }
  // Extras tied to another pick (Ella extras → the Ella day trip) must point at a real option.
  for (const a of activities) {
    if (a.onlyWith && activitiesById[a.onlyWith]?.kind !== "option") throw new Error(`${a.id} needs an unknown option ${a.onlyWith}`);
  }
  void pairsFor;
}
