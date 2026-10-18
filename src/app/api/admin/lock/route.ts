import { db } from "@/lib/server/db";
import { error, json, readJson } from "@/lib/server/http";
import { isAdmin } from "@/lib/server/session";

export async function POST(req: Request) {
  if (!(await isAdmin())) return error("Not allowed", 401);
  const body = await readJson(req);
  if (typeof body?.locked !== "boolean") return error("Expected { locked: boolean }", 400);
  await db().setEditsLocked(body.locked);
  return json({ locked: body.locked });
}
