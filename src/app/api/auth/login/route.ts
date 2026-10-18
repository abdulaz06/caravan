import bcrypt from "bcryptjs";
import { z } from "zod";
import { pinSchema } from "@/lib/schema";
import { db } from "@/lib/server/db";
import { error, json, readJson } from "@/lib/server/http";
import { startSession } from "@/lib/server/session";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 5;

export async function POST(req: Request) {
  const body = await readJson(req);
  const id = z.string().uuid().safeParse(body?.id);
  const pin = pinSchema.safeParse(body?.pin);
  if (!id.success || !pin.success) return error("Enter your 4-digit PIN", 400);

  const p = await db().getParticipant(id.data);
  if (!p) return error("We couldn't find that name — it may have been removed.", 404);

  const now = Date.now();
  if (p.locked_until && new Date(p.locked_until).getTime() > now) {
    const retryAfter = Math.ceil((new Date(p.locked_until).getTime() - now) / 1000);
    return error("locked", 429, { retryAfter });
  }

  if (!(await bcrypt.compare(pin.data, p.pin_hash))) {
    const attempts = p.failed_attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      await db().updateParticipant(p.id, {
        failed_attempts: 0,
        locked_until: new Date(now + LOCK_MINUTES * 60_000).toISOString(),
      });
      return error("locked", 429, { retryAfter: LOCK_MINUTES * 60 });
    }
    await db().updateParticipant(p.id, { failed_attempts: attempts, locked_until: null });
    return error("wrong_pin", 401, { remaining: MAX_ATTEMPTS - attempts });
  }

  if (p.failed_attempts || p.locked_until) {
    await db().updateParticipant(p.id, { failed_attempts: 0, locked_until: null });
  }
  await startSession(p.id);
  return json({ id: p.id, name: p.display_name });
}
