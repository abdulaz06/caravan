// Day-by-day routes for the zoomed map and the share images: which places
// each day visits (in order), the legs between them, and screen geometry
// along the preset's roads so overlapping days run as parallel lines. The
// map itself (projection, outline, roads, default frame) comes from the preset.
import type { ItineraryData } from "./itinerary";
import type { Engine } from "./structure";
import { buildTimeline, transferLeg, type Timeline } from "./timeline";

/** order: 1, 2, 3… for places visited; 0 for airports and the bases. */
export type RouteStop = { region: string; order: number; kind: "airport" | "base" | "stop"; labels: string[] };
/** A point a leg passes through: a place, or a bare [lat, lng] on a road. */
export type Waypoint = string | [number, number];
export type RouteLeg = { from: string; to: string; hours: number; via: Waypoint[] };
export type DayRoute = { index: number; color: string; stops: RouteStop[]; legs: RouteLeg[] };

/** Map projection for the preset: [lat, lng] → SVG units. */
export function projector(e: Engine) {
  const { minLng, maxLat, scale, pad, xScale } = e.catalog.preset.map.projection;
  return (lat: number, lng: number): [number, number] => [(lng - minLng) * scale * xScale + pad, (maxLat - lat) * scale + pad];
}

/** Screen point of a place or waypoint. */
export function regionPoint(e: Engine, r: Waypoint): [number, number] {
  const project = projector(e);
  if (typeof r !== "string") return project(r[0], r[1]);
  const reg = e.catalog.regions[r];
  return reg ? project(reg.lat, reg.lng) : [0, 0];
}

/** One colour per day (from the preset theme). */
export const dayColor = (e: Engine, i: number) => {
  const colors = e.catalog.preset.theme.dayColors;
  return colors[i % colors.length];
};

/** The places a trip flies in and out of. */
export function airports(e: Engine): Set<string> {
  const { arrival, departure } = e.catalog.preset.structure;
  return new Set([e.catalog.legs[arrival.leg]?.from, e.catalog.legs[departure.leg]?.to].filter((x): x is string => !!x));
}

/** Legs between two towns on the same road chain follow it; known roads are drawn as driven. */
function via(e: Engine, a: string, b: string): Waypoint[] {
  const { chains, roads } = e.catalog.preset.map;
  const road = roads.find((r) => (r.from === a && r.to === b) || (r.from === b && r.to === a));
  if (road) return road.from === a ? [a, ...road.via, b] : [a, ...[...road.via].reverse(), b];
  for (const chain of chains) {
    const i = chain.indexOf(a);
    const j = chain.indexOf(b);
    if (i >= 0 && j >= 0) return i <= j ? chain.slice(i, j + 1) : chain.slice(j, i + 1).reverse();
  }
  return [a, b];
}

export function dayRoutes(e: Engine, data: ItineraryData, timeline: Timeline = buildTimeline(e, data)): DayRoute[] {
  const { arrival, departure } = e.catalog.preset.structure;
  const ports = airports(e);
  const baseRegions = new Set(e.catalog.bases.map((b) => b.region));
  return timeline.days.map((t, k) => {
    const home = t.plan.base.region;
    const seq: { region: string; label?: string }[] = [];
    const push = (region: string, label?: string) => {
      const last = seq[seq.length - 1];
      if (last && last.region === region) {
        if (label) last.label = last.label ? `${last.label} · ${label}` : label;
      } else seq.push({ region, label });
    };
    const itemsOf = (slot: "day" | "night") =>
      t[slot].items.flatMap((v) => (v.resolved.kind === "activity" ? [v.resolved.activity] : []));

    if (t.plan.kind === "departure") {
      push(home);
      const leg = e.catalog.legs[departure.leg];
      if (leg) push(leg.to, "Fly home");
    } else if (t.plan.kind === "transfer" && t.plan.transfer) {
      const from = e.catalog.basesById[t.plan.transfer.from];
      if (from) push(from.region);
      const leg = transferLeg(e, t.plan, data.days[t.index].day);
      for (const s of leg?.stops ?? []) {
        const titles = itemsOf("day").filter((a) => a.region === s.region).map((a) => a.title);
        push(s.region, titles.join(" · "));
      }
      push(home);
      if (!t.day.onRoute) for (const a of itemsOf("day")) push(a.region, a.title);
      push(home);
      for (const a of itemsOf("night")) push(a.region, a.title);
      push(home);
    } else {
      if (t.plan.arrival) {
        const leg = e.catalog.legs[arrival.leg];
        if (leg) push(leg.from, arrival.label);
      }
      push(home);
      for (const a of [...itemsOf("day"), ...itemsOf("night")]) push(a.region, a.title);
      push(home);
    }

    const legs: RouteLeg[] = [];
    for (let i = 1; i < seq.length; i++) {
      const a = seq[i - 1].region;
      const b = seq[i].region;
      legs.push({ from: a, to: b, hours: e.catalog.travelHours(a, b), via: via(e, a, b) });
    }
    const stops: RouteStop[] = [];
    let order = 0;
    for (const s of seq) {
      const existing = stops.find((x) => x.region === s.region);
      if (existing) {
        if (s.label && !existing.labels.includes(s.label)) existing.labels.push(s.label);
        continue;
      }
      const kind = ports.has(s.region) ? "airport" : s.region === home || baseRegions.has(s.region) ? "base" : "stop";
      stops.push({ region: s.region, order: kind === "stop" ? ++order : 0, kind, labels: s.label ? [s.label] : [] });
    }
    return { index: t.index, color: dayColor(e, k), stops, legs };
  });
}

// ── Geometry ──────────────────────────────────────────────────────────

export type Box = { x: number; y: number; w: number; h: number };

/** The preset's default frame, grown to include every stop and road. */
export function routeBox(e: Engine, routes: DayRoute[], pad = 6): Box {
  const [a, b] = e.catalog.preset.map.focus;
  const pts: [number, number][] = [regionPoint(e, a), regionPoint(e, b)];
  for (const r of routes) {
    for (const s of r.stops) pts.push(regionPoint(e, s.region));
    for (const l of r.legs) for (const w of l.via) if (typeof w !== "string") pts.push(regionPoint(e, w));
  }
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;
  return { x, y, w: Math.max(...xs) - x + pad, h: Math.max(...ys) - y + pad };
}

/**
 * Frame one day's route: its places and legs with some breathing room, never
 * smaller than ~40% of the full map, in the same aspect ratio as `full` (so the
 * map keeps its size on screen) and kept inside it where it fits.
 */
export function dayBox(e: Engine, route: DayRoute, full: Box): Box {
  const pts = [...route.stops.map((s) => regionPoint(e, s.region)), ...routePoints(e, route, 0)];
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

/** Screen points for a day: legs along the roads, with the day's lane offset. */
export function routePoints(e: Engine, route: DayRoute, lane: number): [number, number][] {
  const raw: [number, number][] = [];
  for (const leg of route.legs) {
    for (const r of leg.via) {
      const p = regionPoint(e, r);
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

/** Places on a road chain (legs between them follow the road). */
export const onRoadChain = (e: Engine, r: string) => e.catalog.preset.map.chains.some((c) => c.includes(r));
/** Places whose labels go above their dot (e.g. a south coast with the sea below). */
export const labelAbove = (e: Engine, r: string) => {
  const southOf = e.catalog.preset.map.labelsAboveSouthOf;
  return southOf !== undefined && (e.catalog.regions[r]?.lat ?? 90) < southOf;
};

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
  above: boolean,
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
  const order: LabelSpot["side"][] = prefer ?? (above ? ["above", "right", "left", "below"] : ["right", "left", "above", "below"]);
  for (const side of order) {
    const [x, y] = sides[side];
    const box = { x: x - pad, y: y - font, w: tw + pad * 2, h: font * 1.25 };
    if (within(box, frame) && !taken.some((t) => overlaps(box, t))) return { x, y, side, box };
  }
  return null;
}

/**
 * A free spot for a round day badge of radius `radius` near (px, py): rings of
 * directions, the open side first. `far` = pushed out enough to want a tether.
 */
export function placeBadge(px: number, py: number, radius: number, above: boolean, taken: Rect[], frame: Rect) {
  const pref = above ? [90, 60, 120, 30, 150, 0, 180, 270] : [180, 150, 210, 0, 30, 330, 120, 240];
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

/** Halfway along a leg as driven (through the places it passes), for its drive-time tag. */
export function legMidpoint(e: Engine, leg: RouteLeg): [number, number] {
  const pts = leg.via.map((w) => regionPoint(e, w));
  if (pts.length < 2) return pts[0] ?? regionPoint(e, leg.from);
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
export function badgeStop(e: Engine, route: DayRoute): RouteStop | null {
  const home = route.stops.find((s) => s.kind === "base") ?? route.stops[0];
  if (!home) return null;
  const [hx, hy] = regionPoint(e, home.region);
  let best = route.stops[route.stops.length - 1];
  let far = -1;
  for (const s of route.stops) {
    const [x, y] = regionPoint(e, s.region);
    const d = Math.hypot(x - hx, y - hy);
    if (d > far) {
      far = d;
      best = s;
    }
  }
  return best;
}
