"use client";

import { flexibility as FLEX } from "@/content/preferences";
import { dayLabel } from "@/lib/dates";
import { nights, tripLength, type ItineraryData } from "@/lib/itinerary";
import type { Timeline } from "@/lib/timeline";
import { Palm } from "../brand/illustrations";
import { RouteMap } from "./route-map";

/** The travel-poster summary card at the top of a review/itinerary view. */
export function TripPoster({ name, data, timeline }: { name: string; data: ItineraryData; timeline: Timeline }) {
  const len = tripLength(data);
  const nts = nights(len);
  const flex = FLEX.find((f) => f.id === data.flexibility);
  return (
    <section className="relative overflow-hidden rounded-[30px] bg-ocean-800 text-paper shadow-lift">
      <div className="sunburst absolute inset-0" />
      <Palm className="absolute -left-6 bottom-0 h-40 text-ocean-950/40" />
      <div className="relative grid grid-cols-[1fr_44%] gap-2 p-5 pr-3">
        <div className="flex min-w-0 flex-col">
          <p className="label text-saffron-400">Sri Lanka · {data.startDate?.startsWith("2027") ? "2027" : "2026"}</p>
          <h2 className="font-display mt-2 text-[34px] font-semibold leading-[0.95] tracking-[-0.025em] [overflow-wrap:anywhere]">
            {name}&apos;s
            <br />
            <span className="italic text-saffron-400">Sri Lanka</span>
          </h2>
          {data.startDate && data.endDate && (
            <p className="mt-3 text-[13.5px] leading-snug text-paper/80">
              {dayLabel(data.startDate)} →<br />
              {dayLabel(data.endDate)}
            </p>
          )}
          <dl className="mt-auto grid grid-cols-2 gap-x-3 gap-y-2 pt-5">
            <Stat label="Days · nights" value={`${len}·${nts.total}`} />
            <Stat label="Colombo + Galle" value={`${nts.colombo}+${nts.galle}`} />
            <Stat label="Hrs on the road" value={`~${Math.round(timeline.totalHours)}`} />
            {flex && <Stat label="Dates" value={flex.id === "exact" ? "Fixed" : flex.id === "few_days" ? "± days" : "Flexi"} />}
          </dl>
        </div>
        <div className="self-center">
          <RouteMap stops={timeline.route} spokes={timeline.spokes} />
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dd className="font-display text-[24px] font-semibold leading-none">{value}</dd>
      <dt className="mt-0.5 text-[10.5px] font-bold uppercase tracking-wider text-paper/55">{label}</dt>
    </div>
  );
}
