// Day-by-day routes for the zoomed coast map and the share image: which
// towns each day visits (in order), the legs between them, and screen
// geometry along the coast road so overlapping days run as parallel lines.
import { regions, travelHours, type RegionId } from "@/content";
import { COAST_DETAIL, project } from "./map-data";
import type { ItineraryData } from "./itinerary";
import { buildTimeline, coastLeg, type Timeline } from "./timeline";

/** One colour per day (ocean, sunset, jungle, hibiscus, saffron, plum). */
export const DAY_COLORS = ["#1a8e9c", "#ec6437", "#3f8f5f", "#d6467a", "#f2a33a", "#8a4ab0"];

/** order: 1, 2, 3… for places visited; 0 for the airport and the nights' bases. */
export type RouteStop = { region: RegionId; order: number; kind: "airport" | "base" | "stop"; labels: string[] };
export type RouteLeg = { from: RegionId; to: RegionId; hours: number; via: RegionId[] };
export type DayRoute = { index: number; color: string; stops: RouteStop[]; legs: RouteLeg[] };

/** Towns along the west and south coast roads, in order. Legs between two of them follow the coast. */
const CHAIN: RegionId[] = [
  "negombo", "airport", "colombo", "mount-lavinia", "kalutara", "bentota", "kosgoda", "balapitiya", "ambalangoda",
  "hikkaduwa", "galle", "unawatuna", "koggala", "ahangama", "weligama", "mirissa", "madiha", "hiriketiya",
];

function via(a: RegionId, b: RegionId): RegionId[] {
  const i = CHAIN.indexOf(a);
  const j = CHAIN.indexOf(b);
  if (i < 0 || j < 0) return [a, b];
  return i <= j ? CHAIN.slice(i, j + 1) : CHAIN.slice(j, i + 1).reverse();
}

export function dayRoutes(data: ItineraryData, timeline: Timeline = buildTimeline(data)): DayRoute[] {
  return timeline.days.map((t, k) => {
    const home: RegionId = t.role === "colombo" ? "colombo" : "galle";
    const seq: { region: RegionId; label?: string }[] = [];
    const push = (region: RegionId, label?: string) => {
      const last = seq[seq.length - 1];
      if (last && last.region === region) {
        if (label) last.label = last.label ? `${last.label} · ${label}` : label;
      } else seq.push({ region, label });
    };
    const itemsOf = (slot: "day" | "night") =>
      t[slot].items.filter((v) => v.resolved.kind === "activity").map((v) => (v.resolved.kind === "activity" ? v.resolved.activity : null)!);

    if (t.role === "departure") {
      push("galle");
      push("airport", "Fly home");
    } else if (t.role === "transfer") {
      push("colombo");
      const leg = coastLeg(data.days[t.index].day);
      for (const s of leg.stops ?? []) {
        const titles = itemsOf("day").filter((a) => a.region === s.region).map((a) => a.title);
        push(s.region, titles.join(" · "));
      }
      push("galle");
      for (const a of itemsOf("night")) push(a.region, a.title);
      push("galle");
    } else {
      if (t.role === "colombo") push("airport", "Land");
      push(home);
      for (const a of [...itemsOf("day"), ...itemsOf("night")]) push(a.region, a.title);
      push(home);
    }

    const legs: RouteLeg[] = [];
    for (let i = 1; i < seq.length; i++) {
      legs.push({ from: seq[i - 1].region, to: seq[i].region, hours: travelHours(seq[i - 1].region, seq[i].region), via: via(seq[i - 1].region, seq[i].region) });
    }
    const stops: RouteStop[] = [];
    let order = 0;
    for (const s of seq) {
      const existing = stops.find((x) => x.region === s.region);
      if (existing) {
        if (s.label && !existing.labels.includes(s.label)) existing.labels.push(s.label);
        continue;
      }
      const kind = s.region === "airport" ? "airport" : s.region === home || s.region === "colombo" || s.region === "galle" ? "base" : "stop";
      stops.push({ region: s.region, order: kind === "stop" ? ++order : 0, kind, labels: s.label ? [s.label] : [] });
    }
    return { index: t.index, color: DAY_COLORS[k % DAY_COLORS.length], stops, legs };
  });
}

// ── Geometry ──────────────────────────────────────────────────────────

export type Box = { x: number; y: number; w: number; h: number };

/** The south-west coast (CMB → Colombo → Hiriketiya), grown to include any inland day trip. */
export function routeBox(routes: DayRoute[], pad = 6): Box {
  const pts: [number, number][] = [project(7.26, 79.74), project(5.9, 80.78)];
  for (const r of routes) for (const s of r.stops) pts.push(project(regions[s.region].lat, regions[s.region].lng));
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;
  return { x, y, w: Math.max(...xs) - x + pad, h: Math.max(...ys) - y + pad };
}

const pt = (r: RegionId) => project(regions[r].lat, regions[r].lng);

/**
 * Frame one day's route: its towns and legs with some breathing room, never
 * smaller than ~40% of the full map, in the same aspect ratio as `full` (so the
 * map keeps its size on screen) and kept inside it where it fits.
 */
export function dayBox(route: DayRoute, full: Box): Box {
  const pts = [...route.stops.map((s) => pt(s.region)), ...routePoints(route, 0)];
  if (!pts.length) return full;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  let w = Math.max(...xs) - minX;
  let h = Math.max(...ys) - minY;
  const cx = minX + w / 2;
  const cy = minY + h / 2;
  const aspect = full.w / full.h;
  w = Math.max(w * 1.5 + 12, full.w * 0.4);
  h = Math.max(h * 1.5 + 12, full.h * 0.4);
  if (w / h < aspect) w = h * aspect;
  else h = w / aspect;
  if (w >= full.w || h >= full.h) return full;
  const x = Math.min(Math.max(cx - w / 2, full.x), full.x + full.w - w);
  const y = Math.min(Math.max(cy - h / 2, full.y), full.y + full.h - h);
  return { x, y, w, h };
}

/** Screen points for a day: legs along the coast chain, with the day's lane offset. */
export function routePoints(route: DayRoute, lane: number): [number, number][] {
  const raw: [number, number][] = [];
  for (const leg of route.legs) {
    for (const r of leg.via) {
      const p = pt(r);
      const last = raw[raw.length - 1];
      if (!last || last[0] !== p[0] || last[1] !== p[1]) raw.push(p);
    }
  }
  if (!lane || raw.length < 2) return raw;
  // Offset each vertex along the averaged normal so overlapping days run side by side.
  return raw.map((p, i) => {
    const a = raw[Math.max(0, i - 1)];
    const b = raw[Math.min(raw.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    return [p[0] + (-dy / len) * lane, p[1] + (dx / len) * lane];
  });
}

/** Smooth Catmull-Rom curve through points, as an SVG path. */
export function smoothPath(points: [number, number][]): string {
  if (points.length < 2) return "";
  const f = (n: number) => n.toFixed(2);
  let d = `M${f(points[0][0])} ${f(points[0][1])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

/** Lane offset per day so parallel lines don't sit on top of each other. */
export const laneFor = (i: number, n: number, gap: number) => (i - (n - 1) / 2) * gap;

// ── Placement: labels and day badges that never overlap ───────────────
// Shared by the live map (SVG units) and the share images (canvas pixels).

export type Rect = { x: number; y: number; w: number; h: number };
export const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const within = (r: Rect, f: Rect) => r.x >= f.x && r.y >= f.y && r.x + r.w <= f.x + f.w && r.y + r.h <= f.y + f.h;
/** Towns on the west/south coast road (legs between them hug the coast). */
export const onCoastRoad = (r: RegionId) => CHAIN.includes(r);
/** South-coast towns get their label above (the sea is below); west-coast ones to the right. */
export const onSouthCoast = (r: RegionId) => regions[r].lat < 6.12;

export type LabelSpot = { x: number; y: number; side: "right" | "left" | "above" | "below" | "on"; box: Rect };

/**
 * Where a place name of width `tw` fits beside its dot at (px, py): the
 * preferred side first, then the others. `x` is the text's left edge, `y`
 * its baseline. Null when every side is taken or outside `frame`.
 */
export function placeLabel(
  px: number,
  py: number,
  tw: number,
  font: number,
  gap: number,
  south: boolean,
  taken: Rect[],
  frame: Rect,
  prefer?: LabelSpot["side"][],
): LabelSpot | null {
  const pad = font * 0.15;
  // centred labels may slide sideways to stay inside the frame
  const centred = Math.max(frame.x + pad, Math.min(px - tw / 2, frame.x + frame.w - pad - tw));
  const sides: Record<LabelSpot["side"], [number, number]> = {
    right: [px + gap, py + font * 0.35],
    left: [px - gap - tw, py + font * 0.35],
    above: [centred, py - gap],
    below: [centred, py + gap + font * 0.8],
    on: [centred, py + font * 0.35],
  };
  const order: LabelSpot["side"][] = prefer ?? (south ? ["above", "right", "left", "below"] : ["right", "left", "above", "below"]);
  for (const side of order) {
    const [x, y] = sides[side];
    const box = { x: x - pad, y: y - font, w: tw + pad * 2, h: font * 1.25 };
    if (within(box, frame) && !taken.some((t) => overlaps(box, t))) return { x, y, side, box };
  }
  return null;
}

/**
 * A free spot for a round day badge of radius `radius` near (px, py): rings of
 * directions, the sea side first. `far` = pushed out enough to want a tether.
 */
export function placeBadge(px: number, py: number, radius: number, south: boolean, taken: Rect[], frame: Rect) {
  const pref = south ? [90, 60, 120, 30, 150, 0, 180, 270] : [180, 150, 210, 0, 30, 330, 120, 240];
  const all = [...pref, 15, 45, 75, 105, 135, 165, 195, 225, 255, 285, 315, 345];
  for (let ring = 1.75; ring <= 6; ring += 0.75) {
    for (const deg of ring > 3 ? all : pref) {
      const a = (deg * Math.PI) / 180;
      const x = px + Math.cos(a) * radius * ring;
      const y = py + Math.sin(a) * radius * ring;
      const box = { x: x - radius * 1.15, y: y - radius * 1.15, w: radius * 2.3, h: radius * 2.3 };
      if (within(box, frame) && !taken.some((t) => overlaps(box, t))) return { x, y, box, far: ring > 2.2 };
    }
  }
  return null;
}

/** Halfway along a leg as driven (through the towns it passes), for its drive-time tag. */
export function legMidpoint(leg: RouteLeg): [number, number] {
  const pts = leg.via.map(pt);
  if (pts.length < 2) return pts[0] ?? pt(leg.from);
  const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  let half = seg.reduce((a, b) => a + b, 0) / 2;
  for (let i = 0; i < seg.length; i++) {
    if (half <= seg[i] || i === seg.length - 1) {
      const t = seg[i] ? Math.min(1, half / seg[i]) : 0;
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t];
    }
    half -= seg[i];
  }
  return pts[0];
}

/** The stop furthest from a day's base — where its badge sits on the map. */
export function badgeStop(route: DayRoute): RouteStop | null {
  const home = route.stops.find((s) => s.kind === "base") ?? route.stops[0];
  if (!home) return null;
  const [hx, hy] = pt(home.region);
  let best = route.stops[route.stops.length - 1];
  let far = -1;
  for (const s of route.stops) {
    const [x, y] = pt(s.region);
    const d = Math.hypot(x - hx, y - hy);
    if (d > far) {
      far = d;
      best = s;
    }
  }
  return best;
}

export { COAST_DETAIL, pt as regionPoint };
