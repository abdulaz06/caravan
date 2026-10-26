import { error, json } from "@/lib/server/http";
import { getPopular } from "@/lib/server/popular";
import { withTrip } from "@/lib/server/route";
import { currentParticipant } from "@/lib/server/session";

/** 🔥 Pick counts of the popular options (counts only — never who). Cached for a few minutes on the server. */
export async function GET(_req: Request, ctx: RouteContext<"/api/t/[slug]/popular">) {
  return withTrip(ctx, async (trip) => {
    if (!(await currentParticipant(trip.trip))) return error("Sign in first", 401);
    return json(await getPopular(trip));
  });
}
