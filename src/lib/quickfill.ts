// "Quick fill": one balanced item per empty slot, from that slot's curated
// pairs, that people can then tweak. Prefers variety, keeps travel light
// (big day trips are rare), respects day-of-week options, and tries a few
// attempts with a little randomness so everyone's isn't identical.
import { activitiesById, pairsFor, type Activity, type Pair } from "@/content";
import { isHidden } from "./rules";
import { parseISO } from "./dates";
import {
  STAY_ID,
  clearAllPicks,
  dateAt,
  dayRole,
  hasSlots,
  itemCounts,
  makeItem,
  normalize,
  nyeIndex,
  nyePairAt,
  slotWhere,
  type ItineraryData,
} from "./itinerary";
import { buildTimeline, hoursFrom } from "./timeline";

type Rng = () => number;

const pairOptions = (p: Pair): Activity[] => [activitiesById[p.a], activitiesById[p.b]];
const runsOn = (a: Activity, date: string | null) =>
  !a.availableDays || (!!date && a.availableDays.includes(parseISO(date).getUTCDay()));

function fill(input: ItineraryData, rng: Rng, onlyEmpty: boolean): ItineraryData {
  const data = onlyEmpty ? structuredClone(input) : clearAllPicks(input);
  const n = data.days.length;
  const nye = nyeIndex(data);
  const used = new Set(itemCounts(data).keys());
  const pairUses = new Map<string, number>();
  let vibeSum = 0;
  let vibeCount = 0;
  let bigTrips = 0;
  for (const d of data.days) {
    for (const x of [...d.day, ...d.night]) {
      if (x.pairId) pairUses.set(x.pairId, (pairUses.get(x.pairId) ?? 0) + 1);
      const a = activitiesById[x.id];
      if (a) vibeSum += a.vibe;
      if (a || x.id === STAY_ID) vibeCount++;
      if (a?.tags.includes("big day trip")) bigTrips++;
    }
  }
  const balancePenalty = (v: number) => Math.abs((vibeSum + v) / (vibeCount + 1));
  const take = (a: Activity, pair: Pair) => {
    used.add(a.id);
    pairUses.set(pair.id, (pairUses.get(pair.id) ?? 0) + 1);
    vibeSum += a.vibe;
    vibeCount++;
    if (a.tags.includes("big day trip")) bigTrips++;
    return [makeItem(a.id, pair.id)];
  };
  const stay = () => {
    vibeCount++;
    return [makeItem(STAY_ID)];
  };
  const best = (pairs: Pair[], score: (a: Activity) => number | null) => {
    let top: { a: Activity; pair: Pair; s: number } | null = null;
    for (const pair of pairs) {
      for (const a of pairOptions(pair)) {
        // Never auto-pick something hidden by the organizers, or a trip that needs a decision (the Ella day trip).
        if (used.has(a.id) || isHidden(a.id) || a.variants) continue;
        const s = score(a);
        if (s === null) continue;
        const total = s + (pairUses.get(pair.id) ?? 0) * 2 + rng();
        if (!top || total < top.s) top = { a, pair, s: total };
      }
    }
    return top;
  };

  for (let i = 0; i < n; i++) {
    const role = dayRole(i, n);
    if (!hasSlots(role)) continue;
    const d = data.days[i];
    const date = dateAt(data, i);
    const dayWhere = slotWhere(role, "day")!;
    const nightWhere = slotWhere(role, "night")!;
    const lastFull = i === n - 2;

    if (!d.day.length) {
      const pick = best(pairsFor(dayWhere, "day"), (a) => {
        if (!runsOn(a, date)) return null;
        if (dayWhere === "enroute") return balancePenalty(a.vibe) * 1.2;
        const h = hoursFrom(a, dayWhere);
        if (a.tags.includes("big day trip") && (bigTrips >= 1 || lastFull)) return null;
        if (lastFull && a.tags.includes("diving")) return null;
        return h * 0.8 + balancePenalty(a.vibe) * 1.2;
      });
      d.day = pick ? take(pick.a, pick.pair) : stay();
    }

    if (d.night.length) continue;
    if (i === nye) {
      const pair = nyePairAt(data);
      if (pair) {
        const [a, b] = pairOptions(pair);
        const pickA = hoursFrom(a, nightWhere) + rng() * 1.2 <= hoursFrom(b, nightWhere) + 0.6;
        d.night = take(pickA ? a : b, pair);
        continue;
      }
    }
    const tomorrow = data.days[i + 1]?.day.map((x) => activitiesById[x.id]).find(Boolean);
    const earlyStart = !!tomorrow && (tomorrow.tags.includes("early") || tomorrow.tags.includes("big day trip"));
    const stays = data.days.filter((x) => x.night.some((y) => y.id === STAY_ID)).length;
    if (earlyStart || (i > 1 && stays < 1 && rng() < 0.25)) {
      d.night = stay();
      continue;
    }
    const pick = best(pairsFor(nightWhere, "night"), (a) => {
      if (!runsOn(a, date)) return null;
      const h = hoursFrom(a, nightWhere);
      if (role === "transfer" && h > 1) return null;
      return h * 1.1 + balancePenalty(a.vibe) * 1.2;
    });
    d.night = pick ? take(pick.a, pick.pair) : stay();
  }
  return normalize(data, n);
}

function score(data: ItineraryData): number {
  const t = buildTimeline(data);
  const warnings = t.days.reduce((n, d) => n + d.warnings.length, 0);
  return t.totalHours + warnings * 6;
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
