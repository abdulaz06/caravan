// Words that must never show while Halal mode is on. The list itself lives in
// one place — src/content/halal-banned-words.json — shared with the content
// check at startup and the Playwright Halal test. Matching is case-insensitive
// on whole words, with their plurals ("bars", "parties", "clubbing").
import WORDS from "@/content/halal-banned-words.json";

export const HALAL_BANNED_WORDS: readonly string[] = WORDS;

/** "party" → part(?:y|ies|ying); "club" → club(?:s|bing|bers?)?; others → word(?:s|es)? */
function forms(w: string): string {
  if (w.endsWith("y")) return `${w.slice(0, -1)}(?:y|ies|ying)`;
  if (w === "club") return "club(?:s|bing|bers?)?";
  return `${w}(?:s|es)?`;
}

const BANNED = new RegExp(`\\b(?:${HALAL_BANNED_WORDS.map(forms).join("|")})\\b`, "gi");

/** The banned words found in `text` (lower-cased, de-duplicated). */
export function bannedIn(text: string | null | undefined): string[] {
  if (!text) return [];
  return [...new Set((text.match(BANNED) ?? []).map((m) => m.toLowerCase()))];
}
