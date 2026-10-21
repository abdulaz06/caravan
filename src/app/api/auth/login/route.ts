import { z } from "zod";
import { pinSchema } from "@/lib/schema";
import { db } from "@/lib/server/db";
import { error, json, readJson } from "@/lib/server/http";
import { checkPin } from "@/lib/server/pin";
import { startSession } from "@/lib/server/session";

export async function POST(req: Request) {
  const body = await readJson(req);
  const id = z.string().uuid().safeParse(body?.id);
  const pin = pinSchema.safeParse(body?.pin);
  if (!id.success || !pin.success) return error("Enter your 4-digit PIN", 400);

  const p = await db().getParticipant(id.data);
  if (!p) return error("We couldn't find that name — it may have been removed.", 404);

  const wrong = await checkPin(p, pin.data);
  if (wrong) return wrong;
  await startSession(p.id);
  return json({ id: p.id, name: p.display_name });
}
