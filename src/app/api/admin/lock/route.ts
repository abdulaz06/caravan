import { db } from "@/lib/server/db";
import { error, json, readJson } from "@/lib/server/http";
import { asOrganizer, logAction } from "@/lib/server/organizer";

export async function POST(req: Request) {
  return asOrganizer("admin", async (actor) => {
    const body = await readJson(req);
    if (typeof body?.locked !== "boolean") return error("Expected { locked: boolean }", 400);
    await db().setEditsLocked(body.locked);
    await logAction(actor, body.locked ? "lock_edits" : "unlock_edits");
    return json({ locked: body.locked });
  });
}
