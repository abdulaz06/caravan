import { json } from "@/lib/server/http";
import { withTrip } from "@/lib/server/route";
import { endSession } from "@/lib/server/session";

export async function POST(_req: Request, ctx: RouteContext<"/api/t/[slug]/auth/logout">) {
  return withTrip(ctx, async (trip) => {
    await endSession(trip.trip.id);
    return json({ ok: true });
  });
}
