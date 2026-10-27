import "server-only";
import { dateRange } from "@/lib/dates";
import { isTestName } from "@/lib/test-users";
import { STAY_ID, countItems, normalize, tripLength, type ItineraryData } from "@/engine/itinerary";
import { nightsFor, tripDays, type Engine } from "@/engine/structure";
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
  sweetSpot: { start: string; end: string; min: number; days: number } | null;
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

  // Sweet spot: the full-length window where the most people can make every
  // single day; ties go to the busier window.
  let sweetSpot: GroupStats["sweetSpot"] = null;
  let bestSum = -1;
  const len = tripDays(e);
  for (let i = 0; i + len <= dates.length; i++) {
    const window = dates.slice(i, i + len);
    const counts = window.map((d) => dateCounts[d]);
    const min = Math.min(...counts);
    const sum = counts.reduce((a, b) => a + b, 0);
    const better = !sweetSpot || min > sweetSpot.min || (min === sweetSpot.min && sum > bestSum);
    if (min > 0 && better) {
      sweetSpot = { start: window[0], end: window[len - 1], min, days: len };
      bestSum = sum;
    }
  }

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
    people: people.map((p) => ({ id: p.id, name: p.name, status: p.status })),
  };
}

/** Counts shown on the public welcome page (no names), plus the trip shape and any announcement. */
export type PublicCounts = {
  joined: number;
  submitted: number;
  initials: string[];
  locked: boolean;
  trip: { days: number; bases: { name: string; nights: number }[]; start: string; end: string };
  announcement: string | null;
};

export async function publicCounts(trip: TripContext): Promise<PublicCounts> {
  const e = trip.engine;
  const shape = {
    days: tripDays(e),
    bases: nightsFor(e, tripDays(e)).map((s) => ({ name: s.base.name, nights: s.nights })),
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
