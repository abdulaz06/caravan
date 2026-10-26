"use client";

import { motion } from "framer-motion";
import { labelAbove, placeLabel, projector, type Rect } from "@/engine/routes";
import { cn } from "@/lib/cn";
import { useEngine } from "../engine";

type Props = {
  /** How many picks each place got (the group overview's "popular places"). */
  weights: { region: string; count: number }[];
  className?: string;
};

const FONT = 12;

/** The destination's outline with a bubble per place, sized by how often it was picked. */
export function RouteMap({ weights, className }: Props) {
  const e = useEngine();
  const { map } = e.catalog.preset;
  const regions = e.catalog.regions;
  const project = projector(e);
  const max = Math.max(1, ...weights.map((w) => w.count));
  const frame: Rect = { x: 0, y: 0, w: map.width, h: map.height };

  // Labels for the busiest places first, wherever they fit without overlapping.
  const taken: Rect[] = [];
  const placed = weights
    .filter((w) => regions[w.region])
    .map((w) => {
      const [x, y] = project(regions[w.region].lat, regions[w.region].lng);
      const r = 6 + (w.count / max) * 18;
      taken.push({ x: x - r, y: y - r, w: r * 2, h: r * 2 });
      return { ...w, x, y, r };
    });
  const labels = placed
    .slice()
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map((w) => {
      const text = regions[w.region].short;
      const spot = placeLabel(w.x, w.y, text.length * FONT * 0.55, FONT, w.r + 3, labelAbove(e, w.region), taken, frame);
      if (spot) taken.push(spot.box);
      return spot ? { region: w.region, text, ...spot } : null;
    })
    .filter((l): l is NonNullable<typeof l> => !!l);

  return (
    <svg
      viewBox={`0 0 ${map.width} ${map.height}`}
      className={cn("h-auto w-full", className)}
      role="img"
      aria-label={`Popular places: ${weights.map((w) => regions[w.region]?.short).filter(Boolean).join(", ")}`}
    >
      <defs>
        <filter id="map-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity={0.15} />
        </filter>
      </defs>
      {map.outline.map((p, i) => (
        <path key={i} d={p} fill="var(--color-secondary-100)" stroke="var(--color-secondary-400)" strokeWidth={1} filter="url(#map-shadow)" />
      ))}
      {placed.map((w) => (
        <motion.circle
          key={w.region}
          cx={w.x}
          cy={w.y}
          initial={{ r: 0 }}
          animate={{ r: w.r }}
          transition={{ type: "spring", stiffness: 120, damping: 14 }}
          fill="var(--color-accent-500)"
          fillOpacity="0.75"
          stroke="var(--color-paper)"
          strokeWidth="2"
        />
      ))}
      {labels.map((l) => (
        <text
          key={l.region}
          x={l.x}
          y={l.y}
          fontSize={FONT}
          fontWeight="700"
          fill="var(--color-ink)"
          fontFamily="var(--font-sans)"
          paintOrder="stroke"
          stroke="var(--color-secondary-100)"
          strokeWidth="3"
        >
          {l.text}
        </text>
      ))}
    </svg>
  );
}
