import type { PresetTheme as Theme } from "@/engine/preset-schema";
import { themeCss } from "@/lib/theme";

/** Puts a trip's preset theme in force for the whole page (palette + fonts). */
export function PresetTheme({ theme }: { theme: Theme }) {
  return <style>{themeCss(theme)}</style>;
}
