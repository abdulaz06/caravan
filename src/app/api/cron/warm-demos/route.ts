import { error, json } from "@/lib/server/http";
import { DEMO_SEED, warmDemoTrips } from "@/lib/server/demo";

/**
 * Rebuilds any demo trip that is missing or from an older seed — called by the
 * "Warm the demos" GitHub Action (.github/workflows/warm-demos.yml) once Vercel
 * reports the production deployment live, so visitors never meet a stale demo.
 * Each rebuild is swapped in under the same slug, so nobody waits meanwhile.
 * Protected like the nightly reset: `Authorization: Bearer <CRON_SECRET>`.
 *
 * `X-Expect-Commit: <sha>`: only warm when this deployment is that commit (the
 * alias may still point at the previous one for a moment); otherwise answer
 * `{ live: false }` so the caller tries again shortly.
 */
async function warm(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return error("Unauthorized", 401);
  const expect = req.headers.get("x-expect-commit");
  const commit = process.env.VERCEL_GIT_COMMIT_SHA ?? null;
  if (expect && commit && commit !== expect) return json({ live: false, commit, seed: DEMO_SEED });
  const demos = await warmDemoTrips();
  return json({ live: true, commit, seed: DEMO_SEED, demos, at: new Date().toISOString() });
}

export const POST = warm;
export const GET = warm;
// A cold rebuild of every demo takes a few seconds; allow for a slow database.
export const maxDuration = 60;
