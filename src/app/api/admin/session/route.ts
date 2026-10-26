import { pinSchema } from "@/lib/validation";
import { isOrganizerRole, roleOf } from "@/lib/server/db";
import { error, json, readJson } from "@/lib/server/http";
import { logAction } from "@/lib/server/organizer";
import { checkPin } from "@/lib/server/pin";
import { currentParticipant, startConsoleSession } from "@/lib/server/session";

/** An organizer re-confirms their PIN to open the console (a ~12 hour console session). */
export async function POST(req: Request) {
  const me = await currentParticipant();
  if (!me) return error("Sign in first", 401, { code: "signin" });
  if (!isOrganizerRole(roleOf(me))) return error("Organizers only", 403, { code: "forbidden" });
  const pin = pinSchema.safeParse((await readJson(req))?.pin);
  if (!pin.success) return error("Enter your 4-digit PIN", 400);
  const wrong = await checkPin(me, pin.data);
  if (wrong) return wrong;
  await startConsoleSession(me.id);
  await logAction({ id: me.id, name: me.display_name }, "console_open");
  return json({ ok: true, role: roleOf(me) });
}
