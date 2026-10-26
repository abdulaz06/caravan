// Copies each preset's images (presets/<id>/images) to public/presets/<id>/images
// so Next.js can serve and optimise them. Runs before `dev` and `build`; the
// copies are generated (gitignored) — edit the files under presets/.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..");
const src = path.join(root, "presets");
const dest = path.join(root, "public", "presets");

let files = 0;
function copy(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name);
    const b = path.join(to, e.name);
    if (e.isDirectory()) copy(a, b);
    else {
      const sa = fs.statSync(a);
      const sb = fs.existsSync(b) ? fs.statSync(b) : null;
      if (!sb || sb.size !== sa.size || sb.mtimeMs < sa.mtimeMs) {
        fs.copyFileSync(a, b);
        files++;
      }
    }
  }
}

for (const id of fs.readdirSync(src)) {
  const images = path.join(src, id, "images");
  if (fs.existsSync(images)) copy(images, path.join(dest, id, "images"));
}
console.log(`sync-presets: ${files} image${files === 1 ? "" : "s"} updated in public/presets`);
