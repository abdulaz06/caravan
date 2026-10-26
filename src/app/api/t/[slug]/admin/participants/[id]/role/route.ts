import { z } from "zod";
import { db, roleOf } from "@/lib/server/db";
import { error, json, readJson } from "@/lib/server/http";
import { asOrganizer, logAction } from "@/lib/server/organizer";
import { allowed } from "@/lib/server/powers";
import { withTrip } from "@/lib/server/route";

/** Owner only: make someone an admin, or back to a member. The owner's role never changes. */
export async function PUT(req: Request, ctx: RouteContext<"/api/t/[slug]/admin/participants/[id]/role">) {
  return withTrip(ctx, (trip) =>
    asOrganizer(trip, "owner", async (actor) => {
      const { id } = await ctx.params;
      const role = z.enum(["admin", "member"]).safeParse((await readJson(req))?.role);
      if (!role.success) return error("Expected a role of admin or member", 400);
      const target = await db().getParticipant(id);
      if (!target || target.trip_id !== trip.trip.id) return error("Not found", 404);
      const can = allowed(actor, target, "set_role");
      if (!can.ok) return error(can.reason, 403, { code: "forbidden" });
      if (roleOf(target) !== role.data) {
        await db().updateParticipant(id, { role: role.data });
        await logAction(trip.trip.id, actor, role.data === "admin" ? "make_admin" : "remove_admin", { id, name: target.display_name });
      }
      return json({ ok: true, role: role.data });
    }),
  );
}
