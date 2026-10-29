import "server-only";
import { dateRange } from "@/lib/dates";
import { isTestName } from "@/lib/test-users";
import { STAY_ID, countItems, normalize, tripLength, type ItineraryData } from "@/engine/itinerary";
import { medianLength, pickWindows } from "@/engine/consensus/dates";
import { defaultLength, isFixed, lengthBounds, nightsFor, tripDays, type Engine } from "@/engine/structure";
import { balanceOf } from "@/engine/timeline";
import { db, roleOf, type ItineraryRow, type ParticipantRow, type Role, type Stamp } from "./db";
import type { TripContext } from "./trip";

export type Person = {
  id: string;
  name: string;
  role: Role;
  stamp: Stamp | null;
  status: "new" | "draft" | "submitted";
  joinedAt: string;
  updatedAt: string | null;
  submittedAt: string | null;
  picks: number;
  data: ItineraryData | null;
  /** A demo visitor ("Try it as a guest"): never counted or listed, except to themselves. */
  guest: boolean;
};

/** Everyone except "zz-test-" users and demo guests — what every count and list is built from. */
export const realPeople = (people: Person[]) => people.filter((p) => !isTestName(p.name) && !p.guest);

/** Everyone on a trip and their (normalised) plans. */
export async function loadPeople(trip: TripContext): Promise<Person[]> {
  const engine = trip.engine;
  const [participants, itineraries] = await Promise.all([db().listParticipants(trip.trip.id), db().listItineraries(trip.trip.id)]);
  const byId = new Map<string, ItineraryRow>(itineraries.map((i) => [i.participant_id, i]));
  return participants.map((p: ParticipantRow) => {
    const it = byId.get(p.id);
    const data = it?.data ? normalize(engine, it.data) : null;
    return {
      id: p.id,
      name: p.display_name,
      role: roleOf(p),
      stamp: it?.stamp ?? null,
      status: it ? it.status : "new",
      joinedAt: p.created_at,
      updatedAt: it?.updated_at ?? null,
      submittedAt: it?.submitted_at ?? null,
      picks: data ? countItems(data) : 0,
      data,
      guest: !!p.guest,
    };
  });
}

export type GroupStats = {
  joined: number;
  submitted: number;
  withDates: number;
  dateCounts: Record<string, number>;
  maxDateCount: number;
  /** The best window at the typical length: `full` people free for all of it (see engine/consensus/dates). */
  sweetSpot: { start: string; end: string; full: number; days: number } | null;
  /** Plan lengths: shortest, longest and the typical (median) one. */
  lengths: { min: number; max: number; typical: number } | null;
  topOptions: { optionId: string; count: number; slot: "day" | "night" }[];
  stayCount: { day: number; night: number };
  balance: number | null;
  regions: { region: string; count: number }[];
  flexibility: Record<string, number>;
  avgLength: number | null;
  people: { id: string; name: string; status: Person["status"] }[];
};

export function computeStats(e: Engine, people: Person[]): GroupStats {
  const byId = e.catalog.byId;
  const dates = dateRange(e.rules.window.start, e.rules.window.end);
  const dateCounts: Record<string, number> = Object.fromEntries(dates.map((d) => [d, 0]));
  const optionCounts = new Map<string, number>();
  const regionCounts = new Map<string, number>();
  const flexibility: Record<string, number> = {};
  const balances: number[] = [];
  const lengths: number[] = [];
  const stayCount = { day: 0, night: 0 };
  let withDates = 0;

  for (const p of people) {
    const d = p.data;
    if (!d) continue;
    if (d.startDate && d.endDate) {
      withDates++;
      lengths.push(tripLength(d));
      for (const day of dateRange(d.startDate, d.endDate)) if (day in dateCounts) dateCounts[day]++;
    }
    if (d.flexibility) flexibility[d.flexibility] = (flexibility[d.flexibility] ?? 0) + 1;
    // "Most picked" counts people (each once per option), like the 🔥 popular badges.
    const mine = new Set<string>();
    for (const day of d.days) {
      for (const x of [...day.day, ...day.night]) {
        const o = byId[x.id];
        if (!o) continue;
        if (!mine.has(o.id)) optionCounts.set(o.id, (optionCounts.get(o.id) ?? 0) + 1);
        mine.add(o.id);
        regionCounts.set(o.region, (regionCounts.get(o.region) ?? 0) + 1);
      }
      if (day.day.some((x) => x.id === STAY_ID)) stayCount.day++;
      if (day.night.some((x) => x.id === STAY_ID)) stayCount.night++;
    }
    const b = balanceOf(e, d).score;
    if (b !== null) balances.push(b);
  }

  // Sweet spot: the window at the typical length (fixed: the trip's length)
  // where the most people are free for every day; ties go to the busier window.
  const typical = isFixed(e) ? tripDays(e) : medianLength(lengths);
  const ranges = people.flatMap((p) => (p.data?.startDate && p.data.endDate ? [{ id: p.id, start: p.data.startDate, end: p.data.endDate }] : []));
  const best = typical ? pickWindows(ranges, e.rules.window, typical, 0).best : null;
  const sweetSpot = best && best.full > 0 ? { start: best.start, end: best.end, full: best.full, days: best.length } : null;

  return {
    joined: people.length,
    submitted: people.filter((p) => p.status === "submitted").length,
    withDates,
    dateCounts,
    maxDateCount: Math.max(0, ...Object.values(dateCounts)),
    sweetSpot,
    topOptions: [...optionCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([optionId, count]) => ({ optionId, count, slot: byId[optionId].slots[0] })),
    stayCount,
    balance: balances.length ? balances.reduce((a, b) => a + b, 0) / balances.length : null,
    regions: [...regionCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .filter(([r]) => r in e.catalog.regions)
      .map(([region, count]) => ({ region, count })),
    flexibility,
    avgLength: lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : null,
    lengths: lengths.length ? { min: Math.min(...lengths), max: Math.max(...lengths), typical: medianLength(lengths)! } : null,
    people: people.map((p) => ({ id: p.id, name: p.name, status: p.status })),
  };
}

/** Counts shown on the public welcome page (no names), plus the trip shape and any announcement. */
export type PublicCounts = {
  joined: number;
  submitted: number;
  initials: string[];
  locked: boolean;
  /** The trip's shape: free dates (a length range, shown at the usual length) or one fixed length. */
  trip: {
    fixed: boolean;
    days: number;
    min: number;
    max: number;
    recommended: { min: number; max: number } | null;
    bases: { name: string; nights: number }[];
    start: string;
    end: string;
  };
  announcement: string | null;
};

export async function publicCounts(trip: TripContext): Promise<PublicCounts> {
  const e = trip.engine;
  const days = defaultLength(e);
  const shape = {
    fixed: isFixed(e),
    days,
    ...lengthBounds(e),
    recommended: isFixed(e) ? null : e.rules.recommended,
    bases: nightsFor(e, days).map((s) => ({ name: s.base.name, nights: s.nights })),
    start: e.rules.window.start,
    end: e.rules.window.end,
  };
  try {
    const people = realPeople(await loadPeople(trip));
    return {
      joined: people.length,
      submitted: people.filter((p) => p.status === "submitted").length,
      initials: people.slice(-5).map((p) => p.name.trim()[0]?.toUpperCase() ?? "?"),
      locked: trip.locked,
      trip: shape,
      announcement: e.rules.announcement.on && e.rules.announcement.text.trim() ? e.rules.announcement.text : null,
    };
  } catch {
    return { joined: 0, submitted: 0, initials: [], locked: false, trip: shape, announcement: null };
  }
}
