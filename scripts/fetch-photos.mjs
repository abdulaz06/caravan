// The photo pipeline for one preset: downloads the photos listed in
// presets/<id>/photos.picks.json from Wikimedia Commons, resizes them to
// ~1600px WebP in presets/<id>/images/<dir>/, and regenerates
// presets/<id>/photos.json (credit, licence, size, blur placeholder).
// Usage: npm run photos -- <preset-id>
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const UA = "CaravanTripPlanner/1.0 (https://github.com/abdulaz06/caravan)";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..");
const id = process.argv[2];
if (!id) throw new Error("usage: npm run photos -- <preset-id>");
const dir = path.join(root, "presets", id);
const picks = JSON.parse(await fs.readFile(path.join(dir, "photos.picks.json"), "utf8"));
delete picks._readme;

const strip = (s = "") =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

function cleanArtist(artist, uploader) {
  const a = artist.replace(/^User:/i, "").trim();
  if (!a || /^(me|myself|own work|unknown|anonymous)$/i.test(a)) return uploader ?? "Wikimedia Commons";
  return a;
}

async function info(titles) {
  const out = {};
  for (let i = 0; i < titles.length; i += 40) {
    const batch = titles.slice(i, i + 40);
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      titles: batch.join("|"),
      prop: "imageinfo",
      iiprop: "url|size|extmetadata|user",
      iiextmetadatafilter: "Artist|LicenseShortName|LicenseUrl",
      iiurlwidth: "1920",
    });
    const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { headers: { "User-Agent": UA } });
    const json = await res.json();
    const norm = Object.fromEntries((json.query.normalized ?? []).map((n) => [n.to, n.from]));
    for (const p of Object.values(json.query.pages)) {
      if (!p.imageinfo) throw new Error(`Missing on Commons: ${p.title}`);
      const i0 = p.imageinfo[0];
      const m = i0.extmetadata ?? {};
      out[norm[p.title] ?? p.title] = {
        url: i0.thumburl ?? i0.url,
        page: i0.descriptionurl,
        artist: cleanArtist(strip(m.Artist?.value), i0.user),
        license: strip(m.LicenseShortName?.value),
      };
    }
  }
  return out;
}

async function download(url) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }
  throw new Error(`Failed to download ${url}`);
}

// Which Commons page each existing file came from, so a changed pick re-downloads.
const previous = new Map();
try {
  const json = JSON.parse(await fs.readFile(path.join(dir, "photos.json"), "utf8"));
  for (const list of Object.values(json)) for (const ph of list) previous.set(ph.src, ph.source);
} catch {
  // first run
}

const allTitles = [...new Set(Object.values(picks).flatMap((p) => p.files))];
const meta = await info(allTitles);
const done = new Map(); // title -> photo record
const result = {};

for (const [key, { dir: sub, files }] of Object.entries(picks)) {
  result[key] = [];
  for (const [n, title] of files.entries()) {
    if (!done.has(title)) {
      const m = meta[title];
      const rel = `images/${sub}/${key}-${n + 1}.webp`;
      const dest = path.join(dir, rel);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      let buf;
      try {
        if (previous.has(rel) && previous.get(rel) !== m.page) throw new Error("pick changed");
        buf = await fs.readFile(dest);
      } catch {
        const raw = await download(m.url);
        buf = await sharp(raw)
          .rotate()
          .resize({ width: 1600, height: 2000, fit: "inside", withoutEnlargement: true })
          .webp({ quality: 72, effort: 5 })
          .toBuffer();
        await fs.writeFile(dest, buf);
        process.stdout.write(".");
      }
      const { width, height } = await sharp(buf).metadata();
      const blur = await sharp(buf).resize(16).webp({ quality: 40 }).toBuffer();
      done.set(title, {
        src: rel,
        credit: m.artist,
        source: m.page,
        license: m.license,
        width,
        height,
        blurDataURL: `data:image/webp;base64,${blur.toString("base64")}`,
      });
    }
    result[key].push(done.get(title));
  }
}

await fs.writeFile(path.join(dir, "photos.json"), `${JSON.stringify(result, null, 2)}\n`);
console.log(`\nWrote ${done.size} photos for ${Object.keys(result).length} keys → presets/${id}/photos.json`);
