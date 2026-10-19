import type { BaseId, Pair } from "./types";

/**
 * Options are matched up into A-vs-B pairs, per base. Re-pair freely — just
 * keep `slot` and `base` consistent with the options.
 * Day pairs: usually nature/adventure (a) vs social/city/beach (b).
 * Night pairs: usually a big night out (a) vs a mellower social night (b).
 */
export const dayPairs: Pair[] = [
  // Colombo
  { id: "first-day", slot: "day", base: "colombo", a: "negombo-lagoon", b: "colombo-tuk-tuk", theme: "Lagoon calm or city buzz" },
  { id: "kandy-or-design", slot: "day", base: "colombo", a: "kandy-day-trip", b: "colombo-design-trail", theme: "Hill capital or design capital" },
  { id: "sea-or-sky", slot: "day", base: "colombo", a: "mount-lavinia-beach", b: "lotus-tower-port-city", theme: "Sea breeze or skyline" },
  // Galle
  { id: "mirissa-ocean", slot: "day", base: "galle", a: "mirissa-whale-watching", b: "mirissa-beach-hop", theme: "Ocean giants or beach life" },
  { id: "south-surf", slot: "day", base: "galle", a: "weligama-surf-lesson", b: "unawatuna-jungle-beach", theme: "Paddle out or kick back" },
  { id: "reef-or-ramparts", slot: "day", base: "galle", a: "hikkaduwa-turtles", b: "galle-fort", theme: "Reef or ramparts" },
  { id: "dive-or-tea", slot: "day", base: "galle", a: "scuba-diving", b: "tea-and-stilts", theme: "Under the sea or over a cuppa" },
  { id: "bentota-days", slot: "day", base: "galle", a: "bentota-water-sports", b: "madu-river-safari", theme: "Full throttle or slow river" },
];

export const nightPairs: Pair[] = [
  // Colombo
  { id: "colombo-nights", slot: "night", base: "colombo", a: "colombo-club-night", b: "colombo-rooftop", theme: "Dance floor or skyline" },
  { id: "feast-nights", slot: "night", base: "colombo", a: "ministry-of-crab", b: "galle-face-street-food", theme: "Crab feast or street feast" },
  { id: "lucky-or-thirsty", slot: "night", base: "colombo", a: "casino-night", b: "pub-golf-colombo", theme: "Feeling lucky or feeling thirsty?" },
  // Galle
  { id: "unawatuna-nights", slot: "night", base: "galle", a: "unawatuna-beach-party", b: "galle-fort-sunset-dinner", theme: "Beach party or fort sunset" },
  { id: "madiha-mirissa", slot: "night", base: "galle", a: "doctors-house-madiha", b: "mirissa-seafood-bbq", theme: "Big night or barefoot dinner" },
  { id: "surf-coast-nights", slot: "night", base: "galle", a: "hikkaduwa-beach-party", b: "weligama-sundowners", theme: "Party strip or surf-town sunset" },
  { id: "jungle-or-golf", slot: "night", base: "galle", a: "secret-jungle-party", b: "pub-golf-galle", theme: "Into the jungle or round the fort" },
];

/** Only offered on the evening of 31 December — one pair per base. */
export const nyePairs: Record<BaseId, Pair> = {
  colombo: {
    id: "nye-colombo",
    slot: "nye",
    base: "colombo",
    a: "nye-colombo-rooftop",
    b: "nye-mount-lavinia",
    theme: "Skyline countdown or beach countdown",
  },
  galle: {
    id: "nye-galle",
    slot: "nye",
    base: "galle",
    a: "nye-mirissa-beach-party",
    b: "nye-galle-fort",
    theme: "Beach party or fort-side fireworks",
  },
};
