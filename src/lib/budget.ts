// The "Trip budget" tracker: per-person cost estimates grouped by day, with
// shared transport split across the group and an optional accommodation
// estimate. Pure, so the server export uses exactly the same numbers.
import { LEGS, activitiesById, formatHours, regions, travelHours, type FixedLeg } from "@/content";
import { ACCOMMODATION, BUDGET_BOUNDS, GROUP_SIZE, VANS, VAN_RATE_PER_HOUR } from "@/content/costs";
import { budgets as BUDGET_TIERS, stays as STAY_STYLES } from "@/content/preferences";
import { addDays, dayLabel } from "./dates";
import { nights as nightsFor, type ItineraryData, type SlotKind } from "./itinerary";
import { ELLA_ID } from "./day-trip";
import { buildTimeline, coastLeg } from "./timeline";

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
  accommodation: { on: boolean; style: string; styleLabel: string; nights: { colombo: number; galle: number } };
  tier: { id: string; label: string; bounds: Range } | null;
  verdict: Verdict;
};

const perPerson = (vanCost: Range): Range => [(vanCost[0] * VANS) / GROUP_SIZE, (vanCost[1] * VANS) / GROUP_SIZE];
const vanFor = (hours: number): Range => perPerson([VAN_RATE_PER_HOUR[0] * hours, VAN_RATE_PER_HOUR[1] * hours]);
const add = (a: Range, b: Range): Range => [a[0] + b[0], a[1] + b[1]];

function legLine(leg: FixedLeg, id: string, excluded: Set<string>): BudgetLine {
  return {
    id,
    label: leg.title.replace(/^Road trip · /, ""),
    detail: `Shared van · ${leg.label}`,
    range: perPerson(leg.vanCostUsd),
    kind: "transport",
    included: !excluded.has(id),
  };
}

export function computeBudget(data: ItineraryData): BudgetResult {
  const excluded = new Set(data.budget?.excluded ?? []);
  const timeline = buildTimeline(data);
  const groups: BudgetGroup[] = [];

  timeline.days.forEach((t, i) => {
    const d = data.days[i];
    const lines: BudgetLine[] = [];
    if (t.role === "colombo") lines.push(legLine(LEGS.arrival, "leg:arrival", excluded));
    if (t.role === "transfer") lines.push(legLine(coastLeg(d.day).stops ? LEGS.coast : LEGS.transfer, "leg:transfer", excluded));

    let driving = 0;
    for (const slot of ["day", "night"] as SlotKind[]) {
      const view = t[slot];
      const when = slot === "day" ? "Daytime" : "Evening";
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
      // The Ella day trip is a full-day van hire (its own quote); any other driving that day is on top.
      const trip = t.tags.includes("daytrip") ? activitiesById[ELLA_ID] : undefined;
      const rest = trip ? Math.max(0, driving - 2 * travelHours("galle", trip.region)) : driving;
      lines.push({
        id,
        label: trip ? `Shared van · Galle ⇄ ${regions[trip.region].short}` : "Shared van for the day's trips",
        detail: trip ? `Day hire · ${formatHours(driving)} of driving` : `${formatHours(driving)} of driving`,
        range: trip?.vanRoundTripUsd ? add(perPerson(trip.vanRoundTripUsd), rest >= 0.75 ? vanFor(rest) : [0, 0]) : vanFor(driving),
        kind: "transport",
        included: !excluded.has(id),
      });
    }
    if (t.role === "departure") lines.push(legLine(LEGS.departure, "leg:departure", excluded));
    if (lines.length) {
      groups.push({
        id: d.id,
        title: `Day ${i + 1}`,
        subtitle: `${data.startDate ? `${dayLabel(addDays(data.startDate, i))} · ` : ""}${t.name}`,
        lines,
      });
    }
  });

  // Accommodation: Colombo 1 night, Galle the rest.
  const { colombo, galle } = nightsFor(data.days.length);
  const nights = { colombo, galle };
  const style = (data.preferences.stay as keyof typeof ACCOMMODATION | undefined) ?? "mix";
  const rates = ACCOMMODATION[style] ?? ACCOMMODATION.mix;
  const styleLabel = STAY_STYLES.find((s) => s.id === style)?.label ?? "A mix";
  const accOn = data.budget?.accommodation !== false;
  if (accOn && nights.colombo + nights.galle > 0) {
    const lines: BudgetLine[] = [];
    for (const b of ["colombo", "galle"] as const) {
      if (!nights[b]) continue;
      const id = `stay:${b}`;
      lines.push({
        id,
        label: `${b === "colombo" ? "Colombo" : "Galle"} · ${nights[b]} ${nights[b] === 1 ? "night" : "nights"}`,
        detail: `${styleLabel}, per person`,
        range: [rates[b][0] * nights[b], rates[b][1] * nights[b]],
        kind: "stay",
        included: !excluded.has(id),
      });
    }
    groups.push({ id: "accommodation", title: "Places to stay", subtitle: `Based on: ${styleLabel.toLowerCase()}`, lines });
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

  const tierDef = data.preferences.budget ? BUDGET_TIERS.find((t) => t.id === data.preferences.budget) : undefined;
  const bounds = tierDef ? BUDGET_BOUNDS[tierDef.id] : undefined;
  const tier = tierDef && bounds ? { id: tierDef.id, label: tierDef.label, bounds } : null;
  return {
    groups,
    total,
    lines: lineCount,
    includedLines: included,
    accommodation: { on: accOn, style, styleLabel, nights },
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
