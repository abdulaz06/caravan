// Frame-exact capture for Playwright: genuine 60 fps at any resolution.
// Headless Chromium runs under BeginFrame control on a virtual clock, so the
// page renders only when told to and its time (performance.now, timers, rAF,
// CSS and Framer Motion animations) moves exactly 1/60 s per frame. Every
// recorded frame is a fresh render at an exact time, however long the
// screenshot takes — no dropped or duplicated frames, nothing tied to the
// screen this runs on. Loads finish "between frames": the clock waits while a
// network fetch is pending, so the video never shows a loading flash.
// Needs Playwright's headless shell (the default for headless: true).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const FLAGS = [
  "--enable-begin-frame-control",
  "--run-all-compositor-stages-before-draw",
  "--disable-new-content-rendering-timeout",
  "--disable-threaded-animation",
  "--disable-threaded-scrolling",
  "--disable-checker-imaging",
  "--disable-image-animation-resync",
  "--hide-scrollbars",
];

/** A headless page that paints only when the clock issues a frame. */
export async function launchFramePage({ width, height, permissions = [], origin }) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "caravan-capture-"));
  const ctx = await chromium.launchPersistentContext(profile, { headless: true, viewport: { width, height }, args: FLAGS });
  if (permissions.length) await ctx.grantPermissions(permissions, { origin });
  // BeginFrame control is per target and only at creation, so make the page ourselves.
  const blank = ctx.pages()[0];
  const opened = ctx.waitForEvent("page");
  await (await ctx.newCDPSession(blank)).send("Target.createTarget", { url: "about:blank", enableBeginFrameControl: true });
  const page = await opened;
  await blank.close();
  const cdp = await ctx.newCDPSession(page);
  return {
    ctx,
    page,
    cdp,
    async close() {
      await ctx.close();
      fs.rmSync(profile, { recursive: true, force: true });
    },
  };
}

/**
 * Starts the page's clock: one frame per tick, forever, until stop(). Frames
 * are saved (JPEG) only while recording; paused, the page still runs — for
 * navigations and set-up off camera — just quicker, without screenshots.
 */
export async function startClock(cdp, { dir, fps = 60, quality = 92, log = console.log }) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const dt = 1000 / fps;
  const { virtualTimeTicksBase: base } = await cdp.send("Emulation.setVirtualTimePolicy", { policy: "pause" });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  let expire = null;
  cdp.on("Emulation.virtualTimeBudgetExpired", () => {
    const done = expire;
    expire = null;
    done?.();
  });
  const grant = (policy) => {
    const p = new Promise((r) => (expire = r));
    cdp.send("Emulation.setVirtualTimePolicy", { policy, budget: dt }).catch(() => {});
    return p;
  };
  // Time stands still while a fetch is in flight; a fetch that never ends (a
  // stream, say) would stall it, so after a few seconds time moves on anyway.
  let stalls = 0;
  async function tickTime() {
    const ok = await Promise.race([grant("pauseIfNetworkFetchesPending").then(() => true), sleep(4000).then(() => false)]);
    if (!ok) {
      stalls++;
      at("time (advance)");
      await Promise.race([grant("advance"), sleep(4000)]);
    }
  }

  const frames = [];
  // Per recorded frame: was a scripted movement (camera, scroll, cursor, fade) under way?
  const moving = [];
  const marks = {};
  const stills = {};
  const hooks = new Set();
  const late = new Set();
  let waiters = [];
  let ticks = 0;
  let vt = 0;
  let recording = false;
  let running = true;
  let still = null;
  let last = null;
  let tweening = 0;
  let n = 0;

  // Says so if a frame ever hangs (and at which step).
  let phase = "";
  let since = Date.now();
  const at = (p) => {
    phase = p;
    since = Date.now();
  };
  const watchdog = setInterval(() => {
    if (running && Date.now() - since > 8000) {
      log(`frame ${ticks} stuck in ${phase} for ${((Date.now() - since) / 1000).toFixed(0)} s`);
      since = Date.now();
    }
  }, 1000);

  const loop = (async () => {
    while (running) {
      for (const h of [...hooks, ...late]) {
        at(`hook ${h.toString().replace(/\s+/g, " ").slice(0, 140)}`);
        await h();
      }
      at("time");
      await tickTime();
      vt += dt;
      const shoot = recording;
      const png = shoot && still;
      at("beginFrame");
      const r = await cdp.send("HeadlessExperimental.beginFrame", {
        frameTimeTicks: base + vt,
        interval: dt,
        ...(shoot ? { screenshot: png ? { format: "png" } : { format: "jpeg", quality } } : {}),
      });
      ticks++;
      if (shoot) {
        if (r.screenshotData) {
          const buf = Buffer.from(r.screenshotData, "base64");
          if (png) {
            const file = path.join(dir, `${still}.png`);
            fs.writeFileSync(file, buf);
            stills[still] = { file, frame: frames.length };
            still = null;
            last = { png: file };
          } else {
            last = path.join(dir, `${String(n++).padStart(6, "0")}.jpg`);
            fs.writeFileSync(last, buf);
          }
        }
        // No screenshot means nothing changed: the previous frame, again.
        if (last) {
          frames.push(last);
          moving.push(tweening > 0);
        }
      }
      const due = waiters.filter((w) => ticks >= w.at);
      waiters = waiters.filter((w) => ticks < w.at);
      for (const w of due) w.resolve();
    }
  })();

  const clock = {
    fps,
    dt,
    /** Virtual milliseconds since the clock started. */
    get now() {
      return vt;
    },
    get recording() {
      return recording;
    },
    /** Frames recorded so far (the index the next one will have). */
    get length() {
      return frames.length;
    },
    /** The last recorded frame's file. */
    get lastFrame() {
      return frames.at(-1) ?? null;
    },
    /** Resolves after `count` more frames. */
    frames(count = 1) {
      return new Promise((resolve) => waiters.push({ at: ticks + Math.max(1, Math.round(count)), resolve }));
    },
    /** Resolves after `ms` of page time. */
    wait(ms) {
      return clock.frames(ms / dt);
    },
    /**
     * Runs `fn` before every frame until the returned function is called;
     * `last` hooks run after the others (and after this frame's tween steps).
     */
    every(fn, { last = false } = {}) {
      const set = last ? late : hooks;
      set.add(fn);
      return () => set.delete(fn);
    },
    /** Calls fn(t) before each of the next `ms` of frames, t easing from 0 to 1. */
    tween(ms, fn, ease = easeInOut) {
      const count = Math.max(1, Math.round(ms / dt));
      let k = 0;
      tweening++;
      return new Promise((resolve) => {
        const hook = async () => {
          k++;
          await fn(ease(Math.min(1, k / count)));
          if (k >= count) {
            hooks.delete(hook);
            tweening--;
            clock.frames(1).then(resolve);
          }
        };
        hooks.add(hook);
      });
    },
    record() {
      recording = true;
    },
    pause() {
      recording = false;
      return clock.frames(1);
    },
    /** Names the next recorded frame. */
    mark(name) {
      marks[name] = frames.length;
    },
    /** Saves the next recorded frame as a lossless PNG too (a thumbnail). */
    still(name) {
      still = name;
      return clock.frames(2);
    },
    async stop() {
      running = false;
      await loop;
      clearInterval(watchdog);
      // PNG stills stand in the sequence as JPEGs, like every other frame.
      for (const [i, f] of frames.entries()) {
        if (typeof f === "object") frames[i] = f.jpg ??= await toJpeg(f.png, quality);
      }
      if (stalls) log(`network never settled ${stalls}× — time moved on regardless`);
      return { frames, moving, marks, stills, fps };
    },
  };
  return clock;
}

async function toJpeg(png, quality) {
  const { default: sharp } = await import("sharp");
  const out = png.replace(/\.png$/, ".jpg");
  await sharp(png).jpeg({ quality, chromaSubsampling: "4:2:0" }).toFile(out);
  return out;
}

// Sine rather than cubic: its last steps are still a visible fraction of a
// pixel's worth, so a glide doesn't trail off into near-identical frames.
export const easeInOut = (t) => (1 - Math.cos(Math.PI * t)) / 2;
export const easeOut = (t) => 1 - (1 - t) ** 3;
export const linear = (t) => t;

/**
 * Frames in order → a constant-frame-rate H.264 MP4 (High profile, yuv420p,
 * faststart). Frames are hard-linked into a numbered sequence first, so a
 * frame repeated in a hold costs nothing. `size` ("1920:1080") downscales.
 */
export function encodeFrames({ ffmpeg, frames, out, fps = 60, crf = 16, size, work }) {
  fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });
  for (const [i, f] of frames.entries()) {
    const to = path.join(work, `${String(i).padStart(6, "0")}.jpg`);
    try {
      fs.linkSync(f, to);
    } catch {
      fs.copyFileSync(f, to);
    }
  }
  // JPEG frames are full-range BT.601; web video is limited-range BT.709.
  const scale = `scale=${size ? `${size}:flags=lanczos:` : ""}in_range=pc:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709`;
  execFileSync(ffmpeg, [
    "-y", "-loglevel", "error", "-framerate", String(fps), "-i", path.join(work, "%06d.jpg"),
    "-vf", `${scale},format=yuv420p,setparams=range=tv:colorspace=bt709:color_primaries=bt709:color_trc=bt709`,
    "-c:v", "libx264", "-profile:v", "high", "-preset", "slow", "-crf", String(crf),
    "-r", String(fps), "-fps_mode", "cfr", "-movflags", "+faststart", "-an", out,
  ]);
  fs.rmSync(work, { recursive: true, force: true });
}
