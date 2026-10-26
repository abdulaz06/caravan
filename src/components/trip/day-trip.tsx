"use client";

import { motion } from "framer-motion";
import { Backpack, Check, Clock, MoonStar } from "lucide-react";
import type { Activity, ActivityVariant } from "@/engine/catalog";
import { lateNightItems } from "@/engine/day-trip";
import { dateAt, slotArea, type ItineraryData } from "@/engine/itinerary";
import { distanceLabel } from "@/engine/timeline";
import { cn } from "@/lib/cn";
import { dayLabel } from "@/lib/dates";
import { useArt } from "../brand/art";
import { useEngine } from "../engine";
import { Photo } from "../ui/photo";
import { Sheet } from "../ui/sheet";
import { tripShortName } from "./day-card";

/** One way to do a big day trip: a little schedule plus the honest trade-offs. */
export function VariantCard({
  activity,
  variant,
  selected,
  onChoose,
  compact,
}: {
  activity: Activity;
  variant: ActivityVariant;
  selected?: boolean;
  onChoose?: () => void;
  compact?: boolean;
}) {
  const { Icon } = useArt();
  const early = !!variant.eveBefore;
  const body = (
    <>
      <span className="flex items-center gap-3">
        <span className={cn("grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl", early ? "bg-night-800" : "bg-highlight-200")}>
          <Icon name={activity.icon} className="size-11 translate-y-0.5" rising={early} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-display block text-[20px] font-semibold leading-tight">
            {variant.emoji} {variant.title}
          </span>
          <span className="block text-[13px] leading-snug text-ink-2">{variant.summary}</span>
        </span>
        {selected && (
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-highlight-400 text-ink">
            <Check className="size-[18px]" strokeWidth={3.5} />
          </span>
        )}
      </span>
      {!compact && (
        <>
          <ol className="mt-3 space-y-1.5 border-l-2 border-dashed border-surface-300 pl-3.5">
            {variant.schedule.map((s) => (
              <li key={s.time + s.text} className="relative text-[13px] leading-snug">
                <span className="absolute -left-[21px] top-[5px] size-2.5 rounded-full bg-paper ring-2 ring-primary-600" />
                <b className="tabular-nums text-ink">{s.time}</b> <span className="text-ink-2">· {s.text}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 flex items-center gap-1.5 text-[12.5px] font-semibold text-primary-700">
            <Clock className="size-3.5" /> {variant.total}
          </p>
          <ul className="mt-2 space-y-1">
            {[...variant.honest, ...(variant.eveBefore ? ["The evening before: an early night — Stay in or something light"] : [])].map((h) => (
              <li key={h} className="flex gap-1.5 text-[12.5px] leading-snug text-ink-3">
                <span aria-hidden="true">·</span>
                {h}
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
  const cls = cn(
    "block w-full rounded-[22px] bg-paper p-3.5 text-left shadow-card ring-1 ring-ink/5 transition",
    selected && "ring-[3px] ring-highlight-400",
    onChoose && "enabled:hover:-translate-y-0.5 enabled:active:scale-[0.99]",
  );
  return onChoose ? (
    <button onClick={onChoose} className={cls} aria-label={`Choose ${variant.title}`}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** What to bring for a day trip (from the option's `bring`). */
export function BringList({ activity, className }: { activity: Activity; className?: string }) {
  if (!activity.bring?.length) return null;
  return (
    <div className={cn("rounded-[20px] bg-surface-100 px-3.5 py-3", className)}>
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-3">
        <Backpack className="size-3.5" /> What to bring
      </p>
      <ul className="mt-1.5 grid gap-1">
        {activity.bring.map((b) => (
          <li key={b} className="flex gap-1.5 text-[13px] leading-snug text-ink-2">
            <span aria-hidden="true">·</span>
            {b}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Picking a big day trip's variant (e.g. sunrise at the summit, or an easy morning). */
export function VariantSheet({
  open,
  activity,
  data,
  index,
  current,
  onClose,
  onChoose,
}: {
  open: boolean;
  activity: Activity;
  data: ItineraryData;
  index: number;
  current?: string;
  onClose: () => void;
  onChoose: (variant: string) => void;
}) {
  const e = useEngine();
  const date = dateAt(data, index);
  const area = slotArea(e, data, index, "day");
  const name = tripShortName(activity.title);
  // A soft heads-up (never a block): the evening before already has a big night.
  const late = index > 0 ? lateNightItems(e, data, index - 1) : [];
  const early = activity.variants?.find((v) => v.eveBefore);
  return (
    <Sheet open={open} onClose={onClose} eyebrow={`Day ${index + 1}${date ? ` · ${dayLabel(date)}` : ""} · ${name}`} title={`How do you want to do ${name.replace(/ day trip$/i, "")}?`}>
      <div className="px-4 pb-10">
        {activity.images[0] && (
          <div className="relative h-32 overflow-hidden rounded-[22px] bg-primary-800">
            <Photo photo={activity.images[0]} alt={activity.title} sizes="(min-width: 1024px) 440px, 92vw" />
            <span className="absolute inset-0 bg-gradient-to-t from-ink/80 to-transparent" />
            <span className="absolute inset-x-3 bottom-2.5 text-[13px] font-semibold text-paper">
              {activity.highlights[0]}
              {area ? ` · ${distanceLabel(e, activity, area).replace(/^Big day trip · /, "")}` : ""}
            </span>
          </div>
        )}
        {late.length > 0 && early && (
          <p className="mt-3 flex gap-2 rounded-2xl bg-night-800 px-3 py-2 text-[12.5px] leading-snug text-paper/90">
            <MoonStar className="mt-0.5 size-3.5 shrink-0 text-highlight-400" />
            <span>
              Day {index}&apos;s evening has <b className="text-paper">{late[0].title.split(":")[0]}</b> — fine with a later start; with{" "}
              {early.title.toLowerCase()} it&apos;d be a very short night.
            </span>
          </p>
        )}
        <div className="mt-3 grid gap-3">
          {(activity.variants ?? []).map((v) => (
            <motion.div key={v.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <VariantCard activity={activity} variant={v} selected={current === v.id} onChoose={() => onChoose(v.id)} />
            </motion.div>
          ))}
        </div>
        <BringList activity={activity} className="mt-3" />
      </div>
    </Sheet>
  );
}
