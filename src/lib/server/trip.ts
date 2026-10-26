import "server-only";
import { cache } from "react";
import { lockedNow, parseRules, type TripRules } from "@/engine/rules";
import { createEngine, type Engine } from "@/engine/structure";
import { DEFAULT_PRESET_ID, loadPreset, type LoadedPreset } from "@/presets/registry";
import { db } from "./db";

export type TripContext = LoadedPreset & {
  presetId: string;
  rules: TripRules;
  /** The trip engine: the compiled preset + these rules. */
  engine: Engine;
  /** Locked by hand in the console. */
  editsLocked: boolean;
  /** Locked by hand or by the scheduled auto-lock. */
  locked: boolean;
};

/** Build a trip context from stored settings. */
export function tripContext(presetId: string, storedRules: unknown, editsLocked: boolean): TripContext {
  const loaded = loadPreset(presetId);
  const rules = parseRules(storedRules, loaded.preset);
  return { ...loaded, presetId, rules, engine: createEngine(loaded.catalog, rules), editsLocked, locked: lockedNow(editsLocked, rules) };
}

/** The trip this request is about: its preset, live rules and engine (once per request). */
export const loadTrip = cache(async (): Promise<TripContext> => {
  const s = await db().getSettings();
  return tripContext(DEFAULT_PRESET_ID, s.rules, s.edits_locked);
});
