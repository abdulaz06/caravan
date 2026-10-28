// Adds a demo's twelve fictional travellers (src/lib/server/demo.ts) to a trip
// that already exists on the local store — the LinkedIn recording seeds the trip
// it starts on camera, so its plan and the group dashboard belong to one trip.
// Local store only. Run with the same CARAVAN_LOCAL_STORE_FILE as the server:
//   npx tsx --conditions=react-server scripts/lib/seed-crew.ts <trip slug>
import { parseRules } from "@/engine/rules";
import { createEngine } from "@/engine/structure";
import { db, isUsingLocalStore } from "@/lib/server/db";
import { demoById, seedDemoCrew } from "@/lib/server/demo";
import { isPresetId, loadPreset } from "@/presets/registry";

async function main(slug: string | undefined) {
  if (!slug) throw new Error("usage: seed-crew.ts <trip slug>");
  // The store is picked on first use, so this still lands in time.
  process.env.CARAVAN_LOCAL_STORE = "1";
  if (!isUsingLocalStore()) throw new Error("seed the local store only");
  const row = await db().getTripBySlug(slug);
  if (!row) throw new Error(`no trip ${slug}`);
  const demo = demoById(row.preset_id);
  if (!demo || !isPresetId(row.preset_id)) throw new Error(`no demo crew for ${row.preset_id}`);
  // The trip's own engine (as src/lib/server/trip.ts builds it), so plans fit its rules.
  const { preset, catalog } = loadPreset(row.preset_id);
  const ids = await seedDemoCrew(row.id, demo, createEngine(catalog, parseRules(row.rules, preset)));
  console.log(`${slug}: ${ids.size} travellers`);
}

main(process.argv[2]).catch((err) => {
  console.error(err);
  process.exit(1);
});
