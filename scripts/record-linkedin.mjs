// Records Caravan's LinkedIn cut: a one-minute 16:9 walkthrough at a genuine,
// constant 60 fps, 2560×1440 (and a 1920×1080 copy), plus a thumbnail.
//   out/linkedin/caravan-linkedin.mp4          2560×1440, H.264 High, 60 fps
//   out/linkedin/caravan-linkedin-1080p.mp4    the same, downscaled
//   out/linkedin/caravan-linkedin-thumbnail.png  the opening hook frame
// One Sri Lanka trip throughout: it's started on camera at /new, built, then
// (off camera) given the demo's twelve fictional travellers, so the group
// dashboard is that same trip's. The hook is filmed last and moved to the front.
// The app renders a 1024×576 layout at 2.5× under a virtual clock, one frame per
// 1/60 s of page time (scripts/lib/frame-capture.mjs) — so nothing depends on
// this machine's screen or speed — and the camera, cursor and captions are
// drawn in the browser (scripts/lib/stage.mjs). The case-study cut is
// scripts/record-desktop.mjs; this doesn't touch it.
// Needs a local server on the local store — e.g. npm run build, then
// CARAVAN_LOCAL_STORE=1 npx next start -p 3100 — and ffmpeg (on PATH, or FFMPEG=…).
// Run it with the server's CARAVAN_LOCAL_STORE_FILE if the server has one: the
// travellers are seeded straight into that store.
// Usage: node scripts/record-linkedin.mjs   (env: BASE, FFMPEG, DRAFT=1 for a quick 1024×576 pass)
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import { encodeFrames, launchFramePage, linear, startClock } from "./lib/frame-capture.mjs";
import { openStage } from "./lib/stage.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..");
const base = process.env.BASE ?? "http://localhost:3100";
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) throw new Error("record against a local server only");
const ffmpeg = process.env.FFMPEG ?? "ffmpeg";
const draft = process.env.DRAFT === "1";
const LIVE = "caravan-prod.vercel.app";
// A 1024×576 layout (the desktop breakpoint, where a trip's 480-px column is
// biggest next to the photo) at 2.5× is exactly 2560×1440.
const W = 1024;
const H = 576;
const S = draft ? 1 : 2.5;
const COL = W - 240; // the centre of a trip's column
const outDir = path.join(root, "out", "linkedin");
const work = path.join(root, ".data", "video", "linkedin");
fs.mkdirSync(outDir, { recursive: true });

const shell = await launchFramePage({ width: W * S, height: H * S, permissions: ["clipboard-read", "clipboard-write"], origin: base });
const clock = await startClock(shell.cdp, { dir: path.join(work, "frames"), quality: draft ? 80 : 94 });
const stage = await openStage(clock, shell.page, base, { width: W, height: H, scale: S });
const { app } = stage;
const wait = (ms) => clock.wait(ms);
const sheet = app.getByRole("dialog");
const pickButtons = () => sheet.getByRole("button", { name: /^Pick (?!Stay)/ });
const day = (n) =>
  app
    .locator("ol > li")
    .filter({ has: app.locator("span.label", { hasText: new RegExp(`^Day ${n}$`) }) })
    .first();

/** The trip's links read as they do in production (the server here is localhost). */
function showLiveOrigin([from, to]) {
  const swap = (n) => {
    if (n.nodeType === 3 && n.data.includes(from)) n.data = n.data.split(from).join(to);
  };
  const walk = (el) => {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) swap(n);
  };
  walk(document.body);
  new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === "characterData") swap(m.target);
      for (const n of m.addedNodes) {
        if (n.nodeType === 3) swap(n);
        else walk(n);
      }
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true });
}

/** Adds the demo's travellers to this trip, on the server's local store. */
async function seedCrew(slug) {
  const tsx = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
  const { stdout } = await promisify(execFile)(process.execPath, [tsx, "--conditions=react-server", path.join(root, "scripts", "lib", "seed-crew.ts"), slug], { cwd: root });
  console.log(stdout.trim());
}

// ── Home: one beat of the hero, then start a trip ───────────────────────
await stage.goto(base);
clock.record();
clock.mark("home");
await wait(200);
await stage.click(app.getByRole("link", { name: /^Start a trip/ }).nth(1), { ms: 420 });

// ── Start the Sri Lanka trip ─────────────────────────────────────────────
clock.mark("create");
await stage.cut(async () => {
  await app.waitForURL(/\/new/);
  await app.getByRole("radio", { name: /Sri Lanka/ }).click();
  await app.locator("#owner-name").waitFor();
  await wait(800); // the form opens
  await app.evaluate(showLiveOrigin, [base, `https://${LIVE}`]);
  await stage.scrollTo(app.locator("#trip-name"), { top: 52, ms: 0 });
  await stage.camera({ z: 1.18, x: W / 2, y: 250 });
});
await stage.click(app.locator("#owner-name"), { ms: 340 });
await stage.type("Maya", 45);
await stage.click(app.locator("#owner-pin"), { ms: 260 });
await stage.type("4826", 45);
await stage.scrollBy(190, { ms: 380 });
await stage.click(app.getByRole("button", { name: /Start the trip/ }), { ms: 340 });

// ── The invite link ──────────────────────────────────────────────────────
clock.mark("invite");
await stage.cut(
  async () => {
    await app.getByTestId("invite-link").waitFor();
    await app.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await stage.frame(app.getByTestId("invite-link"), { z: 1.3, dy: 34 });
  },
  { settle: 120, fade: 260 },
);
await stage.caption("One link. Everyone gets a say.", { as: "center" });
await wait(300);
await stage.click(app.getByRole("button", { name: /Copy link/ }), { ms: 400 });
await wait(950);
await stage.click(app.getByRole("button", { name: /Build my version/ }), { ms: 380 });

// ── Dates: tap the first day, then the last ─────────────────────────────
let slug = "";
clock.mark("dates");
await stage.cut(async () => {
  await app.waitForURL(/\/trip/);
  slug = app.url().match(/\/t\/([^/]+)\//)[1];
  // High enough that the last day (1 Jan) clears the sticky dates bar.
  await stage.scrollTo(app.getByRole("button", { name: /^Mon 14 Dec/ }).first(), { top: 40, ms: 0 });
  await stage.camera({ z: 1.15, x: COL, y: 300 });
  await stage.show("scrim");
});
await stage.caption("Everyone picks <em>their own</em> dates.");
await wait(450);
await stage.click(app.getByRole("button", { name: /^Sun 27 Dec/ }).first(), { ms: 480 });
await wait(700);
await stage.click(app.getByRole("button", { name: /^Fri 1 Jan/ }).first(), { ms: 520 });
await wait(1500);
await stage.click(app.getByRole("button", { name: /Build days/ }), { ms: 420 });

// ── This or that: a daytime matchup, then an evening one ─────────────────
clock.mark("matchups");
await stage.cut(
  async () => {
    await app.getByRole("heading", { name: /Build your days/ }).waitFor();
    await stage.scrollTo(day(3), { top: 160, ms: 0 });
  },
  { keepCaption: true },
);
await stage.caption("Build the trip <em>YOU</em> actually want.");
await wait(300);
await stage.click(day(3).getByRole("button", { name: /Pick your daytime/ }), { ms: 400 });

async function matchup(pick) {
  await sheet.waitFor();
  await wait(420);
  const [a, b] = [pickButtons().nth(0), pickButtons().nth(1)];
  await stage.scrollTo(a, { top: 96, ms: 520 });
  await stage.frame([a, b], { z: 1.3, dy: -12 }, 520);
  await wait(1500);
  await stage.click(pick === 0 ? a : b, { ms: 420, fy: 0.42 });
  await wait(720);
  await stage.camera({ z: 1.15, x: COL, y: 290 }, 420);
}
await matchup(0);
await wait(150);
await stage.click(day(3).getByRole("button", { name: /Pick your evening/ }), { ms: 400 });
await matchup(1);

// ── Customise: add another, drag a day, quick-fill the rest ──────────────
clock.mark("customise");
await stage.caption("Add more. Reorder.<br><em>Or quick-fill the rest.</em>");
await stage.click(day(3).getByRole("button", { name: /Add another to daytime/ }), { ms: 420 });
await sheet.waitFor();
await wait(500);
await stage.click(sheet.getByRole("button", { name: /^Add Galle Fort street-food walk/ }), { ms: 440 });
await wait(450);
// Day 3's handle has to clear the sticky header and progress bar.
await Promise.all([stage.scrollTo(day(3), { top: 190, ms: 480 }), stage.camera({ z: 1, x: COL, y: H / 2 }, 480)]);
// Far enough past the midpoint to swap with Day 4 — and no further, or the
// pointer reaches the bottom edge and the list starts scrolling under it.
const [d3, d4] = [await stage.box(day(3)), await stage.box(day(4))];
const swap = d4.y + d4.height / 2 - (d3.y + d3.height / 2);
await stage.drag(day(3).getByRole("button", { name: /Drag to reorder day 3/ }), { dy: swap * 0.62, ms: 760, settle: 150 });
await wait(350);
// Its plans now fall on Wed 30 Dec.
await stage.scrollTo(day(4), { top: 190, ms: 480 });
await wait(450);
await stage.scrollTo(app.getByRole("button", { name: /Quick fill/ }), { top: 240, ms: 560 });
await stage.click(app.getByRole("button", { name: /Quick fill/ }), { ms: 360 });
await stage.click(app.getByRole("button", { name: /Fill the empty slots/ }), { ms: 400 });
await wait(950);

// ── Review: the route, then the budget ───────────────────────────────────
clock.mark("review");
await stage.caption("Your itinerary.<br>Your route.<br><em>Your budget.</em>");
await stage.click(app.getByRole("navigation", { name: "Steps" }).getByText("Review", { exact: true }), { ms: 460 });
await stage.cut(
  async () => {
    await app.getByRole("heading", { name: /Looking good/ }).waitFor();
    await stage.scrollTo(app.getByText(/Maya's/).first(), { top: 112, ms: 0 });
    await stage.camera({ z: 1.12, x: COL, y: 300 });
  },
  { keepCaption: true },
);
await wait(1000);
// Down the route from Colombo to Galle, to the budget.
const budget = app.getByText(/Trip budget/i).filter({ visible: true }).first();
await stage.scrollTo(budget, { top: 300, ms: 1500 });
await stage.frame(budget, { z: 1.3, dy: 26 }, 700);
await wait(1400);

// ── Off camera: submit, and the friends arrive ───────────────────────────
await stage.cut(
  async () => {
    await app.getByRole("button", { name: /Submit my trip/ }).first().click();
    await app.getByRole("heading", { name: /Your trip is/ }).waitFor();
    await seedCrew(slug);
    await stage.goto(`${base}/t/${slug}/group`);
    await stage.show("scrim");
    await stage.show("tag");
    // The busy end of December, closer than the hook has it.
    await stage.scrollTo(app.getByRole("button", { name: /^Mon 14 Dec: / }), { top: 112, ms: 0 });
    await stage.camera({ z: 1.16, x: COL, y: 316 }); // below the sticky header
  },
  { settle: 700 },
);

// Shot A — the date heatmap: tap the best day, then read how many can make it.
clock.mark("group");
await stage.caption("Find the dates that work for <em>everyone.</em>");
await wait(800);
await stage.click(app.getByRole("button", { name: /^Wed 30 Dec: / }), { ms: 460 });
await wait(250);
await Promise.all([stage.scrollTo(app.getByText(/can make it/).first(), { top: 400, ms: 800 }), stage.cursor(false, 300)]);
await wait(1500);

// Shot B — most picked
clock.mark("mostPicked");
await stage.caption("See what the group <em>actually</em> wants.");
await Promise.all([stage.scrollTo(app.getByRole("heading", { name: "Most picked" }), { top: 76, ms: 1000 }), stage.camera({ z: 1.05, x: COL, y: H / 2 }, 1000)]);
await wait(3000);

// Shot C — the nature ↔ nightlife spectrum
clock.mark("spectrum");
await stage.cut(async () => {
  await app.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await stage.frame(app.getByRole("region", { name: "Group spectrum" }), { z: 1.24, dy: 50 });
});
await stage.caption("Understand everyone’s <em>travel style.</em>");
await stage.camera({ z: 1.31 }, 3300, linear);
const groupLast = clock.lastFrame;
clock.mark("groupEnd");

// ── The hook (filmed now, played first) ──────────────────────────────────
await stage.cut(
  async () => {
    await stage.caption(null);
    // Low enough that the sticky header is out of shot.
    await stage.scrollTo(app.getByText(/^Sweet spot/), { top: 94, ms: 0 });
    await stage.camera({ z: 1.13, x: COL, y: 320 });
    await stage.text("hook1", "Everyone plans<br>their own trip.");
    await stage.text("hook2", "Caravan finds<br>the overlap.");
    await stage.cls("tag", "low");
  },
  { fade: 17, settle: 300 },
);
clock.mark("hook");
const push = stage.camera({ z: 1.19 }, 3000, linear);
await stage.show("hook-lock");
await wait(130);
await stage.show("hook1");
await wait(330);
await stage.show("hook2");
await wait(950);
await clock.still("thumbnail");
await push;
clock.mark("hookEnd");

// ── Another destination, another look ────────────────────────────────────
clock.mark("contrast");
await stage.cut(
  async () => {
    await stage.instant(true);
    for (const id of ["scrim", "hook-lock", "hook1", "hook2"]) await stage.show(id, false);
    await stage.cls("tag", "low", false);
    await stage.cls("tag", "aside"); // clear of the welcome page's own logo
    await stage.instant(false);
    // The trip as a friend opening the invite sees it.
    await shell.ctx.clearCookies();
    await stage.goto(`${base}/t/${slug}`);
    await stage.camera({ z: 1, x: W / 2, y: H / 2 });
  },
  { from: groupLast },
);
await stage.caption("One planner. Any destination.", { as: "center" });
await stage.camera({ z: 1.04, x: 470, y: 300 }, 1500, linear);
clock.mark("georgia");
await stage.cut(
  async () => {
    await stage.show("tag", false);
    await stage.goto(`${base}/demo/georgia`);
    await stage.camera({ z: 1, x: W / 2, y: H / 2 });
  },
  { fade: 380, settle: 400, keepCaption: true },
);
await stage.camera({ z: 1.05, x: 470, y: 300 }, 2000, linear);

// ── End card ─────────────────────────────────────────────────────────────
clock.mark("end");
await stage.text("url", LIVE);
await stage.caption(null);
await stage.show("card");
await wait(2050);
await stage.show("black");
await wait(420);

const { frames, moving, marks, stills } = await clock.stop();
await shell.close();
console.log(`recorded ${frames.length} frames (${(frames.length / 60).toFixed(1)} s at 60 fps)`, marks);

// ── Cut: the hook first, crossfading into the home page ──────────────────
const X = 18; // crossfade frames (0.3 s)
const hook = frames.slice(marks.hook, marks.hookEnd);
const main = frames.slice(marks.home, marks.groupEnd);
const tail = frames.slice(marks.contrast);
const blendDir = path.join(work, "blend");
fs.rmSync(blendDir, { recursive: true, force: true });
fs.mkdirSync(blendDir, { recursive: true });
const blends = [];
for (let i = 0; i < X; i++) {
  const a = hook[hook.length - X + i];
  const b = main[i];
  const out = path.join(blendDir, `${i}.jpg`);
  const t = (i + 1) / (X + 1);
  const top = await sharp(b).ensureAlpha(t).png().toBuffer();
  await sharp(a).composite([{ input: top }]).jpeg({ quality: 94 }).toFile(out);
  blends.push(out);
}
const sequence = [...hook.slice(0, -X), ...blends, ...main.slice(X), ...tail];
const span = (a, b) => moving.slice(a, b);
const motion = [...span(marks.hook, marks.hookEnd - X), ...blends.map(() => true), ...span(marks.home + X, marks.groupEnd), ...span(marks.contrast)];

// Where each scene starts in the final cut (seconds), and when scripted motion runs.
const at = (m) => (m >= marks.contrast ? hook.length - X + main.length + (m - marks.contrast) : hook.length - X + (m - marks.home)) / 60;
const scenes = [["hook", 0], ...["home", "create", "invite", "dates", "matchups", "customise", "review", "group", "mostPicked", "spectrum", "contrast", "georgia", "end"].map((k) => [k, at(marks[k])])];
const intervals = [];
motion.forEach((m, i) => {
  if (m && intervals.at(-1)?.[1] === i) intervals.at(-1)[1] = i + 1;
  else if (m) intervals.push([i, i + 1]);
});
// Frames identical to the one before (the page reported nothing changed) while something was meant to move.
const repeats = motion.filter((m, i) => m && i > 0 && sequence[i] === sequence[i - 1]).length;
console.log(`final ${sequence.length} frames = ${(sequence.length / 60).toFixed(2)} s · ${motion.filter(Boolean).length} in scripted motion, ${repeats} of them repeats`);
for (const [k, t] of scenes) console.log(`  ${t.toFixed(2).padStart(6)} s  ${k}`);
fs.writeFileSync(
  path.join(outDir, draft ? "draft-timeline.json" : "timeline.json"),
  JSON.stringify({ fps: 60, frames: sequence.length, scenes: Object.fromEntries(scenes.map(([k, t]) => [k, +t.toFixed(3)])), motion: intervals.map(([a, b]) => [a / 60, b / 60]) }),
);

if (draft) {
  const out = path.join(outDir, "caravan-linkedin-draft.mp4");
  encodeFrames({ ffmpeg, frames: sequence, out, crf: 20, work: path.join(work, "seq"), draft });
  console.log(`${path.relative(root, out)}  ${(fs.statSync(out).size / 1e6).toFixed(1)} MB`);
} else {
  const out = path.join(outDir, "caravan-linkedin.mp4");
  encodeFrames({ ffmpeg, frames: sequence, out, crf: 16, work: path.join(work, "seq") });
  const hd = path.join(outDir, "caravan-linkedin-1080p.mp4");
  encodeFrames({ ffmpeg, frames: sequence, out: hd, crf: 16, size: "1920:1080", work: path.join(work, "seq") });
  const thumb = path.join(outDir, "caravan-linkedin-thumbnail.png");
  fs.copyFileSync(stills.thumbnail.file, thumb);
  for (const f of [out, hd, thumb]) console.log(`${path.relative(root, f)}  ${(fs.statSync(f).size / 1e6).toFixed(1)} MB`);
}
