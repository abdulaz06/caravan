import { colomboDay, colomboNight } from "./activities/colombo";
import { enrouteDay } from "./activities/enroute";
import { extras } from "./activities/extras";
import { galleDay } from "./activities/galle-day";
import { galleNight } from "./activities/galle-night";
import { nyeOptions } from "./activities/nye";
import { photos } from "./photos.generated";
import type { Activity, Category, Photo, Slot } from "./types";

/**
 * Every curated option and Quick extra. The activity data itself lives in
 * ./activities/*.ts, grouped by where it's picked (Colombo, en route, Galle).
 * vibe: -2 pure nature/adventure … 0 balanced … +2 pure nightlife.
 * Photos come from scripts/image-picks.json (run `npm run photos`).
 */
export { colomboDay, colomboNight, enrouteDay, galleDay, galleNight, nyeOptions, extras };

export const options: Activity[] = [...colomboDay, ...colomboNight, ...enrouteDay, ...galleDay, ...galleNight, ...nyeOptions];

/**
 * "Stay in" — offered in every Daytime and Evening slot, as often as people
 * like. On Day 2's daytime it means skipping the stops and taking the
 * expressway straight to Galle.
 */
export type StayIn = {
  id: "stay";
  slot: Slot;
  title: string;
  tagline: string;
  description: string;
  highlights: string[];
  vibe: 0;
  categories: Category[];
  images: Photo[];
};

const stayPhotos = photos["stay-in"] ?? [];

export const stayIn: Record<Slot | "enroute", StayIn> = {
  day: {
    id: "stay",
    slot: "day",
    title: "Stay in",
    tagline: "Slow morning, pool, nap, no plans.",
    description:
      "A day with zero agenda. Sleep in, take a long breakfast, read by the pool, nap in a hammock — maybe a massage or a wander to the nearest beach. Perfect between big days (or after last night).",
    highlights: ["Sleep in & a long breakfast", "Pool, hammock and a good book", "Optional massage or beach wander", "Pick it as often as you like"],
    vibe: 0,
    categories: ["chill"],
    images: [stayPhotos[1], stayPhotos[0]].filter(Boolean),
  },
  night: {
    id: "stay",
    slot: "night",
    title: "Stay in",
    tagline: "Dinner and hangs at the villa.",
    description:
      "Sometimes the best night is the one where nobody has to go anywhere. Have the villa cook make a rice-and-curry spread (or order in), crack open the arrack, play cards by the pool and get a proper night's sleep.",
    highlights: ["Dinner at the villa — no travel", "Pool, cards & music", "Early night before big days", "Pick it as often as you like"],
    vibe: 0,
    categories: ["chill"],
    images: stayPhotos,
  },
  enroute: {
    id: "stay",
    slot: "day",
    title: "Straight to Galle",
    tagline: "Skip the stops — expressway, check in, pool.",
    description:
      "Take the Southern Expressway and be at the villa in about two hours: early check-in, a swim, and a lazy afternoon before the first Galle evening.",
    highlights: ["~2 hrs on the expressway", "Early check-in & pool", "Fresh for the evening", "No stops, no fuss"],
    vibe: 0,
    categories: ["chill"],
    images: [stayPhotos[1], stayPhotos[0]].filter(Boolean),
  },
};
