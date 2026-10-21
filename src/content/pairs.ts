import type { Pair, Where } from "./types";

/**
 * A-vs-B matchups, kept separate from the options so they're easy to re-pair.
 * The first item in a slot is picked from these; everything else is in the
 * "+ Add another" catalog. NYE pairs show on 31 Dec's evening only.
 */
export const pairs: Pair[] = [
  // ── Day 1 · Colombo ──────────────────────────────────────────────
  { id: "first-day", slot: "day", where: "colombo", a: "negombo-lagoon", b: "colombo-tuk-tuk", theme: "Lagoon calm or city buzz" },
  { id: "design-or-sea", slot: "day", where: "colombo", a: "colombo-design-trail", b: "mount-lavinia-beach", theme: "Design capital or sea breeze" },
  { id: "sky-or-shrines", slot: "day", where: "colombo", a: "lotus-tower-port-city", b: "gangaramaya-beira-lake", theme: "Skyline or shrines" },
  { id: "colombo-nights", slot: "night", where: "colombo", a: "colombo-club-night", b: "colombo-rooftop", theme: "Dance floor or skyline" },
  { id: "feast-nights", slot: "night", where: "colombo", a: "ministry-of-crab", b: "galle-face-street-food", theme: "Crab feast or street feast" },
  { id: "lucky-or-thirsty", slot: "night", where: "colombo", a: "casino-night", b: "pub-golf-colombo", theme: "High rollers or Pub Golf?" },

  // ── Day 2 · en route to Galle ────────────────────────────────────
  { id: "bentota-stop", slot: "day", where: "enroute", a: "bentota-water-sports", b: "bentota-beach-lunch", theme: "Full throttle or flip-flops" },
  { id: "river-or-hatchery", slot: "day", where: "enroute", a: "madu-river-safari", b: "kosgoda-turtles", theme: "Mangrove tunnels or turtle hatchlings" },
  { id: "gardens-or-masks", slot: "day", where: "enroute", a: "bawa-gardens", b: "ambalangoda-masks", theme: "Bawa's gardens or devil masks" },
  { id: "hikkaduwa-stop", slot: "day", where: "enroute", a: "hikkaduwa-turtles", b: "peraliya-tsunami-memorial", theme: "Wild turtles or a moment of history" },

  // ── Galle · daytime ──────────────────────────────────────────────
  { id: "mirissa-ocean", slot: "day", where: "galle", a: "mirissa-whale-watching", b: "mirissa-beach-hop", theme: "Ocean giants or beach life" },
  { id: "south-surf", slot: "day", where: "galle", a: "weligama-surf-lesson", b: "unawatuna-jungle-beach", theme: "Paddle out or kick back" },
  { id: "reef-or-ramparts", slot: "day", where: "galle", a: "hikkaduwa-turtles", b: "galle-fort", theme: "Reef or ramparts" },
  { id: "dive-or-tea", slot: "day", where: "galle", a: "scuba-diving", b: "tea-and-stilts", theme: "Under the sea or over a cuppa" },
  { id: "forest-or-feast", slot: "day", where: "galle", a: "kottawa-rainforest", b: "galle-fort-food-walk", theme: "Rainforest or street food" },
  { id: "reservoir-or-reef", slot: "day", where: "galle", a: "hiyare-rainforest", b: "dalawella-turtles", theme: "Jungle trail or turtle lagoon" },
  { id: "falls-or-lake", slot: "day", where: "galle", a: "kanneliya-trek", b: "koggala-lake-safari", theme: "Waterfall trek or slow lagoon" },
  { id: "pedal-or-pause", slot: "day", where: "galle", a: "countryside-cycling", b: "ahangama-cafes-yoga", theme: "Saddle up or slow down" },
  { id: "summit-or-supper", slot: "day", where: "galle", a: "rumassala-hike", b: "cooking-class-galle", theme: "Jungle summit or clay-pot curries" },
  { id: "paddle-or-folk", slot: "day", where: "galle", a: "koggala-kayak", b: "martin-wickramasinghe-museum", theme: "Sunrise paddle or village stories" },
  { id: "elephants-or-cove", slot: "day", where: "galle", a: "udawalawe-safari", b: "hiriketiya-day", theme: "Big day: elephants or the coolest cove" },
  { id: "rainforest-or-rock", slot: "day", where: "galle", a: "sinharaja-day-trip", b: "mulkirigala-climb", theme: "Big day: rainforest or rock temple" },
  { id: "ella-or-whales", slot: "day", where: "galle", a: "ella-little-adams-peak", b: "mirissa-whale-watching", theme: "Epic early start: Ella sunrise or blue whales" },

  // ── Galle · evening ──────────────────────────────────────────────
  { id: "unawatuna-nights", slot: "night", where: "galle", a: "unawatuna-beach-party", b: "galle-fort-sunset-dinner", theme: "Beach party or fort sunset" },
  { id: "madiha-mirissa", slot: "night", where: "galle", a: "doctors-house-madiha", b: "mirissa-seafood-bbq", theme: "Big night or barefoot dinner" },
  { id: "surf-coast-nights", slot: "night", where: "galle", a: "hikkaduwa-beach-party", b: "weligama-sundowners", theme: "Party strip or surf-town sunset" },
  { id: "jungle-or-golf", slot: "night", where: "galle", a: "secret-jungle-party", b: "pub-golf-galle", theme: "Into the jungle or round the fort" },
  { id: "ahangama-nights", slot: "night", where: "galle", a: "lamana-ahangama", b: "mono-speakeasy", theme: "Skate party or speakeasy" },
  { id: "weekend-rooftops", slot: "night", where: "galle", a: "kurundu-rooftop", b: "tiki-cliff-weligama", theme: "Sunday rooftop or Friday cliff-top" },
  { id: "best-bars", slot: "night", where: "galle", a: "smoke-and-bitters", b: "ropewalk-galle-fort", theme: "Asia's best bar or the fort's arrack bar" },
  { id: "fire-or-techno", slot: "night", where: "galle", a: "mirissa-beach-bars", b: "rumble-in-the-jungle", theme: "Fire shows or techno" },
];

/** One NYE pair per side of the trip: Dec 31 on Day 1 → Colombo, Days 2–5 → Galle. */
export const nyePairs: Record<"colombo" | "galle", Pair> = {
  colombo: { id: "nye-colombo", slot: "nye", where: "colombo", a: "nye-colombo-rooftop", b: "nye-mount-lavinia", theme: "Skyline countdown or beach countdown" },
  galle: { id: "nye-galle", slot: "nye", where: "galle", a: "nye-mirissa-beach-party", b: "nye-galle-fort", theme: "Beach party or fort-side fireworks" },
};

export const pairsFor = (where: Where, slot: "day" | "night"): Pair[] =>
  pairs.filter((p) => p.where === where && p.slot === slot);
