// Rebuilds any demo trip that is missing or from an older seed, against the
// database this shell is configured for — by hand. In production, the "Warm
// the demos" GitHub Action calls /api/cron/warm-demos once each deployment is
// live instead. Runs only with WARM_DEMOS=1, so it's never run by accident.
//   WARM_DEMOS=1 npx tsx --conditions=react-server scripts/warm-demos.ts
import { warmDemoTrips } from "@/lib/server/demo";

const LIMIT_MS = 120_000;

async function main() {
  if (process.env.WARM_DEMOS !== "1") {
    console.log("warm-demos: set WARM_DEMOS=1 to rebuild stale demos against the configured database");
    return;
  }
  const out = await Promise.race([
    warmDemoTrips(),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`timed out after ${LIMIT_MS / 1000}s`)), LIMIT_MS)),
  ]);
  for (const d of out) console.log(`warm-demos: ${d.slug} ${d.rebuilt ? "rebuilt" : "already current"}`);
}

main()
  .catch((err) => console.warn("warm-demos: skipped —", err instanceof Error ? err.message : err))
  .finally(() => process.exit(0));
