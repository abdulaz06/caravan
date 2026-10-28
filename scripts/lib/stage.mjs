// The "stage" for a filmed walkthrough: the app in an iframe (a width×height
// layout, scaled into a crisp frame — see openScaled in recorder.mjs), with a
// camera (zoom/pan by transform: Chrome re-rasterises, so zoomed text stays
// sharp), a drawn cursor, captions and title overlays in Caravan's own fonts,
// and crossfade cuts that hide navigations. Every movement is tweened frame by
// frame on a clock from frame-capture.mjs.
import fs from "node:fs";
import { easeInOut, easeOut } from "./frame-capture.mjs";

// The mark from src/lib/brand.ts (dark backgrounds): three discs on a rising line.
const MARK = [
  [9.5, 20, "#e4825f"],
  [16, 16, "#e2bb6e"],
  [22.5, 12, "#b9c7de"],
];
export const markSvg = (size) =>
  `<svg viewBox="0 0 32 32" width="${size}" height="${size}" aria-hidden="true">${MARK.map(([cx, cy, c]) => `<circle cx="${cx}" cy="${cy}" r="7.2" fill="${c}" fill-opacity=".95"/>`).join("")}</svg>`;

const CURSOR = `<svg viewBox="0 0 24 24" width="24" height="24"><path d="M5 2.5v17.2l4.3-4.1 2.9 6.6 2.9-1.3-2.9-6.5h6z" fill="#fff" stroke="#0b1220" stroke-width="1.4" stroke-linejoin="round"/></svg>`;

const page = ({ width: W, height: H, scale: S }) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Fraunces; font-weight: 600; src: url(/fonts/share/fraunces-600.woff2) format("woff2"); }
@font-face { font-family: Fraunces; font-weight: 600; font-style: italic; src: url(/fonts/share/fraunces-600-italic.woff2) format("woff2"); }
@font-face { font-family: Instrument; font-weight: 500; src: url(/fonts/share/instrument-500.woff2) format("woff2"); }
@font-face { font-family: Instrument; font-weight: 600; src: url(/fonts/share/instrument-600.woff2) format("woff2"); }
@font-face { font-family: Instrument; font-weight: 700; src: url(/fonts/share/instrument-700.woff2) format("woff2"); }
* { box-sizing: border-box; margin: 0; }
html, body { width: ${W * S}px; height: ${H * S}px; overflow: hidden; background: #0b1220; }
#cam { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; transform-origin: 0 0; transform: scale(${S}); }
#cam iframe { width: ${W}px; height: ${H}px; border: 0; display: block; background: #f6efe4; }
#freeze { position: absolute; inset: 0; opacity: 0; pointer-events: none; }
#freeze img { width: 100%; height: 100%; display: block; }
/* Everything drawn over the app, laid out in the app's ${W}×${H} units. */
#hud { position: absolute; left: 0; top: 0; width: ${W}px; height: ${H}px; transform-origin: 0 0; transform: scale(${S}); pointer-events: none;
  font-family: Instrument, system-ui, sans-serif; color: #fffdf9; -webkit-font-smoothing: antialiased; }
.fade { opacity: 0; transition: opacity .32s ease, transform .42s cubic-bezier(.2,.8,.2,1); }
.fade.on { opacity: 1; transform: none; }
/* Darkens (and softens) the photo left of a trip's column, for side captions; it ends where the column begins. */
#scrim { --edge: 470px; position: absolute; inset: 0;
  background: linear-gradient(90deg, rgba(8,13,24,.86) 0, rgba(8,13,24,.8) calc(var(--edge) - 130px), rgba(8,13,24,.36) calc(var(--edge) - 50px), rgba(8,13,24,0) calc(var(--edge) - 2px));
  backdrop-filter: blur(9px);
  -webkit-mask-image: linear-gradient(90deg, #000 0, #000 calc(var(--edge) - 90px), transparent calc(var(--edge) - 2px));
  mask-image: linear-gradient(90deg, #000 0, #000 calc(var(--edge) - 90px), transparent calc(var(--edge) - 2px)); }
#hook-lock { position: absolute; left: 34px; top: 28px; display: flex; align-items: center; gap: 8px; font: italic 600 24px/1 Fraunces; letter-spacing: -.02em; transform: translateY(-6px); }
#hook { position: absolute; left: 34px; top: 0; bottom: 0; width: 400px; display: flex; flex-direction: column; justify-content: center; gap: 10px; }
#hook p { font: 600 40px/1.06 Fraunces; letter-spacing: -.025em; transform: translateY(14px); }
#hook p.em { font-style: italic; color: #e2bb6e; }
#tag { position: absolute; left: 22px; top: 20px; display: inline-flex; align-items: center; gap: 7px; padding: 6px 12px 6px 10px; border-radius: 999px;
  background: rgba(11,18,32,.62); box-shadow: inset 0 0 0 1px rgba(255,253,249,.18); font: 600 13px/1 Instrument; letter-spacing: .01em; transform: translateY(-4px); }
#tag.low { top: auto; bottom: 22px; left: 34px; }
#tag.aside { left: 300px; }
#tag i { width: 7px; height: 7px; border-radius: 50%; background: #e2bb6e; }
#cap { position: absolute; bottom: 24px; left: 32px; max-width: 560px; padding: 11px 20px 12px; border-radius: 20px; background: rgba(11,18,32,.92);
  box-shadow: 0 16px 36px -14px rgba(0,0,0,.6), inset 0 0 0 1px rgba(255,253,249,.08); font: 600 25px/1.15 Instrument; letter-spacing: -.015em; transform: translateY(10px); white-space: nowrap; }
#cap.center { left: 50%; translate: -50% 0; max-width: 900px; text-align: center; }
#cap.top { top: 22px; bottom: auto; transform: translateY(-10px); }
#cap.on { transform: none; }
/* Side captions: large, on the darkened photo left of a trip's column. */
#side { position: absolute; left: 34px; bottom: 48px; width: 370px; font: 600 35px/1.08 Fraunces; letter-spacing: -.025em; transform: translateY(12px);
  text-shadow: 0 2px 20px rgba(0,0,0,.35); }
#side em { font-style: italic; color: #e2bb6e; }
#cap b { color: #e2bb6e; font-weight: 700; }
#cursor { position: absolute; left: 0; top: 0; width: 24px; height: 24px; opacity: 0; filter: drop-shadow(0 2px 3px rgba(0,0,0,.35)); }
#cursor svg { display: block; transition: transform .09s ease; transform-origin: 5px 3px; }
#cursor.down svg { transform: scale(.86); }
#ring { position: absolute; left: 0; top: 0; width: 34px; height: 34px; margin: -17px 0 0 -17px; border-radius: 50%; border: 2.5px solid rgba(255,253,249,.95);
  box-shadow: 0 0 0 1.5px rgba(11,18,32,.35); opacity: 0; }
#ring.go { animation: ring .45s cubic-bezier(.2,.8,.2,1); }
@keyframes ring { from { opacity: .95; transform: scale(.35); } to { opacity: 0; transform: scale(1.35); } }
#card { position: absolute; inset: 0; background: #0b1220; overflow: hidden; display: grid; place-items: center; text-align: center; transition: opacity .3s ease; }
#card .glow { position: absolute; border-radius: 50%; filter: blur(70px); }
#card .in { position: relative; transform: translateY(10px); transition: opacity .5s ease, transform .7s cubic-bezier(.2,.8,.2,1); opacity: 0; }
#card.on .in { opacity: 1; transform: none; }
#card .lock { display: inline-flex; align-items: center; gap: 12px; font: italic 600 62px/1 Fraunces; letter-spacing: -.03em; }
#card h1 { margin-top: 18px; font: 600 36px/1.1 Fraunces; letter-spacing: -.025em; color: rgba(255,253,249,.92); }
#card h1 em { color: #e2bb6e; }
#card .url { display: inline-block; margin-top: 28px; padding: 11px 22px; border-radius: 999px; background: #c95c3c; font: 700 19px/1 Instrument; letter-spacing: .005em; }
#black { position: absolute; inset: 0; background: #05080f; opacity: 0; transition: opacity .4s ease; }
#black.on { opacity: 1; }
</style></head><body>
<div id="cam"><iframe name="app" src="about:blank"></iframe></div>
<div id="freeze"></div>
<div id="hud">
  <div id="scrim" class="fade"></div>
  <div id="hook-lock" class="fade">${markSvg(30)}Caravan</div>
  <div id="hook"><p class="fade" id="hook1"></p><p class="fade em" id="hook2"></p></div>
  <div id="tag" class="fade"><i></i>Demo · fictional travellers</div>
  <div id="cap" class="fade"></div>
  <div id="side" class="fade"></div>
  <div id="card" class="fade">
    <div class="glow" style="left:-80px;top:-70px;width:300px;height:300px;background:rgba(201,92,60,.42)"></div>
    <div class="glow" style="right:-100px;top:190px;width:340px;height:340px;background:rgba(212,162,74,.3)"></div>
    <div class="glow" style="left:300px;bottom:-210px;width:330px;height:330px;background:rgba(62,86,128,.5)"></div>
    <div class="in"><div class="lock">${markSvg(58)}Caravan</div><h1>Plan the trip <em><i>together.</i></em></h1><div class="url" id="url"></div></div>
  </div>
  <div id="ring"></div>
  <div id="cursor">${CURSOR}</div>
  <div id="black"></div>
</div>
<script>
  const $ = (id) => document.getElementById(id);
  window.stage = {
    set(st) {
      if (st.cam) $("cam").style.transform = "translate(" + st.cam[0] + "px," + st.cam[1] + "px) scale(" + st.cam[2] + ")";
      // The arrow's tip is at (5, 2.5) in its box.
      if (st.cur) { $("cursor").style.transform = "translate(" + (st.cur[0] - 5) + "px," + (st.cur[1] - 2.5) + "px)"; $("cursor").style.opacity = st.cur[2]; }
      if (st.freeze !== undefined) $("freeze").style.opacity = st.freeze;
      if (st.edge !== undefined) $("scrim").style.setProperty("--edge", st.edge + "px");
      if (st.scroll !== undefined) this.scroller?.scrollTo({ top: st.scroll, behavior: "instant" });
    },
    async freeze(url) {
      const img = new Image();
      img.src = url;
      await img.decode();
      $("freeze").replaceChildren(img);
      $("freeze").style.opacity = 1;
    },
    show(id, on) { $(id).classList.toggle("on", on); },
    text(id, html) { $(id).innerHTML = html; },
    cls(id, name, on) { $(id).classList.toggle(name, on); },
    caption(html, as) {
      const el = as === "side" ? $("side") : $("cap");
      el.innerHTML = html;
      $("cap").classList.toggle("center", as === "center" || as === "top");
      $("cap").classList.toggle("top", as === "top");
      return el.id;
    },
    press(x, y, down) {
      $("cursor").classList.toggle("down", down);
      if (!down) return;
      const r = $("ring"); r.style.left = x + "px"; r.style.top = y + "px";
      r.classList.remove("go"); void r.offsetWidth; r.classList.add("go");
    },
    instant(on) { for (const el of document.querySelectorAll(".fade")) el.style.transition = on ? "none" : ""; void document.body.offsetWidth; },
  };
</script></body></html>`;

/**
 * Opens the stage in `page` (served from the app's origin, so cookies stay
 * first-party and the fonts load from /fonts/share). Returns the stage; its
 * `app` is the app's frame. The overlays are sized for a 1024×576 layout.
 */
export async function openStage(clock, pg, base, { width = 1024, height = 576, scale = 2.5 } = {}) {
  const url = `${base}/__stage`;
  await pg.route(url, (r) => r.fulfill({ contentType: "text/html", body: page({ width, height, scale }) }));
  await pg.goto(url);
  await pg.unroute(url);
  await pg.evaluate(() => Promise.all(["600 20px Fraunces", "italic 600 20px Fraunces", "500 20px Instrument", "600 20px Instrument", "700 20px Instrument"].map((f) => document.fonts.load(f))));
  const app = pg.frame({ name: "app" });
  const W = width;
  const H = height;
  const S = scale;

  // Camera: zoom z ≥ 1 around a centre (x, y) in app pixels, kept inside the frame.
  const cam = { z: 1, x: W / 2, y: H / 2 };
  const view = (c = cam) => {
    const vw = W / c.z;
    const vh = H / c.z;
    const left = Math.min(Math.max(c.x - vw / 2, 0), W - vw);
    const top = Math.min(Math.max(c.y - vh / 2, 0), H - vh);
    return { left, top, z: c.z };
  };
  // Cursor, in app pixels (it rides along with the camera).
  const cur = { x: W * 0.6, y: H * 0.7, o: 0 };
  let freeze;
  let scroll;
  let dirty = true;
  const state = () => {
    const v = view();
    return {
      cam: [-v.left * S * v.z, -v.top * S * v.z, S * v.z],
      cur: [(cur.x - v.left) * v.z, (cur.y - v.top) * v.z, cur.o],
      // Where a trip page's 480-px column starts on screen: the scrim ends there.
      edge: (W - 480 - v.left) * v.z,
      ...(freeze !== undefined ? { freeze } : {}),
      ...(scroll !== undefined ? { scroll } : {}),
    };
  };
  // Applied after this frame's tween steps, so a movement starts on the frame it's asked for.
  clock.every(
    async () => {
      if (!dirty) return;
      dirty = false;
      await pg.evaluate((st) => window.stage.set(st), state());
    },
    { last: true },
  );
  const toPage = (ax, ay) => {
    const v = view();
    return [(ax - v.left) * v.z * S, (ay - v.top) * v.z * S];
  };
  const toApp = (px, py) => {
    const v = view();
    return [v.left + px / (S * v.z), v.top + py / (S * v.z)];
  };
  let mouse = Promise.resolve();
  const moveMouse = (ax, ay) => {
    const [px, py] = toPage(ax, ay);
    mouse = mouse.then(() => pg.mouse.move(px, py)).catch(() => {});
    return mouse;
  };
  const call = (fn, ...args) => pg.evaluate(([f, a]) => window.stage[f](...a), [fn, args]);

  /** The nearest scrolling box around a locator's element (or the document). */
  async function scroller(locator) {
    if (!locator) return app.evaluateHandle(() => document.scrollingElement);
    return locator.evaluateHandle((el) => {
      for (let n = el.parentElement; n; n = n.parentElement) {
        const o = getComputedStyle(n).overflowY;
        if ((o === "auto" || o === "scroll") && n.scrollHeight > n.clientHeight + 1) return n;
      }
      return document.scrollingElement;
    });
  }

  const stage = {
    app,
    page: pg,
    clock,
    W,
    H,
    S,
    view,
    toApp,
    /** Moves (or with ms 0, sets) the camera. */
    async camera({ z = cam.z, x = cam.x, y = cam.y } = {}, ms = 0, ease = easeInOut) {
      // Tween between the clamped views so the motion never pushes against an edge.
      const a = view();
      const b = view({ z, x, y });
      const from = { z: a.z, x: a.left + W / a.z / 2, y: a.top + H / a.z / 2 };
      const to = { z: b.z, x: b.left + W / b.z / 2, y: b.top + H / b.z / 2 };
      if (!ms) {
        Object.assign(cam, to);
        dirty = true;
        return clock.frames(1);
      }
      return clock.tween(ms, (t) => {
        // Zoom in log space; pan so the view's centre moves evenly.
        cam.z = from.z * (to.z / from.z) ** t;
        cam.x = from.x + (to.x - from.x) * t;
        cam.y = from.y + (to.y - from.y) * t;
        dirty = true;
      }, ease);
    },
    /** An element's box (or several elements' together) in app pixels. */
    async box(locators) {
      const boxes = await Promise.all([locators].flat().map((l) => l.boundingBox()));
      const [x0, y0] = toApp(Math.min(...boxes.map((b) => b.x)), Math.min(...boxes.map((b) => b.y)));
      const [x1, y1] = toApp(Math.max(...boxes.map((b) => b.x + b.width)), Math.max(...boxes.map((b) => b.y + b.height)));
      return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
    },
    /** Camera on an element (or several): their centre, nudged by dx/dy app px, at zoom z. */
    async frame(locators, { z = cam.z, dx = 0, dy = 0 } = {}, ms = 0) {
      const b = await stage.box(locators);
      return stage.camera({ z, x: b.x + b.width / 2 + dx, y: b.y + b.height / 2 + dy }, ms);
    },
    cursor(show, ms = 220) {
      const o0 = cur.o;
      return clock.tween(ms, (t) => {
        cur.o = o0 + ((show ? 1 : 0) - o0) * t;
        dirty = true;
      });
    },
    /** Glides the cursor to app point (x, y), with real mouse moves for hover states. */
    async pointTo(x, y, ms = 420) {
      const x0 = cur.x;
      const y0 = cur.y;
      let k = 0;
      await clock.tween(ms, (t) => {
        cur.x = x0 + (x - x0) * t;
        cur.y = y0 + (y - y0) * t;
        if (k++ % 3 === 0) moveMouse(cur.x, cur.y);
        dirty = true;
      });
      await moveMouse(x, y);
    },
    /**
     * Where to point at an element (app pixels), once it has stopped moving
     * (a sheet may still be sliding in), is in view and isn't covered.
     */
    async target(locator, fx = 0.5, fy = 0.5) {
      await locator.waitFor({ state: "visible" });
      let prev;
      for (let tries = 0; ; tries++) {
        const b = await locator.boundingBox();
        const [x, y] = toApp(b.x + b.width * fx, b.y + b.height * fy);
        const v = view();
        const inView = x >= v.left && y >= v.top && x <= v.left + W / v.z && y <= v.top + H / v.z;
        // …and not under something else, like a sticky header.
        const onTop = await locator.evaluate((el, [fx, fy]) => {
          const r = el.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy);
          return !!hit && (el === hit || el.contains(hit));
        }, [fx, fy]);
        if (inView && onTop && prev && Math.abs(prev[0] - x) < 0.5 && Math.abs(prev[1] - y) < 0.5) return [x, y];
        if (tries > 30) throw new Error(`click target ${!inView ? "off camera" : !onTop ? "covered" : "won't settle"}: ${locator}`);
        prev = [x, y];
        await clock.wait(50);
      }
    },
    /** The cursor glides to the element (at fx/fy of its box) and clicks it. */
    async click(locator, { ms = 420, fx = 0.5, fy = 0.5, hold = 80 } = {}) {
      const [x, y] = await stage.target(locator, fx, fy);
      if (cur.o < 1) await stage.cursor(true, 160);
      await stage.pointTo(x, y, ms);
      await stage.press(hold);
    },
    async press(hold = 80) {
      const v = view();
      await call("press", (cur.x - v.left) * v.z, (cur.y - v.top) * v.z, true);
      await pg.mouse.down();
      await clock.wait(hold);
      await pg.mouse.up();
      await call("press", 0, 0, false);
    },
    /** Drags from the element to an app-pixel offset, smoothly, frame by frame. */
    async drag(locator, { dx = 0, dy = 0, ms = 900, settle = 250 } = {}) {
      const [x, y] = await stage.target(locator);
      if (cur.o < 1) await stage.cursor(true, 160);
      await stage.pointTo(x, y, 380);
      const v = view();
      await call("press", (cur.x - v.left) * v.z, (cur.y - v.top) * v.z, true);
      await pg.mouse.down();
      await clock.wait(90);
      await clock.tween(ms, (t) => {
        cur.x = x + dx * t;
        cur.y = y + dy * t;
        // A move every frame: drag-and-drop follows the pointer.
        moveMouse(cur.x, cur.y);
        dirty = true;
      });
      await mouse;
      await clock.wait(settle);
      await pg.mouse.up();
      await call("press", 0, 0, false);
    },
    /** Types into the focused field, a key every `each` ms of page time. */
    async type(text, each = 55) {
      for (const ch of text) {
        await pg.keyboard.press(ch);
        await clock.wait(each);
      }
    },
    /** Scrolls the element's scroller (or the page) so the element's top sits `top` px below the scroller's top. */
    async scrollTo(locator, { top = 90, ms = 700, within } = {}) {
      const box = await scroller(within ?? locator);
      const [from, to] = await box.evaluate(
        (el, [target, top]) => {
          const doc = el === document.scrollingElement;
          const r0 = doc ? 0 : el.getBoundingClientRect().top;
          const r = target.getBoundingClientRect().top - r0;
          const max = el.scrollHeight - el.clientHeight;
          return [el.scrollTop, Math.max(0, Math.min(max, el.scrollTop + r - top))];
        },
        [await locator.elementHandle(), top],
      );
      return stage.scrollBox(box, from, to, ms);
    },
    async scrollBy(dy, { ms = 700, within } = {}) {
      const box = await scroller(within);
      const [from, to] = await box.evaluate((el, dy) => [el.scrollTop, Math.max(0, Math.min(el.scrollHeight - el.clientHeight, el.scrollTop + dy))], dy);
      return stage.scrollBox(box, from, to, ms);
    },
    async scrollBox(box, from, to, ms) {
      if (!ms || from === to) return box.evaluate((el, top) => el.scrollTo({ top, behavior: "instant" }), to);
      // Scrolled from the stage page, frame by frame: a call into the app's own
      // frame from inside a frame can wait on page time, which stands still.
      await box.evaluate((el) => (window.parent.stage.scroller = el));
      await clock.tween(ms, (t) => {
        scroll = from + (to - from) * t;
        dirty = true;
      });
      scroll = undefined;
    },
    /**
     * A caption (null hides it): "side" (large, over the darkened photo left
     * of a trip's column — show the scrim with it), or a pill at the bottom
     * left, bottom "center" or "top" centre.
     */
    async caption(html, { as = "side" } = {}) {
      await call("show", "cap", false);
      await call("show", "side", false);
      if (html === null) return;
      await clock.wait(stage.captioned ? 300 : 0);
      const id = await call("caption", html, as);
      await call("show", id, true);
      stage.captioned = true;
    },
    captioned: false,
    show: (id, on = true) => call("show", id, on),
    text: (id, html) => call("text", id, html),
    cls: (id, name, on = true) => call("cls", id, name, on),
    /** Overlays snap rather than fade (for set-up while paused). */
    instant: (on) => call("instant", on),
    /**
     * A crossfade cut: the screen freezes (on `from`, a frame file, or the last
     * frame), recording pauses while `fn` changes things off camera, then the
     * frozen frame fades away over the new scene.
     */
    async cut(fn, { from, fade = 300, settle = 500, keepCaption = false } = {}) {
      const src = from ?? clock.lastFrame;
      const file = typeof src === "object" ? src.png : src;
      const type = file.endsWith(".png") ? "png" : "jpeg";
      await clock.pause();
      await pg.evaluate((u) => window.stage.freeze(u), `data:image/${type};base64,${fs.readFileSync(file).toString("base64")}`);
      freeze = 1;
      await stage.instant(true);
      // A caption that carries on sits exactly over its frozen self, so it doesn't blink.
      if (!keepCaption) {
        await call("show", "cap", false);
        await call("show", "side", false);
        stage.captioned = false;
      }
      cur.o = 0;
      dirty = true;
      await stage.instant(false);
      try {
        await fn();
      } catch (err) {
        // Film what went wrong: it's the last frame on disk.
        freeze = 0;
        dirty = true;
        clock.record();
        await clock.frames(2);
        throw err;
      }
      await clock.wait(settle);
      // Recording resumes on the fade's first step, so no frame repeats the freeze.
      await clock.tween(fade, (t) => {
        clock.record();
        freeze = 1 - t;
        dirty = true;
      }, easeOut);
      freeze = undefined;
    },
    /** Navigates the app frame and waits until it's settled. */
    async goto(url) {
      await app.goto(url, { waitUntil: "networkidle" });
      await app.evaluate(() => document.fonts.ready);
    },
  };
  return stage;
}
