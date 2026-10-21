"use client";

import { motion } from "framer-motion";
import { regions, type RegionId } from "@/content";
import { MAP, project } from "@/lib/map-data";
import { cn } from "@/lib/cn";

/**
 * Where each region's label sits relative to its dot, so nothing clips or
 * collides. "none" = dot only (the little towns clustered around Galle).
 */
const LABEL: Record<RegionId, "r" | "l" | "b" | "t" | "none"> = {
  airport: "t",
  colombo: "r",
  "mount-lavinia": "none",
  negombo: "r",
  kalutara: "r",
  bentota: "r",
  kosgoda: "none",
  balapitiya: "none",
  ambalangoda: "none",
  hikkaduwa: "r",
  galle: "l",
  unawatuna: "none",
  koggala: "none",
  ahangama: "none",
  weligama: "none",
  mirissa: "t",
  madiha: "none",
  hiriketiya: "r",
  mulkirigala: "r",
  kottawa: "r",
  hiyare: "none",
  kanneliya: "r",
  sinharaja: "r",
  udawalawe: "r",
  ella: "r",
};

type Props = {
  stops: RegionId[]; // main route in visiting order, starting at the airport
  /** There-and-back trips from a base, drawn as thinner dashed lines. */
  spokes?: { from: RegionId; to: RegionId }[];
  className?: string;
  /** Optional weights to draw bubbles instead of a route (group view). */
  weights?: { region: RegionId; count: number }[];
  tone?: "dark" | "light";
};

export function RouteMap({ stops, spokes = [], className, weights, tone = "dark" }: Props) {
  const dark = tone === "dark";
  const pts = stops.map((r) => project(regions[r].lat, regions[r].lng));
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const max = weights ? Math.max(1, ...weights.map((w) => w.count)) : 1;
  const unique = [...new Set([...stops, ...spokes.map((s) => s.to)])];

  return (
    <svg viewBox={`0 0 ${MAP.width} ${MAP.height}`} className={cn("h-auto w-full", className)} role="img" aria-label={`Route: ${unique.map((r) => regions[r].short).join(", ")}`}>
      <defs>
        <filter id="map-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity={dark ? 0.35 : 0.15} />
        </filter>
      </defs>
      {MAP.paths.map((p, i) => (
        <path
          key={i}
          d={p}
          fill={dark ? "#f7eee0" : "#e8f2e3"}
          stroke={dark ? "#fffbf4" : "#6aa06a"}
          strokeWidth={dark ? 0 : 1}
          filter="url(#map-shadow)"
        />
      ))}
      {weights
        ? weights.map((w) => {
            const [x, y] = project(regions[w.region].lat, regions[w.region].lng);
            const r = 6 + (w.count / max) * 18;
            return (
              <g key={w.region}>
                <motion.circle
                  cx={x}
                  cy={y}
                  initial={{ r: 0 }}
                  animate={{ r }}
                  transition={{ type: "spring", stiffness: 120, damping: 14 }}
                  fill="#ec6437"
                  fillOpacity="0.75"
                  stroke="#fffbf4"
                  strokeWidth="2"
                />
                {LABEL[w.region] !== "none" && <text
                  x={LABEL[w.region] === "l" ? x - r - 3 : x + r + 3}
                  y={y + 4}
                  textAnchor={LABEL[w.region] === "l" ? "end" : "start"}
                  fontSize="12"
                  fontWeight="700"
                  fill="#1d1914"
                  fontFamily="var(--font-instrument)"
                  paintOrder="stroke"
                  stroke="#e8f2e3"
                  strokeWidth="3"
                >
                  {regions[w.region].short}
                </text>}
              </g>
            );
          })
        : pts.length > 1 && (
            <>
              <motion.path
                d={d}
                fill="none"
                stroke="#ec6437"
                strokeWidth="3.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="1 7"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.6, ease: "easeInOut", delay: 0.3 }}
              />
              {spokes.map((s, i) => {
                const [x1, y1] = project(regions[s.from].lat, regions[s.from].lng);
                const [x2, y2] = project(regions[s.to].lat, regions[s.to].lng);
                return (
                  <motion.path
                    key={`${s.from}-${s.to}`}
                    d={`M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}`}
                    fill="none"
                    stroke="#1a8e9c"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeDasharray="1 5"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.6, delay: 1.2 + i * 0.15 }}
                  />
                );
              })}
              {unique.map((r, i) => {
                const [x, y] = project(regions[r].lat, regions[r].lng);
                const pos = LABEL[r];
                const showLabel = LABEL[r] !== "none" && !(r === "negombo" && unique.includes("airport"));
                return (
                  <motion.g
                    key={r}
                    initial={{ opacity: 0, scale: 0.4 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 + (i / Math.max(1, unique.length)) * 1.5 }}
                    style={{ transformOrigin: `${x}px ${y}px` }}
                  >
                    <circle
                      cx={x}
                      cy={y}
                      r={r === "airport" ? 5 : r === "colombo" || r === "galle" ? 7.5 : 5}
                      fill={r === "airport" ? "#1d1914" : r === "colombo" || r === "galle" ? "#f2a33a" : "#d6efeb"}
                      stroke="#1d1914"
                      strokeWidth="2"
                    />
                    {showLabel && <text
                      x={pos === "l" ? x - 10 : pos === "r" ? x + 10 : x}
                      y={pos === "b" ? y + 20 : pos === "t" ? y - 10 : y + 4}
                      textAnchor={pos === "l" ? "end" : pos === "r" ? "start" : "middle"}
                      fontSize="12.5"
                      fontWeight="700"
                      fill="#1d1914"
                      fontFamily="var(--font-instrument)"
                      paintOrder="stroke"
                      stroke="#f7eee0"
                      strokeWidth="3"
                    >
                      {r === "airport" ? "CMB ✈" : regions[r].short}
                    </text>}
                  </motion.g>
                );
              })}
            </>
          )}
    </svg>
  );
}
