import { compareModes, type ConsensusPlan, type PlanSettings } from "@/engine/consensus";
import { parsePlanSettings } from "@/engine/consensus/settings";
import { db } from "@/lib/server/db";
import { error, json, readJson } from "@/lib/server/http";
import { asOrganizer, logAction } from "@/lib/server/organizer";
import { ballotsOf, generateFor, organizerPlanState as state } from "@/lib/server/plan";
import { withTrip } from "@/lib/server/route";

export async function GET(_req: Request, ctx: RouteContext<"/api/t/[slug]/admin/plan">) {
  return withTrip(ctx, (trip) => asOrganizer(trip, "admin", async () => json(await state(trip)), { readOnly: true }));
}

/**
 * The organizer's plan actions:
 * - generate: a plan from the knobs (a preview: nothing is saved but the knobs themselves)
 * - compare: every decision mode on the same inputs
 * - save: generate on the server and store it as the next version (optionally publishing it)
 * - publish: make a saved version the plan travellers see
 * The demo's console can generate and compare (nothing is stored); saving and publishing are refused there.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/t/[slug]/admin/plan">) {
  return withTrip(ctx, async (trip) => {
    const body = await readJson(req);
    const action = body?.action;
    const settings: PlanSettings = parsePlanSettings(body?.settings ?? trip.rules.plan);
    const preview = action === "generate" || action === "compare";
    if (!preview && action !== "save" && action !== "publish") return error("Unknown action", 400);

    return asOrganizer(
      trip,
      "admin",
      async (actor) => {
        if (action === "publish") {
          const id = typeof body?.versionId === "string" ? body.versionId : "";
          const row = await db().publishPlanVersion(trip.trip.id, id, new Date().toISOString());
          if (!row) return error("That version isn't here any more", 404);
          await logAction(trip.trip.id, actor, "publish_plan", null, { version: row.version });
          return json({ published: row.version, state: await state(trip) });
        }

        if (!settings.mode) return error("Choose how the group decides first", 400, { code: "mode" });
        const ballots = await ballotsOf(trip);
        if (action === "compare") return json({ modes: compareModes(trip.engine, ballots, settings) });

        const plan: ConsensusPlan = generateFor(trip, ballots, settings);
        // Remember the knobs (not on the demo, where they stay in the visitor's browser).
        if (trip.trip.kind !== "demo" && JSON.stringify(trip.rules.plan) !== JSON.stringify(settings)) {
          await db().updateTrip(trip.trip.id, { rules: { ...trip.rules, plan: settings } });
        }
        if (action === "generate") return json({ plan });

        const now = new Date().toISOString();
        const row = await db().savePlanVersion({
          trip_id: trip.trip.id,
          data: plan,
          settings,
          created_by: actor.id,
          created_by_name: actor.name,
          published_at: body?.publish === true ? now : null,
        });
        await logAction(trip.trip.id, actor, body?.publish === true ? "publish_plan" : "save_plan", null, { version: row.version, mode: settings.mode });
        return json({ saved: row.version, plan, state: await state(trip) });
      },
      { readOnly: preview },
    );
  });
}
