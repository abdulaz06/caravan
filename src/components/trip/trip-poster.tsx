"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { tripLength, type ItineraryData } from "@/engine/itinerary";
import { dayRoutes } from "@/engine/routes";
import { nightsFor } from "@/engine/structure";
import { departureLeg, type Timeline } from "@/engine/timeline";
import { cn } from "@/lib/cn";
import { dayLabel } from "@/lib/dates";
import { useArt } from "../brand/art";
import { useEngine } from "../engine";
import { ChipScroller } from "../ui/chip-scroller";
import { TripMap, airportLabel } from "./trip-map";

/** How set someone's dates are, in one word for the poster. */
const FLEX_SHORT: Record<string, string> = { exact: "Fixed", few_days: "± days", very: "Flexi" };

/** The travel-poster summary card at the top of a review/itinerary view, with the day-by-day route map. */
export function TripPoster({ name, data, timeline }: { name: string; data: ItineraryData; timeline: Timeline }) {
  const e = useEngine();
  const { preset, regions } = e.catalog;
  const { Decor } = useArt();
  const len = tripLength(data);
  const split = nightsFor(e, len).filter((s) => s.nights > 0);
  const flex = preset.preferences.flexibility.find((f) => f.id === data.flexibility);
  const routes = useMemo(() => dayRoutes(e, data, timeline), [e, data, timeline]);
  const [active, setActive] = useState<number | null>(null);
  const activeRoute = active === null ? null : routes[active];
  const activeDay = active === null ? null : timeline.days[active];
  const year = data.startDate ? data.startDate.slice(0, 4) : preset.dates.window.start.slice(0, 4);
  const departure = timeline.days.length ? departureLeg(e, timeline.days[timeline.days.length - 1].plan) : undefined;

  return (
    <section className="relative overflow-hidden rounded-[30px] bg-primary-800 text-paper shadow-lift">
      <div className="sunburst absolute inset-0" />
      <Decor className="absolute -right-6 top-10 h-40 text-primary-950/40" />
      <div className="relative p-5 pb-4">
        <p className="label text-highlight-400">
          {preset.name} · {year}
        </p>
        <h2 className="font-display mt-2 text-[34px] font-semibold leading-[0.95] tracking-[-0.025em] [overflow-wrap:anywhere]">
          {name}&apos;s <span className="italic text-highlight-400">{preset.name}</span>
        </h2>
        {data.startDate && data.endDate && (
          <p className="mt-2 text-[13.5px] leading-snug text-paper/80">
            {dayLabel(data.startDate)} → {dayLabel(data.endDate)}
          </p>
        )}
        <dl className="mt-4 grid grid-cols-4 gap-2">
          <Stat label="Days · nights" value={`${len}·${Math.max(0, len - 1)}`} />
          {split.length > 1 ? (
            <Stat label={split.map((s) => s.base.name).join(" + ")} value={split.map((s) => s.nights).join("+")} />
          ) : (
            <Stat label={`Nights in ${split[0]?.base.name ?? preset.name}`} value={`${split[0]?.nights ?? 0}`} />
          )}
          <Stat label="Hrs on the road" value={`~${Math.round(timeline.totalHours)}`} />
          {flex && <Stat label="Dates" value={FLEX_SHORT[flex.id] ?? flex.label} />}
        </dl>
      </div>

      {len > 0 && (
        <div className="relative px-3 pb-3">
          <div className="overflow-hidden rounded-[22px] ring-1 ring-white/10">
            <TripMap routes={routes} active={active} onActive={setActive} />
          </div>
          <ChipScroller label="Highlight a day" activeKey={active ?? "all"} className="-mx-3 mt-3">
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
          </ChipScroller>
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
                  Day {active! + 1} · {activeDay.name}
                </b>
                {activeRoute.stops.some((s) => s.kind === "stop")
                  ? ` — ${activeRoute.stops
                      .filter((s) => s.kind === "stop")
                      .map((s) => `${s.order}. ${regions[s.region]?.short ?? s.region}`)
                      .join(" → ")}`
                  : activeDay.plan.kind === "departure" && departure
                    ? ` — ${regions[departure.from]?.short} → ${airportLabel(regions[departure.to]?.short ?? "")}`
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
      data-active={on}
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
    <div className="min-w-0">
      <dd className="font-display text-[22px] font-semibold leading-none">{value}</dd>
      <dt className="mt-1 text-[9.5px] font-bold uppercase leading-tight tracking-wider text-paper/55 [overflow-wrap:anywhere]">{label}</dt>
    </div>
  );
}
