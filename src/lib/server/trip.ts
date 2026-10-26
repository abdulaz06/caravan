import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { lockedNow, parseRules, type TripRules } from "@/engine/rules";
import { createEngine, type Engine } from "@/engine/structure";
import { isPresetId, loadPreset, type LoadedPreset } from "@/presets/registry";
import { db, type TripRow } from "./db";

export type TripInfo = Pick<TripRow, "id" | "slug" | "name" | "kind">;

export type TripContext = LoadedPreset & {
  trip: TripInfo;
  presetId: string;
  rules: TripRules;
  /** The trip engine: the compiled preset + these rules. */
  engine: Engine;
  /** Locked by hand in the console. */
  editsLocked: boolean;
  /** Locked by hand or by the scheduled auto-lock. */
  locked: boolean;
};

/** A trip row → its context (preset, live rules, engine). Null if its preset isn't registered here. */
export function tripContext(row: TripRow): TripContext | null {
  if (!isPresetId(row.preset_id)) return null;
  const loaded = loadPreset(row.preset_id);
  const rules = parseRules(row.rules, loaded.preset);
  return {
    ...loaded,
    trip: { id: row.id, slug: row.slug, name: row.name, kind: row.kind },
    presetId: row.preset_id,
    rules,
    engine: createEngine(loaded.catalog, rules),
    editsLocked: row.edits_locked,
    locked: lockedNow(row.edits_locked, rules),
  };
}

/** The trip at /t/<slug> (once per request), or null. */
export const loadTrip = cache(async (slug: string): Promise<TripContext | null> => {
  if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(slug)) return null;
  const row = await db().getTripBySlug(slug);
  return row ? tripContext(row) : null;
});

/** A trip's paths, for redirects on the server. */
export const tripPath = (slug: string, path = "") => `/t/${slug}${path}`;

/** The trip for a page's `[slug]` param, or a 404. */
export async function tripFromParams(params: Promise<{ slug: string }>): Promise<TripContext> {
  const trip = await loadTrip((await params).slug);
  if (!trip) notFound();
  return trip;
}
