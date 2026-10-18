import "server-only";
import { chillNight, regions } from "@/content";
import { addDays } from "@/lib/dates";
import { isChill, optionFor, tripLength } from "@/lib/itinerary";
import { balanceOf, buildTimeline } from "@/lib/timeline";
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

function summary(p: Person) {
  const d = p.data;
  if (!d) return null;
  const t = buildTimeline(d);
  return {
    tripLength: tripLength(d),
    balance: balanceOf(d),
    regionsVisited: t.regionsVisited.map((r) => regions[r].name),
    totalDriveHours: t.totalHours,
    days: t.days.map((day) => ({
      date: day.date,
      tags: day.tags,
      daytime: day.day ? { id: day.day.id, title: day.day.title, region: day.day.region, vibe: day.day.vibe } : null,
      evening:
        day.night === "chill"
          ? { id: "chill", title: chillNight.title, region: null, vibe: 0 }
          : day.night
            ? { id: day.night.id, title: day.night.title, region: day.night.region, vibe: day.night.vibe }
            : null,
      note: p.data!.days[day.index].note ?? null,
      roadTrips: [day.beforeDay, day.beforeNight].filter(Boolean),
      warnings: day.warnings,
    })),
  };
}

export function exportJson(people: Person[], editsLocked: boolean) {
  return {
    exportedAt: new Date().toISOString(),
    editsLocked,
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
      const plan = d?.startDate
        ? d.days
            .map((day, i) => {
              const date = addDays(d.startDate!, i);
              const dayT = optionFor(day.day)?.title ?? "—";
              const nightT = isChill(day.night) ? chillNight.title : (optionFor(day.night)?.title ?? "—");
              return `${date}: ${dayT} / ${nightT}${day.note ? ` (note: ${day.note})` : ""}`;
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
        flexibility: d?.flexibility,
        picks: p.picks,
        balance_score: b?.score?.toFixed(2),
        nature_picks: b?.nature,
        nightlife_picks: b?.nightlife,
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

/** One row per slot pick (long format). */
export function exportLongCsv(people: Person[]): string {
  const rows: Record<string, unknown>[] = [];
  for (const p of people) {
    const d = p.data;
    if (!d?.startDate) continue;
    d.days.forEach((day, i) => {
      const date = addDays(d.startDate!, i);
      const slots = [
        { slot: "daytime", pick: day.day, chill: false },
        { slot: "evening", pick: day.night, chill: isChill(day.night) },
      ];
      for (const s of slots) {
        if (!s.pick) continue;
        const o = s.chill ? null : optionFor(s.pick);
        rows.push({
          name: p.name,
          status: p.status,
          date,
          day_number: i + 1,
          slot: s.slot,
          option_id: s.chill ? "chill" : o?.id,
          option_title: s.chill ? chillNight.title : o?.title,
          pair_id: s.chill ? "" : "pairId" in s.pick ? s.pick.pairId : "",
          region: o ? regions[o.region].name : "",
          vibe: s.chill ? 0 : o?.vibe,
          tags: o?.tags ?? [],
          note: day.note ?? "",
        });
      }
    });
  }
  return toCsv(
    rows.length
      ? rows
      : [{ name: "", status: "", date: "", day_number: "", slot: "", option_id: "", option_title: "", pair_id: "", region: "", vibe: "", tags: "", note: "" }],
  );
}
