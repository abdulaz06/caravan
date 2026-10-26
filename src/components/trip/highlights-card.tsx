"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";
import { cn } from "@/lib/cn";
import { HIGHLIGHT_ICONS, highlightsTitle, tripHighlights, type HighlightKind } from "@/engine/highlights";
import type { ItineraryData } from "@/engine/itinerary";
import { useEngine } from "../engine";

/** A highlight's custom icon on its round tile (same art as the share images). */
export function HighlightIconView({ kind, className }: { kind: HighlightKind; className?: string }) {
  const icon = HIGHLIGHT_ICONS[kind];
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="16" fill={icon.tile} />
      <g transform="translate(4 4)" strokeLinecap="round" strokeLinejoin="round">
        {icon.parts.map((p, i) => (
          <path key={i} d={p.d} fill={p.fill ?? "none"} stroke={p.stroke} strokeWidth={p.w} />
        ))}
      </g>
    </svg>
  );
}

/**
 * "Trip highlights": what the plan adds up to — beaches, hikes, temples,
 * sunsets — as icon tiles with counts. Family-friendly mode shows it in place
 * of the vibe meter; `action` holds its switch.
 */
export function HighlightsCard({ data, action, className }: { data: ItineraryData; action?: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  const e = useEngine();
  const all = useMemo(() => tripHighlights(e, data), [e, data]);
  const shown = all.slice(0, 6);
  const more = all.length - shown.length;
  return (
    <div className={className} aria-label="Trip highlights">
      <div className="mb-3.5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="label text-ink-3">Trip highlights</p>
          <motion.p
            key={highlightsTitle(e, all)}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display text-[26px] font-semibold leading-tight"
          >
            {highlightsTitle(e, all)}
          </motion.p>
        </div>
        {action && <div className="shrink-0 pb-1">{action}</div>}
      </div>
      {shown.length ? (
        <ul className="grid grid-cols-3 gap-2">
          {shown.map((h, i) => (
            <motion.li
              key={h.kind}
              initial={reduce ? false : { opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: i * 0.05, type: "spring", stiffness: 380, damping: 26 }}
              className={cn("flex flex-col items-center rounded-[20px] bg-surface-100 px-1.5 pb-3 pt-3 text-center ring-1 ring-ink/[0.03]")}
            >
              <HighlightIconView kind={h.kind} className="size-12 drop-shadow-sm" />
              <span className="font-display mt-1.5 text-[28px] font-semibold leading-none tabular-nums">{h.count}</span>
              <span className="mt-1 text-[12px] font-semibold leading-tight text-ink-2">{h.label}</span>
            </motion.li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl bg-surface-100 px-4 py-5 text-center text-[13.5px] text-ink-3">Pick a few things and your highlights show up here.</p>
      )}
      {shown.length > 0 && (
        <p className="mt-2.5 text-center text-[12px] text-ink-3">
          {more > 0 ? `+ ${more} more kind${more === 1 ? "" : "s"} of moment · ` : ""}Counted from your picks
        </p>
      )}
    </div>
  );
}
