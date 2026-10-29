// Records a Playwright page as timestamped frames and encodes them with ffmpeg.
// Two ways to capture:
// - "capture": full-resolution screenshots in a loop, at the page's device
//   scale (crisp phone video at 2x; ~15–20 fps).
// - "screencast": Chrome's screencast — smooth (up to 60 fps) but at CSS-pixel
//   size, for desktop viewports that don't need a device scale.
// Playwright's own recordVideo can't do either: it captures at CSS pixels and
// pads a larger frame instead of scaling.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Opens the app inside an iframe of `width`×`height` CSS pixels, scaled by
 * `scale` in a page of the scaled size. Chrome re-rasterises scaled content, so
 * a screencast of the page is crisp at the scaled resolution and smooth — the
 * way to record a 390-pixel phone layout at 780×1688. The wrapper is served
 * from the app's own origin so cookies stay first-party.
 */
export async function openScaled(ctx, base, { width, height, scale }) {
  const page = await ctx.newPage();
  const wrapper = `${base}/__recorder`;
  await page.route(wrapper, (r) =>
    r.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><body style="margin:0;overflow:hidden;background:#000"><iframe name="app" src="about:blank" style="width:${width}px;height:${height}px;border:0;display:block;transform:scale(${scale});transform-origin:0 0"></iframe></body></html>`,
    }),
  );
  await page.goto(wrapper);
  const app = page.frame({ name: "app" });
  return { page, app, at: (x, y) => [x * scale, y * scale] };
}

export async function startRecording(ctx, page, { dir, mode = "capture", width, height, scale = 1, quality = 88 }) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const cdp = await ctx.newCDPSession(page);
  const frames = [];
  const marks = {};
  let n = 0;
  const save = (data, t) => {
    const file = path.join(dir, `${String(n++).padStart(6, "0")}.jpg`);
    fs.writeFileSync(file, Buffer.from(data, "base64"));
    frames.push({ file, t });
  };
  let running = true;
  let loop = Promise.resolve();
  // Paused around full-page navigations: a screenshot in flight while the
  // document swaps can hang. The paused time is cut from the video.
  let paused = false;
  let pausedAt = 0;
  let cut = 0;
  let inflight = Promise.resolve();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const timeout = (p, ms) => Promise.race([p, sleep(ms).then(() => Promise.reject(new Error("capture timed out")))]);
  if (mode === "capture") {
    const once = async () => {
      const t = Date.now() / 1000 - cut;
      try {
        // Clips are in document coordinates: follow the visual viewport as it scrolls.
        const { cssVisualViewport: v } = await timeout(cdp.send("Page.getLayoutMetrics"), 2000);
        const { data } = await timeout(
          cdp.send("Page.captureScreenshot", {
            format: "jpeg",
            quality,
            optimizeForSpeed: true,
            clip: { x: v.pageX, y: v.pageY, width: v.clientWidth, height: v.clientHeight, scale },
          }),
          3000,
        );
        if (!paused) save(data, t);
      } catch {
        await sleep(30);
      }
    };
    loop = (async () => {
      while (running) {
        if (paused) {
          await sleep(20);
          continue;
        }
        inflight = once();
        await inflight;
      }
    })();
  } else {
    cdp.on("Page.screencastFrame", (f) => {
      save(f.data, f.metadata.timestamp ?? Date.now() / 1000);
      cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
    });
    await cdp.send("Page.startScreencast", { format: "jpeg", quality, maxWidth: width, maxHeight: height, everyNthFrame: 1 });
  }
  const t0 = Date.now() / 1000;
  return {
    /** Remember "now" under a name (seconds into the video, once stopped). */
    mark: (name) => (marks[name] = Date.now() / 1000 - cut),
    /** Stop capturing (and wait for the frame in flight) — e.g. before page.goto. */
    async pause() {
      paused = true;
      pausedAt = Date.now() / 1000;
      await inflight;
    },
    /** Carry on; the paused stretch is left out of the video. */
    resume() {
      if (!paused) return;
      cut += Date.now() / 1000 - pausedAt;
      paused = false;
    },
    /** page.goto with capturing paused across the navigation. */
    async goto(page, url, opts = { waitUntil: "networkidle" }) {
      await this.pause();
      try {
        await page.goto(url, opts);
        await page.waitForTimeout(250);
      } finally {
        this.resume();
      }
    },
    async stop() {
      running = false;
      await loop;
      if (mode !== "capture") await cdp.send("Page.stopScreencast").catch(() => {});
      const sorted = [...frames].sort((a, b) => a.t - b.t);
      const start = sorted[0]?.t ?? t0;
      return { frames: sorted, marks: Object.fromEntries(Object.entries(marks).map(([k, v]) => [k, v - start])), duration: (sorted.at(-1)?.t ?? start) - start };
    },
  };
}

const x264 = new Map();
/**
 * The video encoder's arguments: H.264 (libx264) at `crf`. A draft only has to
 * play, so with an ffmpeg built without libx264 it falls back to the built-in
 * MPEG-4 encoder; a final render needs libx264 and says so.
 */
export function codecArgs(ffmpeg, { crf, preset = "slow", profile, draft = false }) {
  if (!x264.has(ffmpeg)) x264.set(ffmpeg, /\blibx264\b/.test(execFileSync(ffmpeg, ["-hide_banner", "-encoders"]).toString()));
  if (x264.get(ffmpeg)) return ["-c:v", "libx264", ...(profile ? ["-profile:v", profile] : []), "-preset", draft ? "veryfast" : preset, "-crf", String(crf)];
  if (draft) return ["-c:v", "mpeg4", "-q:v", "4"];
  throw new Error(`${ffmpeg} has no libx264 — final renders need an ffmpeg built with it (DRAFT=1 falls back to MPEG-4)`);
}

/** Frames (with their real timings) → MP4. `vf` is extra filters, e.g. a scale. */
export function encodeMp4({ ffmpeg, frames, out, fps = 30, vf = "", crf = 22, draft = false }) {
  const list = path.join(path.dirname(frames[0].file), "frames.txt");
  const lines = [];
  for (const [i, f] of frames.entries()) {
    const next = frames[i + 1]?.t ?? f.t + 1.5;
    lines.push(`file '${f.file.replace(/\\/g, "/")}'`, `duration ${Math.max(0.001, next - f.t).toFixed(4)}`);
  }
  lines.push(`file '${frames.at(-1).file.replace(/\\/g, "/")}'`);
  fs.writeFileSync(list, `${lines.join("\n")}\n`);
  const filters = [`fps=${fps}`, vf, "format=yuv420p"].filter(Boolean).join(",");
  execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-vf", filters, ...codecArgs(ffmpeg, { crf, draft }), "-movflags", "+faststart", "-an", out]);
}

/** A slice of an MP4 → a sharp, compact GIF (two-pass palette). */
export function encodeGif({ ffmpeg, from, out, start, duration, width, fps = 12, colors = 160 }) {
  execFileSync(ffmpeg, [
    "-y", "-loglevel", "error", "-ss", start.toFixed(2), "-t", duration.toFixed(2), "-i", from,
    "-vf", `fps=${fps},scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=${colors}:stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a`,
    out,
  ]);
}
