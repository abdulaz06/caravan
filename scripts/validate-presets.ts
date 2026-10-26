// `npm run preset:validate` — checks every presets/<id>/ folder: the schema,
// cross-references, photos on disk, and family-friendly mode's banned words.
// Also writes presets/preset.schema.json for editor autocomplete.
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { presetSchema } from "../src/engine/preset-schema";
import { validatePreset } from "../src/engine/validate";

const root = path.resolve(import.meta.dirname, "..");
const dir = path.join(root, "presets");
const only = process.argv.slice(2);

fs.writeFileSync(path.join(dir, "preset.schema.json"), `${JSON.stringify(z.toJSONSchema(presetSchema, { io: "input", unrepresentable: "any" }), null, 2)}\n`);

let failed = 0;
const ids = fs
  .readdirSync(dir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(dir, d.name, "preset.json")))
  .map((d) => d.name)
  .filter((id) => !only.length || only.includes(id));

for (const id of ids) {
  const folder = path.join(dir, id);
  const read = (f: string) => JSON.parse(fs.readFileSync(path.join(folder, f), "utf8"));
  const result = validatePreset(read("preset.json"), fs.existsSync(path.join(folder, "photos.json")) ? read("photos.json") : {});
  const problems = [...result.problems];
  if (result.preset && result.preset.id !== id) problems.push(`The preset id "${result.preset.id}" must match its folder "${id}"`);
  for (const list of Object.values(result.photos ?? {})) {
    for (const ph of list) if (!ph.src.startsWith("/") && !fs.existsSync(path.join(folder, ph.src))) problems.push(`Missing image file ${ph.src}`);
  }
  if (problems.length) {
    failed++;
    console.error(`✗ ${id} — ${problems.length} problem${problems.length === 1 ? "" : "s"}`);
    for (const p of problems) console.error(`   · ${p}`);
  } else {
    const p = result.preset!;
    console.log(`✓ ${id} — ${p.activities.length} activities, ${p.pairs.length} matchups, ${p.regions.length} places, ${p.structure.bases.length} base(s)`);
  }
  for (const w of result.warnings) console.warn(`   ⚠ ${w}`);
}
if (!ids.length) console.error("No presets found");
process.exit(failed || !ids.length ? 1 : 0);
