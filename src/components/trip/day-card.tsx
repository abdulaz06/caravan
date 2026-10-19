"use client";

import { motion } from "framer-motion";
import { AlertTriangle, LayoutGrid, Moon, MoreHorizontal, NotebookPen, Plus, Sun } from "lucide-react";
import type { CSSProperties } from "react";
import { formatHours } from "@/content";
import { cn } from "@/lib/cn";
import { parseISO } from "@/lib/dates";
import type { DayEntry, SlotKind } from "@/lib/itinerary";
import { distanceLabel, type ItemView, type SlotView as SlotViewT, type TimelineDay } from "@/lib/timeline";
import { Firework, StayInIcon, Van } from "../brand/illustrations";
import { Photo } from "../ui/photo";
import { DaysBadge, RoadTrip, Tip, VibeDots, Warning } from "./bits";

const WEEKDAY = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTH = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export function DateStub({ date, index, t }: { date: string | null; index: number; t: TimelineDay }) {
  const d = date ? parseISO(date) : null;
  const nye = t.tags.includes("nye");
  return (
    <div
      className={cn(
        "relative flex w-[60px] shrink-0 flex-col items-center rounded-l-[22px] pt-4 shadow-card",
        nye ? "bg-dusk-900 text-paper" : t.role === "departure" ? "bg-ocean-800 text-paper" : "bg-paper",
      )}
    >
      <span className={cn("text-[10.5px] font-bold tracking-[0.12em]", nye || t.role === "departure" ? "text-saffron-400" : "text-sunset-600")}>
        {d ? WEEKDAY[d.getUTCDay()] : "DAY"}
      </span>
      <span className="font-display text-[30px] font-semibold leading-none tabular-nums">{d ? d.getUTCDate() : index + 1}</span>
      <span className={cn("text-[10.5px] font-bold tracking-[0.12em]", nye || t.role === "departure" ? "text-paper/60" : "text-ink-3")}>
        {d ? MONTH[d.getUTCMonth()] : ""}
      </span>
      {nye && <Firework className="mt-3 size-6 text-hibiscus-300" />}
      {/* ticket notches */}
      <span className="absolute -right-[7px] -top-[7px] size-[14px] rounded-full bg-sand-100" />
      <span className="absolute -bottom-[7px] -right-[7px] size-[14px] rounded-full bg-sand-100" />
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
  entry: DayEntry;
  index: number;
  t: TimelineDay;
  locked: boolean;
  drag?: DragBits;
  onFirst: (slot: SlotKind) => void;
  onAdd: (slot: SlotKind) => void;
  onItem: (slot: SlotKind, key: string) => void;
  onNote: () => void;
};

const ROLE_TAG: Record<TimelineDay["role"], { label: string; className: string }> = {
  colombo: { label: "Land in Colombo", className: "bg-ocean-100 text-ocean-700" },
  transfer: { label: "Road trip to Galle", className: "bg-saffron-200 text-ink" },
  galle: { label: "Galle base", className: "bg-jungle-100 text-jungle-800" },
  departure: { label: "Fly home", className: "bg-sunset-100 text-sunset-700" },
};

export function DayCard({ entry, index, t, locked, drag, onFirst, onAdd, onItem, onNote }: CardProps) {
  const nye = t.tags.includes("nye");
  const tag = ROLE_TAG[t.role];

  if (t.role === "departure") return <SendOffCard index={index} t={t} />;

  return (
    <div
      ref={drag?.setNodeRef}
      style={drag?.style}
      className={cn(
        "relative min-w-0 flex-1 select-none rounded-r-[22px] border-l-2 border-dashed border-sand-300 bg-paper p-3 pl-3.5 shadow-card",
        drag?.isDragging && "z-20 rotate-[0.6deg] border-transparent shadow-lift ring-2 ring-saffron-400",
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className="label text-ink-3">Day {index + 1}</span>
        <Tag className={tag.className}>{tag.label}</Tag>
        {nye && <Tag className="bg-dusk-900 text-saffron-400">NYE ✦</Tag>}
        <span className="flex-1" />
        {!locked && (
          <button
            onClick={onNote}
            aria-label={entry.note ? "Edit note" : "Add a note"}
            className={cn("grid size-8 place-items-center rounded-full transition hover:bg-sand-200", entry.note ? "text-ocean-600" : "text-ink-3")}
          >
            <NotebookPen className="size-4" />
          </button>
        )}
        {!locked && drag?.handle}
      </div>
      {t.role === "colombo" && (
        <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-saffron-100 px-2.5 py-1 text-[11.5px] font-bold text-ink ring-1 ring-saffron-200">
          ★ Our only Colombo day · 1 night in the city
        </p>
      )}

      {t.legsBefore.map((l) => (
        <RoadTrip key={l.title} seg={l} className="mt-1.5" />
      ))}
      <SlotBlock
        kind="day"
        view={t.day}
        date={t.date}
        empty={t.role === "transfer" ? "Pick a stop on the way" : t.role === "colombo" ? "Pick your Colombo daytime" : "Pick your daytime"}
        locked={locked}
        onFirst={() => onFirst("day")}
        onAdd={() => onAdd("day")}
        onItem={(k) => onItem("day", k)}
        className="mt-2"
      />
      <SlotBlock
        kind="night"
        view={t.night}
        date={t.date}
        empty={nye ? "Pick your New Year's Eve" : t.role === "colombo" ? "Pick your Colombo night" : "Pick your evening"}
        locked={locked}
        nye={nye}
        onFirst={() => onFirst("night")}
        onAdd={() => onAdd("night")}
        onItem={(k) => onItem("night", k)}
        className="mt-3"
      />
      {entry.note && (
        <button onClick={onNote} disabled={locked} className="mt-2.5 block w-full rounded-xl bg-sand-100 px-3 py-2 text-left text-[13px] italic text-ink-2">
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

/** Day 6: no slots — just the drive and a send-off. */
function SendOffCard({ index, t }: { index: number; t: TimelineDay }) {
  return (
    <div className="relative min-w-0 flex-1 overflow-hidden rounded-r-[22px] border-l-2 border-dashed border-ocean-600/40 bg-ocean-800 p-3 pl-3.5 text-paper shadow-card">
      <div className="sunburst absolute inset-0 opacity-50" />
      <div className="relative">
        <div className="flex items-center gap-1.5">
          <span className="label text-paper/60">Day {index + 1}</span>
          <Tag className="bg-sunset-500 text-white">Check out & fly home</Tag>
          {t.tags.includes("nye") && <Tag className="bg-dusk-900 text-saffron-400">NYE ✦</Tag>}
        </div>
        {t.legsBefore.map((l) => (
          <RoadTrip key={l.title} seg={l} tone="dark" className="mt-2" />
        ))}
        <div className="mt-3 flex items-center gap-3">
          <Van className="h-9 w-14 shrink-0 text-saffron-400" />
          <p className="text-[13.5px] leading-snug text-paper/85">
            Last breakfast, one more swim, pack the van. No plans today — just the road back to CMB.
            {t.tags.includes("nye") && " You'd be flying on New Year's Eve!"}
          </p>
        </div>
        <p className="font-display mt-3 text-[20px] font-semibold italic text-saffron-400">Ayubowan, Sri Lanka 🙏</p>
      </div>
    </div>
  );
}

function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-bold", className)}>{children}</span>;
}

/** A Daytime/Evening slot: an ordered list of items with hops between them. */
function SlotBlock({
  kind,
  view,
  date,
  empty,
  locked,
  nye,
  onFirst,
  onAdd,
  onItem,
  className,
}: {
  kind: SlotKind;
  view: SlotViewT;
  date: string | null;
  empty: string;
  locked: boolean;
  nye?: boolean;
  onFirst: () => void;
  onAdd: () => void;
  onItem: (key: string) => void;
  className?: string;
}) {
  const night = kind === "night";
  const label = night ? (nye ? "New Year's Eve" : "Evening") : view.where === "enroute" ? "On the way" : "Daytime";
  return (
    <div className={className} aria-label={`${night ? "Evening" : "Daytime"} slot`}>
      <div className="mb-1 flex items-center gap-1.5 px-0.5">
        {night ? <Moon className="size-3.5 text-dusk-700" /> : <Sun className="size-3.5 text-saffron-600" />}
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-3">{label}</span>
        <span className="flex-1" />
        {view.items.length > 0 && (
          <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold", view.overpacked ? "text-sunset-600" : "text-ink-3")}>
            {view.overpacked && <AlertTriangle className="size-3" strokeWidth={2.5} />}
            {formatHours(view.plannedHours)} planned
          </span>
        )}
      </div>
      {view.items.length === 0 ? (
        <>
          <EmptySlot kind={kind} label={empty} nye={nye} locked={locked} onClick={onFirst} />
          {!locked && (
            <button onClick={onAdd} className="mt-1 inline-flex items-center gap-1 px-1 py-1 text-[12px] font-semibold text-ink-3 hover:text-ink">
              <LayoutGrid className="size-3.5" /> or browse everything
            </button>
          )}
        </>
      ) : (
        <ul className="space-y-1" aria-label={`${night ? "Evening" : "Daytime"} plan`}>
          {view.items.map((it, k) => (
            <li key={it.item.key}>
              {it.before && <RoadTrip seg={it.before} />}
              <ItemRow kind={kind} view={it} where={view.where} date={date} locked={locked} first={k === 0} onClick={() => onItem(it.item.key)} />
            </li>
          ))}
          {!locked && (
            <li>
              <button
                onClick={onAdd}
                aria-label={`Add another to ${night ? "evening" : "daytime"}`}
                className={cn(
                  "mt-0.5 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed text-[13px] font-bold transition active:scale-[0.99]",
                  night ? "border-dusk-700/30 text-dusk-700 hover:bg-dusk-700/5" : "border-saffron-400 text-saffron-600 hover:bg-saffron-100/60",
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

function EmptySlot({ kind, label, nye, locked, onClick }: { kind: SlotKind; label: string; nye?: boolean; locked: boolean; onClick: () => void }) {
  const night = kind === "night";
  return (
    <button
      onClick={onClick}
      disabled={locked}
      className={cn(
        "group flex h-[60px] w-full items-center gap-3 rounded-2xl px-3 text-left transition active:scale-[0.99]",
        night
          ? "dusk stars text-paper/90 ring-1 ring-white/5"
          : "border-2 border-dashed border-sand-300 bg-sand-50 text-ink-2 hover:border-saffron-400 hover:bg-saffron-100/50",
        locked && "opacity-60",
      )}
    >
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", night ? "bg-white/10 text-saffron-400" : "bg-saffron-100 text-saffron-600")}>
        {night ? nye ? <Firework className="size-5" /> : <Moon className="size-[18px]" /> : <Sun className="size-5" />}
      </span>
      <span className="flex-1 text-[14.5px] font-semibold">{label}</span>
      {!locked && (
        <span className={cn("grid size-8 place-items-center rounded-full transition group-hover:scale-110", night ? "bg-saffron-500 text-ink" : "bg-ink text-paper")}>
          <Plus className="size-4" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

export function ItemRow({
  kind,
  view,
  where,
  date,
  locked,
  first,
  onClick,
}: {
  kind: SlotKind;
  view: ItemView;
  where: SlotViewT["where"];
  date: string | null;
  locked: boolean;
  first?: boolean;
  onClick?: () => void;
}) {
  const night = kind === "night";
  const r = view.resolved;
  const stay = r.kind === "stay";
  const a = r.kind === "activity" ? r.activity : null;
  const title = stay ? r.stay.title : a!.title;
  const extra = a?.kind === "extra";
  const offDay = !!a?.availableDays && !!date && !a.availableDays.includes(parseISO(date).getUTCDay());
  return (
    <motion.button
      layout="position"
      initial={{ scale: 0.95, opacity: 0.4 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 26 }}
      onClick={onClick}
      disabled={!onClick}
      aria-label={`${night ? "Evening" : "Daytime"}: ${title}${locked || !onClick ? "" : " — options"}`}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl text-left",
        extra ? "p-1.5 pr-2" : "p-2 pr-2.5",
        night ? "dusk text-paper" : "bg-sand-100 text-ink",
        !first && !extra && (night ? "ring-1 ring-white/10" : "ring-1 ring-sand-200"),
      )}
    >
      {stay ? (
        <StayThumb kind={kind} className={extra ? "size-10" : undefined} />
      ) : (
        <span className={cn("relative shrink-0 overflow-hidden rounded-xl bg-ocean-800", extra ? "size-10" : "size-[52px]")}>
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
              <span className="truncate">{where === "enroute" ? "Expressway, ~2 hrs" : "At the villa"}</span>
              <VibeDots vibe={0} />
            </>
          ) : (
            <>
              {extra && <span className={cn("rounded-full px-1.5 py-px text-[10px] font-bold", night ? "bg-white/10" : "bg-saffron-200 text-ink")}>Quick extra</span>}
              <span className="truncate">{where ? distanceLabel(a!, where) : a!.duration}</span>
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

/** Thumbnail for a "Stay in" pick: the villa mark on a warm (day) or dusky (night) tile. */
export function StayThumb({ kind, className }: { kind: "day" | "night"; className?: string }) {
  return (
    <span
      className={cn(
        "relative grid size-[52px] shrink-0 place-items-center overflow-hidden rounded-xl",
        kind === "day" ? "bg-gradient-to-b from-saffron-200 to-sand-200" : "bg-gradient-to-b from-dusk-700 to-ocean-800 ring-1 ring-white/10",
        className,
      )}
    >
      <StayInIcon variant={kind} className="size-[44px] translate-y-[2px]" />
    </span>
  );
}
