import { activitiesById } from "@/content";
import { daysNightsLabel, nightsLine, restructure } from "@/lib/itinerary";
import { applyRules, mergeRules, rulesPatchSchema, rulesProblems, tripDays, type TripRules } from "@/lib/rules";
import { db } from "@/lib/server/db";
import { error, json, readJson } from "@/lib/server/http";
import { asOrganizer, logAction } from "@/lib/server/organizer";
import { loadRules } from "@/lib/server/rules";

/** Rule changes that can invalidate saved plans (and so need a preview + confirmation). */
const STRUCTURAL: (keyof TripRules)[] = ["colomboNights", "galleNights", "window", "requireFullTrip"];

export type Impact = { plans: number; needRepicks: number; lostPicks: number; people: { name: string; lost: number }[] };

/**
 * Change the live Trip rules. A change that would move saved plans returns
 * 409 with an impact preview unless `confirm` is true; `dryRun` only previews.
 * Confirmed changes migrate every affected plan and tell its owner once.
 */
export async function POST(req: Request) {
  return asOrganizer("admin", async (actor) => {
    const body = await readJson(req);
    const parsed = rulesPatchSchema.safeParse(body?.patch);
    if (!parsed.success) return error(parsed.error.issues[0]?.message ?? "Those rules didn't look right", 400);
    const patch = parsed.data;
    for (const k of ["hidden", "recheck", "featured"] as const) {
      if (patch[k]) patch[k] = [...new Set(patch[k]!.filter((id) => activitiesById[id]?.kind === "option" || activitiesById[id]?.kind === "extra"))];
    }

    const live = await loadRules();
    const before = live.rules;
    const next = mergeRules(before, patch);
    const problems = rulesProblems(next);
    if (problems.length) return error(problems[0], 400);

    const structural = STRUCTURAL.some((k) => JSON.stringify(before[k]) !== JSON.stringify(next[k]));
    const [participants, rows] = structural ? await Promise.all([db().listParticipants(), db().listItineraries()]) : [[], []];
    const names = new Map(participants.map((p) => [p.id, p.display_name]));
    const moved = rows
      .map((row) => ({ row, ...restructure(row.data, before, next) }))
      .filter((m) => m.changed);
    applyRules(before);
    const impact: Impact = {
      plans: moved.length,
      needRepicks: moved.filter((m) => m.lost > 0).length,
      lostPicks: moved.reduce((n, m) => n + m.lost, 0),
      people: moved.map((m) => ({ name: names.get(m.row.participant_id) ?? "?", lost: m.lost })),
    };
    if (body?.dryRun === true) return json({ impact, rules: next });
    if (moved.length && body?.confirm !== true) return error("confirm", 409, { code: "confirm", impact });

    await db().setRules(next);
    applyRules(next);
    const now = new Date().toISOString();
    const summary = `${daysNightsLabel(tripDays())} · ${nightsLine(tripDays())}`;
    for (const m of moved) {
      await db().saveItinerary({
        participant_id: m.row.participant_id,
        data: m.data,
        status: m.row.status,
        submitted_at: m.row.submitted_at,
        updated_at: now,
        stamp: { kind: "rules", by: actor.name, byId: actor.id, at: now, seen: false, lost: m.lost, text: summary },
      });
    }
    const changes = Object.fromEntries(Object.keys(patch).map((k) => [k, next[k as keyof TripRules]]));
    await logAction(actor, "update_rules", null, { changes, ...(structural ? { migrated: impact.plans, lostPicks: impact.lostPicks } : {}) });
    return json({ rules: next, impact });
  });
}
