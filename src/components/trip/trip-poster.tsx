"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { regions } from "@/content";
import { flexibility as FLEX } from "@/content/preferences";
import { cn } from "@/lib/cn";
import { dayLabel } from "@/lib/dates";
import { DAY_NAMES, nights, tripLength, type ItineraryData } from "@/lib/itinerary";
import { dayRoutes } from "@/lib/routes";
import type { Timeline } from "@/lib/timeline";
import { Palm } from "../brand/illustrations";
import { CoastMap } from "./coast-map";

/** The travel-poster summary card at the top of a review/itinerary view, with the day-by-day route map. */
export function TripPoster({ name, data, timeline }: { name: string; data: ItineraryData; timeline: Timeline }) {
  const len = tripLength(data);
  const nts = nights(len);
  const flex = FLEX.find((f) => f.id === data.flexibility);
  const routes = useMemo(() => dayRoutes(data, timeline), [data, timeline]);
  const [active, setActive] = useState<number | null>(null);
  const activeRoute = active === null ? null : routes[active];
  const activeDay = active === null ? null : timeline.days[active];

  return (
    <section className="relative overflow-hidden rounded-[30px] bg-ocean-800 text-paper shadow-lift">
      <div className="sunburst absolute inset-0" />
      <Palm className="absolute -right-6 top-10 h-40 text-ocean-950/40" />
      <div className="relative p-5 pb-4">
        <p className="label text-saffron-400">Sri Lanka · {data.startDate?.startsWith("2027") ? "2027" : "2026"}</p>
        <h2 className="font-display mt-2 text-[34px] font-semibold leading-[0.95] tracking-[-0.025em] [overflow-wrap:anywhere]">
          {name}&apos;s <span className="italic text-saffron-400">Sri Lanka</span>
        </h2>
        {data.startDate && data.endDate && (
          <p className="mt-2 text-[13.5px] leading-snug text-paper/80">
            {dayLabel(data.startDate)} → {dayLabel(data.endDate)}
          </p>
        )}
        <dl className="mt-4 grid grid-cols-4 gap-2">
          <Stat label="Days · nights" value={`${len}·${nts.total}`} />
          <Stat label="Colombo + Galle" value={`${nts.colombo}+${nts.galle}`} />
          <Stat label="Hrs on the road" value={`~${Math.round(timeline.totalHours)}`} />
          {flex && <Stat label="Dates" value={flex.id === "exact" ? "Fixed" : flex.id === "few_days" ? "± days" : "Flexi"} />}
        </dl>
      </div>

      {len > 0 && (
        <div className="relative px-3 pb-3">
          <div className="overflow-hidden rounded-[22px] ring-1 ring-white/10">
            <CoastMap routes={routes} active={active} onActive={setActive} />
          </div>
          <div className="no-scrollbar -mx-3 mt-3 flex gap-1.5 overflow-x-auto px-3 pb-1" role="group" aria-label="Highlight a day">
            <DayChip label="All days" on={active === null} onClick={() => setActive(null)} />
            {routes.map((r) => (
              <DayChip
                key={r.index}
                label={`Day ${r.index + 1}`}
                sub={timeline.days[r.index].date ? dayLabel(timeline.days[r.index].date!).split(" ").slice(0, 2).join(" ") : undefined}
                color={r.color}
                on={active === r.index}
                onClick={() => setActive(active === r.index ? null : r.index)}
              />
            ))}
          </div>
          <AnimatePresence mode="wait" initial={false}>
            {activeRoute && activeDay && (
              <motion.p
                key={active}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-1.5 px-1 text-[12.5px] leading-snug text-paper/80"
              >
                <b className="text-paper">
                  Day {active! + 1} · {DAY_NAMES[activeDay.role]}
                </b>
                {activeRoute.stops.some((s) => s.kind === "stop")
                  ? ` — ${activeRoute.stops
                      .filter((s) => s.kind === "stop")
                      .map((s) => `${s.order}. ${regions[s.region].short}`)
                      .join(" → ")}`
                  : activeDay.role === "departure"
                    ? " — Galle → CMB airport"
                    : " — staying close to base"}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}

function DayChip({ label, sub, color, on, onClick }: { label: string; sub?: string; color?: string; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-bold transition active:scale-95",
        on ? "bg-paper text-ink" : "bg-white/10 text-paper/85 hover:bg-white/15",
      )}
    >
      {color && <span className="size-2.5 rounded-full ring-2 ring-white/70" style={{ background: color }} />}
      {label}
      {sub && <span className={cn("font-semibold", on ? "text-ink-3" : "text-paper/55")}>{sub}</span>}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dd className="font-display text-[22px] font-semibold leading-none">{value}</dd>
      <dt className="mt-1 text-[9.5px] font-bold uppercase leading-tight tracking-wider text-paper/55">{label}</dt>
    </div>
  );
}
