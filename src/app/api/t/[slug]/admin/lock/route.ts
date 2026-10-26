import { db } from "@/lib/server/db";
import { error, json, readJson } from "@/lib/server/http";
import { asOrganizer, logAction } from "@/lib/server/organizer";
import { withTrip } from "@/lib/server/route";

export async function POST(req: Request, ctx: RouteContext<"/api/t/[slug]/admin/lock">) {
  return withTrip(ctx, (trip) =>
    asOrganizer(trip, "admin", async (actor) => {
      const body = await readJson(req);
      if (typeof body?.locked !== "boolean") return error("Expected { locked: boolean }", 400);
      await db().updateTrip(trip.trip.id, { edits_locked: body.locked });
      await logAction(trip.trip.id, actor, body.locked ? "lock_edits" : "unlock_edits");
      return json({ locked: body.locked });
    }),
  );
}
