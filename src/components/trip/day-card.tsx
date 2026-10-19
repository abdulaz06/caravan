"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { GripVertical, Moon, MoreHorizontal, NotebookPen, Plus, Sun } from "lucide-react";
import { stayIn, type Option } from "@/content";
import { cn } from "@/lib/cn";
import { parseISO } from "@/lib/dates";
import { isPick, type DayEntry, type SlotKind } from "@/lib/itinerary";
import { baseDistanceLabel, type SlotView as SlotViewT, type TimelineDay } from "@/lib/timeline";
import { Firework, StayInIcon, Train, Van } from "../brand/illustrations";
import { Photo } from "../ui/photo";
import { AddOnChips } from "./addons";
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
        nye ? "bg-dusk-900 text-paper" : "bg-paper",
      )}
    >
      <span className={cn("text-[10.5px] font-bold tracking-[0.12em]", nye ? "text-saffron-400" : "text-sunset-600")}>
        {d ? WEEKDAY[d.getUTCDay()] : "DAY"}
      </span>
      <span className="font-display text-[30px] font-semibold leading-none tabular-nums">{d ? d.getUTCDate() : index + 1}</span>
      <span className={cn("text-[10.5px] font-bold tracking-[0.12em]", nye ? "text-paper/60" : "text-ink-3")}>
        {d ? MONTH[d.getUTCMonth()] : ""}
      </span>
      {nye && <Firework className="mt-3 size-6 text-hibiscus-300" />}
      {/* ticket notches */}
      <span className="absolute -right-[7px] -top-[7px] size-[14px] rounded-full bg-sand-100" />
      <span className="absolute -bottom-[7px] -right-[7px] size-[14px] rounded-full bg-sand-100" />
    </div>
  );
}

type CardProps = {
  entry: DayEntry;
  index: number;
  t: TimelineDay;
  locked: boolean;
  onSlot: (slot: SlotKind) => void;
  onAddOns: (slot: SlotKind) => void;
  onNote: () => void;
};

export function DayCard({ entry, index, t, locked, onSlot, onAddOns, onNote }: CardProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: entry.id,
    disabled: locked,
  });
  const nye = t.tags.includes("nye");
  const departure = t.tags.includes("departure");

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "relative min-w-0 flex-1 select-none rounded-r-[22px] border-l-2 border-dashed border-sand-300 bg-paper p-3 pl-3.5 shadow-card",
        isDragging && "z-20 rotate-[0.6deg] border-transparent shadow-lift ring-2 ring-saffron-400",
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className="label text-ink-3">Day {index + 1}</span>
        {t.tags.includes("arrival") && <Tag className="bg-ocean-100 text-ocean-700">Arrival</Tag>}
        {t.tags.includes("transfer") && <Tag className="bg-saffron-200 text-ink">Move to Galle</Tag>}
        {departure && <Tag className="bg-sunset-100 text-sunset-700">Departure</Tag>}
        {nye && <Tag className="bg-dusk-900 text-saffron-400">NYE ✦</Tag>}
        <span className="flex-1" />
        {!locked && (
          <button
            onClick={onNote}
            aria-label={entry.note ? "Edit note" : "Add a note"}
            className={cn(
              "grid size-8 place-items-center rounded-full transition hover:bg-sand-200",
              entry.note ? "text-ocean-600" : "text-ink-3",
            )}
          >
            <NotebookPen className="size-4" />
          </button>
        )}
        {!locked && (
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Drag to reorder day ${index + 1}`}
            className="grid size-8 cursor-grab touch-none place-items-center rounded-full text-ink-3 transition hover:bg-sand-200 active:cursor-grabbing"
          >
            <GripVertical className="size-[18px]" />
          </button>
        )}
      </div>

      {t.legsBefore.map((l) => (
        <RoadTrip key={l.title} seg={l} className="mt-1.5" />
      ))}
      <SlotBlock
        kind="day"
        view={t.day}
        date={t.date}
        empty={t.tags.includes("arrival") ? "Landing day" : departure ? "Daytime · before you fly" : "Pick your daytime"}
        onClick={() => onSlot("day")}
        onAddOns={() => onAddOns("day")}
        locked={locked}
        className="mt-1.5"
      />
      <SlotBlock
        kind="night"
        view={t.night}
        date={t.date}
        empty={nye ? "Pick your New Year's Eve" : departure ? "Evening · if you fly late" : "Pick your evening"}
        onClick={() => onSlot("night")}
        onAddOns={() => onAddOns("night")}
        locked={locked}
        nye={nye}
        className="mt-2"
      />
      {t.legsAfter.map((l) => (
        <RoadTrip key={l.title} seg={l} className="mt-2" />
      ))}
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

function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-bold", className)}>{children}</span>;
}

/** A slot plus its travel lines and add-on chips. */
function SlotBlock({
  kind,
  view,
  date,
  empty,
  onClick,
  onAddOns,
  locked,
  nye,
  className,
}: {
  kind: SlotKind;
  view: SlotViewT;
  date: string | null;
  empty: string;
  onClick: () => void;
  onAddOns: () => void;
  locked: boolean;
  nye?: boolean;
  className?: string;
}) {
  const transport = isPick(view.pick) ? view.pick.transport : undefined;
  return (
    <div className={className}>
      {view.before.map((s) => (
        <RoadTrip key={s.title} seg={s} />
      ))}
      <SlotView kind={kind} option={view.value} empty={empty} onClick={onClick} locked={locked} nye={nye} date={date} transport={transport} />
      {view.value && (
        <AddOnChips ids={view.pick?.addOns} onAdd={locked ? undefined : onAddOns} className="mt-1.5 pl-1" />
      )}
      {view.after.map((s) => (
        <RoadTrip key={s.title} seg={s} />
      ))}
    </div>
  );
}

type SlotProps = {
  kind: SlotKind;
  option: Option | "stay" | null;
  empty: string;
  onClick: () => void;
  locked: boolean;
  nye?: boolean;
  date?: string | null;
  transport?: "train" | "road";
  className?: string;
};

export function SlotView({ kind, option, empty, onClick, locked, nye, date, transport, className }: SlotProps) {
  const night = kind === "night";
  if (!option) {
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
          className,
        )}
      >
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-full",
            night ? "bg-white/10 text-saffron-400" : "bg-saffron-100 text-saffron-600",
          )}
        >
          {night ? nye ? <Firework className="size-5" /> : <Moon className="size-[18px]" /> : <Sun className="size-5" />}
        </span>
        <span className="flex-1 text-[14.5px] font-semibold">{empty}</span>
        {!locked && (
          <span
            className={cn(
              "grid size-8 place-items-center rounded-full transition group-hover:scale-110",
              night ? "bg-saffron-500 text-ink" : "bg-ink text-paper",
            )}
          >
            <Plus className="size-4" strokeWidth={3} />
          </span>
        )}
      </button>
    );
  }

  const isStay = option === "stay";
  const title = isStay ? stayIn[kind].title : option.title;
  const offDay = !isStay && !!option.availableDays && !!date && !option.availableDays.includes(parseISO(date).getUTCDay());
  return (
    <motion.button
      key={isStay ? "stay" : option.id}
      initial={{ scale: 0.94, rotate: -1.5, opacity: 0.4 }}
      animate={{ scale: 1, rotate: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 22 }}
      onClick={onClick}
      aria-label={`${night ? "Evening" : "Daytime"}: ${title}${locked ? "" : " — options"}`}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl p-2 pr-2.5 text-left",
        night ? "dusk text-paper" : "bg-sand-100 text-ink",
        className,
      )}
    >
      {isStay ? (
        <StayThumb kind={kind} />
      ) : (
        <span className="relative size-[56px] shrink-0 overflow-hidden rounded-xl bg-ocean-800">
          <Photo photo={option.images[0]} alt={title} sizes="56px" />
          {transport && (
            <span className="absolute inset-x-0 bottom-0 flex h-4 items-center justify-center bg-paper/95">
              {transport === "train" ? <Train className="h-3 w-8" /> : <Van className="h-3.5 w-6 text-ocean-600" />}
            </span>
          )}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-[14.5px] font-semibold leading-tight">{title}</span>
        <span className={cn("mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] font-medium", night ? "text-paper/60" : "text-ink-3")}>
          {isStay ? (
            <>
              <span className="truncate">At the villa</span>
              <VibeDots vibe={0} />
            </>
          ) : (
            <>
              <span className="truncate">{transport ? (transport === "train" ? "By scenic train" : "By road") : baseDistanceLabel(option)}</span>
              <VibeDots vibe={option.vibe} />
              <DaysBadge option={option} warn={offDay} />
            </>
          )}
        </span>
      </span>
      {!locked && (
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
        "relative grid size-[56px] shrink-0 place-items-center overflow-hidden rounded-xl",
        kind === "day"
          ? "bg-gradient-to-b from-saffron-200 to-sand-200"
          : "bg-gradient-to-b from-dusk-700 to-ocean-800 ring-1 ring-white/10",
        className,
      )}
    >
      <StayInIcon variant={kind} className="size-[46px] translate-y-[2px]" />
    </span>
  );
}
