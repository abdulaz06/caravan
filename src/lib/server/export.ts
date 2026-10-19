import "server-only";
import { addOnsById, regions, stayIn, type Option } from "@/content";
import { computeBudget } from "@/lib/budget";
import { addDays } from "@/lib/dates";
import { baseOfIndex, baseSplit, isPick, isStay, optionFor, tripLength, type SlotPick } from "@/lib/itinerary";
import { balanceOf, buildTimeline, type SlotView } from "@/lib/timeline";
import type { Person } from "./group";

const csvCell = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  const s = Array.isArray(v) ? v.join("; ") : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const toCsv = (rows: Record<string, unknown>[]): string => {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return [headers.join(","), ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(","))].join("\n");
};

const STAY_ID = "stay";

function summarize(v: SlotView) {
  const addOns = (v.pick?.addOns ?? []).map((id) => ({ id, title: addOnsById[id]?.title ?? id }));
  const transport = isPick(v.pick) ? (v.pick.transport ?? null) : null;
  if (v.value === "stay") return { id: STAY_ID, title: stayIn.day.title, region: null, vibe: 0, addOns };
  if (!v.value) return null;
  const o: Option = v.value;
  return { id: o.id, title: o.title, region: o.region, vibe: o.vibe, transport, addOns };
}

const pickTitle = (p: SlotPick | null) => {
  const main = isStay(p) ? stayIn.day.title : (optionFor(p)?.title ?? "—");
  const extras = (p?.addOns ?? []).map((id) => addOnsById[id]?.title ?? id);
  const transport = isPick(p) && p.transport ? ` [${p.transport}]` : "";
  return `${main}${transport}${extras.length ? ` + ${extras.join(" + ")}` : ""}`;
};

function budgetSummary(p: Person) {
  if (!p.data?.startDate) return null;
  const b = computeBudget(p.data);
  return {
    totalUsd: b.total,
    verdict: b.verdict.text,
    tier: b.tier?.id ?? null,
    accommodationIncluded: b.accommodation.on,
    accommodationStyle: b.accommodation.style,
    excludedLines: p.data.budget?.excluded ?? [],
  };
}

function summary(p: Person) {
  const d = p.data;
  if (!d) return null;
  const t = buildTimeline(d);
  const split = baseSplit(d.days.length);
  return {
    tripLength: tripLength(d),
    bases: { colomboDays: split.colombo, galleDays: split.galle },
    balance: balanceOf(d),
    budget: budgetSummary(p),
    currency: d.preferences.currency ?? null,
    regionsVisited: t.regionsVisited.map((r) => regions[r].name),
    totalTravelHours: t.totalHours,
    days: t.days.map((day) => ({
      date: day.date,
      base: day.base,
      tags: day.tags,
      daytime: summarize(day.day),
      evening: summarize(day.night),
      note: d.days[day.index].note ?? null,
      travel: [...day.legsBefore, ...day.day.before, ...day.day.after, ...day.night.before, ...day.night.after, ...day.legsAfter].map(
        (s) => ({ title: s.title, hours: s.hours, mode: s.mode }),
      ),
      warnings: day.warnings,
    })),
  };
}

export function exportJson(people: Person[], editsLocked: boolean) {
  return {
    exportedAt: new Date().toISOString(),
    editsLocked,
    notes: "All money is per person in USD (the app's base currency). Budget totals exclude flights.",
    participants: people.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      joinedAt: p.joinedAt,
      updatedAt: p.updatedAt,
      submittedAt: p.submittedAt,
      itinerary: p.data,
      summary: summary(p),
    })),
  };
}

/** One row per person. */
export function exportWideCsv(people: Person[]): string {
  return toCsv(
    people.map((p) => {
      const d = p.data;
      const pr = d?.preferences ?? {};
      const b = d ? balanceOf(d) : null;
      const budget = budgetSummary(p);
      const split = d ? baseSplit(d.days.length) : null;
      const plan = d?.startDate
        ? d.days
            .map((day, i) => {
              const date = addDays(d.startDate!, i);
              const base = baseOfIndex(d.days.length, i);
              return `${date} (${base}): ${pickTitle(day.day)} / ${pickTitle(day.night)}${day.note ? ` (note: ${day.note})` : ""}`;
            })
            .join(" | ")
        : "";
      return {
        name: p.name,
        status: p.status,
        joined_at: p.joinedAt,
        updated_at: p.updatedAt,
        submitted_at: p.submittedAt,
        start_date: d?.startDate,
        end_date: d?.endDate,
        trip_days: d ? tripLength(d) : "",
        colombo_days: split?.colombo ?? "",
        galle_days: split?.galle ?? "",
        flexibility: d?.flexibility,
        picks: p.picks,
        balance_score: b?.score?.toFixed(2),
        nature_picks: b?.nature,
        nightlife_picks: b?.nightlife,
        budget_estimate_low_usd: budget?.totalUsd[0] ?? "",
        budget_estimate_high_usd: budget?.totalUsd[1] ?? "",
        budget_verdict: budget?.verdict ?? "",
        budget_includes_accommodation: budget ? (budget.accommodationIncluded ? "yes" : "no") : "",
        currency: pr.currency,
        plan,
        budget: pr.budget,
        stay: pr.stay,
        shared_rooms: pr.sharedRooms,
        interests: pr.interests,
        early_mornings: pr.earlyMornings,
        transport: pr.transport,
        dietary: pr.dietary,
        dietary_other: pr.dietaryOther,
        flying_from: pr.flyingFrom,
        must_do: pr.mustDo,
        hard_no: pr.hardNo,
        suggestions: pr.suggestions,
        notes: pr.notes,
      };
    }),
  );
}

const LONG_HEADERS = {
  name: "",
  status: "",
  date: "",
  day_number: "",
  base: "",
  slot: "",
  kind: "",
  option_id: "",
  option_title: "",
  pair_id: "",
  transport: "",
  region: "",
  vibe: "",
  est_cost_low_usd: "",
  est_cost_high_usd: "",
  tags: "",
  note: "",
};

/** One row per slot pick, plus one row per add-on (long format). */
export function exportLongCsv(people: Person[]): string {
  const rows: Record<string, unknown>[] = [];
  for (const p of people) {
    const d = p.data;
    if (!d?.startDate) continue;
    d.days.forEach((day, i) => {
      const date = addDays(d.startDate!, i);
      const base = baseOfIndex(d.days.length, i);
      for (const [slot, pick] of [["daytime", day.day], ["evening", day.night]] as const) {
        if (!pick) continue;
        const stay = isStay(pick);
        const o = stay ? null : optionFor(pick);
        rows.push({
          ...LONG_HEADERS,
          name: p.name,
          status: p.status,
          date,
          day_number: i + 1,
          base,
          slot,
          kind: "pick",
          option_id: stay ? STAY_ID : o?.id,
          option_title: stay ? stayIn.day.title : o?.title,
          pair_id: isPick(pick) ? pick.pairId : "",
          transport: isPick(pick) ? (pick.transport ?? "") : "",
          region: o ? regions[o.region].name : "",
          vibe: stay ? 0 : o?.vibe,
          est_cost_low_usd: stay ? 0 : (o?.estCostUsd?.[0] ?? ""),
          est_cost_high_usd: stay ? 0 : (o?.estCostUsd?.[1] ?? ""),
          tags: o?.tags ?? [],
          note: day.note ?? "",
        });
        for (const id of pick.addOns ?? []) {
          const a = addOnsById[id];
          if (!a) continue;
          rows.push({
            ...LONG_HEADERS,
            name: p.name,
            status: p.status,
            date,
            day_number: i + 1,
            base,
            slot,
            kind: "add-on",
            option_id: a.id,
            option_title: a.title,
            region: regions[a.region].name,
            est_cost_low_usd: a.estCostUsd[0],
            est_cost_high_usd: a.estCostUsd[1],
            tags: a.tags,
          });
        }
      }
    });
  }
  return toCsv(rows.length ? rows : [LONG_HEADERS]);
}
