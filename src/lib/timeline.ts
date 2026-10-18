// Turns an itinerary into a timeline with auto-inserted road-trip segments,
// friendly travel warnings and the nature ↔ nightlife balance.
import {
  chillNight,
  formatHours,
  regions,
  trainNote,
  travelHours,
  type Option,
  type RegionId,
} from "@/content";
import { dateAt, isChill, nyeIndex, optionFor, type ItineraryData } from "./itinerary";
import { dayLabel } from "./dates";

export type TravelSegment = {
  from: RegionId;
  to: RegionId;
  hours: number;
  label: string; // "~4 hrs"
  train?: string;
};

export type DayTag = "arrival" | "departure" | "nye";

export type TimelineDay = {
  index: number;
  date: string | null;
  label: string;
  tags: DayTag[];
  beforeDay?: TravelSegment;
  day: Option | null;
  beforeNight?: TravelSegment;
  night: Option | "chill" | null;
  warnings: string[];
};

export type Timeline = {
  days: TimelineDay[];
  toAirport?: TravelSegment;
  totalHours: number;
  regionsVisited: RegionId[];
};

function segment(from: RegionId, to: RegionId): TravelSegment {
  const hours = travelHours(from, to);
  return { from, to, hours, label: formatHours(hours), train: trainNote(from, to) };
}

const SAME_DAY_LIMIT = 3; // hrs between a day plan and that evening's plan
const OVERNIGHT_LIMIT = 4.5; // hrs before a morning plan

export function buildTimeline(data: ItineraryData): Timeline {
  let loc = "airport" as RegionId;
  let total = 0;
  const visited: RegionId[] = [];
  const nye = nyeIndex(data);
  const n = data.days.length;

  const days = data.days.map((d, index) => {
    const date = dateAt(data, index);
    const tags: DayTag[] = [];
    if (index === 0) tags.push("arrival");
    if (index === n - 1 && n > 1) tags.push("departure");
    if (index === nye) tags.push("nye");
    const warnings: string[] = [];
    const entry: TimelineDay = {
      index,
      date,
      label: date ? dayLabel(date) : `Day ${index + 1}`,
      tags,
      day: optionFor(d.day),
      night: isChill(d.night) ? "chill" : optionFor(d.night),
      warnings,
    };

    if (entry.day) {
      const to = entry.day.region;
      if (to !== loc) {
        entry.beforeDay = segment(loc, to);
        total += entry.beforeDay.hours;
        const sunrise = entry.day.tags.includes("sunrise");
        if (sunrise && entry.beforeDay.hours >= 1.5) {
          warnings.push(
            `${entry.day.title} starts around dawn — you'd want to sleep near ${regions[to].short} the night before.`,
          );
        } else if (entry.beforeDay.hours > OVERNIGHT_LIMIT && index > 0) {
          warnings.push(
            `That's ${entry.beforeDay.label} on the road from ${regions[loc].short} before this — a very early start. Maybe swap a day around?`,
          );
        }
        loc = to;
      }
      if (!visited.includes(to)) visited.push(to);
    }

    if (entry.night && entry.night !== "chill") {
      const to = entry.night.region;
      if (to !== loc) {
        entry.beforeNight = segment(loc, to);
        total += entry.beforeNight.hours;
        if (entry.day && entry.beforeNight.hours > SAME_DAY_LIMIT) {
          warnings.push(
            `Big travel day: ${entry.beforeNight.label} from ${regions[loc].short} to ${regions[to].short} between your daytime and evening plans. Doable, but you'll arrive tired.`,
          );
        } else if (!entry.day && index === 0 && entry.beforeNight.hours > OVERNIGHT_LIMIT) {
          warnings.push(
            `${entry.beforeNight.label} from the airport to ${regions[to].short} on arrival day — fine if you land early.`,
          );
        }
        loc = to;
      }
      if (!visited.includes(to)) visited.push(to);
    }
    return entry;
  });

  let toAirport: TravelSegment | undefined;
  if (n > 0 && loc !== "airport") {
    toAirport = segment(loc, "airport");
    if (toAirport.hours > 3.5) {
      days[n - 1].warnings.push(
        `It's ${toAirport.label} back to the airport from ${regions[loc].short} — leave plenty of time for your flight.`,
      );
    }
  }
  return { days, toAirport, totalHours: total, regionsVisited: visited };
}

/** Where you'll be right before a given slot (used to sort options by distance). */
export function locationBefore(data: ItineraryData, index: number, slot: "day" | "night"): RegionId {
  let loc: RegionId = "airport";
  for (let i = 0; i <= index && i < data.days.length; i++) {
    const day = optionFor(data.days[i].day);
    if (i === index && slot === "day") return loc;
    if (day) loc = day.region;
    if (i === index) return loc;
    const night = optionFor(data.days[i].night);
    if (night) loc = night.region;
  }
  return loc;
}

export type Balance = {
  score: number | null; // -2 … +2
  count: number;
  nature: number;
  balanced: number;
  nightlife: number;
};

export function balanceOf(data: ItineraryData): Balance {
  const vibes: number[] = [];
  for (const d of data.days) {
    const day = optionFor(d.day);
    if (day) vibes.push(day.vibe);
    if (isChill(d.night)) vibes.push(chillNight.vibe);
    else {
      const night = optionFor(d.night);
      if (night) vibes.push(night.vibe);
    }
  }
  return {
    score: vibes.length ? vibes.reduce((a, b) => a + b, 0) / vibes.length : null,
    count: vibes.length,
    nature: vibes.filter((v) => v < 0).length,
    balanced: vibes.filter((v) => v === 0).length,
    nightlife: vibes.filter((v) => v > 0).length,
  };
}

export function balanceLabel(score: number | null): { title: string; line: string } {
  if (score === null) return { title: "Blank canvas", line: "Pick a few things to see your vibe." };
  if (score <= -1.2) return { title: "Wild at heart", line: "Sunrises, summits and safaris." };
  if (score <= -0.4) return { title: "Nature lover", line: "Mostly outdoors, with a few nights out." };
  if (score < 0.4) return { title: "Perfectly balanced", line: "Adventure by day, fun by night." };
  if (score < 1.2) return { title: "Social butterfly", line: "Beaches, bars and good company." };
  return { title: "Party animal", line: "Here for the nights." };
}
