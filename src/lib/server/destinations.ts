import "server-only";
import type { Catalog, Photo } from "@/engine/catalog";
import { defaultRules } from "@/engine/rules";
import { createEngine, defaultLength, lengthBounds, lengthRangeLabel, nightsLine } from "@/engine/structure";
import { PRESET_IDS, loadPreset } from "@/presets/registry";

/** A preset as Caravan's own pages show it: a card in its own colours. */
export type Destination = {
  id: string;
  name: string;
  country: string;
  season: string;
  tagline: string;
  headline: [string, string];
  /** "5–7 days": the suggested length (any length in the rules can be picked). */
  length: string;
  /** The bases at the usual length: "6 days: Colombo · 1 night → Galle · 4 nights". */
  shape: string;
  /** Suggested trip name, e.g. "Sri Lanka '26". */
  suggestedName: string;
  options: number;
  photo: Photo | null;
  /** A day matchup for Caravan's hero: two photographed, non-nightlife options. */
  matchup: { a: { title: string; photo: Photo }; b: { title: string; photo: Photo } } | null;
  colors: { deep: string; mid: string; glow: string; accent: string };
};

export function destinations(): Destination[] {
  return PRESET_IDS.map((id) => {
    const { preset, catalog } = loadPreset(id);
    const e = createEngine(catalog, defaultRules(preset));
    const days = defaultLength(e);
    const p = preset.theme.palette;
    const d = preset.destination;
    return {
      id,
      name: preset.name,
      country: d.country,
      season: d.season,
      tagline: d.tagline,
      headline: d.headline,
      length: lengthRangeLabel(e.rules.recommended ?? lengthBounds(e)),
      shape: `${days} days: ${nightsLine(e, days)}`,
      suggestedName: `${preset.name} '${preset.dates.window.start.slice(2, 4)}`,
      options: catalog.options.length,
      photo: catalog.heroPhotos[0] ?? null,
      matchup: matchupOf(catalog),
      colors: { deep: p.primary["900"], mid: p.primary["700"], glow: p.highlight["400"], accent: p.accent["500"] },
    };
  });
}

function matchupOf(catalog: Catalog): Destination["matchup"] {
  const showcase = new Set(catalog.preset.destination.showcase ?? []);
  const ok = (id: string) => {
    const a = catalog.byId[id];
    return a && a.images[0] && !catalog.isNightlife(a) ? a : null;
  };
  const pairs = catalog.pairs.filter((p) => p.slot === "day" && ok(p.a) && ok(p.b));
  const pair =
    pairs.find((p) => showcase.has(p.a) && showcase.has(p.b)) ?? pairs.find((p) => showcase.has(p.a) || showcase.has(p.b)) ?? pairs[0];
  if (!pair) return null;
  const side = (id: string) => {
    const a = catalog.byId[id];
    return { title: a.title.split(/[:(]/)[0].trim(), photo: a.images[0] };
  };
  return { a: side(pair.a), b: side(pair.b) };
}
