"use client";

import { Moon, Sun } from "lucide-react";
import { useState } from "react";
import { formatHours, type Activity, type Where } from "@/content";
import { cn } from "@/lib/cn";
import type { ItineraryData, SlotKind } from "@/lib/itinerary";
import type { SlotView, Timeline } from "@/lib/timeline";
import { Firework } from "../brand/illustrations";
import { RoadTrip, Tip, Warning } from "./bits";
import { ItemRow } from "./day-card";
import { OptionDetail } from "./option-detail";

/** Read-only, beautiful vertical timeline of a whole itinerary. */
export function ItineraryTimeline({ data, timeline }: { data: ItineraryData; timeline: Timeline }) {
  const [detail, setDetail] = useState<{ a: Activity; where: Where | null } | null>(null);
  return (
    <>
      <ol className="relative">
        <span className="absolute bottom-6 left-[19px] top-4 w-0.5 border-l-2 border-dashed border-sand-300" aria-hidden="true" />
        {timeline.days.map((t) => {
          const nye = t.tags.includes("nye");
          const note = data.days[t.index]?.note;
          const galleNights = timeline.days.length - 2;
          const section = t.role === "colombo" ? "Colombo · 1 night" : t.role === "transfer" ? `Galle · ${galleNights} nights` : null;
          return (
            <li key={t.index} className="relative pb-6 pl-12">
              {section && (
                <p className="label -ml-12 mb-3 inline-flex items-center gap-1.5 rounded-full bg-ocean-800 px-3 py-1 text-saffron-400">{section}</p>
              )}
              <div className="relative">
                <span
                  className={cn(
                    "font-display absolute -left-12 top-0 grid size-10 place-items-center rounded-full text-[17px] font-bold ring-4 ring-sand-100",
                    nye ? "bg-dusk-900 text-saffron-400" : t.role === "departure" ? "bg-ocean-700 text-paper" : "bg-ink text-paper",
                  )}
                >
                  {t.index + 1}
                </span>
                <div className="flex flex-wrap items-baseline gap-x-2 pt-1.5">
                  <h3 className="font-display text-[20px] font-semibold leading-none">{t.label}</h3>
                  <span
                    className={cn(
                      "text-[12px] font-bold",
                      t.role === "colombo" ? "text-ocean-600" : t.role === "transfer" ? "text-saffron-600" : t.role === "departure" ? "text-sunset-600" : "text-jungle-700",
                    )}
                  >
                    {t.name}
                  </span>
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
                {t.role !== "departure" ? (
                  <>
                    <SlotRows kind="day" view={t.day} date={t.date} onOpen={(a) => setDetail({ a, where: t.day.where })} />
                    <SlotRows kind="night" view={t.night} date={t.date} onOpen={(a) => setDetail({ a, where: t.night.where })} />
                  </>
                ) : (
                  <p className="rounded-2xl bg-ocean-100/60 px-3 py-2.5 text-[13px] text-ocean-900">
                    Check out, last swim, and the road back to CMB. Ayubowan 🙏
                  </p>
                )}
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
      <OptionDetail open={!!detail} option={detail?.a ?? null} where={detail?.where ?? undefined} onClose={() => setDetail(null)} />
    </>
  );
}

function SlotRows({ kind, view, date, onOpen }: { kind: SlotKind; view: SlotView; date: string | null; onOpen: (a: Activity) => void }) {
  const night = kind === "night";
  if (!view.items.length) {
    return (
      <div className={cn("flex h-12 items-center gap-2.5 rounded-2xl px-3 text-[13.5px] font-medium", night ? "bg-dusk-900/[0.06] text-ink-3" : "bg-sand-200/50 text-ink-3")}>
        {night ? <Moon className="size-4" /> : <Sun className="size-4" />}
        {night ? "Free evening" : view.where === "enroute" ? "Straight down the expressway" : "Free daytime"}
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <p className={cn("label flex items-center gap-1.5 pl-1", night ? "text-dusk-700" : "text-sunset-600")}>
        {night ? "Evening" : view.where === "enroute" ? "On the way" : "Daytime"}
        <span className="font-sans normal-case tracking-normal text-ink-3">· {formatHours(view.plannedHours)}</span>
      </p>
      {view.items.map((it) => (
        <div key={it.item.key}>
          {it.before && <RoadTrip seg={it.before} />}
          <ItemRow
            kind={kind}
            view={it}
            where={view.where}
            date={date}
            locked
            onClick={it.resolved.kind === "activity" ? () => onOpen((it.resolved as { activity: Activity }).activity) : undefined}
          />
        </div>
      ))}
      {view.after && <RoadTrip seg={view.after} />}
    </div>
  );
}
