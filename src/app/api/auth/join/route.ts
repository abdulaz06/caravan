import bcrypt from "bcryptjs";
import { nameSchema, pinSchema } from "@/lib/validation";
import { db } from "@/lib/server/db";
import { error, json, readJson } from "@/lib/server/http";
import { startSession } from "@/lib/server/session";

export async function POST(req: Request) {
  const body = await readJson(req);
  const name = nameSchema.safeParse(body?.name);
  if (!name.success) return error(name.error.issues[0].message, 400, { field: "name" });
  const pin = pinSchema.safeParse(body?.pin);
  if (!pin.success) return error(pin.error.issues[0].message, 400, { field: "pin" });

  const displayName = name.data.replace(/\s+/g, " ");
  if (await db().findParticipantByName(displayName)) {
    return error("taken", 409, { field: "name" });
  }
  const row = await db().createParticipant(displayName, await bcrypt.hash(pin.data, 10));
  if (!row) return error("taken", 409, { field: "name" });

  await startSession(row.id);
  return json({ id: row.id, name: row.display_name });
}
