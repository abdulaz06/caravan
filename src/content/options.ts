import { photos } from "./photos.generated";
import type { Option } from "./types";

/**
 * Every activity/evening someone can pick. Researched Oct 2026 for late
 * December travel — prices are rough per-person USD and venues change, so
 * treat anything marked `goodToKnow` as worth re-checking closer to the date.
 *
 * vibe: -2 pure nature/adventure … 0 balanced … +2 pure nightlife
 * Photos come from scripts/image-picks.json (run `npm run photos`).
 */
const img = (id: string) => photos[id] ?? [];

export const dayOptions: Option[] = [
  // ── Sigiriya & Dambulla ─────────────────────────────────────────────
  {
    id: "pidurangala-sunrise",
    slot: "day",
    title: "Sunrise on Pidurangala Rock",
    region: "sigiriya",
    tagline: "The best view of Sigiriya is from the rock next door.",
    description:
      "Head out in the dark and climb Pidurangala — temple steps, then a short boulder scramble at the top — to watch the sun rise behind Lion Rock across a sea of jungle. It's a fraction of Sigiriya's price, far less crowded, and it's the photo everyone wants. Back down for a huge breakfast and a lazy afternoon by the pool.",
    highlights: [
      "Sunrise over Lion Rock and the jungle plains",
      "Reclining Buddha in a cave temple halfway up",
      "Short boulder scramble at the top",
      "Done by 9 am — afternoon free",
    ],
    duration: "~3 hrs (from 5 am)",
    estCostUsd: [3, 10],
    vibe: -2,
    intensity: "moderate",
    tags: ["hike", "sunrise", "views", "photography"],
    images: img("pidurangala-sunrise"),
    goodToKnow:
      "Entry is about LKR 1,000 (~$3), cash only. Leave around 5 am to summit for sunrise (~6:20 am in late December). Cover knees and shoulders for the temple section.",
  },
  {
    id: "sigiriya-lion-rock",
    slot: "day",
    title: "Lion Rock & the Dambulla cave temples",
    region: "sigiriya",
    tagline: "Climb a 5th-century sky palace, then explore golden cave shrines.",
    description:
      "Sigiriya is the icon: a 200 m rock with a king's palace on top, reached past ancient frescoes, a mirror wall and two giant stone lion paws. After lunch, Dambulla's cave temples are packed with painted ceilings and around 150 Buddha statues. A big-ticket culture day with serious views.",
    highlights: [
      "~1,200 steps past frescoes and the lion's paws",
      "Palace ruins and 360° views from the summit",
      "Dambulla's painted cave temples (UNESCO)",
      "Early start beats the heat and the crowds",
    ],
    duration: "~6 hrs",
    estCostUsd: [40, 55],
    vibe: -1,
    intensity: "moderate",
    tags: ["culture", "history", "hike", "views", "unesco"],
    images: img("sigiriya-lion-rock"),
    goodToKnow:
      "Sigiriya is about $35 per foreign adult (rupees or card); Dambulla is roughly LKR 2,000. Gates open at 7 am — first in, fewest crowds.",
  },
  {
    id: "elephant-safari-kaudulla",
    slot: "day",
    title: "Wild elephant safari near Sigiriya",
    region: "sigiriya",
    tagline: "Herds of a hundred elephants grazing into golden hour.",
    description:
      "The Cultural Triangle's parks — Minneriya, Kaudulla and Hurulu — host some of Asia's biggest wild elephant herds. Jeeps head wherever the herds are that week, and in December that's usually Kaudulla or Hurulu. Expect babies, bathing, mud fights and very close encounters on an afternoon drive.",
    highlights: [
      "Dozens (sometimes 100+) wild elephants",
      "Afternoon drive into golden hour",
      "Jeeps go wherever the herds are that week",
      "Pairs perfectly with a Sigiriya stay",
    ],
    duration: "~3–4 hrs (afternoon)",
    estCostUsd: [45, 75],
    vibe: -2,
    intensity: "easy",
    tags: ["wildlife", "safari", "photography"],
    images: img("elephant-safari-kaudulla"),
    goodToKnow:
      "Minneriya's famous 'Gathering' peaks Aug–Oct. In December the herds usually move to Kaudulla or Hurulu Eco Park — good operators choose the park on the day.",
  },

  // ── Yala ────────────────────────────────────────────────────────────
  {
    id: "yala-leopard-safari",
    slot: "day",
    title: "Leopard safari in Yala",
    region: "yala",
    tagline: "Open jeep, golden light, the densest leopard population on Earth.",
    description:
      "Bump through scrub jungle, lagoons and giant boulders in an open 4x4 hunting for leopards — with elephants, crocodiles, buffalo, sloth bears and peacocks everywhere. Dawn drives catch the cats on the move; afternoon drives end with the sun dropping over the park. Sightings aren't guaranteed, but Yala gives you the best odds anywhere.",
    highlights: [
      "Leopards, elephants, crocs, maybe a sloth bear",
      "Open-top jeep with a tracker",
      "Beach and lagoon views inside the park",
      "Dawn or late-afternoon game drive",
    ],
    duration: "~4–5 hrs (half day)",
    estCostUsd: [60, 100],
    vibe: -2,
    intensity: "easy",
    tags: ["wildlife", "safari", "photography"],
    images: img("yala-leopard-safari"),
    goodToKnow:
      "Late December is peak season, so there are a lot of jeeps — a good driver makes all the difference. Park entry is roughly $40 per foreigner on top of the jeep.",
  },

  // ── Mirissa & Weligama ──────────────────────────────────────────────
  {
    id: "mirissa-whale-watching",
    slot: "day",
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
    tags: ["wildlife", "ocean", "boat"],
    images: img("mirissa-whale-watching"),
    goodToKnow:
      "Take seasickness tablets the night before if you're prone. We'd pick an operator that follows whale-watching guidelines (no chasing or crowding).",
  },
  {
    id: "mirissa-beach-hop",
    slot: "day",
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

  // ── Galle, Unawatuna & Hikkaduwa ────────────────────────────────────
  {
    id: "unawatuna-jungle-beach",
    slot: "day",
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

  // ── Ella ────────────────────────────────────────────────────────────
  {
    id: "ella-rock",
    slot: "day",
    title: "Summit Ella Rock",
    region: "ella",
    tagline: "The big one: rail tracks, tea fields and a cliff-edge view.",
    description:
      "The classic Ella hike starts by walking the railway line out of town, then climbs through tea estates and eucalyptus forest to a rocky summit with a huge drop over the Ella Gap. It's steep in places and easy to take a wrong turn, so many people go with a guide. Start early to beat the clouds that roll in by late morning.",
    highlights: [
      "Walk the train tracks out of Ella",
      "Tea estates & eucalyptus forest",
      "Cliff-top view over the Ella Gap",
      "A proper workout that earns the afternoon beer",
    ],
    duration: "~4–5 hrs return",
    estCostUsd: [0, 15],
    vibe: -2,
    intensity: "tough",
    tags: ["hike", "views", "sunrise"],
    images: img("ella-rock"),
    goodToKnow:
      "The trail isn't well marked — a local guide (~$10–15) or an offline map helps. Start by 6–7 am for clear views.",
  },
  {
    id: "nine-arches-little-adams",
    slot: "day",
    title: "Nine Arches Bridge & Little Adam's Peak",
    region: "ella",
    tagline: "Ella's two icons in one easy, gorgeous morning.",
    description:
      "Little Adam's Peak is a gentle 45-minute walk through tea gardens to a ridge with sweeping valley views. From there it's a short hop to the Nine Arches Bridge, a colonial stone viaduct deep in the jungle — time it for when the blue train curves across. Finish with brunch and a smoothie back in town.",
    highlights: [
      "Little Adam's Peak ridge views",
      "Watch the train cross the Nine Arches",
      "Tea-garden paths, no scrambling",
      "Brunch in Ella town",
    ],
    duration: "~4 hrs",
    estCostUsd: [0, 10],
    vibe: -1,
    intensity: "easy",
    tags: ["hike", "views", "photography", "train"],
    images: img("nine-arches-little-adams"),
  },
  {
    id: "flying-ravana-zipline",
    slot: "day",
    title: "Flying Ravana zipline & Ravana Falls",
    region: "ella",
    tagline: "Fly half a kilometre over the tea, then cool off at a waterfall.",
    description:
      "Flying Ravana is one of Sri Lanka's longest ziplines — around 550 m, swooping over tea plantations and jungle with Little Adam's Peak in view. Pair it with Ravana Falls, a tall, tiered waterfall just outside town, and a stop at a spice garden on the way back.",
    highlights: [
      "~550 m zipline over the tea hills",
      "Ravana Falls (bring swimwear)",
      "Big adrenaline, easy on the legs",
      "Views of Little Adam's Peak",
    ],
    duration: "~3–4 hrs",
    estCostUsd: [30, 50],
    vibe: -1,
    intensity: "easy",
    tags: ["adventure", "waterfall", "views"],
    images: img("flying-ravana-zipline"),
    goodToKnow:
      "Flying Ravana runs roughly 9 am–5 pm and pauses in heavy rain; expect around $30–40 a ride.",
  },
  {
    id: "ella-cooking-class",
    slot: "day",
    title: "Sri Lankan cooking class in Ella",
    region: "ella",
    tagline: "Learn to make a ten-curry feast — then eat all of it.",
    description:
      "Ella's home cooking classes walk you through a proper Sri Lankan rice-and-curry spread: dhal, coconut sambol, jackfruit or beetroot curry, fish or chicken, and fresh roti — cooked in clay pots over a wood fire. It's hands-on, chatty and ends with the best lunch of the trip. A great one to do as a whole group.",
    highlights: [
      "Cook 6–10 dishes in clay pots",
      "Grind spices & scrape your own coconut",
      "Eat everything you made",
      "Recipes to take home",
    ],
    duration: "~3 hrs",
    estCostUsd: [15, 30],
    vibe: 0,
    intensity: "easy",
    tags: ["food", "culture", "social"],
    images: img("ella-cooking-class"),
  },

  // ── Nuwara Eliya ────────────────────────────────────────────────────
  {
    id: "horton-plains",
    slot: "day",
    title: "Horton Plains & World's End",
    region: "nuwara-eliya",
    tagline: "A cloud-forest plateau that ends in an 870 m drop.",
    description:
      "A 9 km loop across misty grasslands and cloud forest leads to World's End, where the plateau falls 870 m straight down — on a clear morning you can see all the way to the coast. Baker's Falls is on the way back. You need to be at the gate around 6 am, because by 10 the clouds usually roll in.",
    highlights: [
      "World's End & Mini World's End cliffs",
      "Baker's Falls",
      "Sambar deer on the grasslands",
      "Crisp, cool air at 2,100 m",
    ],
    duration: "~3 hrs walk + early drive",
    estCostUsd: [35, 55],
    vibe: -2,
    intensity: "moderate",
    tags: ["hike", "views", "nature", "sunrise"],
    images: img("horton-plains"),
    goodToKnow:
      "Foreigner entry is steep (roughly $25–40 with taxes and vehicle fee). Leave Nuwara Eliya around 5 am — and bring a warm layer.",
  },
  {
    id: "tea-estate-high-tea",
    slot: "day",
    title: "Tea estate tour & colonial high tea",
    region: "nuwara-eliya",
    tagline: "From leaf to cup in the heart of tea country.",
    description:
      "Walk the emerald rows of a working estate like Pedro, one of the oldest around Nuwara Eliya, and see how leaf becomes Ceylon tea in a century-old factory, with a tasting at the end. Then do high tea properly — scones and sandwiches at the Grand Hotel or another colonial bungalow — before a stroll around Gregory Lake.",
    highlights: [
      "Working tea factory tour & tasting",
      "Tea pluckers on the hillsides",
      "High tea at a colonial hotel",
      "Gregory Lake & 'Little England' town",
    ],
    duration: "~5 hrs",
    estCostUsd: [15, 35],
    vibe: 0,
    intensity: "easy",
    tags: ["tea", "culture", "food", "photography"],
    images: img("tea-estate-high-tea"),
  },

  // ── Kandy ───────────────────────────────────────────────────────────
  {
    id: "peradeniya-gardens",
    slot: "day",
    title: "Royal Botanic Gardens, Peradeniya",
    region: "kandy",
    tagline: "60 hectares of giant trees, orchids and palm avenues.",
    description:
      "Just outside Kandy, Peradeniya is one of Asia's great botanic gardens: a Java fig tree with a canopy the size of a football pitch, avenues of royal palms, an orchid house, a spice garden and thousands of fruit bats hanging in the trees. Slow, green and gorgeous — a lovely reset between road trips.",
    highlights: [
      "The Great Java Fig tree",
      "Royal palm avenues",
      "Orchid house & spice garden",
      "Thousands of fruit bats",
    ],
    duration: "~3 hrs",
    estCostUsd: [8, 15],
    vibe: -1,
    intensity: "easy",
    tags: ["nature", "gardens", "photography"],
    images: img("peradeniya-gardens"),
  },
  {
    id: "kandy-temple-city",
    slot: "day",
    title: "Temple of the Tooth & old Kandy",
    region: "kandy",
    tagline: "Sri Lanka's most sacred temple, a lake walk and a lookout.",
    description:
      "The Temple of the Tooth Relic holds a tooth of the Buddha and is the spiritual heart of the country — go at puja time for the drums and offerings. Loop around Kandy Lake, wander the market and colonial streets, and finish at a viewpoint over the city. Pairs naturally with a Kandyan dance show at 5 pm.",
    highlights: [
      "Temple of the Tooth (UNESCO)",
      "Drum ceremony at puja time",
      "Kandy Lake loop & the market",
      "City viewpoint",
    ],
    duration: "~4–5 hrs",
    estCostUsd: [10, 25],
    vibe: 0,
    intensity: "easy",
    tags: ["culture", "temples", "history", "city"],
    images: img("kandy-temple-city"),
    goodToKnow: "Wear light clothing covering knees and shoulders; shoes come off inside.",
  },

  // ── Negombo & Colombo ───────────────────────────────────────────────
  {
    id: "negombo-lagoon",
    slot: "day",
    title: "Negombo lagoon & mangroves by boat",
    region: "negombo",
    tagline: "Ease into Sri Lanka, 20 minutes from the airport.",
    description:
      "Glide through Negombo's lagoon and mangrove channels in a small boat, past fishermen casting nets, outrigger canoes and wading birds. Stop at the fish market and the old Dutch canal, then spend the afternoon on Negombo beach — a gentle first or last day that keeps you close to the airport.",
    highlights: [
      "Mangrove channels & birdlife",
      "Traditional outrigger 'oruwa' boats",
      "Lellama fish market",
      "Beach afternoon near the airport",
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
];

export const nightOptions: Option[] = [
  // ── Colombo & Negombo ───────────────────────────────────────────────
  {
    id: "colombo-club-night",
    slot: "night",
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
  {
    id: "negombo-beach-sundowners",
    slot: "night",
    title: "Sundowners & seafood on Negombo beach",
    region: "negombo",
    tagline: "Feet in the sand, first night, no long drives.",
    description:
      "The easiest first or last night in Sri Lanka: Negombo's beach strip is 20 minutes from the airport and lined with relaxed bars and seafood restaurants. Watch the outrigger boats come in at sunset, order devilled prawns and an arrack cocktail, and ease into island time.",
    highlights: [
      "Sunset over the beach",
      "Devilled prawns & grilled fish",
      "Arrack cocktails & Lion lager",
      "20 minutes from the airport",
    ],
    duration: "~3 hrs",
    estCostUsd: [15, 35],
    vibe: 0,
    tags: ["beach", "food", "sunset", "chill"],
    images: img("negombo-beach-sundowners"),
  },

  // ── Galle & Unawatuna ───────────────────────────────────────────────
  {
    id: "unawatuna-beach-party",
    slot: "night",
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

  // ── Mirissa, Weligama & Madiha ──────────────────────────────────────
  {
    id: "doctors-house-madiha",
    slot: "night",
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
    id: "weligama-sundowners",
    slot: "night",
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

  // ── Hikkaduwa ───────────────────────────────────────────────────────
  {
    id: "hikkaduwa-beach-party",
    slot: "night",
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

  // ── Ella ────────────────────────────────────────────────────────────
  {
    id: "ella-bar-night",
    slot: "night",
    title: "Ella's main-street bar night",
    region: "ella",
    tagline: "Lanterns, live music and backpacker energy in the hills.",
    description:
      "Ella's single main street is lined with open-sided bars and restaurants that fill up every night with hikers swapping stories. Café Chill's upper deck is the classic, with Mandala and others opposite the station running DJ nights. A small scene with big atmosphere — and you can walk home.",
    highlights: [
      "Café Chill's upper deck",
      "DJ & live-music nights",
      "Kottu, curries & cocktails",
      "Walk home — no driving",
    ],
    duration: "7 pm – late",
    estCostUsd: [15, 35],
    vibe: 1,
    tags: ["bar", "live music", "nightlife", "social"],
    images: img("ella-bar-night"),
  },
  {
    id: "ninety-eight-acres-sunset",
    slot: "night",
    title: "Sunset drinks at 98 Acres",
    region: "ella",
    tagline: "Cocktails on a tea-estate terrace facing Little Adam's Peak.",
    description:
      "98 Acres Resort sits on a working tea estate with one of the best terraces in the hills — Little Adam's Peak and the Ella Gap straight ahead. Go up for golden hour, order a cocktail and watch the valley turn pink and gold. Stay for dinner or head back into town after.",
    highlights: [
      "Terrace view of Little Adam's Peak",
      "Golden hour over the tea",
      "Cocktails & a proper dinner",
      "Short tuk-tuk from town",
    ],
    duration: "~3 hrs",
    estCostUsd: [20, 45],
    vibe: 0,
    tags: ["sunset", "cocktails", "views", "chill"],
    images: img("ninety-eight-acres-sunset"),
  },

  // ── Kandy ───────────────────────────────────────────────────────────
  {
    id: "kandy-pub-night",
    slot: "night",
    title: "Kandy lake-view bar night",
    region: "kandy",
    tagline: "Sundowners over the city, then a few rounds.",
    description:
      "Kandy's nightlife is low-key but the views are great: Slightly Chilled Lounge has a terrace over the lake and city with DJs at night, and the Radisson's Bommu rooftop is a slicker option. It's an early-ish town, so start at sunset and make a night of it.",
    highlights: [
      "Lake & city views at sunset",
      "Slightly Chilled Lounge terrace",
      "Rooftop bar option",
      "Pool tables, sport & DJs",
    ],
    duration: "6 pm – 11 pm",
    estCostUsd: [15, 35],
    vibe: 1,
    tags: ["bar", "views", "nightlife", "social"],
    images: img("kandy-pub-night"),
    goodToKnow:
      "No alcohol is served near the Temple of the Tooth, and many Kandy bars close earlier than the coast.",
  },
  {
    id: "kandyan-dance-dinner",
    slot: "night",
    title: "Kandyan dance show & lakeside dinner",
    region: "kandy",
    tagline: "Drums, acrobatics and fire-walking — then dinner by the lake.",
    description:
      "The nightly Kandyan dance show is a whirl of drummers, costumed dancers, acrobatics and a grand finale of fire-eating and fire-walking. Afterwards, stroll to the Temple of the Tooth for the evening drum ceremony and finish with a long dinner overlooking the lake.",
    highlights: [
      "Kandyan dancers & drummers",
      "Fire-walking finale",
      "Evening puja at the temple",
      "Lakeside dinner",
    ],
    duration: "5 pm – 9 pm",
    estCostUsd: [15, 30],
    vibe: 0,
    tags: ["culture", "dance", "food", "chill"],
    images: img("kandyan-dance-dinner"),
  },

  // ── Into the wild ───────────────────────────────────────────────────
  {
    id: "yala-safari-camp",
    slot: "night",
    title: "Bonfire night at a Yala safari camp",
    region: "yala",
    tagline: "Tents, stars and the sounds of the jungle.",
    description:
      "Spend the night at one of the tented camps on the edge of Yala: barbecue and curries under the stars, a crackling bonfire, and the calls of peacocks and elephants after dark. It's beautifully remote — and you're already at the gate for the dawn safari.",
    highlights: [
      "Bonfire & BBQ dinner",
      "Stars with zero light pollution",
      "Jungle sounds after dark",
      "Wake up at the park gate",
    ],
    duration: "Evening & overnight",
    estCostUsd: [30, 80],
    vibe: -1,
    tags: ["camping", "wildlife", "stars", "chill"],
    images: img("yala-safari-camp"),
  },
  {
    id: "sigiriya-village-dinner",
    slot: "night",
    title: "Village feast near Sigiriya",
    region: "sigiriya",
    tagline: "Bullock cart, lake canoe and a clay-pot dinner.",
    description:
      "Village experiences around Habarana and Sigiriya take you by bullock cart and canoe to a farming hamlet as the light fades, where a family cooks a rice-and-curry feast in clay pots over a wood fire, served on lotus leaves. Simple, warm and genuinely local — then an early night before a sunrise climb.",
    highlights: [
      "Bullock cart & lake canoe at dusk",
      "Clay-pot village cooking",
      "Dinner served on lotus leaves",
      "Early night before sunrise",
    ],
    duration: "~3–4 hrs",
    estCostUsd: [20, 40],
    vibe: -1,
    tags: ["food", "culture", "village", "chill"],
    images: img("sigiriya-village-dinner"),
  },
];

export const nyeOptions: Option[] = [
  {
    id: "nye-mirissa-beach-party",
    slot: "night",
    title: "NYE beach party on the south coast",
    region: "mirissa",
    tagline: "Count down barefoot on Mirissa beach, fireworks overhead.",
    description:
      "New Year's Eve is the biggest night of the year on the south coast, and Mirissa is where everyone goes. The whole bay becomes one long party: beach bars with DJs, fire dancers, fireworks over the water at midnight and dancing until sunrise. The big parties are ticketed and the roads get busy, so the plan is to be staying close by.",
    highlights: [
      "Fireworks over the bay at midnight",
      "Beach bars with DJs all night",
      "Fire dancers & a sunrise finish",
      "Stay nearby — no driving",
    ],
    duration: "8 pm – sunrise",
    estCostUsd: [30, 80],
    vibe: 2,
    tags: ["nye", "beach party", "fireworks", "nightlife"],
    images: img("nye-mirissa-beach-party"),
    goodToKnow:
      "South-coast stays book out early for New Year and prices jump — the earlier we book, the better.",
  },
  {
    id: "nye-colombo-rooftop",
    slot: "night",
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
];

/** Always available on any evening, any number of times. Vibe 0. */
export const chillNight = {
  id: "chill",
  title: "Chill night in",
  tagline: "Dinner and hang at the villa.",
  description:
    "Sometimes the best night is the one where nobody has to go anywhere. Have the villa cook make a rice-and-curry spread (or order in), crack open the arrack, play cards by the pool and get a proper night's sleep before tomorrow's adventure.",
  highlights: [
    "Dinner at the villa or hotel — no travel",
    "Pool, cards & music",
    "Early night before big days",
    "Pick it as often as you like",
  ],
  vibe: 0 as const,
  images: photos["chill"] ?? [],
};
