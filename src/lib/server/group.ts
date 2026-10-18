import "server-only";
import { optionsById, regions, TRIP_WINDOW, type RegionId } from "@/content";
import { dateRange } from "@/lib/dates";
import { isChill, optionFor, tripLength, type ItineraryData } from "@/lib/itinerary";
import { balanceOf } from "@/lib/timeline";
import { db, type ItineraryRow, type ParticipantRow } from "./db";

export type Person = {
  id: string;
  name: string;
  status: "new" | "draft" | "submitted";
  joinedAt: string;
  updatedAt: string | null;
  submittedAt: string | null;
  picks: number;
  data: ItineraryData | null;
};

export async function loadPeople(): Promise<Person[]> {
  const [participants, itineraries] = await Promise.all([
    db().listParticipants(),
    db().listItineraries(),
  ]);
  const byId = new Map<string, ItineraryRow>(itineraries.map((i) => [i.participant_id, i]));
  return participants.map((p: ParticipantRow) => {
    const it = byId.get(p.id);
    const picks = it
      ? it.data.days.reduce((n, d) => n + (d.day ? 1 : 0) + (d.night ? 1 : 0), 0)
      : 0;
    return {
      id: p.id,
      name: p.display_name,
      status: it ? it.status : "new",
      joinedAt: p.created_at,
      updatedAt: it?.updated_at ?? null,
      submittedAt: it?.submitted_at ?? null,
      picks,
      data: it?.data ?? null,
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
  chillCount: number;
  balance: number | null;
  regions: { region: RegionId; count: number }[];
  flexibility: Record<string, number>;
  avgLength: number | null;
  people: { id: string; name: string; status: Person["status"] }[];
};

export function computeStats(people: Person[]): GroupStats {
  const dates = dateRange(TRIP_WINDOW.start, TRIP_WINDOW.end);
  const dateCounts: Record<string, number> = Object.fromEntries(dates.map((d) => [d, 0]));
  const optionCounts = new Map<string, number>();
  const regionCounts = new Map<RegionId, number>();
  const flexibility: Record<string, number> = {};
  const balances: number[] = [];
  const lengths: number[] = [];
  let chillCount = 0;
  let withDates = 0;

  for (const p of people) {
    const d = p.data;
    if (!d) continue;
    if (d.startDate && d.endDate) {
      withDates++;
      lengths.push(tripLength(d));
      for (const day of dateRange(d.startDate, d.endDate)) {
        if (day in dateCounts) dateCounts[day]++;
      }
    }
    if (d.flexibility) flexibility[d.flexibility] = (flexibility[d.flexibility] ?? 0) + 1;
    for (const day of d.days) {
      for (const o of [optionFor(day.day), optionFor(day.night)]) {
        if (!o) continue;
        optionCounts.set(o.id, (optionCounts.get(o.id) ?? 0) + 1);
        regionCounts.set(o.region, (regionCounts.get(o.region) ?? 0) + 1);
      }
      if (isChill(day.night)) chillCount++;
    }
    const b = balanceOf(d).score;
    if (b !== null) balances.push(b);
  }

  // Sweet spot: the 5-day window (or 4, if nothing fits) everyone can make most.
  let sweetSpot: GroupStats["sweetSpot"] = null;
  let bestSum = -1;
  for (const len of [5, 4]) {
    for (let i = 0; i + len <= dates.length; i++) {
      const window = dates.slice(i, i + len);
      const counts = window.map((d) => dateCounts[d]);
      const min = Math.min(...counts);
      const sum = counts.reduce((a, b) => a + b, 0);
      if (min > 0 && (!sweetSpot || min > sweetSpot.min || (min === sweetSpot.min && sum > bestSum))) {
        sweetSpot = { start: window[0], end: window[len - 1], min, days: len };
        bestSum = sum;
      }
    }
    if (sweetSpot) break;
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
      .map(([optionId, count]) => ({ optionId, count, slot: optionsById[optionId].slot })),
    chillCount,
    balance: balances.length ? balances.reduce((a, b) => a + b, 0) / balances.length : null,
    regions: [...regionCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .filter(([r]) => r in regions)
      .map(([region, count]) => ({ region, count })),
    flexibility,
    avgLength: lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : null,
    people: people.map((p) => ({ id: p.id, name: p.name, status: p.status })),
  };
}

/** Counts shown on the public welcome page (no names). */
export async function publicCounts(): Promise<{ joined: number; submitted: number; initials: string[] }> {
  try {
    const people = await loadPeople();
    return {
      joined: people.length,
      submitted: people.filter((p) => p.status === "submitted").length,
      initials: people.slice(-5).map((p) => p.name.trim()[0]?.toUpperCase() ?? "?"),
    };
  } catch {
    return { joined: 0, submitted: 0, initials: [] };
  }
}
