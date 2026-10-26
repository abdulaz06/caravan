import { isOrganizerRole, roleOf } from "@/lib/server/db";
import { error, json, readJson } from "@/lib/server/http";
import { logAction } from "@/lib/server/organizer";
import { checkPin } from "@/lib/server/pin";
import { withTrip } from "@/lib/server/route";
import { currentParticipant, startConsoleSession } from "@/lib/server/session";
import { pinSchema } from "@/lib/validation";

/** An organizer re-confirms their PIN to open this trip's console (a ~12 hour console session). */
export async function POST(req: Request, ctx: RouteContext<"/api/t/[slug]/admin/session">) {
  return withTrip(ctx, async (trip) => {
    const me = await currentParticipant(trip.trip);
    if (!me) return error("Sign in first", 401, { code: "signin" });
    if (!isOrganizerRole(roleOf(me))) return error("Organizers only", 403, { code: "forbidden" });
    const pin = pinSchema.safeParse((await readJson(req))?.pin);
    if (!pin.success) return error("Enter your 4-digit PIN", 400);
    const wrong = await checkPin(me, pin.data);
    if (wrong) return wrong;
    await startConsoleSession(trip.trip.id, me.id);
    await logAction(trip.trip.id, { id: me.id, name: me.display_name }, "console_open");
    return json({ ok: true, role: roleOf(me) });
  });
}
