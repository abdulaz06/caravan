import { db } from "@/lib/server/db";
import { json } from "@/lib/server/http";
import { withTrip } from "@/lib/server/route";

/** Names of everyone who has joined this trip — powers the "I've been here before" list. */
export async function GET(_req: Request, ctx: RouteContext<"/api/t/[slug]/people">) {
  return withTrip(ctx, async (trip) => {
    const people = await db().listParticipants(trip.trip.id);
    return json(people.filter((p) => !p.guest).map((p) => ({ id: p.id, name: p.display_name })));
  });
}
