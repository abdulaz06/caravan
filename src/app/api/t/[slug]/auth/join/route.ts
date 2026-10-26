import bcrypt from "bcryptjs";
import { db } from "@/lib/server/db";
import { error, json, readJson } from "@/lib/server/http";
import { withTrip } from "@/lib/server/route";
import { startSession } from "@/lib/server/session";
import { nameSchema, pinSchema } from "@/lib/validation";

export async function POST(req: Request, ctx: RouteContext<"/api/t/[slug]/auth/join">) {
  return withTrip(ctx, async (trip) => {
    const body = await readJson(req);
    const name = nameSchema.safeParse(body?.name);
    if (!name.success) return error(name.error.issues[0].message, 400, { field: "name" });
    const pin = pinSchema.safeParse(body?.pin);
    if (!pin.success) return error(pin.error.issues[0].message, 400, { field: "pin" });

    const displayName = name.data.replace(/\s+/g, " ");
    if (await db().findParticipantByName(trip.trip.id, displayName)) return error("taken", 409, { field: "name" });
    const row = await db().createParticipant(trip.trip.id, { name: displayName, pinHash: await bcrypt.hash(pin.data, 10) });
    if (!row) return error("taken", 409, { field: "name" });

    await startSession(trip.trip.id, row.id);
    return json({ id: row.id, name: row.display_name });
  });
}
