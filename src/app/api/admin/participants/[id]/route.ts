import { db } from "@/lib/server/db";
import { error, json } from "@/lib/server/http";
import { isAdmin } from "@/lib/server/session";

export async function DELETE(_req: Request, ctx: RouteContext<"/api/admin/participants/[id]">) {
  if (!(await isAdmin())) return error("Not allowed", 401);
  const { id } = await ctx.params;
  await db().deleteParticipant(id);
  return json({ ok: true });
}
