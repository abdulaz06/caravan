// Records Caravan's demo video at iPhone size and the screenshots used by the
// case study and README:
//   docs/media/demo.mp4, docs/media/demo.gif   the walkthrough (~60 s / ~12 s)
//   docs/media/hero.png                        four phones for the README
//   public/case-study/*.webp                   flow screenshots for /case-study
//   docs/media/shots/*.png                     full-size phone screenshots (not committed)
// Needs a local server on the local store (npm run dev:local, or next start with
// CARAVAN_LOCAL_STORE=1) and ffmpeg: on PATH, or FFMPEG=<path to ffmpeg>.
// Usage: node scripts/record-demo.mjs   (env: BASE, FFMPEG)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..");
const base = process.env.BASE ?? "http://localhost:3100";
if (!/localhost|127\.0\.0\.1/.test(base)) throw new Error("record against a local server only");
const ffmpeg = process.env.FFMPEG ?? "ffmpeg";
const media = path.join(root, "docs", "media");
const shotsDir = path.join(media, "shots");
const caseDir = path.join(root, "public", "case-study");
const tmp = path.join(root, ".data", "video");
for (const d of [media, shotsDir, caseDir, tmp]) fs.mkdirSync(d, { recursive: true });

const W = 390;
const H = 844;
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  recordVideo: { dir: tmp, size: { width: W * 2, height: H * 2 } },
});
const page = await ctx.newPage();
const t0 = Date.now();
const marks = {};
const mark = (k) => (marks[k] = (Date.now() - t0) / 1000);
const wait = (ms) => page.waitForTimeout(ms);
const scroll = async (dy, steps = 6) => {
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, dy / steps);
    await wait(60);
  }
};
async function shot(name, caseStudy = false) {
  const file = path.join(shotsDir, `${name}.png`);
  await page.screenshot({ path: file });
  if (caseStudy) await sharp(file).resize(600).webp({ quality: 78 }).toFile(path.join(caseDir, `${name}.webp`));
}

// 1 · Caravan's front page
await page.goto(base, { waitUntil: "networkidle" });
await wait(2200);
await shot("landing");
await scroll(520);
await wait(1400);
await scroll(-520);
await wait(500);

// 2 · Start a trip
await page.getByRole("link", { name: /Start a trip/ }).first().click();
await page.waitForURL(/\/new/);
await wait(900);
await page.getByRole("radio", { name: /Sri Lanka/ }).click();
await wait(900);
await page.locator("#owner-name").pressSequentially("Maya", { delay: 110 });
await page.locator("#owner-pin").pressSequentially("4826", { delay: 140 });
await wait(400);
await page.getByRole("button", { name: /Start the trip/ }).click();
await page.getByTestId("invite-link").waitFor();
await wait(2400);
await shot("invite");

// 3 · Dates
await page.getByRole("button", { name: /Build my version/ }).click();
await page.waitForURL(/\/trip/);
await wait(1400);
await page.getByRole("button", { name: /^Mon 28 Dec/ }).first().click();
await wait(1600);
await shot("dates", true);
await page.getByRole("button", { name: /Build days/ }).click();
await wait(1500);

// 4 · A matchup, then quick fill
mark("gifStart");
const slot = page.getByRole("button", { name: /Pick your daytime/ }).first();
await slot.scrollIntoViewIfNeeded();
await wait(700);
await slot.click();
await wait(2200);
await shot("matchup", true);
await page.getByRole("dialog").getByRole("button", { name: /^Pick / }).first().click();
await wait(1600);
await page.mouse.wheel(0, -4000);
await wait(600);
await page.getByRole("button", { name: /Quick fill/ }).click();
// With a pick already made, quick fill asks whether to keep it.
await page.getByRole("button", { name: /Fill the empty slots/ }).click();
await wait(1800);
await scroll(700, 8);
await wait(900);
await shot("days", true);
await scroll(900, 8);
await wait(900);
mark("gifEnd");

// 5 · Review: the trip poster and route map
await page.goto(`${page.url().split("/trip")[0]}/trip?step=review`, { waitUntil: "networkidle" });
await wait(2200);
await scroll(360);
await wait(1500);
await shot("review");
await scroll(900, 8);
await wait(1200);

// 6 · The group, on the demo trip
await page.goto(`${base}/demo/sri-lanka`, { waitUntil: "networkidle" });
await wait(1500);
await page.getByRole("button", { name: /Try it as a guest/ }).click();
await page.waitForURL(/\/trip/);
await page.goto(page.url().replace(/\/trip.*/, "/group"), { waitUntil: "networkidle" });
await wait(1600);
await scroll(520);
await wait(1200);
await scroll(700);
await wait(1400);
await shot("group", true);
await scroll(700);
await wait(1200);

// 7 · A past trip, as a story
await page.goto(`${base}/past/georgia-2025/story`, { waitUntil: "networkidle" });
await wait(2600);
await shot("story");
for (let i = 0; i < 3; i++) {
  await page.mouse.click(W * 0.75, H * 0.5);
  await wait(2000);
}
await page.keyboard.press("ArrowRight");
await wait(1200);
for (let i = 0; i < 4; i++) {
  await page.keyboard.press("ArrowRight");
  await wait(250);
}
await wait(2200);

const video = page.video();
await ctx.close();
await browser.close();
const webm = await video.path();
const total = (Date.now() - t0) / 1000;
console.log(`recorded ${total.toFixed(1)} s → ${path.relative(root, webm)}`, marks);

// MP4 for the README/case study, and a short GIF of the core loop
const mp4 = path.join(media, "demo.mp4");
const gif = path.join(media, "demo.gif");
execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-i", webm, "-vf", "fps=30,scale=540:-2:flags=lanczos", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "27", "-preset", "slow", "-movflags", "+faststart", "-an", mp4]);
const start = Math.max(0, marks.gifStart - 0.3).toFixed(2);
const dur = Math.min(16, marks.gifEnd - marks.gifStart + 0.5).toFixed(2);
execFileSync(ffmpeg, [
  "-y", "-loglevel", "error", "-ss", start, "-t", dur, "-i", webm,
  "-vf", "fps=12,scale=300:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle",
  gif,
]);
// README hero: four phones on Caravan's midnight, with soft glows
const HW = 1600;
const HH = 900;
const pw = 300;
const ph = Math.round((H * 2 * pw) / (W * 2));
const gap = 48;
const x0 = (HW - (4 * pw + 3 * gap)) / 2;
const glows = [
  [260, 160, 330, "#c95c3c"],
  [1350, 520, 380, "#d4a24a"],
  [800, 980, 360, "#3e5680"],
];
const backdrop = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${HW}" height="${HH}"><defs><filter id="b"><feGaussianBlur stdDeviation="150"/></filter></defs>` +
    `<rect width="100%" height="100%" fill="#0b1220"/><g filter="url(#b)" opacity="0.45">${glows.map(([cx, cy, r, c]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}"/>`).join("")}</g></svg>`,
);
const phones = [];
for (const [i, n] of ["landing", "matchup", "review", "story"].entries()) {
  const x = Math.round(x0 + i * (pw + gap));
  const y = Math.round((HH - ph) / 2 + (i === 0 || i === 3 ? 40 : 0));
  const rounded = Buffer.from(`<svg width="${pw}" height="${ph}"><rect width="${pw}" height="${ph}" rx="30"/></svg>`);
  const screen = await sharp(path.join(shotsDir, `${n}.png`)).resize(pw, ph).composite([{ input: rounded, blend: "dest-in" }]).png().toBuffer();
  const bezel = Buffer.from(
    `<svg width="${pw + 92}" height="${ph + 104}"><defs><filter id="s"><feGaussianBlur stdDeviation="20"/></filter></defs>` +
      `<rect x="40" y="56" width="${pw + 12}" height="${ph + 12}" rx="36" fill="#000" opacity="0.55" filter="url(#s)"/>` +
      `<rect x="40" y="40" width="${pw + 12}" height="${ph + 12}" rx="36" fill="#1c2740"/></svg>`,
  );
  phones.push({ input: bezel, left: x - 46, top: y - 46 }, { input: screen, left: x, top: y });
}
await sharp(backdrop).composite(phones).png({ compressionLevel: 9 }).toFile(path.join(media, "hero.png"));

for (const f of [mp4, gif, path.join(media, "hero.png")]) console.log(`${path.relative(root, f)}  ${(fs.statSync(f).size / 1e6).toFixed(1)} MB`);
fs.rmSync(tmp, { recursive: true, force: true });
