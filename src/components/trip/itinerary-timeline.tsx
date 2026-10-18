"use client";

import { Moon, Sun } from "lucide-react";
import { useState } from "react";
import { chillNight, regions, type Option, type RegionId } from "@/content";
import { cn } from "@/lib/cn";
import type { ItineraryData } from "@/lib/itinerary";
import type { Timeline } from "@/lib/timeline";
import { Firework } from "../brand/illustrations";
import { Photo } from "../ui/photo";
import { RoadTrip, ToAirport, VibeDots, Warning } from "./bits";
import { OptionDetail } from "./option-detail";

/** Read-only, beautiful vertical timeline of a whole itinerary. */
export function ItineraryTimeline({ data, timeline }: { data: ItineraryData; timeline: Timeline }) {
  const [detail, setDetail] = useState<Option | null>(null);
  return (
    <>
      <ol className="relative">
        <span className="absolute bottom-6 left-[19px] top-4 w-0.5 border-l-2 border-dashed border-sand-300" aria-hidden="true" />
        {timeline.days.map((t) => {
          const nye = t.tags.includes("nye");
          const note = data.days[t.index]?.note;
          return (
            <li key={t.index} className="relative pb-6 pl-12">
              <span
                className={cn(
                  "font-display absolute left-0 top-0 grid size-10 place-items-center rounded-full text-[17px] font-bold ring-4 ring-sand-100",
                  nye ? "bg-dusk-900 text-saffron-400" : "bg-ink text-paper",
                )}
              >
                {t.index + 1}
              </span>
              <div className="flex flex-wrap items-baseline gap-x-2 pt-1.5">
                <h3 className="font-display text-[20px] font-semibold leading-none">{t.label}</h3>
                {t.tags.includes("arrival") && <span className="text-[12px] font-bold text-ocean-600">Arrival</span>}
                {t.tags.includes("departure") && <span className="text-[12px] font-bold text-sunset-600">Departure</span>}
                {nye && (
                  <span className="inline-flex items-center gap-1 text-[12px] font-bold text-hibiscus-600">
                    <Firework className="size-3.5" /> New Year&apos;s Eve
                  </span>
                )}
              </div>
              <div className="mt-2.5 space-y-2">
                {t.beforeDay && <RoadTrip seg={t.beforeDay} />}
                <PickRow kind="day" option={t.day} onOpen={setDetail} />
                {t.beforeNight && <RoadTrip seg={t.beforeNight} />}
                <PickRow kind="night" option={t.night} onOpen={setDetail} />
                {note && <p className="rounded-xl bg-paper px-3 py-2 text-[13px] italic text-ink-2 shadow-card">“{note}”</p>}
                {t.warnings.map((w) => (
                  <Warning key={w} text={w} />
                ))}
              </div>
            </li>
          );
        })}
      </ol>
      {timeline.toAirport && <ToAirport seg={timeline.toAirport} />}
      <OptionDetail open={!!detail} option={detail} onClose={() => setDetail(null)} />
    </>
  );
}

function PickRow({ kind, option, onOpen }: { kind: "day" | "night"; option: Option | "chill" | null; onOpen: (o: Option) => void }) {
  const night = kind === "night";
  if (!option) {
    return (
      <div className={cn("flex h-12 items-center gap-2.5 rounded-2xl px-3 text-[13.5px] font-medium", night ? "bg-dusk-900/[0.06] text-ink-3" : "bg-sand-200/50 text-ink-3")}>
        {night ? <Moon className="size-4" /> : <Sun className="size-4" />}
        {night ? "Free evening" : "Free daytime"}
      </div>
    );
  }
  const chill = option === "chill";
  const title = chill ? chillNight.title : option.title;
  const region: RegionId | null = chill ? null : option.region;
  return (
    <button
      disabled={chill}
      onClick={() => !chill && onOpen(option)}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl p-2 pr-3 text-left transition enabled:active:scale-[0.99]",
        night ? "dusk text-paper" : "bg-paper shadow-card",
      )}
    >
      <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-ocean-800">
        <Photo photo={chill ? chillNight.images[0] : option.images[0]} alt={title} sizes="56px" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("label block", night ? "text-saffron-400" : "text-sunset-600")}>{night ? "Evening" : "Daytime"}</span>
        <span className="line-clamp-2 text-[14.5px] font-semibold leading-tight">{title}</span>
        <span className={cn("mt-0.5 flex items-center gap-2 text-[11.5px] font-medium", night ? "text-paper/60" : "text-ink-3")}>
          {region ? regions[region].short : "At the villa"}
          {!chill && <VibeDots vibe={option.vibe} />}
        </span>
      </span>
    </button>
  );
}

export function routeStops(timeline: Timeline): RegionId[] {
  const stops: RegionId[] = ["airport"];
  for (const d of timeline.days) {
    for (const seg of [d.beforeDay, d.beforeNight]) {
      if (seg && stops[stops.length - 1] !== seg.to) stops.push(seg.to);
    }
  }
  if (timeline.toAirport) stops.push("airport");
  return stops;
}
