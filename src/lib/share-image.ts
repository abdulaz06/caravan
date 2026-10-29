// Poster-quality share images (9:16 Story and 1:1 Square), drawn straight onto
// a canvas — fixed-weight copies of the page fonts via the FontFace API, the
// map as Path2D from the preset's outline, same-origin photos. Colours,
// place names and copy all come from the trip's preset. Works the same on
// iPhone Safari and Android Chrome. Client-only.
import { formatHours, type Activity, type Photo } from "@/engine/catalog";
import { HIGHLIGHT_ICONS, highlightsTitle, type Highlight, type HighlightKind } from "@/engine/highlights";
import { tripLength, type ItineraryData } from "@/engine/itinerary";
import { airports, badgeStop, labelAbove, laneFor, onRoadChain, placeBadge, placeLabel, projector, routeBox, routePoints, type DayRoute, type Rect } from "@/engine/routes";
import { daysNightsLabel, nightsFor, type Engine } from "@/engine/structure";
import { balanceLabel, departureLeg, type Balance, type Timeline } from "@/engine/timeline";
import { BRAND, MARK } from "./brand";
import { dayLabel } from "./dates";

export type ShareFormat = "story" | "square";
export const SHARE_SIZES: Record<ShareFormat, [number, number]> = { story: [1080, 1920], square: [1080, 1080] };

export type ShareModel = {
  engine: Engine;
  name: string;
  data: ItineraryData;
  timeline: Timeline;
  routes: DayRoute[];
  balance: Balance;
  photos: { photo: Photo; title: string }[];
  /** Family-friendly mode: the trip's highlights take the vibe meter's place (and nothing says so). */
  highlights?: Highlight[];
  /** The line above the destination: "Sam's" by default; the group plan says "Our". */
  heading?: string;
};

/** The preset's palette, as the colours the canvas needs. */
function colors(e: Engine) {
  const p = e.catalog.preset.theme.palette;
  return {
    deep: p.primary["950"],
    dark: p.primary["900"],
    mid: p.primary["800"],
    light: p.primary["700"],
    paper: p.paper,
    surface: p.surface["100"],
    land: [p.surface["50"], p.surface["200"]] as const,
    ink: p.ink["1"],
    ink2: p.ink["2"],
    gold: p.highlight["400"],
    goldDeep: p.highlight["500"],
    nature: p.secondary["600"],
    natureLight: p.secondary["400"],
    night: p.pop["500"],
    nightLight: p.pop["300"],
  };
}
type Colors = ReturnType<typeof colors>;

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

// ── Fonts ─────────────────────────────────────────────────────────────

type Fonts = { display: string; body: string };

/**
 * Fixed-weight copies of the page fonts (scripts/make-share-fonts.py). Canvas
 * text in WebKit ignores a variable font's weight axis, so the images draw
 * with these static files; the page's own fonts stay as the fallback.
 */
const DISPLAY = "Caravan Share Display";
const SANS = "Caravan Share Sans";
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
  const page = { display: pick("--font-fraunces", "Georgia, serif"), body: pick("--font-instrument", "system-ui, sans-serif") };
  if (!(await loadShareFaces())) return page;
  return { display: `"${DISPLAY}", ${page.display}`, body: `"${SANS}", ${page.body}` };
}

async function loadFonts(f: Fonts) {
  const specs = [`italic 900 100px ${f.display}`, `italic 600 100px ${f.display}`, `600 100px ${f.display}`, `700 40px ${f.body}`, `600 40px ${f.body}`, `500 40px ${f.body}`];
  await Promise.all(specs.map((s) => document.fonts.load(s, "Caravan 0123456789 →·").catch(() => [])));
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

/** The Caravan lockup (mark + wordmark), light-on-dark. Returns its height. */
function lockup(ctx: Ctx, f: Fonts, c: Colors, x: number, y: number, scale: number) {
  const size = 84 * scale;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 32, size / 32);
  ctx.globalAlpha = 0.95;
  for (const d of MARK.dark) {
    ctx.beginPath();
    ctx.arc(d.cx, d.cy, d.r, 0, Math.PI * 2);
    ctx.fillStyle = d.color;
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = c.paper;
  ctx.font = `italic 600 ${size * 0.82}px ${f.display}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(BRAND.name, x + size * 1.08, y + size * 0.78);
  return size;
}

function background(ctx: Ctx, c: Colors, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, w * 0.3, h);
  g.addColorStop(0, c.light);
  g.addColorStop(0.45, c.mid);
  g.addColorStop(1, c.dark);
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
  // a soft warm glow
  const glow = ctx.createRadialGradient(w * 0.9, 0, 0, w * 0.9, 0, w * 0.9);
  glow.addColorStop(0, rgba(c.gold, 0.22));
  glow.addColorStop(1, rgba(c.gold, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
}

// ── The map ───────────────────────────────────────────────────────────

function drawMap(ctx: Ctx, f: Fonts, c: Colors, e: Engine, routes: DayRoute[], x: number, y: number, w: number, h: number) {
  const { map } = e.catalog.preset;
  const regions = e.catalog.regions;
  const project = projector(e);
  ctx.save();
  roundRect(ctx, x, y, w, h, 34);
  ctx.clip();
  const sea = ctx.createLinearGradient(x, y, x + w, y + h);
  sea.addColorStop(0, c.mid);
  sea.addColorStop(1, c.deep);
  ctx.fillStyle = sea;
  ctx.fillRect(x, y, w, h);

  const box = routeBox(e, routes, 5);
  const s = Math.min(w / box.w, h / box.h);
  const ox = x + (w - box.w * s) / 2 - box.x * s;
  const oy = y + (h - box.h * s) / 2 - box.y * s;
  const P = (lat: number, lng: number): [number, number] => {
    const [px, py] = project(lat, lng);
    return [ox + px * s, oy + py * s];
  };
  const at = (id: string) => (regions[id] ? P(regions[id].lat, regions[id].lng) : ([0, 0] as [number, number]));

  // land
  ctx.save();
  ctx.setTransform(ctx.getTransform().multiply(new DOMMatrix([s, 0, 0, s, ox, oy])));
  if (map.surroundings) {
    // neighbouring countries: land, but quiet
    ctx.fillStyle = rgba(c.land[1], 0.24);
    ctx.fill(new Path2D(map.surroundings));
  }
  const land = ctx.createLinearGradient(0, box.y, 0, box.y + box.h);
  land.addColorStop(0, c.land[0]);
  land.addColorStop(1, c.land[1]);
  ctx.shadowColor = rgba(c.deep, 0.5);
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = land;
  ctx.fill(new Path2D(map.detail));
  ctx.restore();

  // routes (each day its own colour, parallel where they overlap)
  const n = routes.length;
  const lw = Math.max(5, s * 1.25);
  const lane = (lw + 1.5) / s;
  for (const [k, r] of routes.entries()) {
    const pts = routePoints(e, r, laneFor(k, n, lane)).map(([px, py]) => [ox + px * s, oy + py * s] as [number, number]);
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
    ctx.strokeStyle = rgba(c.paper, 0.9);
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
      const [px, py] = at(st.region);
      ctx.beginPath();
      ctx.arc(px, py, st.kind === "base" ? R * 1.15 : st.kind === "airport" ? R * 0.85 : R * 0.75, 0, Math.PI * 2);
      ctx.fillStyle = st.kind === "base" ? c.goldDeep : st.kind === "airport" ? c.ink : c.paper;
      ctx.fill();
      ctx.lineWidth = st.kind === "stop" ? 4 : 3.5;
      ctx.strokeStyle = st.kind === "stop" ? r.color : c.ink;
      ctx.stroke();
    }
  }

  // every drawn marker counts as taken space for labels and badges
  const boxes: Rect[] = [];
  for (const r of routes) {
    for (const st of r.stops) {
      const [px, py] = at(st.region);
      boxes.push({ x: px - R, y: py - R, w: R * 2, h: R * 2 });
    }
  }
  // the body of water, set vertically beside the land (e.g. "Indian Ocean")
  if (map.waterLabel) {
    const [, wy] = P(map.waterLabel.at[0], map.waterLabel.at[1]);
    const px = Math.max(15, Math.min(19, s * 4.6));
    ctx.save();
    ctx.font = `italic 600 ${px}px ${f.display}`;
    const text = map.waterLabel.text;
    const tw = ctx.measureText(text).width + text.length * 2.5;
    const cx = x + px * 1.6;
    if (wy - tw / 2 > y + 20 && wy + tw / 2 < y + h - 20) {
      ctx.translate(cx, wy);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = rgba(c.paper, 0.42);
      spaced(ctx, text, -tw / 2, px * 0.35, 2.5);
      boxes.push({ x: cx - px, y: wy - tw / 2, w: px * 2, h: tw });
    }
    ctx.restore();
  }
  // labels: airports and bases, then the places visited
  const fontPx = Math.max(20, Math.min(30, s * 2.6));
  const frame = { x: x + 8, y: y + 8, w: w - 16, h: h - 16 };
  ctx.font = `700 ${fontPx}px ${f.body}`;
  const ports = airports(e);
  const visited = new Set(routes.flatMap((r) => r.stops.map((st) => st.region)));
  const want = [...[...ports].filter((p) => visited.has(p)), ...e.catalog.bases.map((b) => b.region), ...routes.flatMap((r) => r.stops.filter((v) => v.kind === "stop").map((v) => v.region))];
  const labelled = new Set<string>();
  for (const id of want) {
    if (labelled.has(id) || !regions[id]) continue;
    labelled.add(id);
    const [px, py] = at(id);
    const text = ports.has(id) ? regions[id].short.replace(/\s*airport$/i, "") : regions[id].short;
    const own = (b: Rect) => Math.abs(b.x + b.w / 2 - px) < 1 && Math.abs(b.y + b.h / 2 - py) < 1;
    const above = labelAbove(e, id);
    const spot = placeLabel(px, py, ctx.measureText(text).width, fontPx, R * 1.6, above, boxes.filter((b) => !own(b)), frame);
    if (!spot) continue;
    boxes.push(spot.box);
    // the open side (below a south-coast town, left of a west-coast one) is water: light text on a dark halo
    const open = above ? spot.side === "below" : spot.side === "left" && onRoadChain(e, id);
    ctx.lineWidth = 6;
    ctx.strokeStyle = open ? rgba(c.deep, 0.85) : c.surface;
    ctx.strokeText(text, spot.x, spot.y);
    ctx.fillStyle = open ? c.paper : c.ink2;
    ctx.fillText(text, spot.x, spot.y);
  }

  // day badges at each day's furthest stop, nudged around it until they fit
  const badgeR = Math.max(17, s * 2.1);
  ctx.font = `800 ${badgeR * 1.05}px ${f.body}`;
  ctx.textAlign = "center";
  for (const r of routes) {
    const best = badgeStop(e, r);
    if (!best) continue;
    const [px, py] = at(best.region);
    const spot = placeBadge(px, py, badgeR, labelAbove(e, best.region), boxes, frame);
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
    ctx.strokeStyle = c.paper;
    ctx.stroke();
    ctx.fillStyle = c.paper;
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
  return a.title.replace(/^Big day trip: /, "").split(/: | — | · /)[0];
}

/**
 * The day-by-day list: a numbered badge in the day's map colour, "MON 28" +
 * the day's name, then its first Daytime and Evening picks (+N for more).
 * `k` scales everything (1 = Story).
 */
function dayList(ctx: Ctx, f: Fonts, c: Colors, m: ShareModel, x: number, y: number, w: number, rowH: number, k: number) {
  const e = m.engine;
  const { structure } = e.catalog.preset;
  const regions = e.catalog.regions;
  const days = m.timeline.days;
  for (const [i, t] of days.entries()) {
    const ry = y + i * rowH;
    const color = m.routes[i]?.color ?? c.goldDeep;
    const br = 25 * k;
    const titleY = ry + 30 * k;
    ctx.beginPath();
    ctx.arc(x + br, titleY - 10 * k, br, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillStyle = c.paper;
    ctx.font = `800 ${br * 1.05}px ${f.body}`;
    ctx.textAlign = "center";
    ctx.fillText(String(i + 1), x + br, titleY - 10 * k + br * 0.37);
    ctx.textAlign = "left";

    const tx = x + br * 2 + 18 * k;
    const tw = w - (tx - x);
    const date = t.date ? dayLabel(t.date).split(" ").slice(0, 2).join(" ").toUpperCase() : `DAY ${i + 1}`;
    ctx.font = `700 ${19 * k}px ${f.body}`;
    ctx.fillStyle = c.gold;
    const dx = spaced(ctx, date, tx, titleY - 1 * k, 2 * k) + 14 * k;
    ctx.font = `700 ${29 * k}px ${f.body}`;
    ctx.fillStyle = c.paper;
    ctx.fillText(fit(ctx, t.name, tx + tw - dx), dx, titleY);

    ctx.font = `500 ${25 * k}px ${f.body}`;
    ctx.fillStyle = rgba(c.paper, 0.74);
    const iconPx = 24 * k;
    const line1 = ry + 67 * k;
    const line2 = ry + 101 * k;
    const textX = tx + iconPx + 12 * k;
    if (t.plan.kind === "departure") {
      const leg = departureLeg(e, t.plan);
      icon(ctx, "plane", tx, line1 - iconPx + 3 * k, iconPx, c.gold);
      const route = leg ? `${regions[leg.from]?.short} → ${regions[leg.to]?.short.replace(/\s*airport$/i, "")} · ${formatHours(leg.hours).slice(1)} · ` : "";
      ctx.fillText(fit(ctx, `${route}fly home`, tx + tw - textX), textX, line1);
      continue;
    }
    icon(ctx, "sun", tx, line1 - iconPx + 3 * k, iconPx, c.gold);
    ctx.fillText(fit(ctx, titlesFor(t, "day") || `Free ${structure.slots.day.label.toLowerCase()}`, tx + tw - textX), textX, line1);
    icon(ctx, "moon", tx, line2 - iconPx + 3 * k, iconPx, c.nightLight);
    const night = titlesFor(t, "night") || `Free ${structure.slots.night.label.toLowerCase()}`;
    ctx.fillText(fit(ctx, night, tx + tw - textX), textX, line2);
  }
}

function vibe(ctx: Ctx, f: Fonts, c: Colors, b: Balance, x: number, y: number, w: number, h: number, scale = 1, title = "YOUR VIBE") {
  ctx.save();
  roundRect(ctx, x, y, w, h, 32 * scale);
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 2;
  ctx.stroke();
  const label = balanceLabel(b.score);
  const pad = 34 * scale;
  ctx.fillStyle = c.gold;
  ctx.font = `700 ${20 * scale}px ${f.body}`;
  spaced(ctx, title, x + pad, y + pad + 16 * scale, 3 * scale);
  ctx.fillStyle = c.paper;
  ctx.font = `600 ${50 * scale}px ${f.display}`;
  ctx.fillText(fit(ctx, label.title, w - pad * 2), x + pad, y + pad + 68 * scale);

  // meter
  const my = y + h - pad - 30 * scale;
  if (my - 20 * scale - (y + pad + 108 * scale) > 18 * scale) {
    ctx.font = `500 ${24 * scale}px ${f.body}`;
    ctx.fillStyle = rgba(c.paper, 0.72);
    ctx.fillText(fit(ctx, label.line, w - pad * 2), x + pad, y + pad + 108 * scale);
  }
  const ml = x + pad + 40 * scale;
  const mr = x + w - pad - 40 * scale;
  const mh = 18 * scale;
  const g = ctx.createLinearGradient(ml, 0, mr, 0);
  g.addColorStop(0, c.nature);
  g.addColorStop(0.5, c.gold);
  g.addColorStop(1, c.night);
  roundRect(ctx, ml, my - mh / 2, mr - ml, mh, mh / 2);
  ctx.fillStyle = g;
  ctx.fill();
  const pos = b.score === null ? 0.5 : (b.score + 2) / 4;
  const kx = ml + (mr - ml) * pos;
  ctx.beginPath();
  ctx.arc(kx, my, 20 * scale, 0, Math.PI * 2);
  ctx.fillStyle = c.ink;
  ctx.fill();
  ctx.lineWidth = 6 * scale;
  ctx.strokeStyle = c.paper;
  ctx.stroke();
  icon(ctx, "leaf", x + pad - 2 * scale, my - 15 * scale, 30 * scale, c.natureLight);
  icon(ctx, "glass", mr + 12 * scale, my - 15 * scale, 30 * scale, c.nightLight);
  ctx.font = `700 ${17 * scale}px ${f.body}`;
  ctx.fillStyle = rgba(c.paper, 0.6);
  spaced(ctx, "NATURE", ml, my + mh + 24 * scale, 2.5 * scale);
  let nightW = 0;
  for (const ch of "NIGHTLIFE") nightW += ctx.measureText(ch).width + 2.5 * scale;
  spaced(ctx, "NIGHTLIFE", mr - (nightW - 2.5 * scale), my + mh + 24 * scale, 2.5 * scale);
  ctx.restore();
}

/** A highlight's icon on its round tile — the same path data the page draws. */
function highlightIcon(ctx: Ctx, kind: HighlightKind, x: number, y: number, size: number) {
  const art = HIGHLIGHT_ICONS[kind];
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = art.tile;
  ctx.fill();
  ctx.translate(x, y);
  ctx.scale(size / 32, size / 32);
  ctx.translate(4, 4);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const p of art.parts) {
    const path = new Path2D(p.d);
    if (p.fill) {
      ctx.fillStyle = p.fill;
      ctx.fill(path);
    }
    if (p.stroke) {
      ctx.strokeStyle = p.stroke;
      ctx.lineWidth = p.w ?? 1.5;
      ctx.stroke(path);
    }
  }
  ctx.restore();
}

/** "Trip highlights": icon + count + label tiles in a grid, in the vibe card's place. */
function highlightsCard(ctx: Ctx, f: Fonts, c: Colors, e: Engine, items: Highlight[], x: number, y: number, w: number, h: number, scale = 1, cols = 3) {
  ctx.save();
  roundRect(ctx, x, y, w, h, 32 * scale);
  ctx.fillStyle = "rgba(255,255,255,0.07)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 2;
  ctx.stroke();
  const pad = 34 * scale;
  ctx.fillStyle = c.gold;
  ctx.font = `700 ${20 * scale}px ${f.body}`;
  spaced(ctx, "TRIP HIGHLIGHTS", x + pad, y + pad + 16 * scale, 3 * scale);
  ctx.fillStyle = c.paper;
  ctx.font = `600 ${46 * scale}px ${f.display}`;
  ctx.fillText(fit(ctx, highlightsTitle(e, items), w - pad * 2), x + pad, y + pad + 66 * scale);

  const top = y + pad + 96 * scale;
  const bottom = y + h - pad * 0.7;
  if (!items.length) {
    ctx.font = `500 ${24 * scale}px ${f.body}`;
    ctx.fillStyle = rgba(c.paper, 0.72);
    ctx.fillText("Pick a few things to see them here.", x + pad, top + 30 * scale);
    ctx.restore();
    return;
  }
  const rows = Math.max(1, Math.floor((bottom - top) / (62 * scale)));
  const n = Math.min(items.length, cols * rows);
  const colW = (w - pad * 2) / cols;
  const rowH = (bottom - top) / Math.max(1, Math.ceil(n / cols));
  const iconPx = Math.min(56 * scale, rowH - 8 * scale);
  for (let i = 0; i < n; i++) {
    const it = items[i];
    const cx = x + pad + (i % cols) * colW;
    const cy = top + Math.floor(i / cols) * rowH + (rowH - iconPx) / 2;
    highlightIcon(ctx, it.kind, cx, cy, iconPx);
    const tx = cx + iconPx + 14 * scale;
    const base = cy + iconPx / 2 + 13 * scale;
    ctx.fillStyle = c.paper;
    ctx.font = `600 ${40 * scale}px ${f.display}`;
    const count = String(it.count);
    ctx.fillText(count, tx, base);
    const lx = tx + ctx.measureText(count).width + 9 * scale;
    ctx.font = `600 ${22 * scale}px ${f.body}`;
    ctx.fillStyle = rgba(c.paper, 0.8);
    ctx.fillText(fit(ctx, it.label, cx + colW - lx - 8 * scale), lx, base - 2 * scale);
  }
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

function header(ctx: Ctx, f: Fonts, c: Colors, m: ShareModel, x: number, y: number, w: number, scale: number) {
  const e = m.engine;
  const { preset } = e.catalog;
  const len = tripLength(m.data);
  const y0 = m.data.startDate?.slice(0, 4);
  const y1 = m.data.endDate?.slice(0, 4);
  const year = y0 && y1 && y0 !== y1 ? `${y0}–${y1.slice(2)}` : (y0 ?? preset.dates.window.start.slice(0, 4));
  ctx.fillStyle = c.gold;
  ctx.font = `700 ${24 * scale}px ${f.body}`;
  spaced(ctx, `${preset.name.toUpperCase()} · ${year}`, x, y, 4 * scale);

  const nameLine = m.heading ?? `${m.name}'s`;
  const px = sizeToFit(ctx, nameLine, (p) => `600 ${p}px ${f.display}`, 110 * scale, w, 56 * scale);
  ctx.fillStyle = c.paper;
  ctx.fillText(nameLine, x - 4 * scale, y + px * 1.02);
  const destPx = sizeToFit(ctx, preset.name, (p) => `italic 600 ${p}px ${f.display}`, Math.max(px, 100 * scale), w, 56 * scale);
  ctx.fillStyle = c.gold;
  const sl = y + px * 1.02 + destPx * 0.98;
  ctx.fillText(preset.name, x - 4 * scale, sl);

  // dates + "6 days · 5 nights" chip + nights per base
  const dy = sl + 62 * scale;
  ctx.font = `600 ${32 * scale}px ${f.body}`;
  ctx.fillStyle = rgba(c.paper, 0.85);
  const dates = m.data.startDate && m.data.endDate ? `${dayLabel(m.data.startDate)} → ${dayLabel(m.data.endDate)}` : "";
  ctx.fillText(dates, x, dy);
  const chip = daysNightsLabel(len || 1);
  ctx.font = `700 ${27 * scale}px ${f.body}`;
  const cw = ctx.measureText(chip).width + 36 * scale;
  const ch = 50 * scale;
  const cy = dy + 26 * scale;
  roundRect(ctx, x, cy, cw, ch, ch / 2);
  ctx.fillStyle = c.goldDeep;
  ctx.fill();
  ctx.fillStyle = c.ink;
  ctx.fillText(chip, x + 18 * scale, cy + ch * 0.68);
  const split = nightsFor(e, len).filter((s) => s.nights > 0);
  if (split.length > 1) {
    ctx.font = `600 ${25 * scale}px ${f.body}`;
    ctx.fillStyle = rgba(c.paper, 0.7);
    ctx.fillText(fit(ctx, split.map((s) => `${s.base.name} ${s.nights}`).join(" · "), w - cw - 20 * scale), x + cw + 20 * scale, cy + ch * 0.68);
  }
  return cy + ch;
}

/** "YOUR VIBE" on someone's own trip, "OUR VIBE" on the group plan. */
const vibeLabel = (m: ShareModel) => (m.heading ? `${m.heading.toUpperCase()} VIBE` : "YOUR VIBE");

const footerText = (m: ShareModel) => `Planned together on ${BRAND.name} · ${m.engine.catalog.preset.destination.season}`;

// ── Layouts ───────────────────────────────────────────────────────────

async function drawStory(ctx: Ctx, f: Fonts, c: Colors, m: ShareModel) {
  const [W, H] = SHARE_SIZES.story;
  background(ctx, c, W, H);
  const M = 72;
  lockup(ctx, f, c, M, 92, 1);
  const headerEnd = header(ctx, f, c, m, M, 312, W - M * 2, 1);

  // map on the left, the days beside it like a legend
  const top = headerEnd + 42;
  const mapW = 430;
  const rowH = Math.min(118, Math.floor(900 / Math.max(1, m.timeline.days.length)));
  const k = rowH / 118;
  const listH = rowH * (m.timeline.days.length - 1) + 78 * k;
  drawMap(ctx, f, c, m.engine, m.routes, M, top, mapW, listH);
  dayList(ctx, f, c, m, M + mapW + 34, top + 2, W - M * 2 - mapW - 34, rowH, k);

  const vibeY = top + listH + 32;
  const vibeH = m.highlights ? 300 : 252;
  if (m.highlights) highlightsCard(ctx, f, c, m.engine, m.highlights, M, vibeY, W - M * 2, vibeH);
  else vibe(ctx, f, c, m.balance, M, vibeY, W - M * 2, vibeH, 1, vibeLabel(m));

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
  ctx.fillStyle = rgba(c.paper, 0.55);
  ctx.textAlign = "center";
  ctx.fillText(footerText(m), W / 2, H - 38);
  ctx.textAlign = "left";
}

async function drawSquare(ctx: Ctx, f: Fonts, c: Colors, m: ShareModel) {
  const [W, H] = SHARE_SIZES.square;
  background(ctx, c, W, H);
  const M = 56;
  lockup(ctx, f, c, M, 48, 0.62);
  const leftW = 500;
  const headerEnd = header(ctx, f, c, m, M, 204, leftW, 0.66);
  const rowH = Math.min(90, Math.floor((H - headerEnd - 90) / Math.max(1, m.timeline.days.length)));
  dayList(ctx, f, c, m, M, headerEnd + 30, leftW, rowH, 0.8 * (rowH / 90));

  const mapX = M + leftW + 30;
  const mapW = W - mapX - M;
  const mapH = 716;
  drawMap(ctx, f, c, m.engine, m.routes, mapX, M, mapW, mapH);
  const boxY = M + mapH + 24;
  if (m.highlights) highlightsCard(ctx, f, c, m.engine, m.highlights, mapX, boxY, mapW, H - M - boxY, 0.78, 2);
  else vibe(ctx, f, c, m.balance, mapX, boxY, mapW, H - M - boxY, 0.78, vibeLabel(m));

  ctx.font = `600 17px ${f.body}`;
  ctx.fillStyle = rgba(c.paper, 0.5);
  ctx.fillText(footerText(m), M, H - 28);
}

/** Render one share image to a PNG blob. */
export async function renderShareImage(format: ShareFormat, m: ShareModel): Promise<Blob> {
  const f = await fontFamilies();
  await loadFonts(f);
  const c = colors(m.engine);
  const [W, H] = SHARE_SIZES[format];
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.textBaseline = "alphabetic";
  if (format === "story") await drawStory(ctx, f, c, m);
  else await drawSquare(ctx, f, c, m);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"));
}
