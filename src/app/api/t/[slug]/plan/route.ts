import { error, json } from "@/lib/server/http";
import { loadPublicPlan } from "@/lib/server/plan";
import { withTrip } from "@/lib/server/route";
import { currentParticipant } from "@/lib/server/session";

/** The published plan for the signed-in traveller (live headcounts: the page polls this). */
export async function GET(_req: Request, ctx: RouteContext<"/api/t/[slug]/plan">) {
  return withTrip(ctx, async (trip) => {
    const me = await currentParticipant(trip.trip);
    if (!me) return error("Not signed in", 401);
    return json({ plan: await loadPublicPlan(trip, me) });
  });
}
