// Poster-quality share images (9:16 Story and 1:1 Square), drawn straight onto
// a canvas — fonts come from the page's own (next/font) faces via the FontFace
// API, the map is Path2D from the same SVG coastline, photos are same-origin.
// Works the same on iPhone Safari and Android Chrome. Client-only.
import { formatHours, regions, type Activity, type Photo } from "@/content";
import { dayLabel } from "./dates";
import { DAY_NAMES, daysNightsLabel, nights, tripLength, type ItineraryData } from "./itinerary";
import { badgeStop, COAST_DETAIL, laneFor, onCoastRoad, onSouthCoast, placeBadge, placeLabel, routeBox, routePoints, type DayRoute, type Rect } from "./routes";
import { balanceLabel, type Balance, type Timeline } from "./timeline";
import { project } from "./map-data";

export type ShareFormat = "story" | "square";
export const SHARE_SIZES: Record<ShareFormat, [number, number]> = { story: [1080, 1920], square: [1080, 1080] };

export type ShareModel = {
  name: string;
  data: ItineraryData;
  timeline: Timeline;
  routes: DayRoute[];
  balance: Balance;
  photos: { photo: Photo; title: string }[];
};

const C = {
  ocean950: "#04242c",
  ocean900: "#06323d",
  ocean800: "#0a4351",
  ocean700: "#0d5a6b",
  paper: "#fffbf4",
  sand: "#f7eee0",
  ink: "#1d1914",
  saffron400: "#f7ba5c",
  saffron500: "#f2a33a",
  jungle: "#2b6a48",
  jungleLight: "#7cc493",
  hibiscus: "#d6467a",
  hibiscusLight: "#ef94b4",
};

// ── Fonts ─────────────────────────────────────────────────────────────

type Fonts = { display: string; body: string; stamp: string };

/**
 * Fixed-weight copies of the page fonts (scripts/make-share-fonts.py). Canvas
 * text in WebKit ignores a variable font's weight axis, so the images draw
 * with these static files; the page's own fonts stay as the fallback.
 */
const DISPLAY = "Lanks Share Display";
const SANS = "Lanks Share Sans";
const SHARE_FACES: [family: string, file: string, weight: string, style: string][] = [
  [DISPLAY, "fraunces-600", "600", "normal"],
  [DISPLAY, "fraunces-600-italic", "600", "italic"],
  [DISPLAY, "fraunces-900-italic", "900", "italic"],
  [SANS, "instrument-500", "500", "normal"],
  [SANS, "instrument-600", "600", "normal"],
  [SANS, "instrument-700", "700", "normal"],
];
let shareFaces: Promise<boolean> | null = null;

function loadShareFaces(): Promise<boolean> {
  shareFaces ??= Promise.all(
    SHARE_FACES.map(async ([family, file, weight, style]) => {
      const face = new FontFace(family, `url(/fonts/share/${file}.woff2) format("woff2")`, { weight, style });
      document.fonts.add(await face.load());
    }),
  )
    .then(() => true)
    .catch(() => {
      shareFaces = null; // try again next time
      return false;
    });
  return shareFaces;
}

async function fontFamilies(): Promise<Fonts> {
  const css = getComputedStyle(document.documentElement);
  const pick = (v: string, fallback: string) => css.getPropertyValue(v).trim() || fallback;
  const page = {
    display: pick("--font-fraunces", "Georgia, serif"),
    body: pick("--font-instrument", "system-ui, sans-serif"),
    stamp: pick("--font-rubik-dirt", "Impact, sans-serif"),
  };
  if (!(await loadShareFaces())) return page;
  return { ...page, display: `"${DISPLAY}", ${page.display}`, body: `"${SANS}", ${page.body}` };
}

async function loadFonts(f: Fonts) {
  const specs = [
    `italic 900 100px ${f.display}`,
    `italic 600 100px ${f.display}`,
    `600 100px ${f.display}`,
    `700 40px ${f.body}`,
    `600 40px ${f.body}`,
    `500 40px ${f.body}`,
    `400 40px ${f.stamp}`,
  ];
  await Promise.all(specs.map((s) => document.fonts.load(s, "Lanks 10hyaya Sri Lanka 0123456789 →·").catch(() => [])));
  await document.fonts.ready;
}

// ── Small drawing helpers ─────────────────────────────────────────────

type Ctx = CanvasRenderingContext2D;

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Ellipsize text to fit a width. */
function fit(ctx: Ctx, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/** Letter-spaced caps (canvas letterSpacing isn't everywhere yet). */
function spaced(ctx: Ctx, text: string, x: number, y: number, spacing: number) {
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
  return cx - spacing;
}

/** Shrink a font until the text fits. */
function sizeToFit(ctx: Ctx, text: string, font: (px: number) => string, start: number, max: number, min = 40) {
  let px = start;
  ctx.font = font(px);
  while (px > min && ctx.measureText(text).width > max) {
    px -= 4;
    ctx.font = font(px);
  }
  return px;
}

/** Lucide-style icons, 24×24 stroke paths. */
const ICONS: Record<string, string[]> = {
  sun: ["M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8", "M12 2v2", "M12 20v2", "m4.93 4.93 1.41 1.41", "m17.66 17.66 1.41 1.41", "M2 12h2", "M20 12h2", "m6.34 17.66-1.41 1.41", "m19.07 4.93-1.41 1.41"],
  moon: ["M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"],
  plane: ["M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"],
  leaf: ["M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z", "M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"],
  glass: ["M8 22h8", "M12 11v11", "m19 3-7 8-7-8Z"],
  van: ["M4 17h16V9l-3-4H4z", "M4 11h16", "M7 17a2 2 0 1 0 4 0", "M14 17a2 2 0 1 0 4 0"],
};

function icon(ctx: Ctx, name: keyof typeof ICONS, x: number, y: number, size: number, color: string, width = 2.2) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const d of ICONS[name]) ctx.stroke(new Path2D(d));
  ctx.restore();
}

/** The Lanks sun mark: a saffron disc with rays. */
function sunMark(ctx: Ctx, cx: number, cy: number, r: number) {
  ctx.save();
  ctx.fillStyle = C.saffron500;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = C.saffron500;
  ctx.lineCap = "round";
  ctx.lineWidth = r * 0.16;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 0.75, cy + Math.sin(a) * r * 0.75);
    ctx.lineTo(cx + Math.cos(a) * r * (i % 2 ? 0.92 : 1.02), cy + Math.sin(a) * r * (i % 2 ? 0.92 : 1.02));
    ctx.stroke();
  }
  ctx.restore();
}

/** "☀ Lanks / by [10hyaya]" — the brand lockup, light-on-dark. Returns its height. */
function lockup(ctx: Ctx, f: Fonts, x: number, y: number, scale: number) {
  const word = 92 * scale;
  sunMark(ctx, x + word * 0.42, y + word * 0.52, word * 0.42);
  ctx.fillStyle = C.paper;
  ctx.font = `italic 900 ${word}px ${f.display}`;
  ctx.textBaseline = "alphabetic";
  const wx = x + word * 0.98;
  ctx.fillText("Lanks", wx, y + word * 0.86);
  const ww = ctx.measureText("Lanks").width;
  // "by [10hyaya]" right-aligned under the wordmark like a signature
  const stampPx = 30 * scale;
  ctx.font = `400 ${stampPx}px ${f.stamp}`;
  const sw = ctx.measureText("10hyaya").width + stampPx * 0.9;
  const sh = stampPx * 1.45;
  const sx = wx + ww - sw;
  const sy = y + word * 1.02;
  ctx.font = `italic 600 ${stampPx * 0.95}px ${f.display}`;
  ctx.fillStyle = C.paper;
  ctx.globalAlpha = 0.85;
  ctx.fillText("by", sx - ctx.measureText("by").width - stampPx * 0.35, sy + sh * 0.72);
  ctx.globalAlpha = 1;
  ctx.save();
  ctx.translate(sx + sw / 2, sy + sh / 2);
  ctx.rotate((-5 * Math.PI) / 180);
  ctx.strokeStyle = C.saffron400;
  ctx.lineWidth = 2.4 * scale;
  roundRect(ctx, -sw / 2, -sh / 2, sw, sh, 6 * scale);
  ctx.stroke();
  ctx.lineWidth = 1.2 * scale;
  roundRect(ctx, -sw / 2 + 4 * scale, -sh / 2 + 4 * scale, sw - 8 * scale, sh - 8 * scale, 4 * scale);
  ctx.stroke();
  ctx.fillStyle = C.saffron400;
  ctx.font = `400 ${stampPx}px ${f.stamp}`;
  ctx.textAlign = "center";
  ctx.fillText("10hyaya", 0, stampPx * 0.36);
  ctx.restore();
  ctx.textAlign = "left";
  return word * 1.02 + sh;
}

function background(ctx: Ctx, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, w * 0.3, h);
  g.addColorStop(0, C.ocean700);
  g.addColorStop(0.45, C.ocean800);
  g.addColorStop(1, C.ocean900);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // sunburst rays from the top-right corner
  ctx.save();
  ctx.translate(w * 0.92, -h * 0.04);
  ctx.fillStyle = "rgba(255,255,255,0.035)";
  for (let i = 0; i < 18; i++) {
    const a0 = (i / 18) * Math.PI * 2;
    const a1 = a0 + Math.PI / 36;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, Math.max(w, h) * 1.6, a0, a1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // soft saffron glow
  const glow = ctx.createRadialGradient(w * 0.9, 0, 0, w * 0.9, 0, w * 0.9);
  glow.addColorStop(0, "rgba(247,186,92,0.22)");
  glow.addColorStop(1, "rgba(247,186,92,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
}

// ── The map ───────────────────────────────────────────────────────────

function drawMap(ctx: Ctx, f: Fonts, routes: DayRoute[], x: number, y: number, w: number, h: number) {
  ctx.save();
  roundRect(ctx, x, y, w, h, 34);
  ctx.clip();
  const sea = ctx.createLinearGradient(x, y, x + w, y + h);
  sea.addColorStop(0, "#0d4f60");
  sea.addColorStop(1, C.ocean950);
  ctx.fillStyle = sea;
  ctx.fillRect(x, y, w, h);

  const box = routeBox(routes, 5);
  const s = Math.min(w / box.w, h / box.h);
  const ox = x + (w - box.w * s) / 2 - box.x * s;
  const oy = y + (h - box.h * s) / 2 - box.y * s;
  const P = (lat: number, lng: number): [number, number] => {
    const [px, py] = project(lat, lng);
    return [ox + px * s, oy + py * s];
  };

  // land
  ctx.save();
  ctx.setTransform(ctx.getTransform().multiply(new DOMMatrix([s, 0, 0, s, ox, oy])));
  const land = ctx.createLinearGradient(0, box.y, 0, box.y + box.h);
  land.addColorStop(0, "#fbf3e6");
  land.addColorStop(1, "#eadbbf");
  ctx.shadowColor = "rgba(2,28,34,0.5)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = land;
  ctx.fill(new Path2D(COAST_DETAIL));
  ctx.restore();

  // routes (each day its own colour, parallel where they overlap)
  const n = routes.length;
  const lw = Math.max(5, s * 1.25);
  const lane = (lw + 1.5) / s;
  for (const [k, r] of routes.entries()) {
    const pts = routePoints(r, laneFor(k, n, lane)).map(([px, py]) => [ox + px * s, oy + py * s] as [number, number]);
    if (pts.length < 2) continue;
    const trace = () => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(0, i - 1)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(pts.length - 1, i + 2)];
        ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
      }
    };
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    trace();
    ctx.strokeStyle = "rgba(255,251,244,0.9)";
    ctx.lineWidth = lw + 5;
    ctx.stroke();
    trace();
    ctx.strokeStyle = r.color;
    ctx.lineWidth = lw;
    ctx.stroke();
  }

  // bases + stops
  const R = Math.max(9, s * 1.6);
  const seen = new Set<string>();
  for (const r of routes) {
    for (const st of r.stops) {
      const key = `${st.region}-${st.kind}`;
      if (seen.has(key) && st.kind !== "stop") continue;
      seen.add(key);
      const [px, py] = P(regions[st.region].lat, regions[st.region].lng);
      ctx.beginPath();
      ctx.arc(px, py, st.kind === "base" ? R * 1.15 : st.kind === "airport" ? R * 0.85 : R * 0.75, 0, Math.PI * 2);
      ctx.fillStyle = st.kind === "base" ? C.saffron500 : st.kind === "airport" ? C.ink : C.paper;
      ctx.fill();
      ctx.lineWidth = st.kind === "stop" ? 4 : 3.5;
      ctx.strokeStyle = st.kind === "stop" ? r.color : C.ink;
      ctx.stroke();
    }
  }

  // labels for the main places
  const labelled = new Set<string>();
  const boxes: Rect[] = [];
  // every drawn marker counts as taken space for labels and badges
  for (const r of routes) {
    for (const st of r.stops) {
      const [px, py] = P(regions[st.region].lat, regions[st.region].lng);
      boxes.push({ x: px - R, y: py - R, w: R * 2, h: R * 2 });
    }
  }
  // "Indian Ocean", set vertically in the sea off the west coast
  {
    const [, oy] = P(6.42, 79.8);
    const px = Math.max(15, Math.min(19, s * 4.6));
    ctx.save();
    ctx.font = `italic 600 ${px}px ${f.display}`;
    const tw = ctx.measureText("Indian Ocean").width + 11 * 2.5;
    const cx = x + px * 1.6;
    if (oy - tw / 2 > y + 20 && oy + tw / 2 < y + h - 20) {
      ctx.translate(cx, oy);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = "rgba(255,251,244,0.42)";
      spaced(ctx, "Indian Ocean", -tw / 2, px * 0.35, 2.5);
      boxes.push({ x: cx - px, y: oy - tw / 2, w: px * 2, h: tw });
    }
    ctx.restore();
  }
  const fontPx = Math.max(20, Math.min(30, s * 2.6));
  const frame = { x: x + 8, y: y + 8, w: w - 16, h: h - 16 };
  ctx.font = `700 ${fontPx}px ${f.body}`;
  const want = ["airport", "colombo", "galle", ...routes.flatMap((r) => r.stops.filter((x) => x.kind === "stop").map((x) => x.region))];
  for (const id of want) {
    if (labelled.has(id)) continue;
    labelled.add(id);
    const reg = regions[id as keyof typeof regions];
    const [px, py] = P(reg.lat, reg.lng);
    const text = id === "airport" ? "CMB" : reg.short;
    const own = (b: Rect) => Math.abs(b.x + b.w / 2 - px) < 1 && Math.abs(b.y + b.h / 2 - py) < 1;
    const south = onSouthCoast(id as keyof typeof regions);
    const spot = placeLabel(px, py, ctx.measureText(text).width, fontPx, R * 1.6, south, boxes.filter((b) => !own(b)), frame);
    if (!spot) continue;
    boxes.push(spot.box);
    // below a south-coast town (or left of a west-coast one) is open sea: light text on a dark halo there
    const atSea = south ? spot.side === "below" : spot.side === "left" && onCoastRoad(id as keyof typeof regions);
    ctx.lineWidth = 6;
    ctx.strokeStyle = atSea ? "rgba(4,36,44,0.85)" : C.sand;
    ctx.strokeText(text, spot.x, spot.y);
    ctx.fillStyle = atSea ? C.paper : "#3b332a";
    ctx.fillText(text, spot.x, spot.y);
  }

  // day badges at each day's furthest stop, nudged around it until they fit
  const badgeR = Math.max(17, s * 2.1);
  ctx.font = `800 ${badgeR * 1.05}px ${f.body}`;
  ctx.textAlign = "center";
  for (const r of routes) {
    const best = badgeStop(r);
    if (!best) continue;
    const [px, py] = P(regions[best.region].lat, regions[best.region].lng);
    const spot = placeBadge(px, py, badgeR, onSouthCoast(best.region), boxes, frame);
    const [bx, by] = spot ? [spot.x, spot.y] : [px, py + badgeR * 1.75];
    if (spot) boxes.push(spot.box);
    if (spot?.far) {
      // pushed further out: a little tether back to the stop
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(bx, by);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(bx, by, badgeR, 0, Math.PI * 2);
    ctx.fillStyle = r.color;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = C.paper;
    ctx.stroke();
    ctx.fillStyle = C.paper;
    ctx.fillText(String(r.index + 1), bx, by + badgeR * 0.37);
  }
  ctx.textAlign = "left";
  ctx.restore();
}

// ── Pieces ────────────────────────────────────────────────────────────

function titlesFor(t: Timeline["days"][number], slot: "day" | "night"): string {
  const items = t[slot].items;
  if (!items.length) return "";
  const first = items[0].resolved;
  const name = first.kind === "stay" ? first.stay.title : shortTitle(first.activity);
  return items.length > 1 ? `${name} +${items.length - 1}` : name;
}

/** Trim marketing subtitles: "Galle Fort: ramparts, boutiques & cafés" → "Galle Fort". */
function shortTitle(a: Activity): string {
  return a.title.replace(/^Big day trip: /, "").split(/: | — /)[0];
}

/**
 * The day-by-day list: a numbered badge in the day's map colour, "MON 28" +
 * the day's name, then its first Daytime and Evening picks (+N for more).
 * `k` scales everything (1 = Story).
 */
function dayList(ctx: Ctx, f: Fonts, m: ShareModel, x: number, y: number, w: number, rowH: number, k: number) {
  const days = m.timeline.days;
  for (const [i, t] of days.entries()) {
    const ry = y + i * rowH;
    const color = m.routes[i]?.color ?? C.saffron500;
    const br = 25 * k;
    const titleY = ry + 30 * k;
    ctx.beginPath();
    ctx.arc(x + br, titleY - 10 * k, br, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillStyle = C.paper;
    ctx.font = `800 ${br * 1.05}px ${f.body}`;
    ctx.textAlign = "center";
    ctx.fillText(String(i + 1), x + br, titleY - 10 * k + br * 0.37);
    ctx.textAlign = "left";

    const tx = x + br * 2 + 18 * k;
    const tw = w - (tx - x);
    const date = t.date ? dayLabel(t.date).split(" ").slice(0, 2).join(" ").toUpperCase() : `DAY ${i + 1}`;
    ctx.font = `700 ${19 * k}px ${f.body}`;
    ctx.fillStyle = C.saffron400;
    const dx = spaced(ctx, date, tx, titleY - 1 * k, 2 * k) + 14 * k;
    ctx.font = `700 ${29 * k}px ${f.body}`;
    ctx.fillStyle = C.paper;
    ctx.fillText(fit(ctx, DAY_NAMES[t.role], tx + tw - dx), dx, titleY);

    ctx.font = `500 ${25 * k}px ${f.body}`;
    ctx.fillStyle = "rgba(255,251,244,0.74)";
    const iconPx = 24 * k;
    const line1 = ry + 67 * k;
    const line2 = ry + 101 * k;
    const textX = tx + iconPx + 12 * k;
    if (t.role === "departure") {
      icon(ctx, "plane", tx, line1 - iconPx + 3 * k, iconPx, C.saffron400);
      ctx.fillText(fit(ctx, `Galle → CMB · ${formatHours(2.5).slice(1)} · fly home`, tx + tw - textX), textX, line1);
      continue;
    }
    icon(ctx, "sun", tx, line1 - iconPx + 3 * k, iconPx, C.saffron400);
    ctx.fillText(fit(ctx, titlesFor(t, "day") || "Free daytime", tx + tw - textX), textX, line1);
    icon(ctx, "moon", tx, line2 - iconPx + 3 * k, iconPx, C.hibiscusLight);
    ctx.fillText(fit(ctx, titlesFor(t, "night") || "Free evening", tx + tw - textX), textX, line2);
  }
}

function vibe(ctx: Ctx, f: Fonts, b: Balance, x: number, y: number, w: number, h: number, scale = 1) {
  ctx.save();
  roundRect(ctx, x, y, w, h, 32 * scale);
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 2;
  ctx.stroke();
  const label = balanceLabel(b.score);
  const pad = 34 * scale;
  ctx.fillStyle = C.saffron400;
  ctx.font = `700 ${20 * scale}px ${f.body}`;
  spaced(ctx, "YOUR VIBE", x + pad, y + pad + 16 * scale, 3 * scale);
  ctx.fillStyle = C.paper;
  ctx.font = `600 ${50 * scale}px ${f.display}`;
  ctx.fillText(fit(ctx, label.title, w - pad * 2), x + pad, y + pad + 68 * scale);

  // meter
  const my = y + h - pad - 30 * scale;
  if (my - 20 * scale - (y + pad + 108 * scale) > 18 * scale) {
    ctx.font = `500 ${24 * scale}px ${f.body}`;
    ctx.fillStyle = "rgba(255,251,244,0.72)";
    ctx.fillText(fit(ctx, label.line, w - pad * 2), x + pad, y + pad + 108 * scale);
  }
  const ml = x + pad + 40 * scale;
  const mr = x + w - pad - 40 * scale;
  const mh = 18 * scale;
  const g = ctx.createLinearGradient(ml, 0, mr, 0);
  g.addColorStop(0, C.jungle);
  g.addColorStop(0.5, C.saffron400);
  g.addColorStop(1, C.hibiscus);
  roundRect(ctx, ml, my - mh / 2, mr - ml, mh, mh / 2);
  ctx.fillStyle = g;
  ctx.fill();
  const pos = b.score === null ? 0.5 : (b.score + 2) / 4;
  const kx = ml + (mr - ml) * pos;
  ctx.beginPath();
  ctx.arc(kx, my, 20 * scale, 0, Math.PI * 2);
  ctx.fillStyle = C.ink;
  ctx.fill();
  ctx.lineWidth = 6 * scale;
  ctx.strokeStyle = C.paper;
  ctx.stroke();
  icon(ctx, "leaf", x + pad - 2 * scale, my - 15 * scale, 30 * scale, C.jungleLight);
  icon(ctx, "glass", mr + 12 * scale, my - 15 * scale, 30 * scale, C.hibiscusLight);
  ctx.font = `700 ${17 * scale}px ${f.body}`;
  ctx.fillStyle = "rgba(255,251,244,0.6)";
  spaced(ctx, "NATURE", ml, my + mh + 24 * scale, 2.5 * scale);
  let nightW = 0;
  for (const ch of "NIGHTLIFE") nightW += ctx.measureText(ch).width + 2.5 * scale;
  spaced(ctx, "NIGHTLIFE", mr - (nightW - 2.5 * scale), my + mh + 24 * scale, 2.5 * scale);
  ctx.restore();
}

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function cover(ctx: Ctx, img: HTMLImageElement, x: number, y: number, w: number, h: number, r: number) {
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const iw = img.naturalWidth * s;
  const ih = img.naturalHeight * s;
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  ctx.restore();
}

function header(ctx: Ctx, f: Fonts, m: ShareModel, x: number, y: number, w: number, scale: number) {
  const len = tripLength(m.data);
  const year = m.data.startDate?.startsWith("2027") ? "2027" : m.data.endDate?.startsWith("2027") ? "2026–27" : "2026";
  ctx.fillStyle = C.saffron400;
  ctx.font = `700 ${24 * scale}px ${f.body}`;
  spaced(ctx, `SRI LANKA · ${year}`, x, y, 4 * scale);

  const nameLine = `${m.name}'s`;
  const px = sizeToFit(ctx, nameLine, (p) => `600 ${p}px ${f.display}`, 110 * scale, w, 56 * scale);
  ctx.fillStyle = C.paper;
  ctx.fillText(nameLine, x - 4 * scale, y + px * 1.02);
  ctx.font = `italic 600 ${Math.max(px, 100 * scale)}px ${f.display}`;
  ctx.fillStyle = C.saffron400;
  const sl = y + px * 1.02 + Math.max(px, 100 * scale) * 0.98;
  ctx.fillText("Sri Lanka", x - 4 * scale, sl);

  // dates + "6 days · 5 nights" chip
  const dy = sl + 62 * scale;
  ctx.font = `600 ${32 * scale}px ${f.body}`;
  ctx.fillStyle = "rgba(255,251,244,0.85)";
  const dates = m.data.startDate && m.data.endDate ? `${dayLabel(m.data.startDate)} → ${dayLabel(m.data.endDate)}` : "";
  ctx.fillText(dates, x, dy);
  const chip = daysNightsLabel(len || 6);
  ctx.font = `700 ${27 * scale}px ${f.body}`;
  const cw = ctx.measureText(chip).width + 36 * scale;
  const ch = 50 * scale;
  const cy = dy + 26 * scale;
  roundRect(ctx, x, cy, cw, ch, ch / 2);
  ctx.fillStyle = C.saffron500;
  ctx.fill();
  ctx.fillStyle = C.ink;
  ctx.fillText(chip, x + 18 * scale, cy + ch * 0.68);
  const { colombo, galle } = nights(len || 6);
  ctx.font = `600 ${25 * scale}px ${f.body}`;
  ctx.fillStyle = "rgba(255,251,244,0.7)";
  ctx.fillText(`Colombo ${colombo} · Galle ${galle}`, x + cw + 20 * scale, cy + ch * 0.68);
  return cy + ch;
}

// ── Layouts ───────────────────────────────────────────────────────────

async function drawStory(ctx: Ctx, f: Fonts, m: ShareModel) {
  const [W, H] = SHARE_SIZES.story;
  background(ctx, W, H);
  const M = 72;
  lockup(ctx, f, M, 92, 1);
  const headerEnd = header(ctx, f, m, M, 312, W - M * 2, 1);

  // map on the left, the days beside it like a legend
  const top = headerEnd + 42;
  const mapW = 430;
  const rowH = 118;
  const listH = rowH * (m.timeline.days.length - 1) + 78;
  drawMap(ctx, f, m.routes, M, top, mapW, listH);
  dayList(ctx, f, m, M + mapW + 34, top + 2, W - M * 2 - mapW - 34, rowH, 1);

  const vibeY = top + listH + 32;
  const vibeH = 252;
  vibe(ctx, f, m.balance, M, vibeY, W - M * 2, vibeH);

  // photo strip
  const py = vibeY + vibeH + 28;
  const ph = H - py - 86;
  const imgs = (await Promise.all(m.photos.slice(0, 3).map((p) => loadImage(p.photo.src)))).filter((x): x is HTMLImageElement => !!x);
  if (imgs.length && ph > 90) {
    const gap = 20;
    const pw = (W - M * 2 - gap * (imgs.length - 1)) / imgs.length;
    imgs.forEach((img, i) => cover(ctx, img, M + i * (pw + gap), py, pw, ph, 26));
  }

  ctx.font = `600 24px ${f.body}`;
  ctx.fillStyle = "rgba(255,251,244,0.55)";
  ctx.textAlign = "center";
  ctx.fillText("Built with Lanks · the 10hyaya group trip · Dec ’26 – Jan ’27", W / 2, H - 38);
  ctx.textAlign = "left";
}

async function drawSquare(ctx: Ctx, f: Fonts, m: ShareModel) {
  const [W, H] = SHARE_SIZES.square;
  background(ctx, W, H);
  const M = 56;
  lockup(ctx, f, M, 48, 0.62);
  const leftW = 500;
  const headerEnd = header(ctx, f, m, M, 204, leftW, 0.66);
  dayList(ctx, f, m, M, headerEnd + 30, leftW, 90, 0.8);

  const mapX = M + leftW + 30;
  const mapW = W - mapX - M;
  const mapH = 716;
  drawMap(ctx, f, m.routes, mapX, M, mapW, mapH);
  vibe(ctx, f, m.balance, mapX, M + mapH + 24, mapW, H - M - (M + mapH + 24), 0.78);

  ctx.font = `600 17px ${f.body}`;
  ctx.fillStyle = "rgba(255,251,244,0.5)";
  ctx.fillText("Built with Lanks · the 10hyaya group trip", M, H - 28);
}

/** Render one share image to a PNG blob. */
export async function renderShareImage(format: ShareFormat, m: ShareModel): Promise<Blob> {
  const f = await fontFamilies();
  await loadFonts(f);
  const [W, H] = SHARE_SIZES[format];
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.textBaseline = "alphabetic";
  if (format === "story") await drawStory(ctx, f, m);
  else await drawSquare(ctx, f, m);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"));
}
