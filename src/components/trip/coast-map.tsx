"use client";

import { motion, useReducedMotion } from "framer-motion";
import { regions, type RegionId } from "@/content";
import { driveLabel } from "@/lib/timeline";
import { cn } from "@/lib/cn";
import { project } from "@/lib/map-data";
import { badgeStop, COAST_DETAIL, dayBox, laneFor, legMidpoint, onCoastRoad, onSouthCoast, placeBadge, placeLabel, routeBox, routePoints, smoothPath, type DayRoute, type LabelSpot, type Rect } from "@/lib/routes";

type Props = {
  routes: DayRoute[];
  /** Index of the highlighted day, or null for all days. */
  active: number | null;
  onActive?: (i: number | null) => void;
  className?: string;
};

/** Which place names get first claim on map space (west coast: label to the east, south coast: above). */
const LABEL_PRIORITY: RegionId[] = ["colombo", "galle", "airport", "mirissa", "hiriketiya", "bentota", "hikkaduwa", "weligama", "negombo", "udawalawe", "sinharaja", "kanneliya", "mulkirigala", "ambalangoda", "kalutara"];

/** The trip's south-west coast, each day's route in its own colour. */
export function CoastMap({ routes, active, onActive, className }: Props) {
  const reduce = useReducedMotion();
  // All days: the south-west coast (grown for inland trips like Adam's Peak). One day: fit to its route.
  const full = routeBox(routes);
  const focus = active === null ? null : (routes.find((d) => d.index === active) ?? null);
  const box = focus ? dayBox(focus, full) : full;
  // Sizes follow the zoom so lines and labels stay the same size on screen.
  const H = box.h;
  const stroke = H * 0.0085;
  const gap = H * 0.0062;
  const font = H * 0.026;
  const r = H * 0.0145;
  const visited = new Set(routes.flatMap((d) => d.stops.map((s) => s.region)));
  const activeRoute = active === null ? null : routes.find((d) => d.index === active) ?? null;

  const at = (id: RegionId) => project(regions[id].lat, regions[id].lng);
  const textW = (t: string, px = font) => t.length * px * 0.56;
  const frame = { x: box.x + font * 0.3, y: box.y + font * 0.3, w: box.w - font * 0.6, h: box.h - font * 0.6 };

  // Everything drawn claims its space, so labels, pills and badges never overlap.
  const taken: Rect[] = [];
  for (const d of routes) {
    if (active !== null && d.index !== active) continue;
    for (const s of d.stops) {
      const [x, y] = at(s.region);
      const rr = s.kind === "base" ? r * 1.15 : r;
      taken.push({ x: x - rr, y: y - rr, w: rr * 2, h: rr * 2 });
    }
  }
  const notOwn = (x: number, y: number) => taken.filter((b) => Math.abs(b.x + b.w / 2 - x) > 0.01 || Math.abs(b.y + b.h / 2 - y) > 0.01);

  // Active day: a pill with the place name next to each numbered stop.
  const pills: { region: RegionId; order: number; x: number; y: number; w: number }[] = [];
  if (activeRoute) {
    for (const s of activeRoute.stops.filter((v) => v.kind === "stop")) {
      const [x, y] = at(s.region);
      const w = textW(regions[s.region].short) + font * 1.1;
      const spot = placeLabel(x, y, w, font * 1.05, r * 2, onSouthCoast(s.region), notOwn(x, y), frame);
      if (!spot) continue;
      taken.push(spot.box);
      pills.push({ region: s.region, order: s.order, x: spot.x, y: spot.y, w });
    }
  }

  // Active day: a drive-time tag beside each longer leg, on the sea side where there's room.
  const legTags: { key: number; text: string; x: number; y: number; w: number }[] = [];
  if (activeRoute) {
    const tagFont = font * 0.9;
    const tagged = new Set<string>();
    activeRoute.legs.forEach((leg, i) => {
      if (leg.hours < 0.5 || leg.from === leg.to) return;
      // Out and back along the same road gets one tag: "~5–6 hrs each way".
      const pair = [leg.from, leg.to].sort().join("|");
      if (tagged.has(pair)) return;
      tagged.add(pair);
      const both = activeRoute.legs.some((o) => o !== leg && o.from === leg.to && o.to === leg.from);
      const [mx, my] = legMidpoint(leg);
      const text = `${driveLabel(leg.hours)}${both ? " each way" : ""}`;
      const w = textW(text, font * 0.82) + font * 0.9;
      const coastal = onCoastRoad(leg.from) && onCoastRoad(leg.to);
      const south = onSouthCoast(leg.from) && onSouthCoast(leg.to);
      // along the coast: beside the road on the sea side; inland: right on the line
      const prefer: LabelSpot["side"][] = !coastal ? ["on", "left", "right", "above", "below"] : south ? ["below", "above", "left", "right"] : ["left", "right", "below", "above"];
      const spot = placeLabel(mx, my, w, tagFont, r * 1.3, south, taken, frame, prefer);
      if (!spot) return;
      taken.push(spot.box);
      legTags.push({ key: i, text, x: spot.x, y: spot.y, w });
    });
  }

  // Labels: bases + visited places, each on the first free side of its dot.
  const labels: { region: RegionId; x: number; y: number; text: string; sea: boolean }[] = [];
  const order = [...LABEL_PRIORITY.filter((x) => visited.has(x) || x === "colombo" || x === "galle"), ...[...visited].filter((x) => !LABEL_PRIORITY.includes(x))];
  for (const id of order) {
    if (activeRoute && activeRoute.stops.some((s) => s.region === id && s.kind === "stop")) continue; // shown as a pill instead
    const [px, py] = at(id);
    const text = id === "airport" ? "CMB ✈" : regions[id].short;
    const south = onSouthCoast(id);
    const spot = placeLabel(px, py, textW(text), font, r * 1.7, south, notOwn(px, py), frame);
    if (!spot) continue;
    taken.push(spot.box);
    labels.push({ region: id, x: spot.x, y: spot.y, text, sea: south ? spot.side === "below" : spot.side === "left" && onCoastRoad(id) });
  }

  // All days: a numbered badge by each day's furthest stop.
  const badges: { day: DayRoute; x: number; y: number; sx: number; sy: number; far: boolean }[] = [];
  if (active === null) {
    for (const d of routes) {
      const best = badgeStop(d);
      if (!best) continue;
      const [sx, sy] = at(best.region);
      const spot = placeBadge(sx, sy, r * 1.2, onSouthCoast(best.region), taken, frame);
      if (spot) taken.push(spot.box);
      badges.push({ day: d, x: spot?.x ?? sx + r * 2.2, y: spot?.y ?? sy + r * 2.2, sx, sy, far: !!spot?.far });
    }
  }

  const drawOrder = [...routes].sort((a, b) => (a.index === active ? 1 : 0) - (b.index === active ? 1 : 0));

  return (
    <motion.svg
      initial={false}
      animate={{ viewBox: `${box.x} ${box.y} ${box.w} ${box.h}` }}
      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 140, damping: 24 }}
      viewBox={`${full.x} ${full.y} ${full.w} ${full.h}`}
      className={cn("block h-auto w-full", className)}
      role="img"
      aria-label={`Route map: ${routes.map((d) => `day ${d.index + 1} ${d.stops.map((s) => regions[s.region].short).join(", ")}`).join("; ")}`}
    >
      <defs>
        <linearGradient id="cm-sea" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0d4f60" />
          <stop offset="1" stopColor="#06323d" />
        </linearGradient>
        <linearGradient id="cm-land" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbf3e6" />
          <stop offset="1" stopColor="#eedfc4" />
        </linearGradient>
        <filter id="cm-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy={H * 0.004} stdDeviation={H * 0.006} floodColor="#021c22" floodOpacity="0.45" />
        </filter>
      </defs>
      <rect x={full.x} y={full.y} width={full.w} height={full.h} fill="url(#cm-sea)" />
      {/* faint latitude lines */}
      {[7, 6.5, 6].map((lat) => {
        const [, y] = project(lat, 80);
        return <line key={lat} x1={full.x} x2={full.x + full.w} y1={y} y2={y} stroke="#ffffff" strokeOpacity="0.06" strokeWidth={H * 0.002} strokeDasharray={`${H * 0.01} ${H * 0.012}`} />;
      })}
      <path d={COAST_DETAIL} fill="url(#cm-land)" stroke="#fffbf4" strokeWidth={H * 0.003} filter="url(#cm-shadow)" />

      {drawOrder.map((d) => {
        const n = routes.length;
        const dpath = smoothPath(routePoints(d, laneFor(routes.indexOf(d), n, gap)));
        const dim = active !== null && d.index !== active;
        const on = d.index === active;
        return (
          <g key={d.index} opacity={dim ? 0.18 : 1} style={{ transition: "opacity 250ms" }}>
            <path d={dpath} fill="none" stroke="#fffbf4" strokeOpacity="0.85" strokeWidth={(on ? 1.9 : 1) * stroke + H * 0.004} strokeLinecap="round" strokeLinejoin="round" />
            <motion.path
              d={dpath}
              fill="none"
              stroke={d.color}
              strokeWidth={(on ? 1.9 : 1) * stroke}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.1, delay: 0.15 + d.index * 0.12, ease: "easeInOut" }}
            />
            {onActive && (
              <path
                d={dpath}
                fill="none"
                stroke="transparent"
                strokeWidth={stroke * 5}
                className="cursor-pointer"
                onClick={() => onActive(on ? null : d.index)}
              />
            )}
          </g>
        );
      })}

      {/* stops */}
      {routes.map((d) => {
        const dim = active !== null && d.index !== active;
        if (dim) return null;
        return d.stops.map((s) => {
          const [x, y] = project(regions[s.region].lat, regions[s.region].lng);
          if (s.kind !== "stop") {
            return (
              <circle key={`${d.index}-${s.region}`} cx={x} cy={y} r={s.kind === "base" ? r * 1.15 : r * 0.9} fill={s.kind === "base" ? "#f2a33a" : "#1d1914"} stroke="#1d1914" strokeWidth={H * 0.004} />
            );
          }
          return (
            <circle key={`${d.index}-${s.region}`} cx={x} cy={y} r={active === null ? r * 0.7 : r * 0.8} fill="#fffbf4" stroke={d.color} strokeWidth={H * 0.0055} />
          );
        });
      })}

      {/* place names sit above the routes */}
      {labels.map((l) => (
        <text
          key={l.region}
          x={l.x}
          y={l.y}
          fontSize={font}
          fontWeight={700}
          fill={l.sea ? "#fffbf4" : "#3b332a"}
          fontFamily="var(--font-instrument)"
          paintOrder="stroke"
          stroke={l.sea ? "#06323d" : "#f7eee0"}
          strokeWidth={font * 0.28}
        >
          {l.text}
        </text>
      ))}

      {/* active day: numbered stops, place pills and drive times */}
      {activeRoute && (
        <g>
          {legTags.map((t) => (
            <g key={t.key}>
              <rect x={t.x} y={t.y - font * 0.81} width={t.w} height={font * 1.04} rx={font * 0.52} fill={activeRoute.color} stroke="#fffbf4" strokeWidth={H * 0.0025} />
              <text x={t.x + t.w / 2} y={t.y - font * 0.03} textAnchor="middle" fontSize={font * 0.82} fontWeight={700} fill="#fffbf4" fontFamily="var(--font-instrument)">
                {t.text}
              </text>
            </g>
          ))}
          {activeRoute.stops
            .filter((s) => s.kind === "stop")
            .map((s) => {
              const [x, y] = at(s.region);
              return (
                <g key={s.region}>
                  <circle cx={x} cy={y} r={r * 1.25} fill={activeRoute.color} stroke="#fffbf4" strokeWidth={H * 0.005} />
                  <text x={x} y={y + font * 0.36} textAnchor="middle" fontSize={font} fontWeight={800} fill="#fffbf4" fontFamily="var(--font-instrument)">
                    {s.order}
                  </text>
                </g>
              );
            })}
          {pills.map((p) => (
            <g key={p.region}>
              <rect x={p.x} y={p.y - font * 1.02} width={p.w} height={font * 1.3} rx={font * 0.65} fill="#fffbf4" stroke={activeRoute.color} strokeWidth={H * 0.003} />
              <text x={p.x + p.w / 2} y={p.y} textAnchor="middle" fontSize={font} fontWeight={700} fill="#1d1914" fontFamily="var(--font-instrument)">
                {regions[p.region].short}
              </text>
            </g>
          ))}
        </g>
      )}

      {/* all days: a day badge by each day's furthest stop */}
      {badges.map((b) => (
        <g key={`badge-${b.day.index}`} onClick={onActive ? () => onActive(b.day.index) : undefined} className={onActive ? "cursor-pointer" : undefined}>
          {b.far && <line x1={b.sx} y1={b.sy} x2={b.x} y2={b.y} stroke={b.day.color} strokeWidth={H * 0.004} strokeLinecap="round" />}
          <circle cx={b.x} cy={b.y} r={r * 1.2} fill={b.day.color} stroke="#fffbf4" strokeWidth={H * 0.005} />
          <text x={b.x} y={b.y + font * 0.35} textAnchor="middle" fontSize={font * 0.95} fontWeight={800} fill="#fffbf4" fontFamily="var(--font-instrument)">
            {b.day.index + 1}
          </text>
        </g>
      ))}
    </motion.svg>
  );
}
