import bcrypt from "bcryptjs";
import { pinSchema } from "@/lib/schema";
import { db } from "@/lib/server/db";
import { error, json, readJson } from "@/lib/server/http";
import { isAdmin } from "@/lib/server/session";

/** Admin sets a new PIN for someone who forgot theirs (also clears any lockout). */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/participants/[id]/pin">) {
  if (!(await isAdmin())) return error("Not allowed", 401);
  const { id } = await ctx.params;
  const pin = pinSchema.safeParse((await readJson(req))?.pin);
  if (!pin.success) return error("PIN must be 4 digits", 400);
  if (!(await db().getParticipant(id))) return error("Not found", 404);
  await db().updateParticipant(id, {
    pin_hash: await bcrypt.hash(pin.data, 10),
    failed_attempts: 0,
    locked_until: null,
  });
  return json({ ok: true });
}
