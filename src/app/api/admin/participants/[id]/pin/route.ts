import bcrypt from "bcryptjs";
import { pinSchema } from "@/lib/schema";
import { db } from "@/lib/server/db";
import { error, json, readJson } from "@/lib/server/http";
import { asOrganizer, logAction } from "@/lib/server/organizer";
import { allowed } from "@/lib/server/powers";

/** An organizer sets a new PIN for someone who forgot theirs (also clears any lockout). */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/participants/[id]/pin">) {
  return asOrganizer("admin", async (actor) => {
    const { id } = await ctx.params;
    const pin = pinSchema.safeParse((await readJson(req))?.pin);
    if (!pin.success) return error("PIN must be 4 digits", 400);
    const target = await db().getParticipant(id);
    if (!target) return error("Not found", 404);
    const can = allowed(actor, target, "reset_pin");
    if (!can.ok) return error(can.reason, 403, { code: "forbidden" });
    await db().updateParticipant(id, {
      pin_hash: await bcrypt.hash(pin.data, 10),
      failed_attempts: 0,
      locked_until: null,
    });
    await logAction(actor, "reset_pin", { id, name: target.display_name });
    return json({ ok: true });
  });
}
