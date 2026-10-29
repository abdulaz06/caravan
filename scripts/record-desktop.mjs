// Records Caravan's 16:9 desktop walkthrough (1920×1080) for LinkedIn and the
// README: a title card, the product with short captions (feeds autoplay
// muted), and an end card with the link.
//   public/case-study/walkthrough.mp4   (played on /case-study; linked from the README)
// Needs a local server on the local store and ffmpeg (on PATH, or FFMPEG=…).
// Usage: node scripts/record-desktop.mjs   (env: BASE, FFMPEG, DRAFT=1 for a quick 1600×900 check that
// lands in out/draft/ and leaves the committed video alone)
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { encodeMp4, openScaled, startRecording } from "./lib/recorder.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..");
const base = process.env.BASE ?? "http://localhost:3100";
if (!/localhost|127\.0\.0\.1/.test(base)) throw new Error("record against a local server only");
const ffmpeg = process.env.FFMPEG ?? "ffmpeg";
const LIVE = "caravan-prod.vercel.app";
const W = 1600;
const H = 900;

const draft = process.env.DRAFT === "1";
const S = draft ? 1 : 1.2; // 1600×900 layout, scaled into a crisp 1920×1080 frame (see openScaled)

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W * S, height: H * S } });
const { page, app } = await openScaled(ctx, base, { width: W, height: H, scale: S });
const go = (url) => app.goto(url, { waitUntil: "networkidle" });
const wait = (ms) => page.waitForTimeout(ms);
const pointAt = (x, y) => page.mouse.move(x * S, y * S);
const scroll = async (dy, steps = 10) => {
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, (dy * S) / steps);
    await wait(45);
  }
};

/** A caption pill at the bottom of the frame (re-added after every navigation). */
async function caption(text) {
  await app.evaluate((t) => {
    let el = document.getElementById("rec-caption");
    if (!el) {
      el = document.createElement("div");
      el.id = "rec-caption";
      Object.assign(el.style, {
        position: "fixed", left: "50%", bottom: "44px", transform: "translateX(-50%)", zIndex: "2147483647",
        background: "rgba(11,18,32,0.9)", color: "#fffdf9", font: "600 27px/1.2 'Instrument Sans', var(--font-instrument), system-ui, sans-serif",
        letterSpacing: "-0.01em", padding: "15px 28px", borderRadius: "999px", boxShadow: "0 18px 40px -12px rgba(0,0,0,0.55)",
        transition: "opacity .35s ease, transform .35s ease", opacity: "0", pointerEvents: "none", whiteSpace: "nowrap",
      });
      document.body.appendChild(el);
    }
    el.textContent = t;
    requestAnimationFrame(() => {
      el.style.opacity = "1";
    });
  }, text);
}

const mark = `<svg viewBox="0 0 32 32" width="88" height="88"><circle cx="9.5" cy="20" r="7.2" fill="#e4825f" fill-opacity=".95"/><circle cx="16" cy="16" r="7.2" fill="#e2bb6e" fill-opacity=".95"/><circle cx="22.5" cy="12" r="7.2" fill="#b9c7de" fill-opacity=".95"/></svg>`;
const card = (body) => `<!doctype html><html><head>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT,WONK@0,9..144,600,100,1;1,9..144,600,100,1&family=Instrument+Sans:wght@500;600;700&display=block" rel="stylesheet">
<style>
  * { margin: 0; box-sizing: border-box; }
  body { width: ${W}px; height: ${H}px; overflow: hidden; background: #0b1220; color: #fffdf9; font-family: 'Instrument Sans', sans-serif; display: grid; place-items: center; text-align: center; }
  .glow { position: absolute; border-radius: 50%; filter: blur(110px); }
  .wrap { position: relative; animation: rise .9s cubic-bezier(.2,.8,.2,1) both; }
  .lock { display: inline-flex; align-items: center; gap: 22px; font-family: 'Fraunces'; font-style: italic; font-weight: 600; font-size: 104px; letter-spacing: -0.03em; font-variation-settings: 'SOFT' 100, 'WONK' 1; }
  h1 { font-family: 'Fraunces'; font-weight: 600; font-size: 66px; letter-spacing: -0.03em; margin-top: 34px; font-variation-settings: 'SOFT' 100, 'WONK' 1; }
  h1 em { color: #e2bb6e; }
  p { margin-top: 18px; font-size: 28px; color: rgba(255,253,249,.78); font-weight: 500; }
  .url { display: inline-block; margin-top: 40px; padding: 18px 34px; border-radius: 999px; background: #c95c3c; font-size: 30px; font-weight: 700; }
  .small { margin-top: 26px; font-size: 21px; color: rgba(255,253,249,.55); }
  @keyframes rise { from { opacity: 0; transform: translateY(24px); } }
</style></head><body>
<div class="glow" style="left:-160px;top:-120px;width:640px;height:640px;background:rgba(201,92,60,.4)"></div>
<div class="glow" style="right:-200px;top:300px;width:700px;height:700px;background:rgba(212,162,74,.3)"></div>
<div class="glow" style="left:500px;bottom:-380px;width:640px;height:640px;background:rgba(62,86,128,.5)"></div>
<div class="wrap">${body}</div></body></html>`;

async function showCard(body, ms) {
  await app.setContent(card(body), { waitUntil: "networkidle" });
  await app.evaluate(() => document.fonts.ready);
  await app.evaluate(() => {
    const w = document.querySelector(".wrap");
    w.style.animation = "none";
    void w.offsetWidth;
    w.style.animation = "";
  });
  await wait(ms);
}

// Warm the fonts before the camera rolls.
await app.setContent(card(""), { waitUntil: "networkidle" });
await pointAt(W * 0.5, H * 0.5);
const rec = await startRecording(ctx, page, { dir: path.join(root, ".data", "video", "desktop"), mode: "screencast", width: W * S, height: H * S, quality: 88 });

// Title card
await showCard(`<div class="lock">${mark}Caravan</div><h1>Plan the trip <em><i>together.</i></em></h1><p>Everyone builds their own version of the trip. You see where it overlaps.</p>`, 3400);

// The front page
await go(base);
await caption("Drop one link in the group chat");
await wait(2600);
await scroll(820);
await wait(900);
await caption("Every trip starts from a destination preset");
await scroll(1600, 16);
await wait(1600);

// Start a trip
await go(`${base}/new?preset=georgia`);
await caption("Start a trip in under a minute");
await wait(900);
await app.locator("#owner-name").pressSequentially("Maya", { delay: 100 });
await app.locator("#owner-pin").pressSequentially("4826", { delay: 120 });
await wait(400);
await app.getByRole("button", { name: /Start the trip/ }).click();
await app.getByTestId("invite-link").waitFor();
await wait(2000);

// Dates, then this or that
await app.getByRole("button", { name: /Build my version/ }).click();
await app.waitForURL(/\/trip/);
await caption("Everyone picks their dates…");
await wait(1200);
// Free dates: tap the first day, then the last.
await app.getByRole("button", { name: /^Fri 25 Dec/ }).first().click();
await wait(1100);
await app.getByRole("button", { name: /^Wed 30 Dec/ }).first().click();
await wait(1800);
await app.getByRole("button", { name: /Build days/ }).click();
await wait(900);
await caption("…then this or that, for every day and evening");
const slot = app.getByRole("button", { name: /Pick your daytime/ }).first();
await slot.scrollIntoViewIfNeeded();
await wait(500);
await slot.click();
await wait(2600);
await app.getByRole("dialog").getByRole("button", { name: /^Pick (?!Stay)/ }).first().click();
await wait(1100);
await caption("Or quick-fill it and tweak");
await pointAt(W * 0.85, H * 0.5);
await page.mouse.wheel(0, -8000);
await wait(500);
await app.getByRole("button", { name: /Quick fill/ }).click();
await app.getByRole("button", { name: /Fill the empty slots/ }).click();
await wait(1500);
await scroll(900);
await wait(1300);

// The trip poster
await go(`${app.url().split("/trip")[0]}/trip?step=review`);
await caption("A trip poster with the route map");
await pointAt(W * 0.85, H * 0.5);
await wait(1800);
await scroll(420);
await wait(2000);

// The group, on the demo trip
await go(`${base}/demo/sri-lanka`);
await app.getByRole("button", { name: /Try it as a guest/ }).click();
await app.waitForURL(/\/trip/);
await go(app.url().replace(/\/trip.*/, "/group"));
await caption("See exactly where everyone overlaps");
await pointAt(W * 0.85, H * 0.5);
await wait(1600);
await scroll(640);
await wait(1700);
await scroll(760);
await wait(2000);

// The organizer console
await go(`${base}/t/demo-sri-lanka/admin`);
await caption("An organizer console for every trip");
await wait(2400);
await scroll(520);
await wait(1400);

// Another destination, another look
await go(`${base}/t/demo-georgia`);
await caption("Every destination brings its own look");
await wait(2800);

// A past trip, as a story
await go(`${base}/past/georgia-2025/story`);
await caption("Past trips, told as stories");
await wait(2300);
for (let i = 0; i < 3; i++) {
  await page.mouse.click(W * 0.56 * S, H * 0.5 * S); // the right of the story frame: next slide
  await wait(1500);
}

// End card
await showCard(
  `<div class="lock" style="font-size:72px;gap:16px">${mark.replace(/88/g, "62")}Caravan</div><h1 style="font-size:56px">Try a demo trip, or start your own.</h1><div class="url">${LIVE}</div><p class="small">Demo trips · Case study · Past trips &nbsp;—&nbsp; designed and built by Abdul</p>`,
  3800,
);

const { frames, duration } = await rec.stop();
await browser.close();
console.log(`recorded ${duration.toFixed(1)} s, ${frames.length} frames (${(frames.length / duration).toFixed(1)} fps)`);
const out = draft ? path.join(root, "out", "draft", "walkthrough-draft.mp4") : path.join(root, "public", "case-study", "walkthrough.mp4");
fs.mkdirSync(path.dirname(out), { recursive: true });
encodeMp4({ ffmpeg, frames, out, fps: 30, crf: draft ? 28 : 21, draft });
console.log(`${path.relative(root, out)}  ${(fs.statSync(out).size / 1e6).toFixed(1)} MB`);
