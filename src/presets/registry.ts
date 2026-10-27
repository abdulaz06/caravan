import "server-only";
// The presets this deployment ships with. Presets are versioned content,
// reviewed like code: each lives in presets/<id>/ (preset.json, photos.json,
// images/) and is registered here. Server-only — a page sends the browser
// just the one preset its trip uses.
import { compileCatalog, type Catalog } from "@/engine/catalog";
import { presetSchema, photoSetSchema, type PhotoSet, type TripPreset } from "@/engine/preset-schema";
import { validatePreset } from "@/engine/validate";
import sriLanka from "../../presets/sri-lanka/preset.json";
import sriLankaPhotos from "../../presets/sri-lanka/photos.json";
import georgia from "../../presets/georgia/preset.json";
import georgiaPhotos from "../../presets/georgia/photos.json";

const RAW: Record<string, { preset: unknown; photos: unknown }> = {
  "sri-lanka": { preset: sriLanka, photos: sriLankaPhotos },
  georgia: { preset: georgia, photos: georgiaPhotos },
};

export type LoadedPreset = { preset: TripPreset; photos: PhotoSet; catalog: Catalog };

export const PRESET_IDS = Object.keys(RAW);
export const DEFAULT_PRESET_ID = "sri-lanka";

const loaded = new Map<string, LoadedPreset>();

/** A registered preset, parsed (and fully validated outside production). Throws for an unknown id. */
export function loadPreset(id: string): LoadedPreset {
  const hit = loaded.get(id);
  if (hit) return hit;
  const raw = RAW[id];
  if (!raw) throw new Error(`Unknown preset "${id}"`);
  let preset: TripPreset;
  let photos: PhotoSet;
  if (process.env.NODE_ENV !== "production") {
    const v = validatePreset(raw.preset, raw.photos);
    if (!v.ok) throw new Error(`Preset "${id}" is invalid:\n${v.problems.map((p) => `  · ${p}`).join("\n")}`);
    preset = v.preset;
    photos = v.photos;
  } else {
    preset = presetSchema.parse(raw.preset);
    photos = photoSetSchema.parse(raw.photos);
  }
  const value = { preset, photos, catalog: compileCatalog(preset, photos) };
  loaded.set(id, value);
  return value;
}

export const isPresetId = (id: unknown): id is string => typeof id === "string" && id in RAW;
