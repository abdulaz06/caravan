// "Quick fill": builds a geographically sensible, balanced itinerary that the
// user can then tweak. Tries a few route shapes and keeps the one with the
// least driving and no warnings; picks between A/B with a little randomness so
// everyone's quick fill isn't identical.
import {
  allOptions,
  dayPairs,
  nightPairs,
  nyePair,
  optionsById,
  travelHours,
  type Option,
  type Pair,
  type RegionId,
} from "@/content";
import {
  STAY,
  clearAllPicks,
  isPick,
  isStay,
  normalize,
  nyeIndex,
  optionCounts,
  optionFor,
  type ItineraryData,
} from "./itinerary";
import { buildTimeline } from "./timeline";

type Rng = () => number;

const ROUTES: Record<number, RegionId[][]> = {
  1: [["colombo"]],
  2: [["negombo", "colombo"], ["colombo", "negombo"]],
  3: [["colombo", "galle", "colombo"], ["negombo", "kandy", "colombo"]],
  4: [["negombo", "galle", "mirissa", "colombo"], ["negombo", "sigiriya", "kandy", "colombo"]],
  5: [
    ["colombo", "galle", "mirissa", "mirissa", "colombo"],
    ["negombo", "sigiriya", "kandy", "ella", "colombo"],
  ],
  6: [
    ["negombo", "kandy", "ella", "ella", "mirissa", "colombo"],
    ["negombo", "galle", "mirissa", "mirissa", "hikkaduwa", "colombo"],
  ],
  7: [["negombo", "sigiriya", "kandy", "ella", "mirissa", "galle", "colombo"]],
  8: [["negombo", "sigiriya", "sigiriya", "kandy", "ella", "mirissa", "galle", "colombo"]],
  9: [["negombo", "sigiriya", "sigiriya", "kandy", "nuwara-eliya", "ella", "mirissa", "galle", "colombo"]],
  10: [["negombo", "sigiriya", "sigiriya", "kandy", "nuwara-eliya", "ella", "yala", "mirissa", "galle", "colombo"]],
  11: [["negombo", "sigiriya", "sigiriya", "kandy", "nuwara-eliya", "ella", "ella", "yala", "mirissa", "galle", "colombo"]],
  12: [["negombo", "sigiriya", "sigiriya", "kandy", "nuwara-eliya", "ella", "ella", "yala", "mirissa", "mirissa", "galle", "colombo"]],
  13: [["negombo", "sigiriya", "sigiriya", "kandy", "nuwara-eliya", "ella", "ella", "yala", "mirissa", "mirissa", "galle", "hikkaduwa", "colombo"]],
  14: [["negombo", "sigiriya", "sigiriya", "kandy", "kandy", "nuwara-eliya", "ella", "ella", "yala", "mirissa", "mirissa", "galle", "hikkaduwa", "colombo"]],
};

function candidateRoutes(n: number): RegionId[][] {
  const base = ROUTES[Math.min(Math.max(n, 1), 14)] ?? ROUTES[14];
  const out: RegionId[][] = [];
  for (const r of base) {
    const route = r.slice(0, n);
    out.push(route);
    if (route.length > 3) {
      out.push([route[0], ...route.slice(1, -1).reverse(), route[route.length - 1]]);
    }
  }
  return out;
}

const pairOptions = (p: Pair): Option[] => [optionsById[p.a], optionsById[p.b]];

function fill(input: ItineraryData, route: RegionId[], rng: Rng, onlyEmpty: boolean): ItineraryData {
  const data = onlyEmpty ? structuredClone(input) : clearAllPicks(input);
  const n = data.days.length;
  const nye = nyeIndex(data);
  // Variety: never repeat the exact same option in a quick fill, and lightly
  // prefer pairs that haven't been touched (manual picks can repeat freely).
  const usedOptions = new Set(optionCounts(data).keys());
  const usedPairs = new Map<string, number>();
  let vibeSum = 0;
  let vibeCount = 0;
  for (const d of data.days) {
    for (const p of [d.day, d.night]) {
      if (isPick(p)) usedPairs.set(p.pairId, (usedPairs.get(p.pairId) ?? 0) + 1);
      const o = optionFor(p);
      if (o) {
        vibeSum += o.vibe;
        vibeCount++;
      } else if (isStay(p)) vibeCount++;
    }
  }
  const balancePenalty = (v: number) => Math.abs((vibeSum + v) / (vibeCount + 1));
  const take = (o: Option, pair: Pair) => {
    usedOptions.add(o.id);
    usedPairs.set(pair.id, (usedPairs.get(pair.id) ?? 0) + 1);
    vibeSum += o.vibe;
    vibeCount++;
    return { pairId: pair.id, optionId: o.id };
  };
  const stay = () => {
    vibeCount++;
    return { ...STAY };
  };

  // Pass 1 — daytime, following the route.
  let loc: RegionId = "airport";
  for (let i = 0; i < n; i++) {
    const d = data.days[i];
    const target = route[i] ?? route[route.length - 1];
    if (d.day) {
      const o = optionFor(d.day);
      if (o) loc = o.region;
      continue;
    }
    if (i === 0 && n >= 3) continue; // arrival day: leave room for flights
    let best: { o: Option; pair: Pair; s: number } | null = null;
    for (const pair of dayPairs) {
      for (const o of pairOptions(pair)) {
        if (usedOptions.has(o.id)) continue;
        const fromTarget = travelHours(target, o.region);
        if (fromTarget > 2) continue;
        let s: number =
          fromTarget * 3 +
          travelHours(loc, o.region) * 0.4 +
          balancePenalty(o.vibe) * 1.2 +
          (usedPairs.get(pair.id) ?? 0) * 2 +
          rng();
        if (o.tags.includes("sunrise") && travelHours(loc, o.region) >= 1.5) s += 4;
        if (!best || s < best.s) best = { o, pair, s };
      }
    }
    if (best) {
      d.day = take(best.o, best.pair);
      loc = best.o.region;
    } else if (i < n - 1) {
      d.day = stay(); // nothing fresh nearby: a slow day off
    }
  }

  // Pass 2 — evenings, from wherever the day ended up.
  loc = "airport";
  let stays = data.days.filter((d) => isStay(d.night)).length;
  for (let i = 0; i < n; i++) {
    const d = data.days[i];
    const dayOpt = optionFor(d.day);
    if (dayOpt) loc = dayOpt.region;
    else if (i === 0) loc = route[0];
    if (d.night) {
      const no = optionFor(d.night);
      if (no) loc = no.region;
      continue;
    }
    if (i === n - 1 && n > 1) continue; // departure night: you're flying
    if (i === nye) {
      const [a, b] = pairOptions(nyePair);
      const pick: Option = travelHours(loc, a.region) + rng() * 0.5 <= travelHours(loc, b.region) ? a : b;
      d.night = take(pick, nyePair);
      loc = pick.region;
      continue;
    }
    const nextDay = optionFor(data.days[i + 1]?.day);
    const earlyStart = nextDay?.tags.includes("sunrise");
    if (earlyStart || (i > 0 && stays < Math.floor(n / 3) && rng() < 0.22)) {
      d.night = stay();
      stays++;
      continue;
    }
    let best: { o: Option; pair: Pair; s: number } | null = null;
    for (const pair of nightPairs) {
      for (const o of pairOptions(pair)) {
        if (usedOptions.has(o.id)) continue;
        const h = travelHours(loc, o.region);
        const nextH = nextDay ? travelHours(o.region, nextDay.region) : 0;
        if (h > 1 || nextH > 4.5) continue;
        const s = h * 3 + nextH * 0.5 + balancePenalty(o.vibe) * 1.2 + (usedPairs.get(pair.id) ?? 0) * 2 + rng();
        if (!best || s < best.s) best = { o, pair, s };
      }
    }
    if (best) {
      d.night = take(best.o, best.pair);
      loc = best.o.region;
    } else {
      d.night = stay();
      stays++;
    }
  }
  return normalize(data);
}

function score(data: ItineraryData): number {
  const t = buildTimeline(data);
  const warnings = t.days.reduce((n, d) => n + d.warnings.length, 0);
  const empty = data.days.reduce((n, d, i) => n + (d.day || i === 0 ? 0 : 1), 0);
  return t.totalHours + warnings * 6 + empty * 3;
}

export function quickFill(
  data: ItineraryData,
  opts: { onlyEmpty?: boolean; rng?: Rng } = {},
): ItineraryData {
  const rng = opts.rng ?? Math.random;
  if (!data.days.length) return data;
  let best: { d: ItineraryData; s: number } | null = null;
  for (const route of candidateRoutes(data.days.length)) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const d = fill(data, route, rng, !!opts.onlyEmpty);
      const s = score(d) + rng() * 0.5;
      if (!best || s < best.s) best = { d, s };
    }
  }
  return best!.d;
}

/** Every option in a slot, used for "near you" sorting in the matchup sheet. */
export function optionsNear(region: RegionId) {
  return allOptions
    .map((o) => ({ o, h: travelHours(region, o.region) }))
    .sort((a, b) => a.h - b.h);
}

export const hasAnyPick = (data: ItineraryData) => data.days.some((d) => d.day || d.night);
