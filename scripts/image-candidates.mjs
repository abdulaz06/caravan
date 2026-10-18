// Dev helper: search Wikimedia Commons for photo candidates and build contact
// sheets so a human (or Claude) can pick the right shots.
// Usage: node scripts/image-candidates.mjs <outDir> [key1,key2,...]
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const UA = "LanksTripPlanner/1.0 (https://github.com/abdulaz06/lanks)";
const outDir = process.argv[2];
const only = process.argv[3]?.split(",");
if (!outDir) throw new Error("usage: image-candidates.mjs <outDir> [keys]");

const queries = JSON.parse(
  await fs.readFile(new URL("./image-queries.json", import.meta.url), "utf8"),
);
const OK_LICENSE = /^(CC BY(-SA)? \d|CC0|Public domain|PD)/i;
const PER_KEY = 8;
const TW = 240;
const TH = 160;
const LABEL = 26;

const strip = (s = "") => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

async function search(q) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrnamespace: "6",
    gsrsearch: `${q} filetype:bitmap filew:>1400`,
    gsrlimit: "10",
    prop: "imageinfo",
    iiprop: "url|size|extmetadata",
    iiextmetadatafilter: "Artist|LicenseShortName|LicenseUrl|Credit",
    iiurlwidth: "330",
  });
  const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
    headers: { "User-Agent": UA },
  });
  const json = await res.json();
  const pages = Object.values(json.query?.pages ?? {}).sort((a, b) => a.index - b.index);
  return pages.map((p) => {
    const i = p.imageinfo[0];
    const m = i.extmetadata ?? {};
    return {
      title: p.title,
      width: i.width,
      height: i.height,
      thumb: i.thumburl,
      original: i.url,
      page: i.descriptionurl,
      license: strip(m.LicenseShortName?.value),
      licenseUrl: m.LicenseUrl?.value ?? "",
      artist: strip(m.Artist?.value),
    };
  });
}

async function fetchBuf(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
  return null;
}

await fs.mkdir(outDir, { recursive: true });
const keys = Object.keys(queries).filter((k) => !only || only.includes(k));
const all = {};
for (const key of keys) {
  const seen = new Set();
  const list = [];
  for (const q of queries[key]) {
    for (const c of await search(q)) {
      if (seen.has(c.title) || !OK_LICENSE.test(c.license)) continue;
      seen.add(c.title);
      list.push(c);
    }
  }
  all[key] = list.slice(0, PER_KEY);
}
await fs.writeFile(path.join(outDir, "candidates.json"), JSON.stringify(all, null, 2));

// contact sheets: 4 keys per sheet, one row per key
const esc = (s) => s.replace(/[<>&"]/g, "");
for (let s = 0; s < keys.length; s += 4) {
  const group = keys.slice(s, s + 4);
  const W = TW * PER_KEY;
  const H = group.length * (TH + LABEL);
  const composites = [];
  let svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;
  for (const [row, key] of group.entries()) {
    const y = row * (TH + LABEL);
    svg += `<text x="6" y="${y + 19}" font-family="Arial" font-size="18" font-weight="bold" fill="#000">${esc(key)}</text>`;
    for (const [col, c] of all[key].entries()) {
      const buf = await fetchBuf(c.thumb);
      if (!buf) continue;
      const tile = await sharp(buf).resize(TW - 4, TH - 4, { fit: "cover" }).toBuffer();
      composites.push({ input: tile, left: col * TW + 2, top: y + LABEL + 2 });
      svg += `<rect x="${col * TW + 4}" y="${y + LABEL + 4}" width="26" height="22" fill="#000"/><text x="${col * TW + 10}" y="${y + LABEL + 21}" font-family="Arial" font-size="17" fill="#fff">${col}</text>`;
    }
  }
  svg += "</svg>";
  composites.push({ input: Buffer.from(svg), left: 0, top: 0 });
  await sharp({ create: { width: W, height: H, channels: 3, background: "#e8e2d6" } })
    .composite(composites)
    .jpeg({ quality: 80 })
    .toFile(path.join(outDir, `sheet-${String(s / 4).padStart(2, "0")}.jpg`));
  console.log("sheet", s / 4, group.join(", "));
}
