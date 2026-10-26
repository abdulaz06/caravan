import "server-only";
import { error } from "./http";
import { loadTrip, type TripContext } from "./trip";

/**
 * Run a trip API route: resolves /api/t/<slug>/… to its trip (404 if it
 * doesn't exist) and hands it to the handler.
 */
export async function withTrip(ctx: { params: Promise<{ slug: string }> }, fn: (trip: TripContext) => Promise<Response>): Promise<Response> {
  const trip = await loadTrip((await ctx.params).slug);
  if (!trip) return error("Trip not found", 404);
  return fn(trip);
}
