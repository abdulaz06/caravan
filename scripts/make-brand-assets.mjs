// Renders the Open Graph link-preview image and app icons from HTML/SVG so
// they match the app's fonts and palette.
// Usage: node scripts/make-brand-assets.mjs   (env: CHROME_PATH optional)
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..");
const img = (p) => pathToFileURL(path.join(root, "public", p)).href;

const SUN = (color) =>
  `<g fill="${color}"><circle cx="16" cy="16" r="7"/>${Array.from({ length: 12 }, (_, i) => `<rect x="15" y="1.5" width="2" height="5" rx="1" transform="rotate(${i * 30} 16 16)"/>`).join("")}</g>`;

// ── Icons ────────────────────────────────────────────────────────────
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="15" fill="#0a4351"/>
  <path d="M0 46 Q8 41 16 46 T32 46 T48 46 T64 46 V64 H0Z" fill="#117485"/>
  <path d="M0 52 Q8 47 16 52 T32 52 T48 52 T64 52" stroke="#79c6c3" stroke-width="2" fill="none"/>
  <g transform="translate(14 8) scale(1.12)">${SUN("#f2a33a")}</g>
</svg>`;
fs.writeFileSync(path.join(root, "src/app/icon.svg"), iconSvg);
await sharp(Buffer.from(iconSvg)).resize(180, 180).png().toFile(path.join(root, "src/app/apple-icon.png"));
console.log("icons ✓");

// ── Open Graph image ─────────────────────────────────────────────────
const html = `<!doctype html><html><head>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT,WONK@0,9..144,600,100,1;1,9..144,600,100,1;1,9..144,900,100,1&family=Instrument+Sans:wght@500;700&display=block" rel="stylesheet">
<style>
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; overflow: hidden; background: #06323d; font-family: 'Instrument Sans', sans-serif; }
  .wrap { position: relative; width: 100%; height: 100%; display: flex; }
  .bg { position: absolute; inset: 0;
    background: repeating-conic-gradient(from 0deg at 30% 120%, rgba(255,255,255,.06) 0deg 5deg, transparent 5deg 10deg),
      radial-gradient(80% 90% at 20% 100%, #0d5a69, #06323d 70%); }
  .left { position: relative; width: 640px; padding: 56px 0 56px 64px; display: flex; flex-direction: column; color: #fffbf4; }
  .brand { font-family: 'Fraunces'; font-style: italic; font-weight: 900; font-size: 38px; display: flex; align-items: center; gap: 10px; }
  .eyebrow { margin-top: auto; font-weight: 700; letter-spacing: .16em; font-size: 18px; color: #f7ba5c; text-transform: uppercase; }
  h1 { font-family: 'Fraunces'; font-weight: 600; font-size: 84px; line-height: .95; letter-spacing: -0.03em; margin-top: 14px; font-variation-settings: 'SOFT' 100, 'WONK' 1; }
  h1 em { color: #f7ba5c; }
  .sub { margin-top: 22px; font-size: 25px; color: rgba(255,251,244,.82); font-weight: 500; }
  .right { position: relative; flex: 1; }
  .card { position: absolute; border-radius: 26px; overflow: hidden; border: 7px solid #fffbf4; box-shadow: 0 30px 60px -20px rgba(0,0,0,.6); background-size: cover; background-position: center; }
  .c1 { width: 270px; height: 380px; left: 40px; top: 70px; transform: rotate(-7deg); background-image: url('${img("images/ella/nine-arches-little-adams-1.webp")}'); }
  .c2 { width: 250px; height: 320px; left: 270px; top: 40px; transform: rotate(6deg); background-image: url('${img("images/mirissa/mirissa-whale-watching-1.webp")}'); }
  .c3 { width: 250px; height: 300px; left: 240px; top: 300px; transform: rotate(-3deg); background-image: url('${img("images/mirissa/mirissa-beach-hop-1.webp")}'); }
  .label { position: absolute; left: 12px; bottom: 12px; background: rgba(29,25,20,.6); color: #fffbf4; font-size: 15px; font-weight: 700; padding: 5px 11px; border-radius: 999px; }
  .stamp { position: absolute; left: -58px; top: 455px; width: 150px; height: 150px; transform: rotate(-14deg); }
</style></head><body><div class="wrap"><div class="bg"></div>
  <div class="left">
    <div class="brand"><svg width="40" height="40" viewBox="0 0 32 32">${SUN("#f2a33a")}</svg>Lanks</div>
    <div class="eyebrow">The group trip · Dec ’26 – Jan ’27</div>
    <h1>Build your dream <em><i>Sri Lanka</i></em> trip.</h1>
    <div class="sub">Pick your days & nights — whales, safaris, sunrise climbs, beach parties. Takes 5 minutes.</div>
  </div>
  <div class="right">
    <div class="card c1"><span class="label">Nine Arches, Ella</span></div>
    <div class="card c2"><span class="label" style="top:12px;bottom:auto">Blue whales, Mirissa</span></div>
    <div class="card c3"><span class="label">Coconut Tree Hill</span></div>
    <svg class="stamp" viewBox="0 0 120 120">
      <defs><path id="c" d="M60 60 m-46 0 a46 46 0 1 1 92 0 a46 46 0 1 1 -92 0"/></defs>
      <circle cx="60" cy="60" r="58" fill="#f2a33a"/>
      <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(0,0,0,.25)" stroke-dasharray="2 3"/>
      <text font-size="11.5" font-weight="700" letter-spacing="2.2" fill="#1d1914" font-family="Instrument Sans"><textPath href="#c">SRI LANKA · DEC 2026 – JAN 2027 · </textPath></text>
      <g transform="translate(40 40) scale(1.25)">${SUN("#1d1914")}</g>
    </svg>
  </div>
</div></body></html>`;

const tmp = path.join(root, ".data", "og.html");
fs.mkdirSync(path.dirname(tmp), { recursive: true });
fs.writeFileSync(tmp, html);
const exe = process.env.CHROME_PATH;
const browser = await chromium.launch(exe ? { executablePath: exe, args: ["--allow-file-access-from-files"] } : { args: ["--allow-file-access-from-files"] });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(pathToFileURL(tmp).href, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(500);
const png = await page.screenshot({ type: "png" });
await browser.close();
await sharp(png).jpeg({ quality: 84, mozjpeg: true }).toFile(path.join(root, "src/app/opengraph-image.jpg"));
fs.writeFileSync(path.join(root, "src/app/opengraph-image.alt.txt"), "Lanks — build your dream Sri Lanka trip with the group");
console.log("opengraph-image.jpg ✓");
