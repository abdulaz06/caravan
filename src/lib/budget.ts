// The "Trip budget" tracker: per-person cost estimates grouped by day, with
// shared transport split across the group and an optional accommodation
// estimate. Pure, so the server export uses exactly the same numbers.
import { LEGS, addOnsById, formatHours, stayIn, type FixedLeg } from "@/content";
import { ACCOMMODATION, BUDGET_BOUNDS, GROUP_SIZE, VANS, VAN_RATE_PER_HOUR } from "@/content/costs";
import { budgets as BUDGET_TIERS, stays as STAY_STYLES } from "@/content/preferences";
import { addDays, dayLabel } from "./dates";
import { baseOfIndex, isPick, isStay, optionFor, transferIndex, type ItineraryData, type SlotKind } from "./itinerary";
import { hoursFromBase } from "./timeline";

export type Range = [number, number];
export type BudgetLine = {
  id: string;
  label: string;
  detail?: string;
  range: Range;
  kind: "activity" | "addon" | "transport" | "stay";
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
const vanTrip = (hoursEachWay: number): Range =>
  perPerson([VAN_RATE_PER_HOUR[0] * hoursEachWay * 2, VAN_RATE_PER_HOUR[1] * hoursEachWay * 2]);
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
  const n = data.days.length;
  const transfer = transferIndex(data);
  const groups: BudgetGroup[] = [];

  data.days.forEach((d, i) => {
    const base = baseOfIndex(n, i);
    const lines: BudgetLine[] = [];
    if (i === 0) lines.push(legLine(LEGS.arrival, "leg:arrival", excluded));
    if (i === transfer) lines.push(legLine(LEGS.transfer, "leg:transfer", excluded));

    for (const slot of ["day", "night"] as SlotKind[]) {
      const p = d[slot];
      if (!p) continue;
      const when = slot === "day" ? "Daytime" : "Evening";
      const o = optionFor(p);
      if (o) {
        const id = `${d.id}:${slot}`;
        lines.push({
          id,
          label: o.title,
          detail: when,
          range: o.estCostUsd ?? [0, 0],
          kind: "activity",
          included: !excluded.has(id),
        });
        if (o.transport && isPick(p)) {
          const t = o.transport[p.transport ?? "train"];
          const tid = `${d.id}:${slot}:transport`;
          lines.push({
            id: tid,
            label: `${t.mode === "train" ? "Train tickets" : "Shared van"} · ${t.out.split(" → ")[1]} & back`,
            detail: t.label,
            range: t.costUsd,
            kind: "transport",
            included: !excluded.has(tid),
          });
        } else {
          const h = hoursFromBase(o);
          if (h >= 0.75) {
            const tid = `${d.id}:${slot}:van`;
            lines.push({
              id: tid,
              label: `Shared van there & back`,
              detail: `${formatHours(h)} each way`,
              range: vanTrip(h),
              kind: "transport",
              included: !excluded.has(tid),
            });
          }
        }
      }
      // Stay in itself costs nothing; only its add-ons show.
      for (const aid of p.addOns ?? []) {
        const a = addOnsById[aid];
        if (!a) continue;
        const id = `${d.id}:${slot}:addon:${aid}`;
        lines.push({
          id,
          label: `${a.emoji} ${a.title}`,
          detail: `Add-on · ${isStay(p) ? `${stayIn[slot].title} ${when.toLowerCase()}` : when}`,
          range: a.estCostUsd,
          kind: "addon",
          included: !excluded.has(id),
        });
      }
    }
    if (i === n - 1) {
      lines.push(legLine(transfer >= 0 ? LEGS.departure : LEGS.departureFromColombo, "leg:departure", excluded));
    }
    if (lines.length) {
      groups.push({
        id: d.id,
        title: `Day ${i + 1}`,
        subtitle: `${data.startDate ? `${dayLabel(addDays(data.startDate, i))} · ` : ""}${base === "colombo" ? "Colombo" : "Galle"}`,
        lines,
      });
    }
  });

  // Accommodation: nights per base = nights spent sleeping there.
  const galleDays = transfer >= 0 ? n - transfer : 0;
  const colomboDays = n - galleDays;
  const nights = {
    colombo: galleDays > 0 ? colomboDays : Math.max(0, colomboDays - 1),
    galle: Math.max(0, galleDays - 1),
  };
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

