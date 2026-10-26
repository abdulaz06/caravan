import { db } from "@/lib/server/db";
import { error, json } from "@/lib/server/http";
import { withTrip } from "@/lib/server/route";
import { currentParticipant } from "@/lib/server/session";

/** The person dismissed "<organizer> updated your plan" (or a rules-change note). */
export async function POST(_req: Request, ctx: RouteContext<"/api/t/[slug]/itinerary/ack">) {
  return withTrip(ctx, async (trip) => {
    const p = await currentParticipant(trip.trip);
    if (!p) return error("Not signed in", 401);
    const row = await db().getItinerary(p.id);
    if (row?.stamp && !row.stamp.seen) await db().setStamp(p.id, { ...row.stamp, seen: true });
    return json({ ok: true });
  });
}
