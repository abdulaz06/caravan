import { z } from "zod";
import { db } from "@/lib/server/db";
import { error, json, readJson } from "@/lib/server/http";
import { checkPin } from "@/lib/server/pin";
import { withTrip } from "@/lib/server/route";
import { startSession } from "@/lib/server/session";
import { pinSchema } from "@/lib/validation";

export async function POST(req: Request, ctx: RouteContext<"/api/t/[slug]/auth/login">) {
  return withTrip(ctx, async (trip) => {
    const body = await readJson(req);
    const id = z.string().uuid().safeParse(body?.id);
    const pin = pinSchema.safeParse(body?.pin);
    if (!id.success || !pin.success) return error("Enter your 4-digit PIN", 400);

    const p = await db().getParticipant(id.data);
    if (!p || p.trip_id !== trip.trip.id) return error("We couldn't find that name — it may have been removed.", 404);

    const wrong = await checkPin(p, pin.data);
    if (wrong) return wrong;
    await startSession(trip.trip.id, p.id);
    return json({ id: p.id, name: p.display_name });
  });
}
