"use client";

import { motion } from "framer-motion";
import { AlertTriangle, Ban, LayoutGrid, Moon, MoonStar, MoreHorizontal, NotebookPen, Plus, Sun } from "lucide-react";
import type { CSSProperties } from "react";
import { formatHours } from "@/engine/catalog";
import { variantOf } from "@/engine/day-trip";
import type { DayEntry, SlotKind } from "@/engine/itinerary";
import { isHidden } from "@/engine/rules";
import { nightsFor } from "@/engine/structure";
import { distanceLabel, type ItemView, type SlotView as SlotViewT, type TimelineDay } from "@/engine/timeline";
import { cn } from "@/lib/cn";
import { parseISO } from "@/lib/dates";
import { useArt } from "../brand/art";
import { Firework } from "../brand/illustrations";
import { useEngine } from "../engine";
import { Photo } from "../ui/photo";
import { DaysBadge, RoadTrip, Tip, VibeDots, Warning } from "./bits";

const WEEKDAY = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTH = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export function DateStub({ date, index, t }: { date: string | null; index: number; t: TimelineDay }) {
  const d = date ? parseISO(date) : null;
  const special = !!t.special;
  const departure = t.plan.kind === "departure";
  return (
    <div
      className={cn(
        "relative flex w-[60px] shrink-0 flex-col items-center rounded-l-[22px] pt-4 shadow-card",
        special ? "bg-night-900 text-paper" : departure ? "bg-primary-800 text-paper" : "bg-paper",
      )}
    >
      <span className={cn("text-[10.5px] font-bold tracking-[0.12em]", special || departure ? "text-highlight-400" : "text-accent-600")}>
        {d ? WEEKDAY[d.getUTCDay()] : "DAY"}
      </span>
      <span className="font-display text-[30px] font-semibold leading-none tabular-nums">{d ? d.getUTCDate() : index + 1}</span>
      <span className={cn("text-[10.5px] font-bold tracking-[0.12em]", special || departure ? "text-paper/60" : "text-ink-3")}>
        {d ? MONTH[d.getUTCMonth()] : ""}
      </span>
      {special && <Firework className="mt-3 size-6 text-pop-300" />}
      {/* ticket notches */}
      <span className="absolute -right-[7px] -top-[7px] size-[14px] rounded-full bg-surface-100" />
      <span className="absolute -bottom-[7px] -right-[7px] size-[14px] rounded-full bg-surface-100" />
    </div>
  );
}

export type DragBits = {
  setNodeRef: (el: HTMLElement | null) => void;
  /** The grip button, built where useSortable lives. */
  handle: React.ReactNode;
  style: CSSProperties;
  isDragging: boolean;
};

type CardProps = {
  /** Days in the whole trip (for each base's nights). */
  length: number;
  entry: DayEntry;
  index: number;
  t: TimelineDay;
  locked: boolean;
  drag?: DragBits;
  onFirst: (slot: SlotKind) => void;
  onAdd: (slot: SlotKind) => void;
  onItem: (slot: SlotKind, key: string) => void;
  onNote: () => void;
  /** One tap "Stay in" for the evening of a big day trip. */
  onStayIn?: () => void;
};

/** The colour of a day's kind tag. */
export function dayTagClass(t: TimelineDay): string {
  if (t.plan.kind === "departure") return "bg-accent-100 text-accent-700";
  if (t.plan.kind === "transfer") return "bg-highlight-200 text-ink";
  if (t.plan.arrival) return "bg-primary-100 text-primary-700";
  return "bg-secondary-100 text-secondary-800";
}

/** "Ella day trip" from "Ella day trip · Little Adam's Peak". */
export const tripShortName = (title: string) => title.split(" · ")[0];

export function DayCard({ entry, index, length, t, locked, drag, onFirst, onAdd, onItem, onNote, onStayIn }: CardProps) {
  const e = useEngine();
  const { Icon } = useArt();
  const special = t.special;

  if (t.plan.kind === "departure") return <SendOffCard index={index} t={t} />;

  const base = t.plan.base;
  const nights = nightsFor(e, length).find((s) => s.base.id === base.id)?.nights ?? 0;
  const onRoute = t.day.onRoute;
  return (
    <div
      ref={drag?.setNodeRef}
      style={drag?.style}
      className={cn(
        "relative min-w-0 flex-1 select-none rounded-r-[22px] border-l-2 border-dashed border-surface-300 bg-paper p-3 pl-3.5 shadow-card",
        drag?.isDragging && "z-20 rotate-[0.6deg] border-transparent shadow-lift ring-2 ring-highlight-400",
      )}
    >
      <div className="flex items-start gap-1.5">
        <div className="flex min-h-8 min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <span className="label whitespace-nowrap text-ink-3">Day {index + 1}</span>
          <Tag className={dayTagClass(t)}>{t.name}</Tag>
          {special && <Tag className="bg-night-900 text-highlight-400">{special.short} ✦</Tag>}
          {t.trip && (
            <Tag className="inline-flex items-center gap-1 bg-secondary-800 text-highlight-400">
              <Icon name={t.trip.activity.icon} className="size-4" /> {tripShortName(t.trip.activity.title)}
            </Tag>
          )}
        </div>
        {!locked && (
          <button
            onClick={onNote}
            aria-label={entry.note ? "Edit note" : "Add a note"}
            className={cn("grid size-8 place-items-center rounded-full transition hover:bg-surface-200", entry.note ? "text-primary-600" : "text-ink-3")}
          >
            <NotebookPen className="size-4" />
          </button>
        )}
        {!locked && drag?.handle}
      </div>
      {t.plan.arrival && base.arrivalNote && (
        <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-highlight-100 px-2.5 py-1 text-[11.5px] font-bold text-ink ring-1 ring-highlight-200">
          {(nights === 1 ? base.arrivalNote.one : base.arrivalNote.many).replace("{nights}", String(nights))}
        </p>
      )}

      {t.legsBefore.map((l) => (
        <RoadTrip key={l.title} seg={l} className="mt-1.5" />
      ))}
      <SlotBlock
        kind="day"
        view={t.day}
        date={t.date}
        empty={onRoute ? "Pick a stop on the way" : t.plan.arrival ? `Pick your ${base.name} daytime` : "Pick your daytime"}
        locked={locked}
        onFirst={() => onFirst("day")}
        onAdd={() => onAdd("day")}
        onItem={(k) => onItem("day", k)}
        className="mt-2"
      />
      {t.night.area && (
      <SlotBlock
        kind="night"
        view={t.night}
        date={t.date}
        empty={special?.slot === "night" ? `Pick your ${special.name}` : t.plan.arrival ? `Pick your ${base.name} night` : "Pick your evening"}
        locked={locked}
        special={special?.slot === "night" ? special.name : undefined}
        onFirst={() => onFirst("night")}
        onAdd={() => onAdd("night")}
        onItem={(k) => onItem("night", k)}
        onStayIn={onStayIn}
        className="mt-3"
      />
      )}
      {t.legsAfter.map((l) => (
        <RoadTrip key={l.title} seg={l} className="mt-3" />
      ))}
      {entry.note && (
        <button onClick={onNote} disabled={locked} className="mt-2.5 block w-full rounded-xl bg-surface-100 px-3 py-2 text-left text-[13px] italic text-ink-2">
          “{entry.note}”
        </button>
      )}
      {t.tips.map((w) => (
        <Tip key={w} text={w} className="mt-2" />
      ))}
      {t.warnings.map((w) => (
        <Warning key={w} text={w} className="mt-2" />
      ))}
    </div>
  );
}

/** The last day: no slots — just the road to the airport and a send-off. */
function SendOffCard({ index, t }: { index: number; t: TimelineDay }) {
  const { preset } = useEngine().catalog;
  const { Vehicle } = useArt();
  return (
    <div className="relative min-w-0 flex-1 overflow-hidden rounded-r-[22px] border-l-2 border-dashed border-primary-600/40 bg-primary-800 p-3 pl-3.5 text-paper shadow-card">
      <div className="sunburst absolute inset-0 opacity-50" />
      <div className="relative">
        <div className="flex items-center gap-1.5">
          <span className="label text-paper/60">Day {index + 1}</span>
          <Tag className="bg-accent-500 text-white">{t.name}</Tag>
          {t.special && <Tag className="bg-night-900 text-highlight-400">{t.special.short} ✦</Tag>}
        </div>
        {t.legsBefore.map((l) => (
          <RoadTrip key={l.title} seg={l} tone="dark" className="mt-2" />
        ))}
        <div className="mt-3 flex items-center gap-3">
          <Vehicle className="h-9 w-14 shrink-0 text-highlight-400" />
          <p className="text-[13.5px] leading-snug text-paper/85">
            {preset.structure.departure.text}
            {t.special && ` ${t.special.departureNote}`}
          </p>
        </div>
        <p className="font-display mt-3 text-[20px] font-semibold italic text-highlight-400">{preset.destination.farewell}</p>
      </div>
    </div>
  );
}

function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-bold", className)}>{children}</span>;
}

/** A Daytime/Evening slot: an ordered list of items with hops between them. */
function SlotBlock({
  kind,
  view,
  date,
  empty,
  locked,
  special,
  onFirst,
  onAdd,
  onItem,
  onStayIn,
  className,
}: {
  kind: SlotKind;
  view: SlotViewT;
  date: string | null;
  empty: string;
  locked: boolean;
  /** The special date's name when it takes over this slot (e.g. "New Year's Eve"). */
  special?: string;
  onFirst: () => void;
  onAdd: () => void;
  onItem: (key: string) => void;
  onStayIn?: () => void;
  className?: string;
}) {
  const { slots } = useEngine().catalog.preset.structure;
  const night = kind === "night";
  const label = special ?? (view.onRoute ? "On the way" : slots[kind].label);
  return (
    <div className={className} aria-label={`${slots[kind].label} slot`}>
      <div className="mb-1 flex items-center gap-1.5 px-0.5">
        {night ? <Moon className="size-3.5 text-night-700" /> : <Sun className="size-3.5 text-highlight-600" />}
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">{label}</span>
        <span className="flex-1" />
        {view.items.length > 0 && (
          <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold", view.overpacked ? "text-accent-600" : "text-ink-3")}>
            {view.overpacked && <AlertTriangle className="size-3" strokeWidth={2.5} />}
            {view.fullDay ? `Full day · ${view.fullDay}` : `${formatHours(view.plannedHours)} planned${view.legHours ? " with the drive" : ""}`}
          </span>
        )}
      </div>
      {view.notes?.map((n) => (
        <div
          key={n.text}
          className={cn(
            "mb-1.5 flex items-center gap-2 rounded-xl px-3 py-2 text-[12.5px] font-semibold",
            n.tone === "early" ? "bg-night-800 text-paper" : "bg-night-900/90 text-paper",
          )}
        >
          {n.tone === "early" ? <MoonStar className="size-4 shrink-0 text-highlight-400" /> : <span aria-hidden="true">😴</span>}
          <span className="flex-1">{n.text}</span>
          {n.suggestStay && !locked && onStayIn && (
            <button onClick={onStayIn} className="shrink-0 rounded-full bg-highlight-400 px-2.5 py-1 text-[11.5px] font-bold text-ink">
              + Stay in
            </button>
          )}
        </div>
      ))}
      {view.items.length === 0 ? (
        <>
          <EmptySlot kind={kind} label={empty} special={!!special} locked={locked} onClick={onFirst} />
          {!locked && (
            <button onClick={onAdd} className="mt-1 inline-flex items-center gap-1 px-1 py-1 text-[12px] font-semibold text-ink-3 hover:text-ink">
              <LayoutGrid className="size-3.5" /> or browse everything
            </button>
          )}
        </>
      ) : (
        <ul className="space-y-1" aria-label={`${slots[kind].label} plan`}>
          {view.items.map((it, k) => (
            <li key={it.item.key}>
              {it.before && <RoadTrip seg={it.before} />}
              <ItemRow kind={kind} view={it} area={view.area} date={date} locked={locked} first={k === 0} onClick={() => onItem(it.item.key)} />
            </li>
          ))}
          {!locked && (
            <li>
              <button
                onClick={onAdd}
                aria-label={`Add another to ${slots[kind].label.toLowerCase()}`}
                className={cn(
                  "mt-0.5 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed text-[13px] font-bold transition active:scale-[0.99]",
                  night ? "border-night-700/30 text-night-700 hover:bg-night-700/5" : "border-highlight-400 text-highlight-600 hover:bg-highlight-100/60",
                )}
              >
                <Plus className="size-4" strokeWidth={3} /> Add another
              </button>
            </li>
          )}
        </ul>
      )}
      {view.after && <RoadTrip seg={view.after} className="mt-1" />}
    </div>
  );
}

function EmptySlot({ kind, label, special, locked, onClick }: { kind: SlotKind; label: string; special?: boolean; locked: boolean; onClick: () => void }) {
  const night = kind === "night";
  return (
    <button
      onClick={onClick}
      disabled={locked}
      className={cn(
        "group flex h-[60px] w-full items-center gap-3 rounded-2xl px-3 text-left transition active:scale-[0.99]",
        night
          ? "dusk stars text-paper/90 ring-1 ring-white/5"
          : "border-2 border-dashed border-surface-300 bg-surface-50 text-ink-2 hover:border-highlight-400 hover:bg-highlight-100/50",
        locked && "opacity-60",
      )}
    >
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", night ? "bg-white/10 text-highlight-400" : "bg-highlight-100 text-highlight-600")}>
        {night ? special ? <Firework className="size-5" /> : <Moon className="size-[18px]" /> : <Sun className="size-5" />}
      </span>
      <span className="flex-1 text-[14.5px] font-semibold">{label}</span>
      {!locked && (
        <span className={cn("grid size-8 place-items-center rounded-full transition group-hover:scale-110", night ? "bg-highlight-500 text-ink" : "bg-ink text-paper")}>
          <Plus className="size-4" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

export function ItemRow({
  kind,
  view,
  area,
  date,
  locked,
  first,
  onClick,
}: {
  kind: SlotKind;
  view: ItemView;
  area: string | null;
  date: string | null;
  locked: boolean;
  first?: boolean;
  onClick?: () => void;
}) {
  const e = useEngine();
  const night = kind === "night";
  const { slots } = e.catalog.preset.structure;
  const r = view.resolved;
  const stay = r.kind === "stay";
  const a = r.kind === "activity" ? r.activity : null;
  const title = stay ? r.stay.title : a!.title;
  const extra = a?.kind === "extra";
  const offDay = !!a?.availableDays && !!date && !a.availableDays.includes(parseISO(date).getUTCDay());
  const gone = !!a && isHidden(e.rules, a.familyOf ?? a.id);
  const variant = a?.variants ? variantOf(a, view.item.variant) : undefined;
  return (
    <motion.button
      layout="position"
      initial={{ scale: 0.95, opacity: 0.4 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 26 }}
      onClick={onClick}
      disabled={!onClick}
      aria-label={`${slots[kind].label}: ${title}${locked || !onClick ? "" : " — options"}`}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl text-left",
        extra ? "p-1.5 pr-2" : "p-2 pr-2.5",
        night ? "dusk text-paper" : "bg-surface-100 text-ink",
        !first && !extra && (night ? "ring-1 ring-white/10" : "ring-1 ring-surface-200"),
        gone && "opacity-70 grayscale",
      )}
    >
      {stay ? (
        <StayThumb kind={kind} className={extra ? "size-10" : undefined} />
      ) : (
        <span className={cn("relative shrink-0 overflow-hidden rounded-xl bg-primary-800", extra ? "size-10" : "size-[52px]")}>
          <Photo photo={a!.images[0]} alt={title} sizes="52px" />
          {a!.emoji && (
            <span className="absolute bottom-0.5 right-0.5 grid size-[18px] place-items-center rounded-md bg-paper/95 text-[11px] shadow">{a!.emoji}</span>
          )}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className={cn("line-clamp-2 font-semibold leading-tight", extra ? "text-[13.5px]" : "text-[14.5px]")}>{title}</span>
        <span className={cn("mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] font-medium", night ? "text-paper/60" : "text-ink-3")}>
          {stay ? (
            <>
              <span className="truncate">{r.stay.meta}</span>
              <VibeDots vibe={0} />
            </>
          ) : (
            <>
              {gone && (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent-600 px-1.5 py-px text-[10px] font-bold text-white">
                  <Ban className="size-2.5" /> No longer available
                </span>
              )}
              {variant && (
                <span className={cn("rounded-full px-1.5 py-px text-[10px] font-bold", night ? "bg-white/10" : "bg-secondary-800 text-highlight-400")}>
                  {variant.emoji} {variant.title}
                </span>
              )}
              {extra && <span className={cn("rounded-full px-1.5 py-px text-[10px] font-bold", night ? "bg-white/10" : "bg-highlight-200 text-ink")}>Quick extra</span>}
              <span className="truncate">{area ? distanceLabel(e, a!, area) : a!.duration}</span>
              {!extra && <VibeDots vibe={a!.vibe} />}
              <DaysBadge option={a!} warn={offDay} />
            </>
          )}
        </span>
      </span>
      {!locked && onClick && (
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", night ? "bg-white/10" : "bg-paper")}>
          <MoreHorizontal className="size-4" />
        </span>
      )}
    </motion.button>
  );
}

/** Thumbnail for a "Stay in" pick: the set's stay-in mark on a warm (day) or dusky (night) tile. */
export function StayThumb({ kind, className }: { kind: "day" | "night"; className?: string }) {
  const { StayIn } = useArt();
  return (
    <span
      className={cn(
        "relative grid size-[52px] shrink-0 place-items-center overflow-hidden rounded-xl",
        kind === "day" ? "bg-gradient-to-b from-highlight-200 to-surface-200" : "bg-gradient-to-b from-night-700 to-primary-800 ring-1 ring-white/10",
        className,
      )}
    >
      <StayIn variant={kind} className="size-[44px] translate-y-[2px]" />
    </span>
  );
}
