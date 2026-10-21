import { error, json, readJson } from "@/lib/server/http";
import { logAction } from "@/lib/server/organizer";
import { checkAdminPassword, startConsoleSession } from "@/lib/server/session";

/** The owner's break-glass login with ADMIN_PASSWORD (owner-level console session). */
export async function POST(req: Request) {
  const body = await readJson(req);
  const password = typeof body?.password === "string" ? body.password : "";
  if (!password || !checkAdminPassword(password)) {
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return error("Wrong password", 401);
  }
  await startConsoleSession(null);
  await logAction({ id: null, name: "Organizer (password)" }, "console_open", null, { via: "password" });
  return json({ ok: true });
}
