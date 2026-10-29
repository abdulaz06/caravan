import fs from "node:fs";
import path from "node:path";
import { compileCatalog } from "@/engine/catalog";
import { emptyItinerary, setStart, type ItineraryData } from "@/engine/itinerary";
import { defaultRules, type TripRules } from "@/engine/rules";
import { createEngine, type Engine } from "@/engine/structure";
import { validatePreset } from "@/engine/validate";
import { miniPhotos, miniPreset } from "../fixtures/mini-preset";

const presetsDir = path.resolve(__dirname, "../../presets");

export function readPreset(id: string) {
  const read = (f: string) => JSON.parse(fs.readFileSync(path.join(presetsDir, id, f), "utf8"));
  return { preset: read("preset.json"), photos: read("photos.json") };
}

/** A validated preset's engine, with optional rule overrides. */
export function engineFor(raw: { preset: unknown; photos: unknown }, rules: Partial<TripRules> = {}): Engine {
  const v = validatePreset(raw.preset, raw.photos);
  if (!v.ok) throw new Error(`invalid preset:\n${v.problems.join("\n")}`);
  const catalog = compileCatalog(v.preset, v.photos);
  return createEngine(catalog, { ...defaultRules(v.preset), ...rules });
}

export const sriLanka = (rules: Partial<TripRules> = {}) => engineFor(readPreset("sri-lanka"), rules);
export const mini = (rules: Partial<TripRules> = {}) => engineFor({ preset: miniPreset, photos: miniPhotos }, rules);

/** A placed, empty plan starting on `start` (the trip's default length unless given). */
export function placed(e: Engine, start: string, length?: number): ItineraryData {
  return setStart(e, emptyItinerary(), start, length);
}

/** Deterministic randomness for quick fill. */
export function seeded(seed = 7) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
