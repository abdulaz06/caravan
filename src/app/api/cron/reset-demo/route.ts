import { error, json } from "@/lib/server/http";
import { resetDemoTrips } from "@/lib/server/demo";

/**
 * Vercel Cron (vercel.json) calls this nightly to rebuild every demo trip from
 * scratch — fictional travellers back to their plans, every guest gone.
 * Vercel sends `Authorization: Bearer <CRON_SECRET>`; without the secret set,
 * nothing can trigger it.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return error("Unauthorized", 401);
  const demos = await resetDemoTrips();
  return json({ ok: true, demos, at: new Date().toISOString() });
}
