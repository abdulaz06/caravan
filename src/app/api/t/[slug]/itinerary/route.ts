import { db } from "@/lib/server/db";
import { error, json, readJson } from "@/lib/server/http";
import { withTrip } from "@/lib/server/route";
import { savePlan } from "@/lib/server/save-plan";
import { currentParticipant } from "@/lib/server/session";

export async function GET(_req: Request, ctx: RouteContext<"/api/t/[slug]/itinerary">) {
  return withTrip(ctx, async (trip) => {
    const p = await currentParticipant(trip.trip);
    if (!p) return error("Not signed in", 401);
    return json((await db().getItinerary(p.id)) ?? null);
  });
}

/** Autosave (debounced from the client) and submit. */
export async function PUT(req: Request, ctx: RouteContext<"/api/t/[slug]/itinerary">) {
  return withTrip(ctx, async (trip) => {
    const p = await currentParticipant(trip.trip);
    if (!p) return error("Not signed in", 401);
    return savePlan(trip, p, await readJson(req));
  });
}
