"use client";

import { motion, useReducedMotion } from "framer-motion";
import { formatHours } from "@/engine/catalog";
import {
  airports,
  badgeStop,
  dayBox,
  labelAbove,
  laneFor,
  legMidpoint,
  onRoadChain,
  placeBadge,
  placeLabel,
  regionPoint,
  routeBox,
  routePoints,
  smoothPath,
  type DayRoute,
  type LabelSpot,
  type Rect,
} from "@/engine/routes";
import { cn } from "@/lib/cn";
import { useEngine } from "../engine";

type Props = {
  routes: DayRoute[];
  /** Index of the highlighted day, or null for all days. */
  active: number | null;
  onActive?: (i: number | null) => void;
  className?: string;
};

/** "CMB ✈" from "CMB airport". */
export const airportLabel = (short: string) => `${short.replace(/\s*airport$/i, "")} ✈`;

/** The trip's map, each day's route in its own colour; tap a day to zoom to it. */
export function TripMap({ routes, active, onActive, className }: Props) {
  const e = useEngine();
  const { regions, bases, preset } = e.catalog;
  const pal = preset.theme.palette;
  const reduce = useReducedMotion();
  // All days: the preset's default frame (grown for far-off day trips). One day: fit to its route.
  const full = routeBox(e, routes);
  const focus = active === null ? null : (routes.find((d) => d.index === active) ?? null);
  const box = focus ? dayBox(e, focus, full) : full;
  // Sizes follow the zoom so lines and labels stay the same size on screen.
  const H = box.h;
  const stroke = H * 0.0085;
  const gap = H * 0.0062;
  const font = H * 0.026;
  const r = H * 0.0145;
  const visited = new Set(routes.flatMap((d) => d.stops.map((s) => s.region)));
  const activeRoute = active === null ? null : (routes.find((d) => d.index === active) ?? null);
  const ports = airports(e);
  const baseRegions = bases.map((b) => b.region);

  const at = (id: string) => regionPoint(e, id);
  const nameOf = (id: string) => (ports.has(id) ? airportLabel(regions[id]?.short ?? id) : (regions[id]?.short ?? id));
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
  const pills: { region: string; order: number; x: number; y: number; w: number }[] = [];
  if (activeRoute) {
    for (const s of activeRoute.stops.filter((v) => v.kind === "stop")) {
      const [x, y] = at(s.region);
      const w = textW(nameOf(s.region)) + font * 1.1;
      const spot = placeLabel(x, y, w, font * 1.05, r * 2, labelAbove(e, s.region), notOwn(x, y), frame);
      if (!spot) continue;
      taken.push(spot.box);
      pills.push({ region: s.region, order: s.order, x: spot.x, y: spot.y, w });
    }
  }

  // Active day: a drive-time tag beside each longer leg.
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
      const [mx, my] = legMidpoint(e, leg);
      const text = `${formatHours(leg.hours)}${both ? " each way" : ""}`;
      const w = textW(text, font * 0.82) + font * 0.9;
      const chained = onRoadChain(e, leg.from) && onRoadChain(e, leg.to);
      const above = labelAbove(e, leg.from) && labelAbove(e, leg.to);
      // along a road chain: beside the road on the open side; elsewhere: right on the line
      const prefer: LabelSpot["side"][] = !chained ? ["on", "left", "right", "above", "below"] : above ? ["below", "above", "left", "right"] : ["left", "right", "below", "above"];
      const spot = placeLabel(mx, my, w, tagFont, r * 1.3, above, taken, frame, prefer);
      if (!spot) return;
      taken.push(spot.box);
      legTags.push({ key: i, text, x: spot.x, y: spot.y, w });
    });
  }

  // Labels: bases and airports first, then the places visited, each on the first free side of its dot.
  const labels: { region: string; x: number; y: number; text: string; open: boolean }[] = [];
  const order = [...new Set([...baseRegions, ...[...ports].filter((p) => visited.has(p)), ...visited])].filter((x) => regions[x]);
  for (const id of order) {
    if (activeRoute && activeRoute.stops.some((s) => s.region === id && s.kind === "stop")) continue; // shown as a pill instead
    const [px, py] = at(id);
    const text = nameOf(id);
    const above = labelAbove(e, id);
    const spot = placeLabel(px, py, textW(text), font, r * 1.7, above, notOwn(px, py), frame);
    if (!spot) continue;
    taken.push(spot.box);
    labels.push({ region: id, x: spot.x, y: spot.y, text, open: above ? spot.side === "below" : spot.side === "left" && onRoadChain(e, id) });
  }

  // All days: a numbered badge by each day's furthest stop.
  const badges: { day: DayRoute; x: number; y: number; sx: number; sy: number; far: boolean }[] = [];
  if (active === null) {
    for (const d of routes) {
      const best = badgeStop(e, d);
      if (!best) continue;
      const [sx, sy] = at(best.region);
      const spot = placeBadge(sx, sy, r * 1.2, labelAbove(e, best.region), taken, frame);
      if (spot) taken.push(spot.box);
      badges.push({ day: d, x: spot?.x ?? sx + r * 2.2, y: spot?.y ?? sy + r * 2.2, sx, sy, far: !!spot?.far });
    }
  }

  // Faint latitude lines every half degree across the frame.
  const { maxLat, scale, pad } = preset.map.projection;
  const latOf = (y: number) => maxLat - (y - pad) / scale;
  const lats: number[] = [];
  for (let lat = Math.ceil(latOf(full.y + full.h) * 2) / 2; lat <= latOf(full.y); lat += 0.5) lats.push(lat);

  const drawOrder = [...routes].sort((a, b) => (a.index === active ? 1 : 0) - (b.index === active ? 1 : 0));

  return (
    <motion.svg
      initial={false}
      animate={{ viewBox: `${box.x} ${box.y} ${box.w} ${box.h}` }}
      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 140, damping: 24 }}
      viewBox={`${full.x} ${full.y} ${full.w} ${full.h}`}
      className={cn("block h-auto w-full", className)}
      role="img"
      aria-label={`Route map: ${routes.map((d) => `day ${d.index + 1} ${d.stops.map((s) => regions[s.region]?.short).join(", ")}`).join("; ")}`}
    >
      <defs>
        <linearGradient id="cm-sea" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={pal.primary["800"]} />
          <stop offset="1" stopColor={pal.primary["900"]} />
        </linearGradient>
        <linearGradient id="cm-land" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={pal.surface["50"]} />
          <stop offset="1" stopColor={pal.surface["200"]} />
        </linearGradient>
        <filter id="cm-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy={H * 0.004} stdDeviation={H * 0.006} floodColor={pal.primary["950"]} floodOpacity="0.45" />
        </filter>
      </defs>
      <rect x={full.x} y={full.y} width={full.w} height={full.h} fill="url(#cm-sea)" />
      {lats.map((lat) => {
        const [, y] = regionPoint(e, [lat, preset.map.projection.minLng]);
        return <line key={lat} x1={full.x} x2={full.x + full.w} y1={y} y2={y} stroke="#ffffff" strokeOpacity="0.06" strokeWidth={H * 0.002} strokeDasharray={`${H * 0.01} ${H * 0.012}`} />;
      })}
      {preset.map.surroundings && (
        <path d={preset.map.surroundings} fill={pal.surface["400"]} fillOpacity={0.3} stroke={pal.surface["200"]} strokeOpacity={0.25} strokeWidth={H * 0.002} />
      )}
      <path d={preset.map.detail} fill="url(#cm-land)" stroke={pal.paper} strokeWidth={H * 0.003} filter="url(#cm-shadow)" />

      {drawOrder.map((d) => {
        const n = routes.length;
        const dpath = smoothPath(routePoints(e, d, laneFor(routes.indexOf(d), n, gap)));
        const dim = active !== null && d.index !== active;
        const on = d.index === active;
        return (
          <g key={d.index} opacity={dim ? 0.18 : 1} style={{ transition: "opacity 250ms" }}>
            <path d={dpath} fill="none" stroke={pal.paper} strokeOpacity="0.85" strokeWidth={(on ? 1.9 : 1) * stroke + H * 0.004} strokeLinecap="round" strokeLinejoin="round" />
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
              <path d={dpath} fill="none" stroke="transparent" strokeWidth={stroke * 5} className="cursor-pointer" onClick={() => onActive(on ? null : d.index)} />
            )}
          </g>
        );
      })}

      {/* stops */}
      {routes.map((d) => {
        const dim = active !== null && d.index !== active;
        if (dim) return null;
        return d.stops.map((s) => {
          const [x, y] = at(s.region);
          if (s.kind !== "stop") {
            return (
              <circle
                key={`${d.index}-${s.region}`}
                cx={x}
                cy={y}
                r={s.kind === "base" ? r * 1.15 : r * 0.9}
                fill={s.kind === "base" ? pal.highlight["500"] : pal.ink["1"]}
                stroke={pal.ink["1"]}
                strokeWidth={H * 0.004}
              />
            );
          }
          return <circle key={`${d.index}-${s.region}`} cx={x} cy={y} r={active === null ? r * 0.7 : r * 0.8} fill={pal.paper} stroke={d.color} strokeWidth={H * 0.0055} />;
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
          fill={l.open ? pal.paper : pal.ink["2"]}
          fontFamily="var(--font-sans)"
          paintOrder="stroke"
          stroke={l.open ? pal.primary["900"] : pal.surface["100"]}
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
              <rect x={t.x} y={t.y - font * 0.81} width={t.w} height={font * 1.04} rx={font * 0.52} fill={activeRoute.color} stroke={pal.paper} strokeWidth={H * 0.0025} />
              <text x={t.x + t.w / 2} y={t.y - font * 0.03} textAnchor="middle" fontSize={font * 0.82} fontWeight={700} fill={pal.paper} fontFamily="var(--font-sans)">
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
                  <circle cx={x} cy={y} r={r * 1.25} fill={activeRoute.color} stroke={pal.paper} strokeWidth={H * 0.005} />
                  <text x={x} y={y + font * 0.36} textAnchor="middle" fontSize={font} fontWeight={800} fill={pal.paper} fontFamily="var(--font-sans)">
                    {s.order}
                  </text>
                </g>
              );
            })}
          {pills.map((p) => (
            <g key={p.region}>
              <rect x={p.x} y={p.y - font * 1.02} width={p.w} height={font * 1.3} rx={font * 0.65} fill={pal.paper} stroke={activeRoute.color} strokeWidth={H * 0.003} />
              <text x={p.x + p.w / 2} y={p.y} textAnchor="middle" fontSize={font} fontWeight={700} fill={pal.ink["1"]} fontFamily="var(--font-sans)">
                {nameOf(p.region)}
              </text>
            </g>
          ))}
        </g>
      )}

      {/* all days: a day badge by each day's furthest stop */}
      {badges.map((b) => (
        <g key={`badge-${b.day.index}`} onClick={onActive ? () => onActive(b.day.index) : undefined} className={onActive ? "cursor-pointer" : undefined}>
          {b.far && <line x1={b.sx} y1={b.sy} x2={b.x} y2={b.y} stroke={b.day.color} strokeWidth={H * 0.004} strokeLinecap="round" />}
          <circle cx={b.x} cy={b.y} r={r * 1.2} fill={b.day.color} stroke={pal.paper} strokeWidth={H * 0.005} />
          <text x={b.x} y={b.y + font * 0.35} textAnchor="middle" fontSize={font * 0.95} fontWeight={800} fill={pal.paper} fontFamily="var(--font-sans)">
            {b.day.index + 1}
          </text>
        </g>
      ))}
    </motion.svg>
  );
}
