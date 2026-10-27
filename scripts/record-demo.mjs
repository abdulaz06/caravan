// Records Caravan's demo video at iPhone size and the screenshots used by the
// case study and README:
//   docs/media/demo.mp4, docs/media/demo.gif   the walkthrough at 780×1688 (~60 s / ~12 s)
//   docs/media/hero.png                        four phones for the README
//   public/case-study/hero.webp                the same, for the case study page
//   public/case-study/*.webp                   flow screenshots for /case-study
//   docs/media/shots/*.png                     full-size phone screenshots (not committed)
// Needs a local server on the local store (npm run dev:local, or next start with
// CARAVAN_LOCAL_STORE=1) and ffmpeg: on PATH, or FFMPEG=<path to ffmpeg>.
// Usage: node scripts/record-demo.mjs   (env: BASE, FFMPEG)
// The 16:9 desktop cut is scripts/record-desktop.mjs.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";
import { encodeGif, encodeMp4, openScaled, startRecording } from "./lib/recorder.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..");
const base = process.env.BASE ?? "http://localhost:3100";
if (!/localhost|127\.0\.0\.1/.test(base)) throw new Error("record against a local server only");
const ffmpeg = process.env.FFMPEG ?? "ffmpeg";
const media = path.join(root, "docs", "media");
const shotsDir = path.join(media, "shots");
const caseDir = path.join(root, "public", "case-study");
const tmp = path.join(root, ".data", "video", "phone");
for (const d of [media, shotsDir, caseDir, tmp]) fs.mkdirSync(d, { recursive: true });

const W = 390;
const H = 844;
const browser = await chromium.launch();
// The 390×844 phone layout, scaled 2× into a 780×1688 page (see openScaled).
const ctx = await browser.newContext({ viewport: { width: W * 2, height: H * 2 }, hasTouch: true });
const { page, app } = await openScaled(ctx, base, { width: W, height: H, scale: 2 });
const go = (url) => app.goto(url, { waitUntil: "networkidle" });
await go(base);
const rec = await startRecording(ctx, page, { dir: tmp, mode: "screencast", width: W * 2, height: H * 2, quality: 85 });
const mark = rec.mark;
const wait = (ms) => page.waitForTimeout(ms);
await page.mouse.move(W, H);
const scroll = async (dy, steps = 6) => {
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, (dy * 2) / steps);
    await wait(60);
  }
};
async function shot(name, caseStudy = false) {
  const file = path.join(shotsDir, `${name}.png`);
  await page.screenshot({ path: file });
  if (caseStudy) await sharp(file).resize(600).webp({ quality: 78 }).toFile(path.join(caseDir, `${name}.webp`));
}

// 1 · Caravan's front page
await wait(2200);
await shot("landing");
await scroll(520);
await wait(1400);
await scroll(-520);
await wait(500);

// 2 · Start a trip
await app.getByRole("link", { name: /Start a trip/ }).first().click();
await app.waitForURL(/\/new/);
await wait(900);
await app.getByRole("radio", { name: /Sri Lanka/ }).click();
await wait(900);
await app.locator("#owner-name").pressSequentially("Maya", { delay: 110 });
await app.locator("#owner-pin").pressSequentially("4826", { delay: 140 });
await wait(400);
await app.getByRole("button", { name: /Start the trip/ }).click();
await app.getByTestId("invite-link").waitFor();
await wait(2400);
await shot("invite");

// 3 · Dates
await app.getByRole("button", { name: /Build my version/ }).click();
await app.waitForURL(/\/trip/);
await wait(1400);
await app.getByRole("button", { name: /^Mon 28 Dec/ }).first().click();
await wait(1600);
await shot("dates", true);
await app.getByRole("button", { name: /Build days/ }).click();
await wait(1500);

// 4 · A matchup, then quick fill
mark("gifStart");
const slot = app.getByRole("button", { name: /Pick your daytime/ }).first();
await slot.scrollIntoViewIfNeeded();
await wait(700);
await slot.click();
await wait(2200);
await shot("matchup", true);
await app.getByRole("dialog").getByRole("button", { name: /^Pick (?!Stay)/ }).first().click();
await wait(1600);
await page.mouse.wheel(0, -8000);
await wait(600);
await app.getByRole("button", { name: /Quick fill/ }).click();
// With a pick already made, quick fill asks whether to keep it.
await app.getByRole("button", { name: /Fill the empty slots/ }).click();
await wait(1800);
await scroll(700, 8);
await wait(900);
await shot("days", true);
await scroll(900, 8);
await wait(900);
mark("gifEnd");

// 5 · Review: the trip poster and route map
await go(`${app.url().split("/trip")[0]}/trip?step=review`);
await wait(2200);
await scroll(360);
await wait(1500);
await shot("review");
await scroll(900, 8);
await wait(1200);

// 6 · The group, on the demo trip
await go(`${base}/demo/sri-lanka`);
await wait(1500);
await app.getByRole("button", { name: /Try it as a guest/ }).click();
await app.waitForURL(/\/trip/);
await go(app.url().replace(/\/trip.*/, "/group"));
await wait(1600);
await scroll(520);
await wait(1200);
await scroll(700);
await wait(1400);
await shot("group", true);
await scroll(700);
await wait(1200);

// 7 · A past trip, as a story
await go(`${base}/past/georgia-2025/story`);
await wait(2600);
await shot("story");
for (let i = 0; i < 3; i++) {
  await page.mouse.click(W * 2 * 0.75, H);
  await wait(2000);
}
await page.keyboard.press("ArrowRight");
await wait(1200);
for (let i = 0; i < 4; i++) {
  await page.keyboard.press("ArrowRight");
  await wait(250);
}
await wait(2200);

const { frames, marks, duration } = await rec.stop();
await ctx.close();
await browser.close();
console.log(`recorded ${duration.toFixed(1)} s, ${frames.length} frames (${(frames.length / duration).toFixed(1)} fps)`, marks);

// MP4 at full resolution, and a GIF of the core loop for the README
const mp4 = path.join(media, "demo.mp4");
const gif = path.join(media, "demo.gif");
encodeMp4({ ffmpeg, frames, out: mp4, crf: 23 });
const start = Math.max(0, marks.gifStart - 0.3);
encodeGif({ ffmpeg, from: mp4, out: gif, start, duration: Math.min(12, marks.gifEnd - start + 0.3), width: 420, fps: 10, colors: 128 });
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
await sharp(path.join(media, "hero.png")).webp({ quality: 82 }).toFile(path.join(caseDir, "hero.webp"));

for (const f of [mp4, gif, path.join(media, "hero.png")]) console.log(`${path.relative(root, f)}  ${(fs.statSync(f).size / 1e6).toFixed(1)} MB`);
fs.rmSync(tmp, { recursive: true, force: true });
