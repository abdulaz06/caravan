// The "Trip budget" tracker: per-person cost estimates grouped by day, with
// shared transport split across the group and an optional accommodation
// estimate. Pure, so the server export uses exactly the same numbers.
import { addDays, dayLabel } from "@/lib/dates";
import { formatHours, type Leg } from "./catalog";
import type { ItineraryData, SlotKind } from "./itinerary";
import { nightsFor, type Engine } from "./structure";
import { buildTimeline, transferLeg } from "./timeline";

export type Range = [number, number];
export type BudgetLine = {
  id: string;
  label: string;
  detail?: string;
  range: Range;
  kind: "activity" | "extra" | "transport" | "stay";
  included: boolean;
};
export type BudgetGroup = { id: string; title: string; subtitle?: string; lines: BudgetLine[] };
export type Verdict = { kind: "within" | "under" | "near" | "over" | "none"; text: string; pct?: number };
export type BudgetResult = {
  groups: BudgetGroup[];
  total: Range;
  lines: number;
  includedLines: number;
  accommodation: { on: boolean; style: string; styleLabel: string; nights: { base: string; name: string; nights: number }[] };
  tier: { id: string; label: string; bounds: Range } | null;
  verdict: Verdict;
};

const add = (a: Range, b: Range): Range => [a[0] + b[0], a[1] + b[1]];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function computeBudget(e: Engine, data: ItineraryData): BudgetResult {
  const { costs, travel, structure, preferences } = e.catalog.preset;
  const perPerson = (perVehicle: Range): Range => [(perVehicle[0] * costs.vehicles) / costs.groupSize, (perVehicle[1] * costs.vehicles) / costs.groupSize];
  const forHours = (hours: number): Range => perPerson([costs.perHourUsd[0] * hours, costs.perHourUsd[1] * hours]);
  const shared = travel.selfDrive ? `${costs.vehicles} ${travel.vehicle}s, split ${costs.groupSize} ways` : `Shared ${travel.vehicle}`;

  const excluded = new Set(data.budget?.excluded ?? []);
  const timeline = buildTimeline(e, data);
  const groups: BudgetGroup[] = [];

  const legLine = (leg: Leg, id: string): BudgetLine => ({
    id,
    label: leg.title.replace(/^Road trip · /, ""),
    detail: `${shared} · ${leg.label}`,
    range: perPerson(leg.vehicleCostUsd),
    kind: "transport",
    included: !excluded.has(id),
  });

  timeline.days.forEach((t, i) => {
    const d = data.days[i];
    const lines: BudgetLine[] = [];
    if (t.plan.arrival) {
      const leg = e.catalog.legs[structure.arrival.leg];
      if (leg) lines.push(legLine(leg, "leg:arrival"));
    }
    if (t.plan.kind === "transfer" && t.plan.transfer) {
      const seg = transferLeg(e, t.plan, d.day);
      const leg = e.catalog.legs[seg?.stops ? (t.plan.transfer.scenicLeg ?? t.plan.transfer.leg) : t.plan.transfer.leg];
      if (leg) lines.push(legLine(leg, `leg:transfer:${t.plan.base.id}`));
    }
    // Self-drive trips: the cars themselves, every day they're out.
    if (costs.dailyUsd && t.plan.kind !== "departure") {
      const id = `${d.id}:daily`;
      lines.push({ id, label: costs.dailyLabel ?? `${cap(travel.vehicle)}s`, detail: shared, range: perPerson(costs.dailyUsd), kind: "transport", included: !excluded.has(id) });
    }

    let driving = 0;
    for (const slot of ["day", "night"] as SlotKind[]) {
      const view = t[slot];
      const when = structure.slots[slot].label;
      for (const v of view.items) {
        driving += v.before && v.before.kind !== "fixed" ? v.before.hours : 0;
        if (v.resolved.kind !== "activity") continue; // Stay in costs nothing
        const a = v.resolved.activity;
        const id = `${d.id}:${slot}:${v.item.key}`;
        lines.push({
          id,
          label: a.emoji ? `${a.emoji} ${a.title}` : a.title,
          detail: a.kind === "extra" ? `Quick extra · ${when}` : when,
          range: a.estCostUsd,
          kind: a.kind === "extra" ? "extra" : "activity",
          included: !excluded.has(id),
        });
      }
      driving += view.after?.hours ?? 0;
    }
    if (driving >= 0.75) {
      const id = `${d.id}:van`;
      // A day trip with a quoted round-trip price is a full-day hire; any other driving that day is on top.
      const trip = t.trip?.activity.vehicleRoundTripUsd ? t.trip.activity : undefined;
      const rest = trip ? Math.max(0, driving - 2 * e.catalog.travelHours(t.plan.base.region, trip.region)) : driving;
      const fuel = travel.selfDrive ? "Fuel & parking" : `Shared ${travel.vehicle}`;
      lines.push({
        id,
        label: trip
          ? `${fuel} · ${t.plan.base.name} ⇄ ${e.catalog.regions[trip.region]?.short ?? trip.region}`
          : travel.selfDrive
            ? "Fuel & parking for the day's drives"
            : `Shared ${travel.vehicle} for the day's trips`,
        detail: trip ? `Day hire · ${formatHours(driving)} of driving` : `${formatHours(driving)} of driving`,
        range: trip?.vehicleRoundTripUsd ? add(perPerson(trip.vehicleRoundTripUsd), rest >= 0.75 ? forHours(rest) : [0, 0]) : forHours(driving),
        kind: "transport",
        included: !excluded.has(id),
      });
    }
    if (t.plan.kind === "departure") {
      const leg = e.catalog.legs[structure.departure.leg];
      if (leg) lines.push(legLine(leg, "leg:departure"));
    }
    if (lines.length) {
      groups.push({
        id: d.id,
        title: `Day ${i + 1}`,
        subtitle: `${data.startDate ? `${dayLabel(addDays(data.startDate, i))} · ` : ""}${t.name}`,
        lines,
      });
    }
  });

  // Accommodation: nights at each base × the preferred stay style.
  const split = nightsFor(e, data.days.length).filter((s) => s.nights > 0);
  const styles = preferences.stays;
  const style = data.preferences.stay && costs.accommodation[data.preferences.stay] ? data.preferences.stay : (styles.find((s) => s.id === "mix")?.id ?? styles[0].id);
  const rates = costs.accommodation[style] ?? Object.values(costs.accommodation)[0] ?? {};
  const styleLabel = styles.find((s) => s.id === style)?.label ?? style;
  const accOn = data.budget?.accommodation !== false;
  if (accOn && data.days.length > 1) {
    const lines: BudgetLine[] = [];
    for (const { base, nights } of split) {
      const rate = rates[base.id];
      if (!rate) continue;
      const id = `stay:${base.id}`;
      lines.push({
        id,
        label: `${base.name} · ${nights} ${nights === 1 ? "night" : "nights"}`,
        detail: `${styleLabel}, per person`,
        range: [rate[0] * nights, rate[1] * nights],
        kind: "stay",
        included: !excluded.has(id),
      });
    }
    if (lines.length) groups.push({ id: "accommodation", title: "Places to stay", subtitle: `Based on: ${styleLabel.toLowerCase()}`, lines });
  }

  let total: Range = [0, 0];
  let lineCount = 0;
  let included = 0;
  for (const g of groups) {
    for (const l of g.lines) {
      lineCount++;
      if (!l.included) continue;
      included++;
      total = add(total, l.range);
    }
  }
  total = [Math.round(total[0]), Math.round(total[1])];

  const tierDef = data.preferences.budget ? preferences.budgets.find((t) => t.id === data.preferences.budget) : undefined;
  const tier = tierDef ? { id: tierDef.id, label: tierDef.label, bounds: [tierDef.usd[0], tierDef.usd[1] ?? Number.POSITIVE_INFINITY] as Range } : null;
  return {
    groups,
    total,
    lines: lineCount,
    includedLines: included,
    accommodation: { on: accOn, style, styleLabel, nights: split.map((s) => ({ base: s.base.id, name: s.base.name, nights: s.nights })) },
    tier,
    verdict: verdictFor(total, tier?.bounds),
  };
}

function verdictFor(total: Range, bounds: Range | undefined): Verdict {
  if (!bounds) return { kind: "none", text: "Set a budget in Extras to compare" };
  const [, max] = bounds;
  const [lo, hi] = total;
  if (hi <= max) {
    if (hi < bounds[0] * 0.75) return { kind: "under", text: "Comfortably under your budget" };
    return { kind: "within", text: "Within your budget" };
  }
  if (lo > max) {
    const pct = Math.max(1, Math.round((((lo + hi) / 2 - max) / max) * 100));
    return { kind: "over", text: `≈ ${pct}% over your budget`, pct };
  }
  return { kind: "near", text: "Around the top of your budget" };
}
