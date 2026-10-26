import { normalize } from "@/engine/itinerary";
import { db } from "@/lib/server/db";
import { error, json, readJson } from "@/lib/server/http";
import { asOrganizer } from "@/lib/server/organizer";
import { loadTrip } from "@/lib/server/trip";
import { savePlan } from "@/lib/server/save-plan";

/** An organizer reads anyone's full plan, private answers included. */
export async function GET(_req: Request, ctx: RouteContext<"/api/admin/participants/[id]/itinerary">) {
  return asOrganizer("admin", async () => {
    const { id } = await ctx.params;
    const { engine } = await loadTrip();
    const [p, row] = await Promise.all([db().getParticipant(id), db().getItinerary(id)]);
    if (!p) return error("Not found", 404);
    return json({ id: p.id, name: p.display_name, row: row ? { ...row, data: normalize(engine, row.data) } : null });
  });
}

/** An organizer edits a plan on someone's behalf (works while edits are locked; stamped "Edited by"). */
export async function PUT(req: Request, ctx: RouteContext<"/api/admin/participants/[id]/itinerary">) {
  return asOrganizer("admin", async (actor) => {
    const { id } = await ctx.params;
    const p = await db().getParticipant(id);
    if (!p) return error("Not found", 404);
    return savePlan(p, await readJson(req), actor);
  });
}
