import type { Pair } from "./types";

/**
 * Options are matched up into A-vs-B pairs. Each pair can be used once per
 * itinerary. Re-pair freely — just keep `slot` consistent with the options.
 * Day pairs: usually nature/adventure (a) vs social/city/beach (b).
 * Night pairs: usually a big night out (a) vs a mellower social night (b).
 */
export const dayPairs: Pair[] = [
  { id: "sigiriya-rocks", slot: "day", a: "pidurangala-sunrise", b: "sigiriya-lion-rock", theme: "Climb the legend, or watch it from next door at sunrise" },
  { id: "big-safari", slot: "day", a: "yala-leopard-safari", b: "elephant-safari-kaudulla", theme: "Leopards or elephants?" },
  { id: "mirissa-ocean", slot: "day", a: "mirissa-whale-watching", b: "mirissa-beach-hop", theme: "Ocean giants or beach life" },
  { id: "south-surf", slot: "day", a: "weligama-surf-lesson", b: "unawatuna-jungle-beach", theme: "Paddle out or kick back" },
  { id: "reef-or-ramparts", slot: "day", a: "hikkaduwa-turtles", b: "galle-fort", theme: "Reef or ramparts" },
  { id: "ella-hikes", slot: "day", a: "ella-rock", b: "nine-arches-little-adams", theme: "The big climb or the easy icons" },
  { id: "ella-thrills", slot: "day", a: "flying-ravana-zipline", b: "ella-cooking-class", theme: "Adrenaline or spice" },
  { id: "tea-country", slot: "day", a: "horton-plains", b: "tea-estate-high-tea", theme: "Cloud forest or a cuppa" },
  { id: "kandy-days", slot: "day", a: "peradeniya-gardens", b: "kandy-temple-city", theme: "Gardens or the sacred city" },
  { id: "first-day", slot: "day", a: "negombo-lagoon", b: "colombo-tuk-tuk", theme: "Lagoon calm or city buzz" },
];

export const nightPairs: Pair[] = [
  { id: "colombo-nights", slot: "night", a: "colombo-club-night", b: "colombo-rooftop", theme: "Dance floor or skyline" },
  { id: "first-night", slot: "night", a: "ministry-of-crab", b: "negombo-beach-sundowners", theme: "Crab feast or beach sundowners" },
  { id: "unawatuna-nights", slot: "night", a: "unawatuna-beach-party", b: "galle-fort-sunset-dinner", theme: "Beach party or fort sunset" },
  { id: "madiha-mirissa", slot: "night", a: "doctors-house-madiha", b: "mirissa-seafood-bbq", theme: "Big night or barefoot dinner" },
  { id: "surf-coast-nights", slot: "night", a: "hikkaduwa-beach-party", b: "weligama-sundowners", theme: "Party strip or surf-town sunset" },
  { id: "ella-nights", slot: "night", a: "ella-bar-night", b: "ninety-eight-acres-sunset", theme: "Bar street or big view" },
  { id: "kandy-nights", slot: "night", a: "kandy-pub-night", b: "kandyan-dance-dinner", theme: "Pub with a view or drums & fire" },
  { id: "wild-nights", slot: "night", a: "yala-safari-camp", b: "sigiriya-village-dinner", theme: "Bonfire in the bush or village feast" },
];

/** Only offered on the evening of 31 December. */
export const nyePair: Pair = {
  id: "nye",
  slot: "nye",
  a: "nye-mirissa-beach-party",
  b: "nye-colombo-rooftop",
  theme: "Beach countdown or skyline countdown",
};
