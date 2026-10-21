import "server-only";
import bcrypt from "bcryptjs";
import { db, type ParticipantRow } from "./db";
import { error } from "./http";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 5;

/**
 * Check someone's PIN with brute-force protection: 5 wrong tries lock the
 * name for 5 minutes. Returns null when the PIN is right, or the error to send.
 */
export async function checkPin(p: ParticipantRow, pin: string): Promise<Response | null> {
  const now = Date.now();
  if (p.locked_until && new Date(p.locked_until).getTime() > now) {
    const retryAfter = Math.ceil((new Date(p.locked_until).getTime() - now) / 1000);
    return error("locked", 429, { retryAfter });
  }
  if (!(await bcrypt.compare(pin, p.pin_hash))) {
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
  return null;
}
