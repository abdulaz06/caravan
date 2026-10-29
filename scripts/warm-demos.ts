// After a production build on Vercel (npm's postbuild): rebuilds any demo trip
// that is missing or from an older seed, so no visitor ever waits for one.
// Elsewhere (local builds, CI, previews) it does nothing unless WARM_DEMOS=1.
// It never fails the build: a demo that couldn't be warmed is rebuilt in the
// background on its next visit instead.
//   npx tsx --conditions=react-server scripts/warm-demos.ts
import { warmDemoTrips } from "@/lib/server/demo";

const LIMIT_MS = 120_000;

async function main() {
  if (process.env.VERCEL_ENV !== "production" && process.env.WARM_DEMOS !== "1") {
    console.log("warm-demos: not a production build, nothing to do");
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
