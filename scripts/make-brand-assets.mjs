// Renders Caravan's app icons and Open Graph link-preview images from
// HTML/SVG, so they match the app's fonts and palette:
//   src/app/icon.svg, src/app/apple-icon.png   the Caravan mark
//   src/app/opengraph-image.jpg                 Caravan's own pages
//   public/og/<preset-id>.jpg                   each destination (trip invite links)
// Usage: node scripts/make-brand-assets.mjs   (env: CHROME_PATH optional)
// Rerun after brand changes or when a preset's look or showcase changes.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..");
const file = (...p) => pathToFileURL(path.join(root, ...p)).href;

// Keep in step with src/lib/brand.ts (MARK).
const MARK = {
  light: [
    [9.5, 20, "#c95c3c"],
    [16, 16, "#d4a24a"],
    [22.5, 12, "#2e4266"],
  ],
  dark: [
    [9.5, 20, "#e4825f"],
    [16, 16, "#e2bb6e"],
    [22.5, 12, "#b9c7de"],
  ],
};
const discs = (tone, opacity = 0.92) => MARK[tone].map(([cx, cy, c]) => `<circle cx="${cx}" cy="${cy}" r="7.2" fill="${c}" fill-opacity="${opacity}"/>`).join("");
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ── Icons ────────────────────────────────────────────────────────────
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="15" fill="#111a2e"/>
  <g transform="translate(5.5 6) scale(1.66)">${discs("dark", 0.95)}</g>
</svg>
`;
fs.writeFileSync(path.join(root, "src/app/icon.svg"), iconSvg);
await sharp(Buffer.from(iconSvg)).resize(180, 180).png().toFile(path.join(root, "src/app/apple-icon.png"));
console.log("icons ✓");

// ── Shared page bits ─────────────────────────────────────────────────
const head = (css) => `<!doctype html><html><head>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT,WONK@0,9..144,600,100,1;1,9..144,600,100,1&family=Instrument+Sans:wght@500;600;700&display=block" rel="stylesheet">
<style>
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; overflow: hidden; font-family: 'Instrument Sans', sans-serif; }
  .serif { font-family: 'Fraunces'; font-variation-settings: 'SOFT' 100, 'WONK' 1; }
  .lock { display: flex; align-items: center; gap: .26em; font-family: 'Fraunces'; font-style: italic; font-weight: 600; letter-spacing: -0.025em; line-height: 1; }
  .lock svg { width: 1.08em; height: 1.08em; }
  .card { position: absolute; border-radius: 26px; overflow: hidden; border: 7px solid #fffdf9; box-shadow: 0 30px 60px -20px rgba(0,0,0,.6); background-size: cover; background-position: center; }
  .tag { position: absolute; left: 12px; bottom: 12px; max-width: calc(100% - 24px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; background: rgba(15,15,20,.62); color: #fffdf9; font-size: 15px; font-weight: 700; padding: 5px 11px; border-radius: 999px; }
  ${css}
</style></head><body>`;
const lockup = (size, color) => `<div class="lock" style="font-size:${size}px;color:${color}"><svg viewBox="0 0 32 32">${discs("dark")}</svg>Caravan</div>`;

let browser;
async function render(html, out) {
  const tmp = path.join(root, ".data", "og.html");
  fs.mkdirSync(path.dirname(tmp), { recursive: true });
  fs.writeFileSync(tmp, html);
  const exe = process.env.CHROME_PATH;
  browser ??= await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ["--allow-file-access-from-files"] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto(pathToFileURL(tmp).href, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  const png = await page.screenshot({ type: "png" });
  await page.close();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await sharp(png).jpeg({ quality: 84, mozjpeg: true }).toFile(out);
  console.log(`${path.relative(root, out)} ✓`);
}

// ── Presets: their showcase photos ───────────────────────────────────
const presets = fs
  .readdirSync(path.join(root, "presets"), { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(root, "presets", d.name, "preset.json")))
  .map((d) => {
    const dir = path.join("presets", d.name);
    const preset = JSON.parse(fs.readFileSync(path.join(root, dir, "preset.json"), "utf8"));
    const photos = JSON.parse(fs.readFileSync(path.join(root, dir, "photos.json"), "utf8"));
    const titles = Object.fromEntries((preset.activities ?? preset.options ?? []).map((a) => [a.id, a.title]));
    const shots = (preset.destination.showcase ?? Object.keys(photos))
      .filter((id) => photos[id]?.[0])
      .map((id) => ({ src: file(dir, photos[id][0].src), title: (titles[id] ?? id).split(/[:(]/)[0].trim() }));
    return { id: d.name, dir, preset, shots };
  });

// ── Caravan's own OG image ───────────────────────────────────────────
const lead = presets[0];
const [a, b] = lead?.shots ?? [];
await render(
  `${head(`
  body { background: #0b1220; color: #fffdf9; }
  .glow { position: absolute; border-radius: 50%; filter: blur(90px); }
  .left { position: absolute; left: 72px; top: 62px; bottom: 62px; width: 600px; display: flex; flex-direction: column; }
  .eyebrow { margin-top: auto; font-weight: 700; letter-spacing: .16em; font-size: 17px; color: #e2bb6e; text-transform: uppercase; }
  h1 { font-weight: 600; font-size: 104px; line-height: .9; letter-spacing: -0.035em; margin-top: 16px; }
  h1 em { color: #e2bb6e; }
  .sub { margin-top: 26px; font-size: 25px; line-height: 1.35; color: rgba(255,253,249,.8); font-weight: 500; max-width: 540px; }
  .m { position: absolute; left: 742px; top: 92px; width: 380px; background: #fffdf9; border-radius: 30px; padding: 14px; box-shadow: 0 40px 80px -24px rgba(0,0,0,.7); transform: rotate(2deg); }
  .m .hd { display: flex; justify-content: space-between; align-items: baseline; padding: 4px 8px 12px; color: #6e6f75; font-weight: 700; letter-spacing: .14em; font-size: 13px; text-transform: uppercase; }
  .m .hd i { font-family: 'Fraunces'; font-weight: 600; letter-spacing: 0; text-transform: none; font-size: 19px; color: #a8452b; }
  .m .row { position: relative; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .m .ph { position: relative; aspect-ratio: 3/4; border-radius: 20px; background-size: cover; background-position: center; overflow: hidden; }
  .m .ph::after { content: ""; position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,.75), transparent 55%); }
  .m .ph b { position: absolute; z-index: 1; left: 12px; right: 12px; bottom: 12px; color: #fff; font-size: 16px; line-height: 1.15; }
  .m .vs { position: absolute; left: 50%; top: 50%; transform: translate(-50%,-50%); width: 54px; height: 54px; border-radius: 50%; background: #d4a24a; border: 5px solid #fffdf9; display: grid; place-items: center; font-family: 'Fraunces'; font-style: italic; font-weight: 600; font-size: 19px; color: #16181d; z-index: 2; }
  .back { position: absolute; width: 360px; height: 470px; border-radius: 30px; }
  .chip { position: absolute; background: #fffdf9; color: #16181d; border-radius: 20px; padding: 14px 16px; box-shadow: 0 30px 60px -20px rgba(0,0,0,.6); font-weight: 700; }
  `)}
  <div class="glow" style="left:-120px;top:-80px;width:520px;height:520px;background:rgba(201,92,60,.35)"></div>
  <div class="glow" style="right:-160px;top:200px;width:560px;height:560px;background:rgba(212,162,74,.28)"></div>
  <div class="glow" style="left:420px;bottom:-260px;width:520px;height:520px;background:rgba(62,86,128,.45)"></div>
  <div class="left">
    ${lockup(46, "#fffdf9")}
    <div class="eyebrow">Group trip planner</div>
    <h1 class="serif">Plan the trip<br><em><i>together.</i></em></h1>
    <div class="sub">Everyone builds their own version of the trip. You see exactly where the group overlaps.</div>
  </div>
  <div class="back" style="left:716px;top:96px;background:#c95c3c;transform:rotate(-8deg)"></div>
  <div class="back" style="left:780px;top:84px;background:#d4a24a;transform:rotate(9deg)"></div>
  <div class="m">
    <div class="hd">Day 3 · Daytime <i>This or that?</i></div>
    <div class="row">
      <div class="ph" style="background-image:url('${a?.src ?? ""}')"><b>${esc(a?.title ?? "")}</b></div>
      <div class="ph" style="background-image:url('${b?.src ?? ""}')"><b>${esc(b?.title ?? "")}</b></div>
      <div class="vs">vs</div>
    </div>
    <div style="display:flex;align-items:center;gap:10px;padding:14px 8px 4px;color:#6e6f75;font-size:15px;font-weight:600">
      <span style="display:flex">${["#c95c3c", "#3e5680", "#5f7f63", "#c25576"].map((c, i) => `<span style="width:30px;height:30px;border-radius:50%;background:${c};border:3px solid #fffdf9;margin-left:${i ? -9 : 0}px"></span>`).join("")}</span>
      4 friends planning
    </div>
  </div>
  <div class="chip" style="left:690px;top:470px;font-size:16px">🔥 Popular · 7 picked</div>
  <div class="chip" style="left:960px;top:500px;font-size:16px">11 of 12 free · 29 Dec</div>
</body></html>`,
  path.join(root, "src/app/opengraph-image.jpg"),
);
fs.writeFileSync(path.join(root, "src/app/opengraph-image.alt.txt"), "Caravan — plan the trip together: everyone builds their own version, you see where it overlaps\n");

// ── One OG image per destination (used by its trips' invite links) ───
for (const p of presets) {
  const pal = p.preset.theme.palette;
  const d = p.preset.destination;
  const [c1, c2, c3] = p.shots;
  const card = (s, css, tagTop = false) =>
    s ? `<div class="card" style="${css};background-image:url('${s.src}')"><span class="tag"${tagTop ? ' style="top:12px;bottom:auto"' : ""}>${esc(s.title)}</span></div>` : "";
  await render(
    `${head(`
    body { background: ${pal.primary["950"]}; color: #fffdf9; }
    .bg { position: absolute; inset: 0;
      background: repeating-conic-gradient(from 0deg at 30% 120%, rgba(255,255,255,.05) 0deg 5deg, transparent 5deg 10deg),
        radial-gradient(80% 90% at 20% 100%, ${pal.primary["700"]}, ${pal.primary["950"]} 72%); }
    .left { position: absolute; left: 64px; top: 56px; bottom: 56px; width: 620px; display: flex; flex-direction: column; }
    .eyebrow { margin-top: auto; font-weight: 700; letter-spacing: .16em; font-size: 18px; color: ${pal.highlight["400"]}; text-transform: uppercase; }
    h1 { font-weight: 600; font-size: 86px; line-height: .95; letter-spacing: -0.03em; margin-top: 14px; }
    h1 em { color: ${pal.highlight["400"]}; }
    .sub { margin-top: 22px; font-size: 24px; line-height: 1.35; color: rgba(255,253,249,.82); font-weight: 500; }
    `)}
    <div class="bg"></div>
    <div class="left">
      ${lockup(40, "#fffdf9")}
      <div class="eyebrow">You're invited · ${esc(d.season)}</div>
      <h1 class="serif">Build your dream <em><i>${esc(p.preset.name)}</i></em> trip.</h1>
      <div class="sub">${esc(d.tagline)}. Pick your days and nights — takes 5 minutes.</div>
    </div>
    ${card(c1, "width:270px;height:380px;left:676px;top:74px;transform:rotate(-7deg)")}
    ${card(c2, "width:250px;height:320px;left:900px;top:44px;transform:rotate(6deg)", true)}
    ${card(c3, "width:250px;height:290px;left:868px;top:306px;transform:rotate(-3deg)")}
  </body></html>`,
    path.join(root, "public", "og", `${p.id}.jpg`),
  );
}

await browser?.close();
