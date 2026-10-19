"use client";

import { Moon, Sun } from "lucide-react";
import { useState } from "react";
import { bases, stayIn, type Option } from "@/content";
import { cn } from "@/lib/cn";
import { isPick, type ItineraryData, type SlotKind } from "@/lib/itinerary";
import { baseDistanceLabel, type SlotView, type Timeline } from "@/lib/timeline";
import { Firework } from "../brand/illustrations";
import { Photo } from "../ui/photo";
import { AddOnChips } from "./addons";
import { RoadTrip, Tip, VibeDots, Warning } from "./bits";
import { StayThumb } from "./day-card";
import { OptionDetail } from "./option-detail";

/** Read-only, beautiful vertical timeline of a whole itinerary. */
export function ItineraryTimeline({ data, timeline }: { data: ItineraryData; timeline: Timeline }) {
  const [detail, setDetail] = useState<Option | null>(null);
  return (
    <>
      <ol className="relative">
        <span className="absolute bottom-6 left-[19px] top-4 w-0.5 border-l-2 border-dashed border-sand-300" aria-hidden="true" />
        {timeline.days.map((t, k) => {
          const nye = t.tags.includes("nye");
          const note = data.days[t.index]?.note;
          const newBase = k === 0 || timeline.days[k - 1].base !== t.base;
          return (
            <li key={t.index} className="relative pb-6 pl-12">
              {newBase && (
                <p className="label -ml-12 mb-3 inline-flex items-center gap-1.5 rounded-full bg-ocean-800 px-3 py-1 text-saffron-400">
                  Base · {bases[t.base].name}
                </p>
              )}
              <div className="relative">
                <span
                  className={cn(
                    "font-display absolute -left-12 top-0 grid size-10 place-items-center rounded-full text-[17px] font-bold ring-4 ring-sand-100",
                    nye ? "bg-dusk-900 text-saffron-400" : "bg-ink text-paper",
                  )}
                >
                  {t.index + 1}
                </span>
                <div className="flex flex-wrap items-baseline gap-x-2 pt-1.5">
                  <h3 className="font-display text-[20px] font-semibold leading-none">{t.label}</h3>
                  {t.tags.includes("arrival") && <span className="text-[12px] font-bold text-ocean-600">Arrival</span>}
                  {t.tags.includes("transfer") && <span className="text-[12px] font-bold text-saffron-600">Move to Galle</span>}
                  {t.tags.includes("departure") && <span className="text-[12px] font-bold text-sunset-600">Departure</span>}
                  {nye && (
                    <span className="inline-flex items-center gap-1 text-[12px] font-bold text-hibiscus-600">
                      <Firework className="size-3.5" /> New Year&apos;s Eve
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-2.5 space-y-2">
                {t.legsBefore.map((l) => (
                  <RoadTrip key={l.title} seg={l} />
                ))}
                <SlotRows kind="day" view={t.day} onOpen={setDetail} />
                <SlotRows kind="night" view={t.night} onOpen={setDetail} />
                {t.legsAfter.map((l) => (
                  <RoadTrip key={l.title} seg={l} />
                ))}
                {note && <p className="rounded-xl bg-paper px-3 py-2 text-[13px] italic text-ink-2 shadow-card">“{note}”</p>}
                {t.tips.map((w) => (
                  <Tip key={w} text={w} />
                ))}
                {t.warnings.map((w) => (
                  <Warning key={w} text={w} />
                ))}
              </div>
            </li>
          );
        })}
      </ol>
      <OptionDetail open={!!detail} option={detail} onClose={() => setDetail(null)} />
    </>
  );
}

function SlotRows({ kind, view, onOpen }: { kind: SlotKind; view: SlotView; onOpen: (o: Option) => void }) {
  return (
    <div className="space-y-1.5">
      {view.before.map((s) => (
        <RoadTrip key={s.title} seg={s} />
      ))}
      <PickRow kind={kind} view={view} onOpen={onOpen} />
      {view.pick?.addOns?.length ? <AddOnChips ids={view.pick.addOns} className="pl-1" /> : null}
      {view.after.map((s) => (
        <RoadTrip key={s.title} seg={s} />
      ))}
    </div>
  );
}

function PickRow({ kind, view, onOpen }: { kind: SlotKind; view: SlotView; onOpen: (o: Option) => void }) {
  const night = kind === "night";
  const option = view.value;
  if (!option) {
    return (
      <div className={cn("flex h-12 items-center gap-2.5 rounded-2xl px-3 text-[13.5px] font-medium", night ? "bg-dusk-900/[0.06] text-ink-3" : "bg-sand-200/50 text-ink-3")}>
        {night ? <Moon className="size-4" /> : <Sun className="size-4" />}
        {night ? "Free evening" : "Free daytime"}
      </div>
    );
  }
  const rowClass = cn(
    "flex w-full items-center gap-3 rounded-2xl p-2 pr-3 text-left transition",
    night ? "dusk text-paper" : "bg-paper shadow-card",
  );
  const eyebrow = (
    <span className={cn("label block", night ? "text-saffron-400" : "text-sunset-600")}>{night ? "Evening" : "Daytime"}</span>
  );
  if (option === "stay") {
    const s = stayIn[kind];
    return (
      <div className={rowClass}>
        <StayThumb kind={kind} className="size-14" />
        <span className="min-w-0 flex-1">
          {eyebrow}
          <span className="text-[14.5px] font-semibold leading-tight">{s.title}</span>
          <span className={cn("mt-0.5 flex items-center gap-2 text-[11.5px] font-medium", night ? "text-paper/60" : "text-ink-3")}>
            <span className="truncate">{s.tagline}</span>
          </span>
        </span>
      </div>
    );
  }
  const transport = isPick(view.pick) ? view.pick.transport : undefined;
  return (
    <button onClick={() => onOpen(option)} className={cn(rowClass, "active:scale-[0.99]")}>
      <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-ocean-800">
        <Photo photo={option.images[0]} alt={option.title} sizes="56px" />
      </span>
      <span className="min-w-0 flex-1">
        {eyebrow}
        <span className="line-clamp-2 text-[14.5px] font-semibold leading-tight">{option.title}</span>
        <span className={cn("mt-0.5 flex items-center gap-2 text-[11.5px] font-medium", night ? "text-paper/60" : "text-ink-3")}>
          <span className="truncate">
            {transport ? (transport === "train" ? "By scenic train" : "By road") : baseDistanceLabel(option)}
          </span>
          <VibeDots vibe={option.vibe} />
        </span>
      </span>
    </button>
  );
}
