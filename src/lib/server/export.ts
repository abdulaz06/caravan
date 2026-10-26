import "server-only";
import { activitiesById, regions, stayIn } from "@/content";
import { computeBudget } from "@/lib/budget";
import { addDays } from "@/lib/dates";
import { STAY_ID, dayName, dayRole, daysNightsLabel, nights, slotWhere, tripLength, type SlotItem } from "@/lib/itinerary";
import { balanceOf, buildTimeline, type SlotView } from "@/lib/timeline";
import { tripDays } from "@/lib/rules";
import { roommateBoard, type RoommateBoard } from "@/lib/roommates";
import type { Person } from "./group";
import type { LiveSettings } from "./rules";

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

function titleOf(x: SlotItem): string {
  if (x.id === STAY_ID) return stayIn.day.title;
  const a = activitiesById[x.id];
  if (!a) return x.id;
  const v = x.variant ? a.variants?.find((y) => y.id === x.variant) : undefined;
  return v ? `${a.title} (${v.title})` : a.title;
}

function summarizeSlot(v: SlotView) {
  return {
    plannedHours: v.plannedHours,
    items: v.items.map((it) =>
      it.resolved.kind === "stay"
        ? { id: STAY_ID, title: it.resolved.stay.title, kind: "stay", vibe: 0 }
        : {
            id: it.resolved.activity.id,
            title: it.resolved.activity.title,
            kind: it.resolved.activity.kind,
            region: regions[it.resolved.activity.region].name,
            vibe: it.resolved.activity.vibe,
            pairId: it.item.pairId ?? null,
          },
    ),
  };
}

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
  const len = tripLength(d);
  return {
    tripLength: len ? daysNightsLabel(len) : null,
    days: len,
    nights: nights(len),
    balance: balanceOf(d),
    budget: budgetSummary(p),
    currency: d.preferences.currency ?? null,
    regionsVisited: t.regionsVisited.map((r) => regions[r].name),
    totalTravelHours: t.totalHours,
    itinerary: t.days.map((day) => ({
      date: day.date,
      day: day.index + 1,
      name: day.name,
      tags: day.tags,
      daytime: summarizeSlot(day.day),
      evening: summarizeSlot(day.night),
      note: d.days[day.index].note ?? null,
      travel: [
        ...day.legsBefore,
        ...[...day.day.items, ...day.night.items].map((x) => x.before).filter((x) => !!x),
        ...[day.day.after, day.night.after].filter((x) => !!x),
      ].map((s) => ({ title: s!.title, hours: s!.hours })),
      warnings: day.warnings,
    })),
  };
}

const boardOf = (people: Person[]) => roommateBoard(people.map((p) => ({ id: p.id, name: p.name, picks: p.data?.preferences.roommates })));

/** "A (their 1st), B (their 2nd)" — the people this person matched with both ways. */
function mutualFor(board: RoommateBoard, id: string): string[] {
  return board.mutual.flatMap((m) => (m.a.id === id ? [m.b.name] : m.b.id === id ? [m.a.name] : []));
}

export function exportJson(people: Person[], live: LiveSettings) {
  const board = boardOf(people);
  const len = tripDays();
  const n = nights(len);
  return {
    exportedAt: new Date().toISOString(),
    editsLocked: live.locked,
    rules: live.rules,
    notes: `Trip is ${daysNightsLabel(len)} (${n.colombo} ${n.colombo === 1 ? "night" : "nights"} Colombo, ${n.galle} nights Galle). All money is per person in USD (the app's base currency). Budget totals exclude flights. Roommate picks are just for fun, not binding.`,
    roommates: board,
    participants: people.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
      editStamp: p.stamp,
      status: p.status,
      joinedAt: p.joinedAt,
      updatedAt: p.updatedAt,
      submittedAt: p.submittedAt,
      itinerary: p.data,
      roommates: (p.data?.preferences.roommates ?? []).map((r, i) => ({ rank: i + 1, name: r.name, participantId: r.id ?? null })),
      mutualRoommates: mutualFor(board, p.id),
      summary: summary(p),
    })),
  };
}

/** One row per person. */
export function exportWideCsv(people: Person[]): string {
  const board = boardOf(people);
  return toCsv(
    people.map((p) => {
      const d = p.data;
      const pr = d?.preferences ?? {};
      const b = d ? balanceOf(d) : null;
      const budget = budgetSummary(p);
      const len = d ? tripLength(d) : 0;
      const plan = d?.startDate
        ? d.days
            .map((day, i) => {
              const date = addDays(d.startDate!, i);
              const role = dayRole(i, d.days.length);
              const slot = (xs: SlotItem[]) => (xs.length ? xs.map(titleOf).join(" + ") : "—");
              return role === "departure"
                ? `${date} (Day ${i + 1} · ${dayName(i, role)})`
                : `${date} (Day ${i + 1} · ${dayName(i, role)}): ${slot(day.day)} / ${slot(day.night)}${day.note ? ` (note: ${day.note})` : ""}`;
            })
            .join(" | ")
        : "";
      return {
        name: p.name,
        role: p.role,
        status: p.status,
        edited_by: p.stamp?.kind === "edit" ? p.stamp.by : "",
        edited_at: p.stamp?.kind === "edit" ? p.stamp.at : "",
        joined_at: p.joinedAt,
        updated_at: p.updatedAt,
        submitted_at: p.submittedAt,
        start_date: d?.startDate,
        end_date: d?.endDate,
        trip_days: len || "",
        trip_nights: len ? len - 1 : "",
        colombo_nights: len ? nights(len).colombo : "",
        galle_nights: len ? nights(len).galle : "",
        flexibility: d?.flexibility,
        items: p.picks,
        balance_score: b?.score?.toFixed(2),
        nature_items: b?.nature,
        nightlife_items: b?.nightlife,
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
        roommate_1: pr.roommates?.[0]?.name ?? "",
        roommate_2: pr.roommates?.[1]?.name ?? "",
        roommate_3: pr.roommates?.[2]?.name ?? "",
        mutual_roommates: mutualFor(board, p.id),
      };
    }),
  );
}

const LONG_HEADERS = {
  name: "",
  status: "",
  date: "",
  day_number: "",
  day_name: "",
  where: "",
  slot: "",
  position: "",
  kind: "",
  item_id: "",
  item_title: "",
  variant: "",
  pair_id: "",
  region: "",
  vibe: "",
  categories: "",
  available_days: "",
  est_cost_low_usd: "",
  est_cost_high_usd: "",
  tags: "",
  note: "",
};

/** One row per item in every slot (long format). */
export function exportLongCsv(people: Person[]): string {
  const rows: Record<string, unknown>[] = [];
  for (const p of people) {
    const d = p.data;
    if (!d?.startDate) continue;
    d.days.forEach((day, i) => {
      const date = addDays(d.startDate!, i);
      const role = dayRole(i, d.days.length);
      for (const [slot, key] of [["daytime", "day"], ["evening", "night"]] as const) {
        day[key].forEach((x, pos) => {
          const stay = x.id === STAY_ID;
          const a = stay ? null : activitiesById[x.id];
          if (!stay && !a) return;
          rows.push({
            ...LONG_HEADERS,
            name: p.name,
            status: p.status,
            date,
            day_number: i + 1,
            day_name: dayName(i, role),
            where: slotWhere(role, key) ?? "",
            slot,
            position: pos + 1,
            kind: stay ? "stay" : a!.kind,
            item_id: x.id,
            item_title: stay ? stayIn.day.title : a!.title,
            variant: x.variant ? (a?.variants?.find((v) => v.id === x.variant)?.title ?? x.variant) : "",
            pair_id: x.pairId ?? "",
            region: a ? regions[a.region].name : "",
            vibe: stay ? 0 : a!.vibe,
            categories: stay ? ["chill"] : a!.categories,
            available_days: a?.availableDays ?? [],
            est_cost_low_usd: stay ? 0 : a!.estCostUsd[0],
            est_cost_high_usd: stay ? 0 : a!.estCostUsd[1],
            tags: a?.tags ?? [],
            note: day.note ?? "",
          });
        });
      }
    });
  }
  return toCsv(rows.length ? rows : [LONG_HEADERS]);
}
