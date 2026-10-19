import { photos } from "../photos.generated";
import type { Activity, Slot, Source, Where } from "../types";

type Base = Omit<Activity, "kind" | "slots" | "where" | "images"> & { photoKey?: string };

const img = (key: string) => photos[key] ?? [];

/** A curated option (appears in the A-vs-B matchups and the catalog). */
export function option(slot: Slot, where: Where[], o: Base): Activity {
  const { photoKey, ...rest } = o;
  return { ...rest, kind: "option", slots: [slot], where, images: img(photoKey ?? o.id) };
}

/** A small Quick extra (catalog only). */
export function extra(slots: Slot[], where: Where[], o: Base): Activity {
  const { photoKey, ...rest } = o;
  return { ...rest, kind: "extra", slots, where, images: img(photoKey ?? o.id) };
}

/** Source shorthand. */
export const src = (label: string, url: string): Source => ({ label, url });

/** Shared sources used by several nightlife entries. */
export const S = {
  wanderwithjo: src("Wander with Jo — south-coast nightlife (updated Sep 2026)", "https://www.wanderwithjo.com/sri-lanka-nightlife/"),
  weligamalife: src("Weligama Life — clubs & nightlife (May 2025)", "https://www.weligamalife.com/2025/05/the-best-clubs-and-night-life-spots-in.html"),
  fridayBeach: src("friday.lk — beach parties 2026", "https://www.friday.lk/beach-parties-in-sri-lanka"),
  fridayColombo: src("friday.lk — Colombo nightlife 2026", "https://www.friday.lk/colombo-nightlife"),
};
