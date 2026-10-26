// Turns an itinerary into a timeline: the fixed legs (arrival, the road
// between bases, the way to the airport), road trips and hops between items
// in different places, per-slot time totals, friendly warnings and the
// nature ↔ nightlife balance. Never blocks anything — it only advises.
import { dayLabel, parseISO } from "@/lib/dates";
import { formatHours, type Activity, type Leg, type Route, type Slot, type SpecialDate } from "./catalog";
import { earlyNightBefore, lateNightItems, tripOn, type DayTrip } from "./day-trip";
import { dateAt, plansOf, resolve, specialAt, type ItineraryData, type Resolved, type SlotItem } from "./itinerary";
import { isRouteArea, type DayPlan, type Engine } from "./structure";

export type TravelSegment = {
  kind: "fixed" | "excursion" | "hop" | "return";
  from: string;
  to: string;
  title: string;
  hours: number;
  label: string;
  detail?: string;
  /** Stops picked along a scenic route (transfer days), in route order. */
  stops?: { region: string; name: string; km: number }[];
  route?: Route;
  /** The leg leaves from or lands at an airport. */
  flight?: boolean;
  /** Icon hint from the activity at the far end (e.g. "hill-sun"). */
  icon?: string;
};

export type ItemView = {
  item: SlotItem;
  resolved: Resolved;
  /** Travel to this item (road trip from base, or a hop from the previous item). */
  before: TravelSegment | null;
};

export type SlotView = {
  slot: Slot;
  area: string | null;
  /** Items here sit on a transfer route ("On the way"). */
  onRoute: boolean;
  items: ItemView[];
  /** Item time + travel inside the slot. */
  plannedHours: number;
  overpacked: boolean;
  /** Getting back to base after the slot, if it's far. */
  after: TravelSegment | null;
  /** Evening notes: an early night before a very early day trip, or rest after one. */
  notes?: { text: string; suggestStay: boolean; tone: "early" | "rest" }[];
  /** Daytime: a full-day trip replaces the hours total ("~14 hrs door to door"). */
  fullDay?: string | null;
};

export type DayTag = "arrival" | "transfer" | "departure" | "special" | "daytrip";

export type TimelineDay = {
  index: number;
  date: string | null;
  label: string;
  plan: DayPlan;
  name: string;
  tags: DayTag[];
  special: SpecialDate | null;
  trip: DayTrip | null;
  legsBefore: TravelSegment[];
  day: SlotView;
  night: SlotView;
  warnings: string[];
  tips: string[];
};

export type Timeline = {
  days: TimelineDay[];
  totalHours: number;
  regionsVisited: string[];
  /** Main route for the map plus there-and-back spokes from the bases. */
  route: string[];
  spokes: { from: string; to: string }[];
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Fridays only", "Wed & Sat", "Wed, Fri & Sun". */
export function daysLabel(days: number[]): string {
  if (days.length === 1) return `${WEEKDAYS[days[0]]}s only`;
  const order = [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)); // Mon-first
  const names = order.map((d) => SHORT_DAYS[d]);
  return `${names.slice(0, -1).join(", ")} & ${names.at(-1)}`;
}

/** The short name of an activity for warnings ("Secret Jungle Party", not the whole title). */
const shortTitle = (a: Activity) => a.title.split(/[:,·]/)[0].replace(/^(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day at /, "").trim();

/** The base you set off from for a pool. */
export function homeRegion(e: Engine, area: string | null): string {
  const home = area ? e.catalog.areas[area]?.home : undefined;
  return (home && e.catalog.basesById[home]?.region) ?? e.catalog.bases[0].region;
}

/** Hours each way from a pool's home base to an activity. */
export function hoursFrom(e: Engine, a: Activity, area: string): number {
  return e.catalog.travelHours(homeRegion(e, area), a.region);
}

/** "In Galle", "~1 hr from Galle", "On the way · km 62", "Big day trip · ~2.5 hrs each way". */
export function distanceLabel(e: Engine, a: Activity, area: string): string {
  if (isRouteArea(e, area)) return a.routeKm !== undefined ? `On the way · km ${a.routeKm}` : "On the way";
  if (a.onlyWith) return `In ${e.catalog.regions[a.region]?.short ?? a.region} · with your day trip`;
  const home = e.catalog.basesById[e.catalog.areas[area]?.home ?? ""]?.name ?? e.catalog.bases[0].name;
  const h = hoursFrom(e, a, area);
  if (h === 0) return `In ${home}`;
  if (h <= 0.25) return `~15 min from ${home}`;
  if (h >= 2) return `Big day trip · ${formatHours(h)} each way`;
  return `${formatHours(h)} from ${home}`;
}

export function legSegment(leg: Leg, extra?: Pick<TravelSegment, "stops" | "route" | "flight">): TravelSegment {
  return { kind: "fixed", from: leg.from, to: leg.to, title: leg.title, hours: leg.hours, label: leg.label, detail: leg.detail, ...extra };
}

const activityIn = (r: Resolved | null): Activity | null => (r?.kind === "activity" ? r.activity : null);

function segment(e: Engine, kind: TravelSegment["kind"], from: string, to: string, icon?: string): TravelSegment {
  const h = e.catalog.travelHours(from, to);
  const R = e.catalog.regions;
  const title =
    kind === "excursion"
      ? `Road trip · ${R[from]?.short ?? from} → ${R[to]?.short ?? to}`
      : kind === "return"
        ? `Back to ${R[to]?.short ?? to}`
        : `${R[from]?.short ?? from} → ${R[to]?.short ?? to}`;
  return { kind, from, to, title, hours: h, label: formatHours(h), ...(icon ? { icon } : {}) };
}

/** The road between two bases: straight there, or the scenic route through the stops picked on the way. */
export function transferLeg(e: Engine, plan: DayPlan, dayItems: SlotItem[]): TravelSegment | null {
  const t = plan.transfer;
  if (!t) return null;
  const direct = e.catalog.legs[t.leg];
  const route = t.route ? e.catalog.routes[t.route] : undefined;
  const scenic = t.scenicLeg ? e.catalog.legs[t.scenicLeg] : undefined;
  const acts = dayItems.map((x) => e.catalog.byId[x.id]).filter((a): a is Activity => !!a);
  if (!route || !scenic || !acts.length) return direct ? legSegment(direct) : null;
  const byRegion = new Map<string, number>();
  for (const a of acts) byRegion.set(a.region, a.routeKm ?? route.stops.find((s) => s.region === a.region)?.km ?? 0);
  const stops = [...byRegion.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([region, km]) => ({ region, name: e.catalog.regions[region]?.short ?? region, km }));
  return legSegment(scenic, { stops, route });
}

export function buildTimeline(e: Engine, data: ItineraryData): Timeline {
  const n = data.days.length;
  const plans = plansOf(e, data);
  const { structure } = e.catalog.preset;
  let total = 0;
  const visited: string[] = [];
  const spokes: { from: string; to: string }[] = [];
  const route: string[] = [];
  const visit = (r: string) => !visited.includes(r) && visited.push(r);
  const onRoute = (r: string) => route[route.length - 1] !== r && route.push(r);

  const days = data.days.map((d, index) => {
    const plan = plans[index];
    const date = dateAt(data, index);
    const weekday = date ? parseISO(date).getUTCDay() : null;
    const special = specialAt(e, data, index);
    const trip = plan.kind === "base" ? tripOn(e, data, index) : null;
    const earlyNight = earlyNightBefore(e, data, index);
    const tags: DayTag[] = [];
    if (plan.arrival) tags.push("arrival");
    if (trip) tags.push("daytrip");
    if (plan.kind === "transfer") tags.push("transfer");
    if (plan.kind === "departure") tags.push("departure");
    if (special) tags.push("special");
    const warnings: string[] = [];
    const tips: string[] = [];
    const legsBefore: TravelSegment[] = [];

    if (plan.arrival) {
      const leg = e.catalog.legs[structure.arrival.leg];
      if (leg) {
        legsBefore.push(legSegment(leg, { flight: true }));
        onRoute(leg.from);
      }
    }
    if (plan.kind === "transfer") {
      const leg = transferLeg(e, plan, d.day);
      if (leg) {
        legsBefore.push(leg);
        for (const s of leg.stops ?? []) {
          onRoute(s.region);
          visit(s.region);
        }
      }
    }
    if (plan.kind === "departure") {
      const leg = e.catalog.legs[structure.departure.leg];
      if (leg) legsBefore.push(legSegment(leg, { flight: true }));
    }
    for (const l of legsBefore) total += l.hours;
    if (plan.kind !== "departure") {
      visit(plan.base.region);
      onRoute(plan.base.region);
    }

    // Walk the day: Daytime items then Evening items, starting from home.
    const home = plan.base.region;
    let here = home;
    const views = {} as Record<Slot, SlotView>;
    for (const slot of ["day", "night"] as Slot[]) {
      const area = plan.areas[slot];
      const routeSlot = isRouteArea(e, area);
      const items: ItemView[] = [];
      let planned = 0;
      for (const item of d[slot]) {
        const r = resolve(e, item, slot, area);
        if (!r) continue;
        let before: TravelSegment | null = null;
        const a = activityIn(r);
        if (routeSlot) {
          // Stops sit on the road itself — the drive is the leg above.
          planned += a?.hours ?? 0;
        } else if (r.kind === "stay") {
          if (here !== home) {
            before = segment(e, "return", here, home);
            total += before.hours;
            here = home;
          }
        } else if (a) {
          if (a.region !== here) {
            const kind = here === home ? "excursion" : "hop";
            const seg = segment(e, kind, here, a.region, a.icon);
            if (trip && a.id === trip.activity.id) seg.detail = `Leave ${e.catalog.regions[here]?.short ?? here} ${trip.variant.leave}`;
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
        items.push({ item, resolved: r, before });

        // Day-of-week check.
        if (a?.availableDays && weekday !== null && !a.availableDays.includes(weekday)) {
          warnings.push(
            `${shortTitle(a)} only runs on ${a.availableDays.map((x) => `${WEEKDAYS[x]}s`).join(" & ")} — this is a ${WEEKDAYS[weekday]}. Try moving it to a ${WEEKDAYS[a.availableDays[0]]}.`,
          );
        }
      }
      // A variant day trip is long by design — no "packed" nag, a door-to-door total instead.
      const fullDay = slot === "day" && trip ? trip.variant.total : null;
      const overpacked = !fullDay && planned > structure.slots[slot].limitHours;
      if (overpacked) {
        warnings.push(`${slot === "day" ? "Daytime" : "The evening"} looks packed (~${Math.round(planned)} hrs with travel) — maybe save something for another day.`);
      }
      views[slot] = { slot, area, onRoute: routeSlot, items, plannedHours: planned, overpacked, after: null, fullDay };
      // The long drive back from a day trip belongs to the daytime — the evening starts back at base.
      if (slot === "day" && trip && here !== home) {
        const back = segment(e, "return", here, home, trip.activity.icon);
        views.day.after = back;
        total += back.hours;
        here = home;
      }
    }

    // Soft notes: an early night before a very early variant (never a lock), rest after a day trip.
    const notes: NonNullable<SlotView["notes"]> = [];
    const hasStay = views.night.items.some((v) => v.resolved.kind === "stay");
    if (earlyNight?.eveBefore) {
      notes.push({ text: earlyNight.eveBefore, suggestStay: false, tone: "early" });
      const late = lateNightItems(e, data, index);
      if (late.length) {
        warnings.push(
          `Early start tonight — you leave ${earlyNight.leave} for tomorrow's day trip, and ${shortTitle(late[0])} usually runs late. Maybe keep it short, or move it to another night.`,
        );
      }
    }
    if (trip) notes.push({ text: trip.variant.eveningNote, suggestStay: !hasStay, tone: "rest" });
    if (notes.length) views.night.notes = notes;

    // Head home at the end of the day if we're far away.
    if (here !== home) {
      const back = segment(e, "return", here, home);
      total += back.hours;
      const last = views.night.items.length ? views.night : views.day;
      if (back.hours >= 0.75) last.after = back;
    }

    // Friendly advice.
    const dayActs = views.day.items.map((v) => activityIn(v.resolved)).filter((a): a is Activity => !!a);
    const nightActs = views.night.items.map((v) => activityIn(v.resolved)).filter((a): a is Activity => !!a);
    if (plan.kind === "transfer" && views.day.onRoute) {
      if (dayActs.length) tips.push(`On the road today — the ${e.catalog.preset.travel.vehicle} stops wherever you've picked on the way.`);
      const far = nightActs.find((a) => e.catalog.travelHours(home, a.region) >= 1.5);
      if (far && dayActs.length) {
        warnings.push(`Long road day already — ${shortTitle(far)} tonight means another ${formatHours(e.catalog.travelHours(home, far.region))} each way.`);
      }
    }
    if (index === n - 2 && !plan.arrival) {
      const departure = e.catalog.legs[structure.departure.leg];
      if (dayActs.some((a) => a.tags.includes("diving"))) warnings.push("Don't fly within 18–24 hrs of diving — move the dive earlier in the trip.");
      if (nightActs.some((a) => a.vibe >= 2) && departure) tips.push(`Big last night! It's ${departure.label} to the airport tomorrow — plan the flight time around it.`);
    }
    const travelToday =
      legsBefore.reduce((s, l) => s + l.hours, 0) +
      [...views.day.items, ...views.night.items].reduce((s, v) => s + (v.before?.hours ?? 0), 0) +
      (views.night.after?.hours ?? views.day.after?.hours ?? 0);
    if (travelToday > 6 && !trip) warnings.push(`That's about ${Math.round(travelToday)} hrs on the road today — doable, but a long one.`);
    const next = data.days[index + 1];
    if (next && !earlyNight && nightActs.some((a) => a.vibe >= 2)) {
      const early = next.day
        .map((x) => e.catalog.byId[x.id])
        .find((a) => a && (a.tags.includes("early") || a.tags.includes("big day trip")));
      if (early) warnings.push(`Big night before an early start tomorrow (${early.title.replace(/^Big day trip: /, "")}). Brave.`);
    }

    const out: TimelineDay = {
      index,
      date,
      label: date ? dayLabel(date) : `Day ${index + 1}`,
      plan,
      name: plan.name,
      tags,
      special,
      trip,
      legsBefore,
      day: views.day,
      night: views.night,
      warnings: [...new Set(warnings)],
      tips,
    };
    return out;
  });

  const departure = e.catalog.legs[structure.departure.leg];
  if (n && departure) onRoute(departure.to);
  return { days, totalHours: total, regionsVisited: visited, route: n ? route : [], spokes };
}

export type Balance = {
  score: number | null; // -2 … +2
  count: number;
  nature: number;
  balanced: number;
  nightlife: number;
};

export function balanceOf(e: Engine, data: Pick<ItineraryData, "days">): Balance {
  const vibes: number[] = [];
  for (const d of data.days) {
    for (const x of [...d.day, ...d.night]) {
      const r = resolve(e, x, "day");
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
  if (score <= -1.2) return { title: "Wild at heart", line: "Trails, wild places and early starts." };
  if (score <= -0.4) return { title: "Nature lover", line: "Mostly outdoors, with a few nights out." };
  if (score < 0.4) return { title: "Perfectly balanced", line: "Adventure by day, fun by night." };
  if (score < 1.2) return { title: "Social butterfly", line: "Good food, good views, good company." };
  return { title: "Party animal", line: "Here for the nights." };
}
