// Turns an itinerary into a timeline: the fixed legs (CMB → Colombo, the
// Colombo → Galle road trip, Galle → CMB), road trips and hops between items
// in different towns, per-slot time totals, friendly warnings and the
// nature ↔ nightlife balance.
import {
  COAST_ROAD,
  LEGS,
  formatHours,
  isNightlife,
  poyaOn,
  regions,
  stays,
  travelHours,
  type Activity,
  type FixedLeg,
  type RegionId,
  type Where,
} from "@/content";
import { PEAK_ID, overnightFrom, peakOn, peakWarnings } from "./adams-peak";
import {
  dateAt,
  dayName,
  dayRole,
  nyeIndex,
  resolve,
  slotWhere,
  type DayRole,
  type ItineraryData,
  type Resolved,
  type SlotItem,
  type SlotKind,
} from "./itinerary";
import { dayLabel, parseISO } from "./dates";

export type TravelSegment = {
  /** "overnight": Adam's Peak sunrise — the drive left Galle the evening before. */
  kind: "fixed" | "excursion" | "hop" | "return" | "overnight";
  from: RegionId;
  to: RegionId;
  title: string;
  hours: number;
  label: string;
  detail?: string;
  /** Coast-road stops (Day 2), in route order. */
  stops?: { region: RegionId; name: string; km: number }[];
};

export type ItemView = {
  item: SlotItem;
  resolved: Resolved;
  /** Travel to this item (road trip from base, or a hop from the previous item). */
  before: TravelSegment | null;
};

export type SlotView = {
  slot: SlotKind;
  where: Where | null;
  items: ItemView[];
  /** Item time + travel inside the slot. */
  plannedHours: number;
  overpacked: boolean;
  /** Getting back to base after the slot, if it's far. */
  after: TravelSegment | null;
  /** Evening: the locked overnight drive to Adam's Peak (the next day is a sunrise climb). */
  locked?: { title: string; detail: string; leave: string; hours: number; forDay: number } | null;
  /** Evening: "Recovery night — Stay in suggested" / "Back late…". */
  note?: { text: string; suggestStay: boolean } | null;
  /** Daytime: a full-day trip replaces the hours total ("~18–19 hrs door to door"). */
  fullDay?: string | null;
};

export type DayTag = "arrival" | "transfer" | "departure" | "nye" | "summit" | "poya";

export type TimelineDay = {
  index: number;
  date: string | null;
  label: string;
  role: DayRole;
  name: string;
  tags: DayTag[];
  legsBefore: TravelSegment[];
  day: SlotView;
  night: SlotView;
  warnings: string[];
  tips: string[];
};

export type Timeline = {
  days: TimelineDay[];
  totalHours: number;
  regionsVisited: RegionId[];
  /** Main route for the map plus there-and-back spokes from the bases. */
  route: RegionId[];
  spokes: { from: RegionId; to: RegionId }[];
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const SLOT_LIMIT: Record<SlotKind, number> = { day: 10, night: 7 };

/** "Fridays only", "Wed & Sat", "Wed, Fri & Sun". */
export function daysLabel(days: number[]): string {
  if (days.length === 1) return `${WEEKDAYS[days[0]]}s only`;
  const order = [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)); // Mon-first
  const names = order.map((d) => SHORT_DAYS[d]);
  return `${names.slice(0, -1).join(", ")} & ${names.at(-1)}`;
}

/** Home for a pool: where you'd set off from. */
export const homeOf = (where: Where): RegionId => (where === "colombo" ? "colombo" : "galle");

/** Hours each way from the home base to an activity. */
export function hoursFrom(a: Activity, where: Where): number {
  return travelHours(homeOf(where === "enroute" ? "colombo" : where), a.region);
}

/** Drive time label — Adam's Peak reads "~5–6 hrs" rather than a single number. */
export const driveLabel = (h: number) => (h === 5.5 ? "~5–6 hrs" : formatHours(h));

/** "In Galle", "~1 hr from Galle", "On the way · 62 km", "Big day trip · ~2.5 hrs each way". */
export function distanceLabel(a: Activity, where: Where): string {
  if (where === "enroute") return a.routeKm ? `On the way · km ${a.routeKm}` : "On the way";
  const h = travelHours(homeOf(where), a.region);
  if (h >= 4) return `Big day trip · ${driveLabel(h)} each way`;
  const home = stays[where === "colombo" ? "colombo" : "galle"].name;
  if (h === 0) return `In ${home}`;
  if (h <= 0.25) return `~15 min from ${home}`;
  if (h >= 2) return `Big day trip · ${formatHours(h)} each way`;
  return `${formatHours(h)} from ${home}`;
}

export function legSegment(leg: FixedLeg, stops?: TravelSegment["stops"]): TravelSegment {
  return { kind: "fixed", from: leg.from, to: leg.to, title: leg.title, hours: leg.hours, label: leg.label, detail: leg.detail, stops };
}

const activityOf = (r: Resolved | null): Activity | null => (r?.kind === "activity" ? r.activity : null);

function segment(kind: TravelSegment["kind"], from: RegionId, to: RegionId, home: RegionId): TravelSegment {
  const h = travelHours(from, to);
  const title =
    kind === "excursion"
      ? `Road trip · ${regions[from].short} → ${regions[to].short}`
      : kind === "return"
        ? `Back to ${regions[to].short}`
        : `${regions[from].short} → ${regions[to].short}`;
  void home;
  return { kind, from, to, title, hours: h, label: driveLabel(h) };
}

/** Coast-road leg for Day 2, listing the picked stops in route order. */
export function coastLeg(items: SlotItem[]): TravelSegment {
  const acts = items.map((x) => activityOf(resolve(x, "day", "enroute"))).filter((a): a is Activity => !!a);
  if (!acts.length) return legSegment(LEGS.transfer);
  const byRegion = new Map<RegionId, number>();
  for (const a of acts) byRegion.set(a.region, a.routeKm ?? COAST_ROAD.find((s) => s.region === a.region)?.km ?? 0);
  const stops = [...byRegion.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([region, km]) => ({ region, name: regions[region].short, km }));
  return legSegment(LEGS.coast, stops);
}

export function buildTimeline(data: ItineraryData): Timeline {
  const n = data.days.length;
  const nye = nyeIndex(data);
  let total = 0;
  const visited: RegionId[] = [];
  const spokes: { from: RegionId; to: RegionId }[] = [];
  const coastStops: RegionId[] = [];
  const visit = (r: RegionId) => !visited.includes(r) && visited.push(r);

  const days = data.days.map((d, index) => {
    const role = dayRole(index, n);
    const date = dateAt(data, index);
    const weekday = date ? parseISO(date).getUTCDay() : null;
    const tags: DayTag[] = [];
    const peak = peakOn(data, index);
    const overnight = overnightFrom(data, index);
    if (index === 0) tags.push("arrival");
    if (peak && role === "galle") tags.push("summit");
    if (poyaOn(date)) tags.push("poya");
    if (role === "transfer") tags.push("transfer");
    if (role === "departure") tags.push("departure");
    if (index === nye) tags.push("nye");
    const warnings: string[] = [];
    const tips: string[] = [];
    const legsBefore: TravelSegment[] = [];

    if (role === "colombo") legsBefore.push(legSegment(LEGS.arrival));
    if (role === "transfer") {
      const leg = coastLeg(d.day);
      legsBefore.push(leg);
      for (const s of leg.stops ?? []) {
        if (!coastStops.includes(s.region)) coastStops.push(s.region);
        visit(s.region);
      }
    }
    if (role === "departure") legsBefore.push(legSegment(LEGS.departure));
    for (const l of legsBefore) total += l.hours;
    if (role === "colombo") visit("colombo");
    if (role === "transfer" || role === "galle") visit("galle");

    // Walk the day: Daytime items then Evening items, starting from home.
    const home: RegionId = role === "colombo" ? "colombo" : "galle";
    let here: RegionId = home;
    const views = {} as Record<SlotKind, SlotView>;
    for (const slot of ["day", "night"] as SlotKind[]) {
      const where = slotWhere(role, slot);
      const items: ItemView[] = [];
      let planned = 0;
      for (const item of d[slot]) {
        const r = resolve(item, slot, where);
        if (!r) continue;
        let before: TravelSegment | null = null;
        const a = activityOf(r);
        if (where === "enroute") {
          // Stops sit on the coast road itself — the drive is the leg above.
          planned += a?.hours ?? 0;
        } else if (r.kind === "stay") {
          if (here !== home) {
            before = segment("return", here, home, home);
            here = home;
          }
        } else if (a) {
          if (a.region !== here) {
            const kind = here === home ? "excursion" : "hop";
            const seg = segment(kind, here, a.region, home);
            if (a.id === PEAK_ID && peak?.variant.overnight) {
              seg.kind = "overnight";
              seg.title = `Overnight drive · ${regions[here].short} → ${regions[a.region].short}`;
              seg.detail = `Left ${regions[here].short} ${peak.variant.overnight.leave} last night · sleep in the van`;
            }
            if (kind === "hop" || seg.hours >= 0.75) before = seg;
            planned += seg.hours;
            total += seg.hours;
            here = a.region;
          }
          planned += a.hours;
          if (a.region !== home) {
            visit(a.region);
            if (!spokes.some((s) => s.to === a.region)) spokes.push({ from: home, to: a.region });
          }
        }
        if (before && r.kind === "stay") total += before.hours;
        items.push({ item, resolved: r, before });

        // Day-of-week check.
        if (a?.availableDays && weekday !== null && !a.availableDays.includes(weekday)) {
          warnings.push(
            `${a.title.split(",")[0].replace(/^Friday at /, "")} only runs on ${a.availableDays
              .map((x) => `${WEEKDAYS[x]}s`)
              .join(" & ")} — this is a ${WEEKDAYS[weekday]}. Try moving it to a ${WEEKDAYS[a.availableDays[0]]}.`,
          );
        }
      }
      // A full-day trip (Adam's Peak) is long by design — no "packed" nag, a door-to-door total instead.
      const fullDay = slot === "day" && peak ? peak.variant.total : null;
      const overpacked = !fullDay && planned > SLOT_LIMIT[slot];
      if (overpacked) {
        warnings.push(
          `${slot === "day" ? "Daytime" : "The evening"} looks packed (~${Math.round(planned)} hrs with travel) — maybe save something for another day.`,
        );
      }
      views[slot] = { slot, where, items, plannedHours: planned, overpacked, after: null, fullDay };
      // Adam's Peak: the long drive back belongs to the daytime — the evening starts back in Galle.
      if (slot === "day" && peak && here !== home) {
        const back = segment("return", here, home, home);
        views.day.after = back;
        total += back.hours;
        here = home;
      }
    }
    // Adam's Peak: tonight's locked overnight drive, and the climb day's evening note.
    if (overnight?.overnight) {
      const h = travelHours("galle", "adams-peak");
      views.night.locked = { title: overnight.overnight.title, detail: overnight.overnight.detail, leave: overnight.overnight.leave, hours: h, forDay: index + 1 };
      if (views.night.items.length) {
        warnings.push(`Tonight's plans run into the overnight drive to Adam's Peak (leave ${overnight.overnight.leave}) — keep them early.`);
      }
    }
    if (peak && role === "galle") {
      views.night.note = { text: peak.variant.eveningNote, suggestStay: !views.night.items.some((v) => v.resolved.kind === "stay") };
      warnings.push(...peakWarnings(data, index));
    }
    // Head home at the end of the day if we're far away.
    if (here !== home) {
      const back = segment("return", here, home, home);
      total += back.hours;
      const last = views.night.items.length ? views.night : views.day;
      if (back.hours >= 0.75) last.after = back;
    }

    // Friendly warnings.
    const dayActs = views.day.items.map((v) => activityOf(v.resolved)).filter((a): a is Activity => !!a);
    const nightActs = views.night.items.map((v) => activityOf(v.resolved)).filter((a): a is Activity => !!a);
    if (role === "colombo" && dayActs.some((a) => a.region === "negombo")) {
      tips.push("Negombo is right by the airport — easiest straight off the plane, before heading into Colombo.");
    }
    if (role === "transfer") {
      if (dayActs.length) tips.push("Coast road today — the van stops wherever you've picked on the way down.");
      const far = nightActs.find((a) => travelHours("galle", a.region) >= 1.5);
      if (far && dayActs.length) warnings.push(`Long road day already — ${far.title.split(":")[0]} tonight means another ~${formatHours(travelHours("galle", far.region)).slice(1)} each way.`);
    }
    if (index === n - 2 && role !== "colombo") {
      if (dayActs.some((a) => a.tags.includes("diving"))) warnings.push("Don't fly within 18–24 hrs of diving — move the dive earlier in the trip.");
      if (nightActs.some((a) => a.vibe >= 2)) tips.push(`Big last night! It's ${LEGS.departure.label} to the airport tomorrow — plan the flight time around it.`);
    }
    const travelToday =
      legsBefore.reduce((s, l) => s + l.hours, 0) +
      [...views.day.items, ...views.night.items].reduce((s, v) => s + (v.before?.hours ?? 0), 0) +
      (views.night.after?.hours ?? views.day.after?.hours ?? 0);
    if (travelToday > 6 && !peak) warnings.push(`That's about ${Math.round(travelToday)} hrs on the road today — doable, but a long one.`);
    if (poyaOn(date) && nightActs.some((a) => isNightlife(a))) {
      tips.push(`${poyaOn(date)!.name} (full moon) — bars and liquor shops close by law, so tonight may be a dry one.`);
    }
    const next = data.days[index + 1];
    if (next && nightActs.some((a) => a.vibe >= 2)) {
      const early = next.day
        .map((x) => activityOf(resolve(x, "day", slotWhere(dayRole(index + 1, n), "day"))))
        .find((a) => a && (a.tags.includes("early") || a.tags.includes("big day trip") || a.id === "mirissa-whale-watching"));
      if (early) warnings.push(`Big night before an early start tomorrow (${early.title.replace(/^Big day trip: /, "")}). Brave.`);
    }

    const out: TimelineDay = {
      index,
      date,
      label: date ? dayLabel(date) : `Day ${index + 1}`,
      role,
      name: dayName(index, role),
      tags,
      legsBefore,
      day: views.day,
      night: views.night,
      warnings: [...new Set(warnings)],
      tips,
    };
    return out;
  });

  const route: RegionId[] = n ? ["airport", "colombo", ...coastStops, "galle", "airport"] : [];
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
    for (const x of [...d.day, ...d.night]) {
      const r = resolve(x, "day");
      if (!r) continue;
      vibes.push(r.kind === "stay" ? 0 : r.activity.vibe);
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
  if (score <= -1.2) return { title: "Wild at heart", line: "Rainforests, reefs and early starts." };
  if (score <= -0.4) return { title: "Nature lover", line: "Mostly outdoors, with a few nights out." };
  if (score < 0.4) return { title: "Perfectly balanced", line: "Adventure by day, fun by night." };
  if (score < 1.2) return { title: "Social butterfly", line: "Beaches, bars and good company." };
  return { title: "Party animal", line: "Here for the nights." };
}
