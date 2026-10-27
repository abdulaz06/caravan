import { error, json } from "@/lib/server/http";
import { resetDemoTrip } from "@/lib/server/demo";

/**
 * Vercel Cron (vercel.json) calls this nightly to rebuild the demo trip from
 * scratch — fictional travellers back to their plans, every guest gone.
 * Vercel sends `Authorization: Bearer <CRON_SECRET>`; without the secret set,
 * nothing can trigger it.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return error("Unauthorized", 401);
  const result = await resetDemoTrip();
  return json({ ok: true, ...result, at: new Date().toISOString() });
}
