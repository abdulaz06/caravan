import { photos } from "./photos.generated";
import type { Option, Photo } from "./types";

/**
 * Every daytime and evening option, grouped by base (Colombo first, then
 * Galle). Researched Oct 2026 for late-December travel — prices are rough
 * per-person USD, and anything marked `goodToKnow` is worth re-checking.
 *
 * vibe: -2 pure nature/adventure … 0 balanced … +2 pure nightlife
 * Photos come from scripts/image-picks.json (run `npm run photos`).
 */
const img = (id: string) => photos[id] ?? [];

const kandyDayTrip: Option = {
  id: "kandy-day-trip",
  slot: "day",
  base: "colombo",
  title: "Kandy day trip: Temple of the Tooth & the lake",
  region: "kandy",
  tagline: "Sri Lanka's last royal capital, there and back in a day.",
  description:
    "Head up into the hills to Kandy: the Temple of the Tooth Relic (the country's most sacred shrine), a loop of Kandy Lake and the old town, and the giant trees of the Royal Botanic Gardens at Peradeniya, with a rice-and-curry lunch in between. You choose how to get there — the classic blue train from Colombo Fort, or a door-to-door van.",
  highlights: [
    "Temple of the Tooth (UNESCO)",
    "Kandy Lake & the old town",
    "Royal Botanic Gardens, Peradeniya",
    "Scenic train or road trip — your call",
  ],
  duration: "Full day (~12 hrs with travel)",
  estCostUsd: [20, 35],
  vibe: -1,
  intensity: "easy",
  tags: ["culture", "temples", "history", "gardens", "train", "day trip"],
  images: img("kandy-day-trip"),
  transport: {
    train: {
      mode: "train",
      title: "Scenic train",
      out: "Colombo Fort → Kandy",
      back: "Kandy → Colombo Fort",
      hours: 2.5,
      label: "~2.5 hrs each way",
      detail:
        "e.g. the 07:00 Intercity (arr. ~09:35), back on the 15:00 (arr. ~17:35). Reserved 2nd class ~LKR 1,200, observation car ~LKR 1,500 — book up to 30 days ahead.",
      costUsd: [9, 16],
    },
    road: {
      mode: "road",
      title: "Road trip",
      out: "Colombo → Kandy",
      back: "Kandy → Colombo",
      hours: 3.25,
      label: "~3–3.5 hrs each way",
      detail: "Private van door to door — leave ~7 am, back by ~7 pm. No expressway yet, so traffic on the Kandy road varies.",
      costUsd: [16, 24],
    },
  },
  goodToKnow:
    "Heads-up: the Colombo–Kandy railway was damaged by Cyclone Ditwah in Nov 2025 and services were due to resume in late 2026 — we'll check the trains are running before booking, otherwise it's the van. Temple dress code: knees and shoulders covered.",
};

const colomboDesignTrail: Option = {
  id: "colombo-design-trail",
  slot: "day",
  base: "colombo",
  title: "Colombo's Bawa & design trail",
  region: "colombo",
  tagline: "Tropical modernism, gallery cafés and the city's best shops.",
  description:
    "Geoffrey Bawa shaped how Sri Lanka looks. Tour Number 11, his own townhouse, then lunch at Paradise Road's The Gallery Café in his former office. Browse Barefoot's handloom shop and garden café, and finish at the restored Old Dutch Hospital. A stylish, slow, very social city day.",
  highlights: [
    "Number 11 — Bawa's own home (guided tour)",
    "Lunch at The Gallery Café, Paradise Road",
    "Barefoot's textiles & garden café",
    "Old Dutch Hospital shopping arcade",
  ],
  duration: "~5 hrs",
  estCostUsd: [15, 40],
  vibe: 1,
  intensity: "easy",
  tags: ["design", "architecture", "food", "shopping", "city"],
  images: img("colombo-design-trail"),
  goodToKnow: "Number 11 runs guided tours at set times — book ahead.",
};

const mountLavinia: Option = {
  id: "mount-lavinia-beach",
  slot: "day",
  base: "colombo",
  title: "Mount Lavinia: colonial hotel & beach day",
  region: "colombo",
  travelFromBase: 0.5,
  tagline: "A 200-year-old governor's mansion on the sand.",
  description:
    "Twenty minutes south of the city, the Mount Lavinia Hotel started life as a British governor's residence in 1806. Spend the day by its sea-view pool or on the beach below, lunch on the terrace or at the seafood shacks on the sand, and stay for a cold Lion as the sun drops into the ocean.",
  highlights: [
    "Pool & terrace at the 1806 Mount Lavinia Hotel",
    "Seafood shacks on the beach",
    "Sunset over the ocean",
    "Easy half day from Colombo",
  ],
  duration: "Half to full day",
  estCostUsd: [15, 45],
  vibe: 0,
  intensity: "easy",
  tags: ["beach", "history", "food", "pool"],
  images: img("mount-lavinia-beach"),
  goodToKnow: "Pool access is usually via a paid day pass or a lunch spend — we'd check on the day.",
};

const lotusTower: Option = {
  id: "lotus-tower-port-city",
  slot: "day",
  base: "colombo",
  title: "Lotus Tower, Port City & One Galle Face",
  region: "colombo",
  tagline: "South Asia's tallest tower, then the shiny new waterfront.",
  description:
    "Ride up the 350 m Lotus Tower for the whole city and coastline laid out below, then wander the new Port City promenade and One Galle Face — mall, food court and a seafront boardwalk. Modern Colombo in one easy afternoon, with Playdium's bowling and arcade right there if you want an add-on.",
  highlights: [
    "Lotus Tower observation deck",
    "Port City promenade & marina",
    "One Galle Face mall & food court",
    "Sunset over Galle Face Green",
  ],
  duration: "~4 hrs",
  estCostUsd: [22, 40],
  vibe: 1,
  intensity: "easy",
  tags: ["city", "views", "shopping", "food"],
  images: img("lotus-tower-port-city"),
  goodToKnow: "Foreigner tickets are around US$20 + 18% VAT.",
};

const galleFaceStreetFood: Option = {
  id: "galle-face-street-food",
  slot: "night",
  base: "colombo",
  title: "Galle Face Green: sunset & street food",
  region: "colombo",
  tagline: "Kites, crowds and prawn fritters by the sea.",
  description:
    "Colombo's seafront promenade is where the whole city comes at dusk: kites, cricket, couples and families. Graze the stalls — isso vadai (crunchy prawn fritters), kottu, grilled corn, fresh mango with chilli — then grab a drink on the old Galle Face Hotel's verandah as the lights come on.",
  highlights: [
    "Sunset on the Galle Face promenade",
    "Isso vadai, kottu & mango with chilli",
    "G&T on the Galle Face Hotel verandah",
    "Cheap, chaotic, very Colombo",
  ],
  duration: "5 pm – 9 pm",
  estCostUsd: [5, 15],
  vibe: 0,
  tags: ["food", "sunset", "city", "chill"],
  images: img("galle-face-street-food"),
};

const casinoNight: Option = {
  id: "casino-night",
  slot: "night",
  base: "colombo",
  title: "Casino night in Colombo",
  region: "colombo",
  tagline: "Dress up, play a few hands, cash out (hopefully).",
  description:
    "Colombo is South Asia's casino capital. City of Dreams Sri Lanka — Melco's glitzy new integrated resort by Beira Lake — opened its gaming floor in August 2025, while Bally's and its sister Bellagio are the long-running 24-hour classics. Blackjack, roulette and baccarat, then dinner and drinks at the resort's bars.",
  highlights: [
    "City of Dreams — the new mega-resort",
    "Bally's & Bellagio — 24-hour classics",
    "Blackjack, roulette & baccarat",
    "Cocktails & late dinner after",
  ],
  duration: "8 pm – late",
  estCostUsd: [15, 60],
  vibe: 2,
  tags: ["casino", "nightlife", "city", "dress up"],
  images: img("casino-night"),
  goodToKnow:
    "Bring your passport — expect an ID and age check (18+/21+ depending on the venue). Sri Lankan citizens pay a US$100 government entry levy (since Jan 2026). Smart-casual dress. The cost shown is for food & drinks — not what you gamble!",
};

const PUB_GOLF_RULES = {
  title: "Pub Golf rules",
  items: [
    "Each bar is a hole. Par is the number of sips to finish your drink.",
    "Count your sips; lowest total after six holes wins the green jacket.",
    "Hole in one (finish in one sip): −1 bonus.",
    "Soft drinks & mocktails count — the score is sips, not units.",
    "Water hazard: a glass of water at every hole, or take a +1.",
    "Bunker: phone out at the bar = +1.",
    "Toilet break before hole 4 = +2.",
    "Dress code: golf caps, polos, plaid — commit to the bit.",
    "Know your limit. Anyone can switch to softs and keep playing.",
  ],
};

const pubGolfColombo: Option = {
  id: "pub-golf-colombo",
  slot: "night",
  base: "colombo",
  title: "Pub Golf: the Colombo course",
  region: "colombo",
  tagline: "Six bars, six pars, one scorecard. Fore!",
  description:
    "The classic Sidemen-style pub crawl, Colombo edition: each bar is a hole with a par, you count your sips, and the lowest score wins. The course runs from harbour views at the Kingsbury along the seafront to Colombo 3's rooftops, finishing with the house band at Rhythm & Blues. Short tuk-tuk hops between holes.",
  highlights: [
    "Six holes from the Kingsbury to Colombo 3",
    "Scorecards, golf caps & a green jacket",
    "Rooftops, a hotel verandah & a live band",
    "Ends where the dancing starts",
  ],
  duration: "7 pm – late (~5 hrs)",
  estCostUsd: [35, 70],
  vibe: 2,
  tags: ["pub crawl", "nightlife", "bars", "games"],
  images: img("pub-golf-colombo"),
  rules: PUB_GOLF_RULES,
  course: [
    { venue: "Sky Lounge, The Kingsbury", area: "Colombo 1", par: 3, note: "Tee off at sunset over the harbour" },
    { venue: "Galle Face Hotel verandah", area: "Galle Face", par: 4 },
    { venue: "ON14, OZO Colombo", area: "Colombo 3", par: 3, note: "Rooftop pool bar" },
    { venue: "Cloud Red, Cinnamon Red", area: "Colombo 3", par: 4 },
    { venue: "Curve Bar", area: "Colombo 3", par: 4 },
    { venue: "Rhythm & Blues", area: "Kollupitiya", par: 5, note: "Finish with the house band" },
  ],
  goodToKnow: "Colombo's bar scene changes fast — we'll confirm the six holes nearer the time. Fri & Sat are liveliest.",
};

const scubaDiving: Option = {
  id: "scuba-diving",
  slot: "day",
  base: "galle",
  title: "Scuba diving off Unawatuna",
  region: "galle",
  travelFromBase: 0.25,
  tagline: "Breathe underwater on the south coast's reefs and wrecks.",
  description:
    "Unawatuna and Hikkaduwa are home to the south coast's dive schools. First-timers do a PADI Discover Scuba — skills in the shallows, then a guided reef dive with turtles and parrotfish. Certified divers can head out to wrecks and rock reefs. Clear water and calm seas make December–March the season.",
  highlights: [
    "PADI Discover Scuba — no licence needed",
    "Reefs, wrecks, turtles & reef fish",
    "Small groups with instructors",
    "Dive shops in Unawatuna & Hikkaduwa",
  ],
  duration: "~3–4 hrs",
  estCostUsd: [60, 110],
  vibe: -2,
  intensity: "moderate",
  tags: ["diving", "ocean", "wildlife", "adventure"],
  images: img("scuba-diving"),
  goodToKnow:
    "Well-known shops include Divinguru (formerly the Unawatuna Diving Centre), Submarine Diving School and Poseidon Diving Station in Hikkaduwa. Don't fly within 18–24 hrs of diving — keep it off the last day.",
};

const teaAndStilts: Option = {
  id: "tea-and-stilts",
  slot: "day",
  base: "galle",
  title: "Handunugoda tea estate & the stilt fishermen",
  region: "galle",
  travelFromBase: 0.5,
  tagline: "A coastal tea estate, then Sri Lanka's most famous photo.",
  description:
    "Handunugoda, near Ahangama, is the coast's only tea estate — the free tour starts with tea and cake at the old planter's bungalow, walks through the factory and ends with a tasting of 20-plus teas, including the rare Virgin White. On the way back, stop at Koggala for the stilt fishermen perched over the surf.",
  highlights: [
    "Free tea-estate tour & tasting",
    "Virgin White Tea — the estate's speciality",
    "Stilt fishermen at Koggala",
    "Slow, scenic and easy",
  ],
  duration: "~4 hrs",
  estCostUsd: [2, 15],
  vibe: 0,
  intensity: "easy",
  tags: ["tea", "culture", "photography", "food"],
  images: img("tea-and-stilts"),
  goodToKnow:
    "These days the stilt fishermen mostly pose for tips (around LKR 500–1,000) — it's a photo moment, not a fishing trip.",
};

const bentotaWaterSports: Option = {
  id: "bentota-water-sports",
  slot: "day",
  base: "galle",
  title: "Jet skis & water sports in Bentota",
  region: "bentota",
  tagline: "Full throttle on Sri Lanka's water-sports river.",
  description:
    "Bentota's calm river mouth and long beach make it the island's water-sports capital: jet skis, banana boats, tube rides and wakeboarding, with operators lined up along the river. Make an afternoon of it with lunch on the beach — or do it as a stop on the Colombo → Galle transfer day.",
  highlights: [
    "Jet ski, banana boat & tube rides",
    "Calm river water — great for first-timers",
    "Beach lunch on Bentota's golden sand",
    "Ideal stop on the transfer day",
  ],
  duration: "~4 hrs + travel",
  estCostUsd: [30, 85],
  vibe: -1,
  intensity: "easy",
  tags: ["water sports", "adventure", "beach", "jet ski"],
  images: img("bentota-water-sports"),
  goodToKnow: "A 15-min jet ski runs roughly LKR 10,000–16,500; multi-ride packages are around US$40–85.",
};

const maduRiver: Option = {
  id: "madu-river-safari",
  slot: "day",
  base: "galle",
  title: "Madu River mangroves & turtle hatchery",
  region: "bentota",
  travelFromBase: 1,
  tagline: "Slow boats through mangrove tunnels and baby turtles.",
  description:
    "At Balapitiya, small boats nose through the mangrove tunnels of the Madu Ganga lagoon, past the island temple of Kothduwa and a cinnamon-peeling island. Pair it with the Kosgoda turtle hatchery, where rescued eggs hatch and the babies are released to the sea.",
  highlights: [
    "Mangrove tunnels by boat",
    "Kothduwa island temple",
    "Cinnamon island demo",
    "Kosgoda turtle hatchery",
  ],
  duration: "~4 hrs + travel",
  estCostUsd: [15, 30],
  vibe: -1,
  intensity: "easy",
  tags: ["nature", "boat", "wildlife", "culture"],
  images: img("madu-river-safari"),
};

const secretJungleParty: Option = {
  id: "secret-jungle-party",
  slot: "night",
  base: "galle",
  title: "Secret Jungle Party, Hiriketiya",
  region: "hiriketiya",
  tagline: "Techno and deep house in a hidden jungle clearing.",
  description:
    "Every Friday an underground party pops up in the coastal forest near Hiriketiya beach (Dikwella): local and international DJs playing techno, deep house and tech-house under the trees, with a cash-only jungle bar. The exact spot is revealed on Instagram (@secret_jungle_party) closer to the night.",
  highlights: [
    "Fridays, ~7 pm – 1 am",
    "Location revealed on @secret_jungle_party",
    "Tickets ~LKR 2,000–3,000 on MyTickets.lk",
    "Cash-only jungle bar",
  ],
  duration: "7 pm – 1 am (+ ~1.5–2 hrs each way)",
  estCostUsd: [10, 25],
  vibe: 2,
  tags: ["party", "techno", "nightlife", "late"],
  images: img("secret-jungle-party"),
  availableDays: [5],
  goodToKnow:
    "Fridays only — in our window the Fridays around New Year are 25 Dec and 1 Jan, so we'd check it's running those weeks. It's ~1.5–2 hrs each way from Galle, so expect to be back around 3 am (book a driver to wait). Buy tickets early on MyTickets.lk; Fridays can sell out.",
};

const pubGolfGalle: Option = {
  id: "pub-golf-galle",
  slot: "night",
  base: "galle",
  title: "Pub Golf: Galle Fort → Unawatuna",
  region: "galle",
  tagline: "Tee off inside the fort, finish on the beach.",
  description:
    "Pub Golf, south-coast edition: start with arrack sours in the lantern-lit lanes of Galle Fort, then a 15-minute tuk-tuk to Unawatuna's beach bars for the back three, finishing on a dance floor. Same rules — count your sips, beat par, lowest score wins.",
  highlights: [
    "Front three inside Galle Fort",
    "Back three on Unawatuna beach",
    "Scorecards & golf-caddy dress code",
    "Best on a Friday or Saturday",
  ],
  duration: "6 pm – late (~5 hrs)",
  estCostUsd: [35, 70],
  vibe: 2,
  tags: ["pub crawl", "nightlife", "bars", "games", "beach"],
  images: img("pub-golf-galle"),
  rules: PUB_GOLF_RULES,
  course: [
    { venue: "Ropewalk, Galle Fort Hotel", area: "Galle Fort", par: 3, note: "Order the arrack sour" },
    { venue: "The Living Room", area: "Galle Fort", par: 3 },
    { venue: "Coats of Arms Bar, Jetwing Lighthouse", area: "Galle", par: 4 },
    { venue: "Kingfisher", area: "Unawatuna beach", par: 4 },
    { venue: "Happy Banana", area: "Unawatuna beach", par: 4 },
    { venue: "555ONE Night Club, Araliya", area: "Unawatuna", par: 5, note: "Finish on the dance floor" },
  ],
  goodToKnow:
    "Galle Fort winds down around 11 pm, so tee off early. Happy Banana's party night is Friday and Kingfisher's is Saturday — we'll confirm the course nearer the time.",
};

const nyeMountLavinia: Option = {
  id: "nye-mount-lavinia",
  slot: "night",
  base: "colombo",
  title: "NYE by the sea at Mount Lavinia",
  region: "colombo",
  travelFromBase: 0.5,
  tagline: "Live bands, a beach party and fireworks along the coast.",
  description:
    "The grand old Mount Lavinia Hotel throws a New Year's Eve party on its beach — last year's was a Havana-themed night with live Latin bands. Dinner and dancing on the sand, then fireworks along the Colombo coast at midnight.",
  highlights: [
    "Beachfront party at a colonial landmark",
    "Live bands & DJs",
    "Fireworks along the coast at midnight",
    "20 minutes from the city",
  ],
  duration: "8 pm – late",
  estCostUsd: [50, 120],
  vibe: 2,
  tags: ["nye", "beach party", "live music", "fireworks"],
  images: img("nye-mount-lavinia"),
  goodToKnow: "A ticketed hotel event — tickets usually go on sale in November; we'd book as a group.",
};

const nyeGalleFort: Option = {
  id: "nye-galle-fort",
  slot: "night",
  base: "galle",
  title: "NYE in Galle Fort",
  region: "galle",
  tagline: "Champagne in the fort, fireworks over the bay.",
  description:
    "Galle's New Year is elegant rather than wild: a long dinner in one of the fort's colonial hotels or courtyard restaurants, live jazz, then out onto the ramparts at midnight as fireworks pop along the beaches. Unawatuna's beach parties are 15 minutes away if you want to keep going.",
  highlights: [
    "NYE dinner inside the fort",
    "Midnight on the ramparts",
    "Fireworks along the bay",
    "Unawatuna parties 15 min away",
  ],
  duration: "8 pm – late",
  estCostUsd: [40, 120],
  vibe: 1,
  tags: ["nye", "dinner", "fireworks", "culture"],
  images: img("nye-galle-fort"),
  goodToKnow: "Fort restaurants and hotels sell NYE dinners in advance — we'd book in November.",
};

// ── Colombo base · daytime ──────────────────────────────────────
export const colomboDayOptions: Option[] = [
  {
    id: "negombo-lagoon",
    slot: "day",
    base: "colombo",
    title: "Negombo lagoon & mangroves by boat",
    region: "negombo",
    tagline: "Mangroves, fishermen and a slow first day near the airport.",
    description:
      "Glide through Negombo's lagoon and mangrove channels in a small boat, past fishermen casting nets, outrigger canoes and wading birds. Stop at the fish market and the old Dutch canal, then spend the afternoon on Negombo beach. It's about an hour north of Colombo, right by the airport.",
    highlights: [
      "Mangrove channels & birdlife",
      "Traditional outrigger 'oruwa' boats",
      "Lellama fish market",
      "~1 hr from Colombo, by the airport",
    ],
    duration: "~3 hrs + beach",
    estCostUsd: [15, 30],
    vibe: -1,
    intensity: "easy",
    tags: ["nature", "boat", "culture"],
    images: img("negombo-lagoon"),
  },
  {
    id: "colombo-tuk-tuk",
    slot: "day",
    base: "colombo",
    title: "Colombo by tuk-tuk: markets, temples & street food",
    region: "colombo",
    tagline: "The capital at full volume.",
    description:
      "Zip through Pettah's chaotic bazaars, past the candy-striped Red Mosque, Gangaramaya Temple and Beira Lake, then the colonial Fort district and the Old Dutch Hospital. End at Galle Face Green with isso vadai (prawn fritters) and kottu as the sun sets over the ocean.",
    highlights: [
      "Pettah markets & the Red Mosque",
      "Gangaramaya Temple & Seema Malaka",
      "Colonial Fort & Old Dutch Hospital",
      "Street food at Galle Face Green",
    ],
    duration: "~5 hrs",
    estCostUsd: [20, 45],
    vibe: 1,
    intensity: "easy",
    tags: ["city", "food", "culture", "social"],
    images: img("colombo-tuk-tuk"),
  },
  kandyDayTrip,
  colomboDesignTrail,
  mountLavinia,
  lotusTower,
];

// ── Colombo base · evening ──────────────────────────────────────
export const colomboNightOptions: Option[] = [
  {
    id: "colombo-club-night",
    slot: "night",
    base: "colombo",
    title: "Colombo club night",
    region: "colombo",
    tagline: "Rooftop warm-up, then the city's dance floors.",
    description:
      "Colombo has the island's biggest nights out. Pre-drinks with harbour views at Sky Lounge (The Kingsbury), then on to weekend DJ nights at H2O at Cinnamon Lakeside, Latin-flavoured Margarita Blue, or Rhythm & Blues — a Kollupitiya institution with live bands. Fridays and Saturdays are busiest; dress smart-casual.",
    highlights: [
      "Rooftop cocktails over the harbour",
      "Weekend DJ nights at hotel clubs",
      "Live bands at Rhythm & Blues",
      "Late finishes on Fri & Sat",
    ],
    duration: "9 pm – late",
    estCostUsd: [30, 70],
    vibe: 2,
    tags: ["club", "nightlife", "city", "dancing"],
    images: img("colombo-club-night"),
    goodToKnow:
      "Colombo's club scene changes fast — we'd lock in the hottest spot nearer the time. Entry is usually free–$15 on a guest list; smart-casual dress codes apply.",
  },
  {
    id: "colombo-rooftop",
    slot: "night",
    base: "colombo",
    title: "Sunset rooftop cocktails over Colombo",
    region: "colombo",
    tagline: "Watch the skyline light up from the 14th floor.",
    description:
      "Colombo's rooftops are made for golden hour: ON14 at the OZO hotel has an infinity pool and 360° views, Cloud Red at Cinnamon Red does great happy hours, and the Kingsbury's Sky Lounge looks out over the port. Cocktails as the Lotus Tower lights up, then a long dinner nearby.",
    highlights: [
      "Sunset over the Indian Ocean",
      "ON14, Cloud Red or Sky Lounge",
      "Happy hours & weekend DJs",
      "Dinner after in Colombo 3",
    ],
    duration: "5 pm – 11 pm",
    estCostUsd: [25, 50],
    vibe: 1,
    tags: ["rooftop", "cocktails", "city", "sunset"],
    images: img("colombo-rooftop"),
  },
  {
    id: "ministry-of-crab",
    slot: "night",
    base: "colombo",
    title: "Ministry of Crab feast",
    region: "colombo",
    tagline: "Giant lagoon crabs in the old Dutch Hospital.",
    description:
      "Ministry of Crab — co-owned by two Sri Lankan cricket legends — is a fixture on Asia's 50 Best lists. Huge Sri Lankan lagoon crabs come garlic-chilli, pepper or curried, eaten with your hands in the 17th-century Old Dutch Hospital. Order the crab-liver pâté, book well ahead, then hit the bars around the Fort.",
    highlights: [
      "Signature garlic-chilli crab",
      "17th-century Old Dutch Hospital setting",
      "A regular on Asia's 50 Best Restaurants",
      "Bars right next door for after",
    ],
    duration: "~2.5 hrs",
    estCostUsd: [45, 100],
    vibe: 1,
    tags: ["food", "dinner", "city", "social"],
    images: img("ministry-of-crab"),
    goodToKnow:
      "Book 2–3 weeks ahead for late December. Crab is priced by size — sharing big ones as a group is much cheaper.",
  },
  galleFaceStreetFood,
  casinoNight,
  pubGolfColombo,
];

// ── Galle base · daytime ────────────────────────────────────────
export const galleDayOptions: Option[] = [
  {
    id: "mirissa-whale-watching",
    slot: "day",
    base: "galle",
    title: "Blue whale watching off Mirissa",
    region: "mirissa",
    tagline: "Go looking for the biggest animal that has ever lived.",
    description:
      "Boats leave Mirissa harbour around 6:30 am for the edge of the continental shelf, where blue whales feed unusually close to shore — one of the most reliable spots on the planet. Spinner dolphins and sperm whales often join in. It's an early and sometimes choppy morning, but a blue whale's tail rising out of the Indian Ocean is unforgettable.",
    highlights: [
      "Blue whales — Nov to Apr is peak season",
      "Spinner dolphins, sometimes sperm whales",
      "Breakfast on board",
      "Back by lunch for the beach",
    ],
    duration: "~4–6 hrs (from 6:30 am)",
    estCostUsd: [40, 70],
    vibe: -1,
    intensity: "moderate",
    tags: ["wildlife", "ocean", "boat", "early"],
    images: img("mirissa-whale-watching"),
    goodToKnow:
      "Take seasickness tablets the night before if you're prone. We'd pick an operator that follows whale-watching guidelines (no chasing or crowding).",
  },
  {
    id: "mirissa-beach-hop",
    slot: "day",
    base: "galle",
    title: "Mirissa beach-hop: Coconut Tree Hill to Secret Beach",
    region: "mirissa",
    tagline: "Palm-hill photos, hidden coves and a long lunch on the sand.",
    description:
      "Start at Coconut Tree Hill — the red-earth headland of leaning palms you've definitely seen online — then tuk-tuk to Secret Beach's rock pools and climb Parrot Rock at the end of the bay. Spend the afternoon on loungers with king coconuts and fresh seafood, and stay for sunset drinks as the beach bars warm up.",
    highlights: [
      "Coconut Tree Hill at golden hour",
      "Secret Beach & Parrot Rock",
      "Beach-bar lunch with your feet in the sand",
      "Sunset cocktails on Mirissa beach",
    ],
    duration: "Full day, at your own pace",
    estCostUsd: [15, 35],
    vibe: 1,
    intensity: "easy",
    tags: ["beach", "photography", "food", "social"],
    images: img("mirissa-beach-hop"),
  },
  {
    id: "weligama-surf-lesson",
    slot: "day",
    base: "galle",
    title: "Learn to surf in Weligama Bay",
    region: "mirissa",
    tagline: "Sri Lanka's friendliest beginner waves — you will stand up.",
    description:
      "Weligama's wide, sandy bay rolls in soft, waist-high waves that are made for first-timers. A two-hour lesson with a local instructor gets most people standing, and then you're free to keep practising. The town is a laid-back surf hub of smoothie bowls, hammocks and surf clubs — perfect for the afternoon recovery.",
    highlights: [
      "2-hr lesson with board & rash vest",
      "Soft, sandy-bottomed beginner waves",
      "Board rental to keep practising",
      "Surf-town cafés to refuel",
    ],
    duration: "~3 hrs",
    estCostUsd: [15, 35],
    vibe: -1,
    intensity: "moderate",
    tags: ["surfing", "beach", "active"],
    images: img("weligama-surf-lesson"),
  },
  {
    id: "unawatuna-jungle-beach",
    slot: "day",
    base: "galle",
    title: "Unawatuna & Jungle Beach day",
    region: "galle",
    tagline: "A sheltered swimming bay, a jungle cove and beach bars.",
    description:
      "Unawatuna is a horseshoe bay protected by a reef, so the water is calm enough to actually swim and snorkel. Walk or tuk-tuk over the Rumassala headland to Jungle Beach, a little cove backed by forest, then come back for a lazy afternoon of cocktails, grilled fish and hammocks. Galle Fort is 15 minutes away for sunset.",
    highlights: [
      "Calm, reef-protected swimming bay",
      "Jungle Beach & the Japanese Peace Pagoda",
      "Snorkelling straight off the beach",
      "Long beach-bar afternoon",
    ],
    duration: "Full day, at your own pace",
    estCostUsd: [15, 35],
    vibe: 1,
    intensity: "easy",
    tags: ["beach", "swimming", "snorkeling", "social"],
    images: img("unawatuna-jungle-beach"),
  },
  {
    id: "hikkaduwa-turtles",
    slot: "day",
    base: "galle",
    title: "Snorkel with sea turtles in Hikkaduwa",
    region: "hikkaduwa",
    tagline: "Wild green turtles cruising the shallows, right off the beach.",
    description:
      "Hikkaduwa's coral sanctuary sits a few hundred metres offshore, and wild green turtles graze in the shallows by the beach almost every day. Snorkel straight from the sand or take a glass-bottom boat over the reef, then spend the afternoon on one of the south coast's longest beaches.",
    highlights: [
      "Wild green turtles in waist-deep water",
      "Coral sanctuary snorkelling",
      "Glass-bottom boat option",
      "Beach bars all along the strip",
    ],
    duration: "~3–4 hrs + beach time",
    estCostUsd: [10, 30],
    vibe: -1,
    intensity: "easy",
    tags: ["wildlife", "snorkeling", "beach", "ocean"],
    images: img("hikkaduwa-turtles"),
    goodToKnow:
      "Please don't feed or touch the turtles — people sometimes hand out seaweed for photos, but it harms them.",
  },
  {
    id: "galle-fort",
    slot: "day",
    base: "galle",
    title: "Galle Fort: ramparts, boutiques & cafés",
    region: "galle",
    tagline: "Wander a 400-year-old walled town by the sea.",
    description:
      "Inside Galle Fort's Dutch ramparts are lanes of colonial villas turned into cafés, design shops, gelato bars and galleries. Walk the walls past the lighthouse, watch locals leap off Flag Rock, browse for linen and gems, and linger over a long lunch in a shady courtyard. Easy, beautiful and very social.",
    highlights: [
      "Walk the ramparts & the lighthouse",
      "Boutiques, galleries & courtyard cafés",
      "Cliff jumpers at Flag Rock",
      "UNESCO World Heritage old town",
    ],
    duration: "Half to full day",
    estCostUsd: [10, 40],
    vibe: 1,
    intensity: "easy",
    tags: ["culture", "history", "shopping", "food", "photography"],
    images: img("galle-fort"),
  },
  scubaDiving,
  teaAndStilts,
  bentotaWaterSports,
  maduRiver,
];

// ── Galle base · evening ────────────────────────────────────────
export const galleNightOptions: Option[] = [
  {
    id: "unawatuna-beach-party",
    slot: "night",
    base: "galle",
    title: "Unawatuna beach party",
    region: "galle",
    tagline: "DJs, fire shows and dancing on the sand.",
    description:
      "Unawatuna's bay becomes the south coast's most dependable weekly party in season: Happy Banana on Fridays, Kingfisher's beach-lounge DJ night on Saturdays, and Angel Beach's pool parties from December to March. Expect barefoot dancing, fire dancers and a mixed crowd of travellers and locals into the early hours.",
    highlights: [
      "Happy Banana — Fridays",
      "Kingfisher — Saturday DJ nights",
      "Angel Beach pool parties (Dec–Mar)",
      "Fire dancers on the sand",
    ],
    duration: "9 pm – 2 am",
    estCostUsd: [15, 40],
    vibe: 2,
    tags: ["beach party", "club", "dancing", "nightlife"],
    images: img("unawatuna-beach-party"),
    goodToKnow:
      "Party nights are weekly and can shift — we'd match the date to what's on. Poya (full-moon) days are dry island-wide: no alcohol sales.",
  },
  {
    id: "galle-fort-sunset-dinner",
    slot: "night",
    base: "galle",
    title: "Sunset on Galle Fort's ramparts & dinner",
    region: "galle",
    tagline: "Golden hour on the walls, then lantern-lit lanes.",
    description:
      "Join half of Galle on the fort walls as the sun drops into the ocean — kids playing cricket, couples, kites — then wander into the lantern-lit lanes for dinner. There's everything from rice-and-curry to wood-fired pizza and seafood platters, plus a few relaxed cocktail and jazz bars to finish.",
    highlights: [
      "Sunset from the bastions",
      "Dinner in a colonial courtyard",
      "Cocktail & jazz bars",
      "Quiet, beautiful streets at night",
    ],
    duration: "5 pm – 11 pm",
    estCostUsd: [20, 45],
    vibe: 0,
    tags: ["sunset", "food", "culture", "chill"],
    images: img("galle-fort-sunset-dinner"),
  },
  {
    id: "doctors-house-madiha",
    slot: "night",
    base: "galle",
    title: "The Doctor's House, Madiha",
    region: "mirissa",
    tagline: "The south coast's favourite party, in a 200-year-old villa.",
    description:
      "A beachfront Dutch-era villa just east of Mirissa that anchors the south-coast scene: wood-fired pizza and cold beers at sunset, then live bands and DJs playing deep house and disco into the night. It pulls in surfers, travellers and Colombo weekenders, and hosts bigger ticketed nights with international DJs.",
    highlights: [
      "DJ nights on Wednesdays & Saturdays",
      "Wood-fired pizza at sunset",
      "Beachfront garden dance floor",
      "Occasional big-name events",
    ],
    duration: "6 pm – midnight+",
    estCostUsd: [15, 40],
    vibe: 2,
    tags: ["beach party", "dj", "nightlife", "live music"],
    images: img("doctors-house-madiha"),
    goodToKnow:
      "Regular nights are Wednesday & Saturday (6 pm–midnight) as of 2026; special events are ticketed (around LKR 3,500–6,000).",
  },
  {
    id: "mirissa-seafood-bbq",
    slot: "night",
    base: "galle",
    title: "Candlelit seafood on Mirissa beach",
    region: "mirissa",
    tagline: "Pick your fish off the ice, eat it with your toes in the sand.",
    description:
      "Every evening Mirissa's beach restaurants drag their tables onto the sand, light candles and lay out the day's catch on ice — tuna, barracuda, prawns, lobster. Choose your fish, they grill it, and you eat by the waves with a cold Lion. Mellow, social and very Sri Lanka, with beach bars nearby if you want more.",
    highlights: [
      "Choose-your-catch seafood BBQ",
      "Tables right on the sand",
      "Lion lager & arrack cocktails",
      "Beach bars nearby for later",
    ],
    duration: "~3 hrs",
    estCostUsd: [15, 35],
    vibe: 1,
    tags: ["food", "beach", "social", "chill"],
    images: img("mirissa-seafood-bbq"),
  },
  {
    id: "hikkaduwa-beach-party",
    slot: "night",
    base: "galle",
    title: "Hikkaduwa beach party",
    region: "hikkaduwa",
    tagline: "The original south-coast party strip.",
    description:
      "Hikkaduwa has been partying since the hippie-trail days. In season there's a weekly rotation — Funky De Bar on Thursdays, Vibration on Fridays (the biggest crowd on this stretch), Mambo's on Saturdays — with reggae, EDM and baila on the sand. Cheap drinks, cheap entry, very lively.",
    highlights: [
      "Vibration's Friday beach party",
      "Mambo's on Saturdays",
      "Reggae, EDM & baila",
      "Cheap entry (around $5)",
    ],
    duration: "9 pm – late",
    estCostUsd: [10, 30],
    vibe: 2,
    tags: ["beach party", "club", "nightlife", "dancing"],
    images: img("hikkaduwa-beach-party"),
    goodToKnow:
      "Quieter than its heyday, and party nights move around by season — we'd check what's on for our dates.",
  },
  {
    id: "weligama-sundowners",
    slot: "night",
    base: "galle",
    title: "Sundowners in Weligama's surf bars",
    region: "mirissa",
    tagline: "Watch the last surfers of the day with a cocktail.",
    description:
      "Weligama and neighbouring Ahangama are the coolest stretch of the coast right now: rooftop bars, surf clubs and beach shacks where you watch the sunset session, then hop between spots — in season there's a rooftop DJ night somewhere almost every evening. Relaxed but social, and easy to turn into a bigger night.",
    highlights: [
      "Sunset over Weligama Bay",
      "Surf-club bars & rooftops",
      "Smash burgers, sliders & sushi",
      "Turns into a party if the mood's right",
    ],
    duration: "5 pm – 11 pm",
    estCostUsd: [15, 40],
    vibe: 1,
    tags: ["sunset", "cocktails", "surf", "social"],
    images: img("weligama-sundowners"),
  },
  secretJungleParty,
  pubGolfGalle,
];

// ── New Year's Eve (one pair per base) ──────────────────────────
export const nyeOptions: Option[] = [
  {
    id: "nye-colombo-rooftop",
    slot: "night",
    base: "colombo",
    title: "NYE rooftop countdown in Colombo",
    region: "colombo",
    tagline: "Champagne above the skyline, fireworks over Galle Face.",
    description:
      "Ring in 2027 in the capital: a hotel rooftop or gala dinner with skyline views, then fireworks over Galle Face Green and the Port City at midnight. Glammier and more comfortable than the beach — dress up, eat well, and keep going at a club afterwards if you've got it in you.",
    highlights: [
      "Rooftop or gala dinner with views",
      "Fireworks over Galle Face Green",
      "A proper dress-up night",
      "Clubs open late afterwards",
    ],
    duration: "8 pm – late",
    estCostUsd: [60, 150],
    vibe: 1,
    tags: ["nye", "rooftop", "fireworks", "city"],
    images: img("nye-colombo-rooftop"),
    goodToKnow: "Hotel NYE packages usually go on sale in November; we'd book as a group.",
  },
  nyeMountLavinia,
  {
    id: "nye-mirissa-beach-party",
    slot: "night",
    base: "galle",
    title: "NYE beach party on the south coast",
    region: "mirissa",
    tagline: "Count down barefoot on Mirissa beach, fireworks overhead.",
    description:
      "New Year's Eve is the biggest night of the year on the south coast, and Mirissa is where everyone goes. The whole bay becomes one long party: beach bars with DJs, fire dancers, fireworks over the water at midnight and dancing until sunrise. The big parties are ticketed and the coast road jams up, so we'd head over early from Galle (about an hour) with a driver booked for the way back.",
    highlights: [
      "Fireworks over the bay at midnight",
      "Beach bars with DJs all night",
      "Fire dancers & a sunrise finish",
      "~1 hr from Galle — book a driver",
    ],
    duration: "8 pm – sunrise",
    estCostUsd: [30, 80],
    vibe: 2,
    tags: ["nye", "beach party", "fireworks", "nightlife", "late"],
    images: img("nye-mirissa-beach-party"),
    goodToKnow:
      "South-coast stays book out early for New Year and prices jump — the earlier we book, the better.",
  },
  nyeGalleFort,
];

export const dayOptions: Option[] = [...colomboDayOptions, ...galleDayOptions];
export const nightOptions: Option[] = [...colomboNightOptions, ...galleNightOptions];

/**
 * "Stay in" — offered on every Daytime and Evening slot, as often as people
 * like. Vibe 0 (perfectly balanced). Same id for both slots; copy differs.
 */
export type StayIn = {
  id: "stay";
  slot: "day" | "night";
  title: string;
  tagline: string;
  description: string;
  highlights: string[];
  vibe: 0;
  images: Photo[];
};

const stayPhotos = photos["stay-in"] ?? [];

export const stayIn: Record<"day" | "night", StayIn> = {
  day: {
    id: "stay",
    slot: "day",
    title: "Stay in",
    tagline: "Slow morning, pool, nap, no plans.",
    description:
      "A day with zero agenda. Sleep in, take a long breakfast, read by the pool, nap in a hammock — maybe a massage or a wander down to the nearest beach. Perfect for recharging between big days (or recovering from last night).",
    highlights: [
      "Sleep in & a long breakfast",
      "Pool, hammock and a good book",
      "Optional massage or beach wander",
      "Pick it as often as you like",
    ],
    vibe: 0,
    images: [stayPhotos[1], stayPhotos[0]].filter(Boolean),
  },
  night: {
    id: "stay",
    slot: "night",
    title: "Stay in",
    tagline: "Dinner and hangs at the villa.",
    description:
      "Sometimes the best night is the one where nobody has to go anywhere. Have the villa cook make a rice-and-curry spread (or order in), crack open the arrack, play cards by the pool and get a proper night's sleep before tomorrow's adventure.",
    highlights: [
      "Dinner at the villa — no travel",
      "Pool, cards & music",
      "Early night before big days",
      "Pick it as often as you like",
    ],
    vibe: 0,
    images: stayPhotos,
  },
};
