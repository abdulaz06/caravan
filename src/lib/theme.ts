// A preset's theme as CSS custom properties: its palette replaces the
// semantic colour scales (see globals.css) and its fonts the display/body
// families. Trip pages inject it over Caravan's own defaults.
import { PALETTE_SCALES, type PresetTheme } from "@/engine/preset-schema";

/** next/font variables loaded in the root layout, by preset font id. */
const FONT_VARS: Record<PresetTheme["fonts"]["display"], string> = {
  fraunces: "var(--font-fraunces), ui-serif, Georgia, serif",
  instrument: "var(--font-instrument), ui-sans-serif, system-ui, sans-serif",
  playfair: "var(--font-playfair), ui-serif, Georgia, serif",
  bricolage: "var(--font-bricolage), ui-sans-serif, system-ui, sans-serif",
  "dm-serif": "var(--font-dm-serif), ui-serif, Georgia, serif",
};

export function themeVars(theme: PresetTheme): Record<string, string> {
  const vars: Record<string, string> = {};
  const p = theme.palette;
  for (const name of Object.keys(PALETTE_SCALES) as (keyof typeof PALETTE_SCALES)[]) {
    for (const [step, hex] of Object.entries(p[name])) vars[`--color-${name}-${step}`] = hex;
  }
  vars["--color-paper"] = p.paper;
  vars["--color-ink"] = p.ink["1"];
  vars["--color-ink-2"] = p.ink["2"];
  vars["--color-ink-3"] = p.ink["3"];
  vars["--font-display"] = FONT_VARS[theme.fonts.display];
  vars["--font-sans"] = FONT_VARS[theme.fonts.body];
  return vars;
}

/** `:root { --color-primary-600: …; … }` for a <style> tag. */
export function themeCss(theme: PresetTheme): string {
  const body = Object.entries(themeVars(theme))
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
  return `:root{${body}}`;
}

/** The same variables as an inline style object (for scoped previews, e.g. preset cards). */
export function themeStyle(theme: PresetTheme): React.CSSProperties {
  return themeVars(theme) as React.CSSProperties;
}
