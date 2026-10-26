import { error, json, readJson } from "@/lib/server/http";
import { logAction } from "@/lib/server/organizer";
import { withTrip } from "@/lib/server/route";
import { checkAdminPassword, startConsoleSession } from "@/lib/server/session";

/** The deployment owner's break-glass login with ADMIN_PASSWORD (owner-level on this trip's console). */
export async function POST(req: Request, ctx: RouteContext<"/api/t/[slug]/admin/login">) {
  return withTrip(ctx, async (trip) => {
    const body = await readJson(req);
    const password = typeof body?.password === "string" ? body.password : "";
    if (!password || !checkAdminPassword(password)) {
      await new Promise((r) => setTimeout(r, 600)); // slow down guessing
      return error("Wrong password", 401);
    }
    await startConsoleSession(trip.trip.id, null);
    await logAction(trip.trip.id, { id: null, name: "Organizer (password)" }, "console_open", null, { via: "password" });
    return json({ ok: true });
  });
}
