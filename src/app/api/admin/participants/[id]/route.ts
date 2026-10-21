import { db } from "@/lib/server/db";
import { error, json } from "@/lib/server/http";
import { asOrganizer, logAction } from "@/lib/server/organizer";
import { allowed } from "@/lib/server/powers";

export async function DELETE(_req: Request, ctx: RouteContext<"/api/admin/participants/[id]">) {
  return asOrganizer("admin", async (actor) => {
    const { id } = await ctx.params;
    const target = await db().getParticipant(id);
    if (!target) return error("Not found", 404);
    const can = allowed(actor, target, "delete");
    if (!can.ok) return error(can.reason, 403, { code: "forbidden" });
    await db().deleteParticipant(id);
    await logAction(actor, "delete_participant", { id, name: target.display_name });
    return json({ ok: true });
  });
}
