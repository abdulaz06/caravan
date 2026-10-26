import type { Activity } from "../types";
import { option, src } from "./helpers";

/** New Year's Eve — one pair for Colombo (Dec 31 = Day 1) and one for the Galle side. */
export const nyeOptions: Activity[] = [
  option("night", ["colombo"], {
    id: "nye-colombo-rooftop",
    title: "NYE rooftop countdown in Colombo",
    region: "colombo",
    categories: ["party"],
    tagline: "Champagne above the skyline, fireworks over Galle Face.",
    loved: "A proper dress-up night with the city's fireworks laid out below — glammier and comfier than the beach.",
    description:
      "Ring in 2027 in the capital: a hotel rooftop or gala dinner with skyline views, then fireworks over Galle Face Green and the Port City at midnight, and a club after if you've got it in you.",
    highlights: ["Rooftop or gala dinner", "Fireworks over Galle Face", "Dress-up night", "Clubs open late after"],
    duration: "8 pm – late",
    hours: 5,
    estCostUsd: [60, 150],
    vibe: 1,
    tags: ["nye", "rooftop", "fireworks"],
    goodToKnow: "Hotel NYE packages usually go on sale in November; we'd book as a group.",
    sources: [src("The Rooftop Guide — Colombo rooftops (2026)", "https://www.therooftopguide.com/rooftop-bars-in-colombo.html")],
  }),
  option("night", ["colombo"], {
    id: "nye-mount-lavinia",
    title: "NYE by the sea at Mount Lavinia",
    region: "mount-lavinia",
    categories: ["party"],
    tagline: "Live bands, a beach party and fireworks along the coast.",
    loved: "Dancing on the sand below a 200-year-old mansion, with fireworks all along the Colombo coast.",
    description:
      "The grand old Mount Lavinia Hotel throws a New Year's Eve party on its beach — 2025's was a Havana-themed night with live Latin bands. Dinner and dancing on the sand, then fireworks along the coast at midnight.",
    highlights: ["Beachfront party at a colonial landmark", "Live bands & DJs", "Fireworks at midnight", "30 min from the city"],
    duration: "8 pm – late",
    hours: 5,
    estCostUsd: [50, 120],
    vibe: 2,
    tags: ["nye", "beach party", "live music"],
    goodToKnow: "A ticketed hotel event — the 2026 party hadn't been announced yet when we checked.",
    sources: [src("Oyster — Mount Lavinia Hotel", "https://www.oyster.com/sri-lanka/hotels/mount-lavinia-hotel/")],
  }),
  option("night", ["galle"], {
    id: "nye-mirissa-beach-party",
    title: "NYE beach party on the south coast",
    region: "mirissa",
    categories: ["party"],
    tagline: "Count down barefoot on Mirissa beach, fireworks overhead.",
    loved: "The biggest night of the year on the coast — the whole bay becomes one party until sunrise.",
    description:
      "New Year's Eve is the south coast's biggest night, and Mirissa is where everyone goes: beach bars with DJs, fire dancers, fireworks over the water at midnight and dancing until sunrise. The big parties are ticketed and the coast road jams, so we'd head over early with a driver booked back (~1 hr).",
    highlights: ["Fireworks over the bay", "DJs all along the beach", "Fire dancers & a sunrise finish", "~1 hr from Galle"],
    duration: "8 pm – sunrise",
    hours: 6,
    estCostUsd: [30, 80],
    vibe: 2,
    tags: ["nye", "beach party", "fireworks"],
    goodToKnow: "South-coast stays book out early for New Year and prices jump.",
    sources: [src("friday.lk — beach parties 2026 (NYE island-wide)", "https://www.friday.lk/beach-parties-in-sri-lanka")],
  }),
  option("night", ["galle"], {
    id: "nye-galle-fort",
    /** Halal mode shows these words instead (no bars or drinks). */
    halalText: {
      description: "A long NYE dinner in one of the fort's colonial hotels or courtyard restaurants, live jazz, then out onto the ramparts at midnight as fireworks pop along the beaches.",
    },
    title: "NYE in Galle Fort",
    region: "galle",
    categories: ["food", "culture"],
    tagline: "Dinner in the fort, midnight on the ramparts.",
    loved: "Elegant rather than wild — a long dinner, then the whole fort out on the walls at midnight.",
    description:
      "A long NYE dinner in one of the fort's colonial hotels or courtyard restaurants, live jazz, then out onto the ramparts at midnight as fireworks pop along the beaches. Unawatuna's parties are 15 minutes away if you want to keep going.",
    highlights: ["NYE dinner inside the fort", "Midnight on the ramparts", "Fireworks along the bay", "Unawatuna 15 min away"],
    duration: "8 pm – late",
    hours: 5,
    estCostUsd: [40, 120],
    vibe: 1,
    tags: ["nye", "dinner", "fireworks"],
    goodToKnow: "Not one big event — fort restaurants and hotels sell NYE dinners in advance; we'd book in November.",
    sources: [src("Resplendent Ceylon — best restaurants & bars in Galle", "https://www.resplendentceylon.com/our-journal/the-best-restaurants-and-bars-in-galle/")],
  }),
];
