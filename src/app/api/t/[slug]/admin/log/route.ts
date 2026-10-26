import { db } from "@/lib/server/db";
import { json } from "@/lib/server/http";
import { asOrganizer } from "@/lib/server/organizer";
import { withTrip } from "@/lib/server/route";

export async function GET(_req: Request, ctx: RouteContext<"/api/t/[slug]/admin/log">) {
  return withTrip(ctx, (trip) => asOrganizer(trip, "admin", async () => json(await db().listLog(trip.trip.id, 300))));
}
