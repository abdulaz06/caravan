// Turns an itinerary into a timeline: fixed travel legs (arrival, Colombo →
// Galle, departure), there-and-back trips from each base, the Kandy
// train/road legs, friendly warnings and the nature ↔ nightlife balance.
import {
  LEGS,
  bases,
  formatHours,
  regions,
  travelHours,
  type BaseId,
  type FixedLeg,
  type Option,
  type RegionId,
} from "@/content";
import {
  baseOfIndex,
  dateAt,
  isPick,
  isStay,
  nyeIndex,
  optionFor,
  transferIndex,
  type ItineraryData,
  type SlotKind,
  type SlotPick,
  type TransportMode,
} from "./itinerary";
import { dayLabel, parseISO } from "./dates";

export type TravelSegment = {
  kind: "fixed" | "excursion" | "outbound" | "return";
  mode: "road" | "train";
  from: RegionId;
  to: RegionId;
  title: string; // "Road trip · Colombo → Galle"
  hours: number;
  label: string; // "~2 hrs" / "~1 hr each way"
  detail?: string;
  stops?: FixedLeg["stops"];
};

export type DayTag = "arrival" | "departure" | "nye" | "transfer";

export type SlotView = {
  value: Option | "stay" | null;
  pick: SlotPick | null;
  before: TravelSegment[];
  after: TravelSegment[];
};

export type TimelineDay = {
  index: number;
  date: string | null;
  label: string;
  base: BaseId;
  tags: DayTag[];
  legsBefore: TravelSegment[];
  day: SlotView;
  night: SlotView;
  legsAfter: TravelSegment[];
  warnings: string[];
  tips: string[];
};

export type Timeline = {
  days: TimelineDay[];
  totalHours: number;
  regionsVisited: RegionId[];
  /** Main route for the map plus there-and-back spokes from each base. */
  route: RegionId[];
  spokes: { from: RegionId; to: RegionId }[];
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function daysLabel(days: number[]): string {
  const names = days.map((d) => `${WEEKDAYS[d]}s`);
  return names.length === 1 ? `${names[0]} only` : `${names.slice(0, -1).join(", ")} & ${names.at(-1)} only`;
}

/** Hours each way from the base to an option. */
export function hoursFromBase(o: Option): number {
  return o.travelFromBase ?? travelHours(bases[o.base].region, o.region);
}

export function baseDistanceLabel(o: Option): string {
  const h = hoursFromBase(o);
  if (h <= 0.25) return `In ${bases[o.base].name}`;
  return `${formatHours(h)} from ${bases[o.base].name}`;
}

export function legSegment(leg: FixedLeg): TravelSegment {
  return {
    kind: "fixed",
    mode: "road",
    from: leg.from,
    to: leg.to,
    title: leg.title,
    hours: leg.hours,
    label: leg.label,
    detail: leg.detail,
    stops: leg.stops,
  };
}

/** Travel lines around a slot: Kandy-style train/road legs, or a there-and-back road trip. */
function slotTravel(o: Option, transport: TransportMode | undefined): { before: TravelSegment[]; after: TravelSegment[]; hours: number } {
  const home = bases[o.base].region;
  if (o.transport) {
    const t = o.transport[transport ?? "train"];
    const mode = t.mode;
    return {
      before: [
        {
          kind: "outbound",
          mode,
          from: home,
          to: o.region,
          title: `${mode === "train" ? "Scenic train" : "Road trip"} · ${t.out}`,
          hours: t.hours,
          label: formatHours(t.hours),
          detail: t.detail,
        },
      ],
      after: [
        {
          kind: "return",
          mode,
          from: o.region,
          to: home,
          title: `${mode === "train" ? "Train back" : "Drive back"} · ${t.back}`,
          hours: t.hours,
          label: formatHours(t.hours),
        },
      ],
      hours: t.hours * 2,
    };
  }
  const h = hoursFromBase(o);
  if (h < 0.75) return { before: [], after: [], hours: h * 2 };
  return {
    before: [
      {
        kind: "excursion",
        mode: "road",
        from: home,
        to: o.region,
        title: `Road trip · ${bases[o.base].name} → ${regions[o.region].short}`,
        hours: h,
        label: `${formatHours(h)} each way`,
      },
    ],
    after: [],
    hours: h * 2,
  };
}

function slotView(p: SlotPick | null): SlotView & { hours: number; option: Option | null } {
  if (isStay(p)) return { value: "stay", pick: p, before: [], after: [], hours: 0, option: null };
  const o = optionFor(p);
  if (!o) return { value: null, pick: null, before: [], after: [], hours: 0, option: null };
  const t = slotTravel(o, isPick(p) ? p.transport : undefined);
  return { value: o, pick: p, before: t.before, after: t.after, hours: t.hours, option: o };
}

const isLate = (o: Option | null) => !!o && (o.vibe >= 2 || o.tags.includes("late"));
const isEarly = (o: Option | null) => !!o && (o.tags.includes("early") || !!o.transport);

export function buildTimeline(data: ItineraryData): Timeline {
  const n = data.days.length;
  const nye = nyeIndex(data);
  const transfer = transferIndex(data);
  let total = 0;
  const visited: RegionId[] = [];
  const spokes: { from: RegionId; to: RegionId }[] = [];
  const visit = (r: RegionId) => !visited.includes(r) && visited.push(r);

  const days = data.days.map((d, index) => {
    const base = baseOfIndex(n, index);
    const date = dateAt(data, index);
    const tags: DayTag[] = [];
    if (index === 0) tags.push("arrival");
    if (index === transfer) tags.push("transfer");
    if (index === n - 1 && n > 1) tags.push("departure");
    if (index === nye) tags.push("nye");
    const warnings: string[] = [];
    const tips: string[] = [];
    const legsBefore: TravelSegment[] = [];
    const legsAfter: TravelSegment[] = [];

    if (index === 0) legsBefore.push(legSegment(LEGS.arrival));
    if (index === transfer) legsBefore.push(legSegment(LEGS.transfer));
    if (index === n - 1) legsAfter.push(legSegment(transfer >= 0 ? LEGS.departure : LEGS.departureFromColombo));
    for (const l of [...legsBefore, ...legsAfter]) total += l.hours;
    if (index === 0) visit("colombo");
    if (index === transfer) visit("galle");

    const day = slotView(d.day);
    const night = slotView(d.night);
    total += day.hours + night.hours;

    for (const [slot, v] of [["day", day], ["night", night]] as [SlotKind, typeof day][]) {
      const o = v.option;
      if (!o) continue;
      if (o.region !== bases[base].region) {
        visit(o.region);
        if (!spokes.some((s) => s.to === o.region)) spokes.push({ from: bases[base].region, to: o.region });
      }
      if (o.availableDays && date) {
        const wd = parseISO(date).getUTCDay();
        if (!o.availableDays.includes(wd)) {
          warnings.push(
            `The ${o.title.split(",")[0]} only runs on ${o.availableDays.map((x) => `${WEEKDAYS[x]}s`).join(" & ")} — this is a ${WEEKDAYS[wd]}. Try moving it to a ${WEEKDAYS[o.availableDays[0]]}.`,
          );
        }
      }
      if (slot === "day" && index === 0 && hoursFromBase(o) >= 2) {
        warnings.push(`${o.title} on landing day is a lot — it might fit better on Day 2.`);
      }
      if (index === transfer && slot === "day") {
        if (o.region === "bentota") tips.push(`Nice — ${regions.bentota.short} is on the way. Stop there on the coast road to Galle.`);
        else if (hoursFromBase(o) >= 1) {
          warnings.push(`Transfer day: you'll reach Galle around lunchtime, so something close to Galle works best.`);
        }
      }
      if (index === n - 1 && n > 1) {
        if (slot === "night") warnings.push(`Last evening — only if you fly late. It's ${LEGS.departure.label} to the airport from Galle.`);
        else if (hoursFromBase(o) >= 1) warnings.push(`It's your departure day — something close to ${bases[base].name} is safer.`);
        if (o.tags.includes("diving")) warnings.push("Don't fly within 18–24 hrs of diving — move the dive earlier in the trip.");
      }
    }

    const travelToday = day.hours + night.hours + legsBefore.reduce((s, l) => s + l.hours, 0);
    if (travelToday > 6) {
      warnings.push(`That's about ${Math.round(travelToday)} hrs of travel today — doable, but a long one.`);
    }
    const next = data.days[index + 1];
    if (isLate(night.option) && next && isEarly(optionFor(next.day))) {
      warnings.push(`Big night before an early start tomorrow (${optionFor(next.day)!.title}). Brave.`);
    }

    const out: TimelineDay = {
      index,
      date,
      label: date ? dayLabel(date) : `Day ${index + 1}`,
      base,
      tags,
      legsBefore,
      day: { value: day.value, pick: day.pick, before: day.before, after: day.after },
      night: { value: night.value, pick: night.pick, before: night.before, after: night.after },
      legsAfter,
      warnings,
      tips,
    };
    return out;
  });

  const route: RegionId[] = n ? ["airport", "colombo", ...(transfer >= 0 ? (["galle"] as RegionId[]) : []), "airport"] : [];
  return { days, totalHours: total, regionsVisited: visited, route, spokes };
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
    for (const p of [d.day, d.night]) {
      if (isStay(p)) vibes.push(0); // Stay in is perfectly balanced
      else {
        const o = optionFor(p);
        if (o) vibes.push(o.vibe);
      }
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
  if (score <= -1.2) return { title: "Wild at heart", line: "Reefs, rivers and early starts." };
  if (score <= -0.4) return { title: "Nature lover", line: "Mostly outdoors, with a few nights out." };
  if (score < 0.4) return { title: "Perfectly balanced", line: "Adventure by day, fun by night." };
  if (score < 1.2) return { title: "Social butterfly", line: "Beaches, bars and good company." };
  return { title: "Party animal", line: "Here for the nights." };
}
