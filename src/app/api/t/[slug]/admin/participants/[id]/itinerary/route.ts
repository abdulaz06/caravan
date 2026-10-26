import { normalize } from "@/engine/itinerary";
import { db } from "@/lib/server/db";
import { error, json, readJson } from "@/lib/server/http";
import { asOrganizer } from "@/lib/server/organizer";
import { withTrip } from "@/lib/server/route";
import { savePlan } from "@/lib/server/save-plan";

/** An organizer reads anyone's full plan, private answers included. */
export async function GET(_req: Request, ctx: RouteContext<"/api/t/[slug]/admin/participants/[id]/itinerary">) {
  return withTrip(ctx, (trip) =>
    asOrganizer(trip, "admin", async () => {
      const { id } = await ctx.params;
      const [p, row] = await Promise.all([db().getParticipant(id), db().getItinerary(id)]);
      if (!p || p.trip_id !== trip.trip.id) return error("Not found", 404);
      return json({ id: p.id, name: p.display_name, row: row ? { ...row, data: normalize(trip.engine, row.data) } : null });
    }),
  );
}

/** An organizer edits a plan on someone's behalf (works while edits are locked; stamped "Edited by"). */
export async function PUT(req: Request, ctx: RouteContext<"/api/t/[slug]/admin/participants/[id]/itinerary">) {
  return withTrip(ctx, (trip) =>
    asOrganizer(trip, "admin", async (actor) => {
      const { id } = await ctx.params;
      const p = await db().getParticipant(id);
      if (!p || p.trip_id !== trip.trip.id) return error("Not found", 404);
      return savePlan(trip, p, await readJson(req), actor);
    }),
  );
}
