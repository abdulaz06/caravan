// "Quick fill": one balanced item per empty slot, from that slot's curated
// pairs, that people can then tweak. Prefers variety, keeps travel light
// (big day trips are rare), respects day-of-week options, and tries a few
// attempts with a little randomness so everyone's isn't identical.
import { parseISO } from "@/lib/dates";
import type { Activity, Pair } from "./catalog";
import {
  STAY_ID,
  clearAllPicks,
  dateAt,
  itemCounts,
  makeItem,
  normalize,
  plansOf,
  specialPairAt,
  isSpecialSlot,
  type ItineraryData,
} from "./itinerary";
import { isHidden } from "./rules";
import type { Engine } from "./structure";
import { buildTimeline, hoursFrom } from "./timeline";

type Rng = () => number;

const runsOn = (a: Activity, date: string | null) => !a.availableDays || (!!date && a.availableDays.includes(parseISO(date).getUTCDay()));
const isBigTrip = (a: Activity) => a.tags.includes("big day trip");
const isEarly = (a: Activity) => a.tags.includes("early") || isBigTrip(a);

function fill(e: Engine, input: ItineraryData, rng: Rng, onlyEmpty: boolean): ItineraryData {
  const data = onlyEmpty ? structuredClone(input) : clearAllPicks(input);
  const byId = e.catalog.byId;
  const pairOptions = (p: Pair): Activity[] => [byId[p.a], byId[p.b]].filter(Boolean);
  const plans = plansOf(e, data);
  const n = data.days.length;
  const used = new Set(itemCounts(data).keys());
  const pairUses = new Map<string, number>();
  let vibeSum = 0;
  let vibeCount = 0;
  let bigTrips = 0;
  for (const d of data.days) {
    for (const x of [...d.day, ...d.night]) {
      if (x.pairId) pairUses.set(x.pairId, (pairUses.get(x.pairId) ?? 0) + 1);
      const a = byId[x.id];
      if (a) vibeSum += a.vibe;
      if (a || x.id === STAY_ID) vibeCount++;
      if (a && isBigTrip(a)) bigTrips++;
    }
  }
  const balancePenalty = (v: number) => Math.abs((vibeSum + v) / (vibeCount + 1));
  const take = (a: Activity, pair: Pair) => {
    used.add(a.id);
    pairUses.set(pair.id, (pairUses.get(pair.id) ?? 0) + 1);
    vibeSum += a.vibe;
    vibeCount++;
    if (isBigTrip(a)) bigTrips++;
    return [makeItem(e, a.id, pair.id)];
  };
  const stay = () => {
    vibeCount++;
    return [makeItem(e, STAY_ID)];
  };
  const best = (pairs: Pair[], score: (a: Activity) => number | null) => {
    let top: { a: Activity; pair: Pair; s: number } | null = null;
    for (const pair of pairs) {
      for (const a of pairOptions(pair)) {
        // Never auto-pick something hidden by the organizers, or a trip that needs a decision (variants).
        if (used.has(a.id) || isHidden(e.rules, a.id) || a.variants) continue;
        const s = score(a);
        if (s === null) continue;
        const total = s + (pairUses.get(pair.id) ?? 0) * 2 + rng();
        if (!top || total < top.s) top = { a, pair, s: total };
      }
    }
    return top;
  };

  for (let i = 0; i < n; i++) {
    const plan = plans[i];
    if (!plan.hasSlots) continue;
    const d = data.days[i];
    const date = dateAt(data, i);
    const dayArea = plan.areas.day!;
    const nightArea = plan.areas.night!;
    const lastFull = i === n - 2;
    const onRoute = plan.kind === "transfer" && !!plan.transfer?.dayArea;

    if (!d.day.length) {
      const pick = best(e.catalog.pairsFor(dayArea, "day"), (a) => {
        if (!runsOn(a, date)) return null;
        if (onRoute) return balancePenalty(a.vibe) * 1.2;
        if (isBigTrip(a) && (bigTrips >= 1 || lastFull)) return null;
        if (lastFull && a.tags.includes("diving")) return null;
        return hoursFrom(e, a, dayArea) * 0.8 + balancePenalty(a.vibe) * 1.2;
      });
      d.day = pick ? take(pick.a, pick.pair) : stay();
    }

    if (d.night.length) continue;
    if (isSpecialSlot(e, data, i, "night")) {
      const pair = specialPairAt(e, data, i);
      if (pair) {
        const [a, b] = pairOptions(pair);
        if (a && b) {
          const pickA = hoursFrom(e, a, nightArea) + rng() * 1.2 <= hoursFrom(e, b, nightArea) + 0.6;
          d.night = take(pickA ? a : b, pair);
          continue;
        }
      }
    }
    const tomorrow = data.days[i + 1]?.day.map((x) => byId[x.id]).find(Boolean);
    const earlyStart = !!tomorrow && isEarly(tomorrow);
    const stays = data.days.filter((x) => x.night.some((y) => y.id === STAY_ID)).length;
    if (earlyStart || (i > 1 && stays < 1 && rng() < 0.25)) {
      d.night = stay();
      continue;
    }
    const pick = best(e.catalog.pairsFor(nightArea, "night"), (a) => {
      if (!runsOn(a, date)) return null;
      const h = hoursFrom(e, a, nightArea);
      if (plan.kind === "transfer" && h > 1) return null;
      return h * 1.1 + balancePenalty(a.vibe) * 1.2;
    });
    d.night = pick ? take(pick.a, pick.pair) : stay();
  }
  return normalize(e, data, n);
}

function score(e: Engine, data: ItineraryData): number {
  const t = buildTimeline(e, data);
  const warnings = t.days.reduce((n, d) => n + d.warnings.length, 0);
  return t.totalHours + warnings * 6;
}

export function quickFill(e: Engine, data: ItineraryData, opts: { onlyEmpty?: boolean; rng?: Rng } = {}): ItineraryData {
  const rng = opts.rng ?? Math.random;
  if (!data.days.length) return data;
  let top: { d: ItineraryData; s: number } | null = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const d = fill(e, data, rng, !!opts.onlyEmpty);
    const s = score(e, d) + rng() * 0.5;
    if (!top || s < top.s) top = { d, s };
  }
  return top!.d;
}
