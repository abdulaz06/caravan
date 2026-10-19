// "Quick fill": builds a sensible, balanced itinerary inside the two bases
// that people can then tweak. Prefers variety, keeps travel light (and the
// transfer/departure days close to Galle), respects day-of-week options, and
// picks a few attempts with a little randomness so everyone's isn't identical.
import { dayPairs, nightPairs, nyePairs, optionsById, type BaseId, type Option, type Pair } from "@/content";
import { parseISO } from "./dates";
import {
  STAY,
  baseOfIndex,
  clearAllPicks,
  dateAt,
  isPick,
  isStay,
  normalize,
  nyeIndex,
  optionCounts,
  optionFor,
  transferIndex,
  type ItineraryData,
  type OptionPick,
} from "./itinerary";
import { buildTimeline, hoursFromBase } from "./timeline";

type Rng = () => number;

const pairOptions = (p: Pair): Option[] => [optionsById[p.a], optionsById[p.b]];
const runsOn = (o: Option, date: string | null) =>
  !o.availableDays || (!!date && o.availableDays.includes(parseISO(date).getUTCDay()));

function fill(input: ItineraryData, rng: Rng, onlyEmpty: boolean): ItineraryData {
  const data = onlyEmpty ? structuredClone(input) : clearAllPicks(input);
  const n = data.days.length;
  const nye = nyeIndex(data);
  const transfer = transferIndex(data);
  const used = new Set(optionCounts(data).keys());
  const pairUses = new Map<string, number>();
  let vibeSum = 0;
  let vibeCount = 0;
  for (const d of data.days) {
    for (const p of [d.day, d.night]) {
      if (isPick(p)) pairUses.set(p.pairId, (pairUses.get(p.pairId) ?? 0) + 1);
      const o = optionFor(p);
      if (o) vibeSum += o.vibe;
      if (o || isStay(p)) vibeCount++;
    }
  }
  const balancePenalty = (v: number) => Math.abs((vibeSum + v) / (vibeCount + 1));
  const take = (o: Option, pair: Pair): OptionPick => {
    used.add(o.id);
    pairUses.set(pair.id, (pairUses.get(pair.id) ?? 0) + 1);
    vibeSum += o.vibe;
    vibeCount++;
    const pick: OptionPick = { pairId: pair.id, optionId: o.id };
    if (o.transport) pick.transport = rng() < 0.6 ? "train" : "road";
    return pick;
  };
  const stay = () => {
    vibeCount++;
    return { ...STAY };
  };
  const best = (pairs: Pair[], score: (o: Option) => number | null) => {
    let top: { o: Option; pair: Pair; s: number } | null = null;
    for (const pair of pairs) {
      for (const o of pairOptions(pair)) {
        if (used.has(o.id)) continue;
        const s = score(o);
        if (s === null) continue;
        const total = s + (pairUses.get(pair.id) ?? 0) * 2 + rng();
        if (!top || total < top.s) top = { o, pair, s: total };
      }
    }
    return top;
  };

  for (let i = 0; i < n; i++) {
    const d = data.days[i];
    const base: BaseId = baseOfIndex(n, i);
    const date = dateAt(data, i);
    const isLast = i === n - 1 && n > 1;

    // Daytime (landing day stays free on longer trips)
    if (!d.day && !(i === 0 && n >= 3)) {
      const pick = best(
        dayPairs.filter((p) => p.base === base),
        (o) => {
          if (!runsOn(o, date)) return null;
          const h = hoursFromBase(o);
          if (i === 0 && h >= 2) return null;
          if (i === transfer && h >= 1 && o.region !== "bentota") return null;
          if (isLast && (h >= 1 || o.tags.includes("diving"))) return null;
          return h * 0.8 + balancePenalty(o.vibe) * 1.2;
        },
      );
      d.day = pick ? take(pick.o, pick.pair) : i < n - 1 ? stay() : null;
    }

    // Evening (departure night stays free — you're flying)
    if (d.night || isLast) continue;
    if (i === nye) {
      const pair = nyePairs[base];
      const [a, b] = pairOptions(pair);
      const pick = hoursFromBase(a) + rng() * 1.2 <= hoursFromBase(b) + 0.6 ? a : b;
      d.night = take(pick, pair);
      continue;
    }
    const tomorrow = optionFor(data.days[i + 1]?.day);
    const earlyStart = !!tomorrow && (tomorrow.tags.includes("early") || !!tomorrow.transport);
    const stays = data.days.filter((x) => isStay(x.night)).length;
    if (earlyStart || (i > 0 && stays < Math.floor(n / 3) && rng() < 0.22)) {
      d.night = stay();
      continue;
    }
    const pick = best(
      nightPairs.filter((p) => p.base === base),
      (o) => {
        if (!runsOn(o, date)) return null;
        const h = hoursFromBase(o);
        if (h > 1.25 && i === 0) return null;
        return h * 1.1 + balancePenalty(o.vibe) * 1.2 + (i === 0 && o.vibe >= 2 ? 1.5 : 0);
      },
    );
    d.night = pick ? take(pick.o, pick.pair) : stay();
  }
  return normalize(data);
}

function score(data: ItineraryData): number {
  const t = buildTimeline(data);
  const warnings = t.days.reduce((n, d) => n + d.warnings.length, 0);
  const empty = data.days.reduce((n, d, i) => n + (d.day || i === 0 ? 0 : 1), 0);
  return t.totalHours + warnings * 6 + empty * 3;
}

export function quickFill(data: ItineraryData, opts: { onlyEmpty?: boolean; rng?: Rng } = {}): ItineraryData {
  const rng = opts.rng ?? Math.random;
  if (!data.days.length) return data;
  let top: { d: ItineraryData; s: number } | null = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const d = fill(data, rng, !!opts.onlyEmpty);
    const s = score(d) + rng() * 0.5;
    if (!top || s < top.s) top = { d, s };
  }
  return top!.d;
}
