"use client";

import { Moon, MoonStar, Sun } from "lucide-react";
import { useState } from "react";
import { formatHours, type Activity } from "@/engine/catalog";
import type { ItineraryData, SlotKind } from "@/engine/itinerary";
import { nightsFor } from "@/engine/structure";
import type { SlotView, Timeline } from "@/engine/timeline";
import { cn } from "@/lib/cn";
import { useArt } from "../brand/art";
import { Firework } from "../brand/illustrations";
import { useEngine } from "../engine";
import { RoadTrip, Tip, Warning } from "./bits";
import { ItemRow, tripShortName } from "./day-card";
import { OptionDetail } from "./option-detail";

const nightsWord = (x: number) => `${x} ${x === 1 ? "night" : "nights"}`;

/** Read-only, beautiful vertical timeline of a whole itinerary. */
export function ItineraryTimeline({ data, timeline, hideNotes = false }: { data: ItineraryData; timeline: Timeline; hideNotes?: boolean }) {
  const e = useEngine();
  const { Icon } = useArt();
  const [detail, setDetail] = useState<{ a: Activity; area: string | null } | null>(null);
  const split = new Map(nightsFor(e, timeline.days.length).map((s) => [s.base.id, s.nights]));
  const seen = new Set<string>();
  const { preset } = e.catalog;
  return (
    <>
      <ol className="relative">
        <span className="absolute bottom-6 left-[19px] top-4 w-0.5 border-l-2 border-dashed border-surface-300" aria-hidden="true" />
        {timeline.days.map((t) => {
          const special = t.special;
          const note = hideNotes ? undefined : data.days[t.index]?.note;
          // A ribbon where each base's stretch of the trip begins.
          const base = t.plan.base;
          const section = t.plan.kind !== "departure" && !seen.has(base.id) ? `${base.name} · ${nightsWord(split.get(base.id) ?? 0)}` : null;
          seen.add(base.id);
          const nameColor =
            t.plan.kind === "departure" ? "text-accent-600" : t.plan.kind === "transfer" ? "text-highlight-600" : t.plan.arrival ? "text-primary-600" : "text-secondary-700";
          return (
            <li key={t.index} className="relative pb-6 pl-12">
              {section && <p className="label -ml-12 mb-3 inline-flex items-center gap-1.5 rounded-full bg-primary-800 px-3 py-1 text-highlight-400">{section}</p>}
              <div className="relative">
                <span
                  className={cn(
                    "font-display absolute -left-12 top-0 grid size-10 place-items-center rounded-full text-[17px] font-bold ring-4 ring-surface-100",
                    special ? "bg-night-900 text-highlight-400" : t.plan.kind === "departure" ? "bg-primary-700 text-paper" : "bg-ink text-paper",
                  )}
                >
                  {t.index + 1}
                </span>
                <div className="flex flex-wrap items-baseline gap-x-2 pt-1.5">
                  <h3 className="font-display text-[20px] font-semibold leading-none">{t.label}</h3>
                  <span className={cn("text-[12px] font-bold", nameColor)}>{t.name}</span>
                  {special && (
                    <span className="inline-flex items-center gap-1 text-[12px] font-bold text-pop-600">
                      <Firework className="size-3.5" /> {special.name}
                    </span>
                  )}
                  {t.trip && (
                    <span className="inline-flex items-center gap-1 text-[12px] font-bold text-secondary-700">
                      <Icon name={t.trip.activity.icon} className="size-4" /> {tripShortName(t.trip.activity.title)}
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-2.5 space-y-2">
                {t.legsBefore.map((l) => (
                  <RoadTrip key={l.title} seg={l} />
                ))}
                {t.plan.kind !== "departure" ? (
                  <>
                    <SlotRows kind="day" view={t.day} date={t.date} onOpen={(a) => setDetail({ a, area: t.day.area })} />
                    <SlotRows kind="night" view={t.night} date={t.date} onOpen={(a) => setDetail({ a, area: t.night.area })} />
                  </>
                ) : (
                  <p className="rounded-2xl bg-primary-100/60 px-3 py-2.5 text-[13px] text-primary-900">
                    {preset.structure.departure.text} {preset.destination.farewell}
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
      <OptionDetail open={!!detail} option={detail?.a ?? null} area={detail?.area ?? undefined} onClose={() => setDetail(null)} />
    </>
  );
}

function SlotRows({ kind, view, date, onOpen }: { kind: SlotKind; view: SlotView; date: string | null; onOpen: (a: Activity) => void }) {
  const { slots } = useEngine().catalog.preset.structure;
  const night = kind === "night";
  if (!view.items.length) {
    return (
      <div className="space-y-1">
        <SlotNotes notes={view.notes} />
        <div className={cn("flex h-12 items-center gap-2.5 rounded-2xl px-3 text-[13.5px] font-medium", night ? "bg-night-900/[0.06] text-ink-3" : "bg-surface-200/50 text-ink-3")}>
          {night ? <Moon className="size-4" /> : <Sun className="size-4" />}
          {view.onRoute ? "Straight there — no stops" : `Free ${slots[kind].label.toLowerCase()}`}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <p className={cn("label flex items-center gap-1.5 pl-1", night ? "text-night-700" : "text-accent-600")}>
        {view.onRoute ? "On the way" : slots[kind].label}
        <span className="font-sans normal-case tracking-normal text-ink-3">· {view.fullDay ? `Full day, ${view.fullDay}` : formatHours(view.plannedHours)}</span>
      </p>
      <SlotNotes notes={view.notes} />
      {view.items.map((it) => (
        <div key={it.item.key}>
          {it.before && <RoadTrip seg={it.before} />}
          <ItemRow
            kind={kind}
            view={it}
            area={view.area}
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

/** Soft evening notes: an early night before a very early day trip, or rest after one. */
function SlotNotes({ notes }: { notes: SlotView["notes"] }) {
  if (!notes?.length) return null;
  return (
    <>
      {notes.map((n) => (
        <p key={n.text} className={cn("flex items-center gap-2 rounded-xl px-3 py-2 text-[12.5px] font-semibold text-paper", n.tone === "early" ? "bg-night-800" : "bg-night-900")}>
          {n.tone === "early" ? <MoonStar className="size-4 shrink-0 text-highlight-400" /> : <span aria-hidden="true">😴</span>}
          {n.text}
        </p>
      ))}
    </>
  );
}
