"use client";

import { motion } from "framer-motion";
import { Backpack, Check, Clock, MoonStar } from "lucide-react";
import { activitiesById, type ActivityVariant } from "@/content";
import { cn } from "@/lib/cn";
import { dayLabel } from "@/lib/dates";
import { ELLA_ID, lateNightItems, tripVariants } from "@/lib/day-trip";
import { dateAt, type ItineraryData } from "@/lib/itinerary";
import { HillSunIcon } from "../brand/illustrations";
import { Photo } from "../ui/photo";
import { Sheet } from "../ui/sheet";

/** One way to do the Ella day trip: a little schedule plus the honest trade-offs. */
export function VariantCard({
  variant,
  selected,
  onChoose,
  compact,
}: {
  variant: ActivityVariant;
  selected?: boolean;
  onChoose?: () => void;
  compact?: boolean;
}) {
  const sunrise = !!variant.eveBefore;
  const body = (
    <>
      <span className="flex items-center gap-3">
        <span className={cn("grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl", sunrise ? "bg-dusk-800" : "bg-saffron-200")}>
          <HillSunIcon className="size-11 translate-y-0.5" rising={sunrise} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="font-display block text-[20px] font-semibold leading-tight">
            {variant.emoji} {variant.title}
          </span>
          <span className="block text-[13px] leading-snug text-ink-2">{variant.summary}</span>
        </span>
        {selected && (
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-saffron-400 text-ink">
            <Check className="size-[18px]" strokeWidth={3.5} />
          </span>
        )}
      </span>
      {!compact && (
        <>
          <ol className="mt-3 space-y-1.5 border-l-2 border-dashed border-sand-300 pl-3.5">
            {variant.schedule.map((s) => (
              <li key={s.time + s.text} className="relative text-[13px] leading-snug">
                <span className="absolute -left-[21px] top-[5px] size-2.5 rounded-full bg-paper ring-2 ring-ocean-600" />
                <b className="tabular-nums text-ink">{s.time}</b> <span className="text-ink-2">· {s.text}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 flex items-center gap-1.5 text-[12.5px] font-semibold text-ocean-700">
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
    selected && "ring-[3px] ring-saffron-400",
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

/** What to bring for the Ella trip (from the option's `bring`). */
export function BringList({ className }: { className?: string }) {
  const bring = activitiesById[ELLA_ID]?.bring ?? [];
  if (!bring.length) return null;
  return (
    <div className={cn("rounded-[20px] bg-sand-100 px-3.5 py-3", className)}>
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-3">
        <Backpack className="size-3.5" /> What to bring
      </p>
      <ul className="mt-1.5 grid gap-1">
        {bring.map((b) => (
          <li key={b} className="flex gap-1.5 text-[13px] leading-snug text-ink-2">
            <span aria-hidden="true">·</span>
            {b}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Picking the Ella day trip: sunrise at Little Adam's Peak, or an easy morning. */
export function VariantSheet({
  open,
  data,
  index,
  current,
  onClose,
  onChoose,
}: {
  open: boolean;
  data: ItineraryData;
  index: number;
  current?: string;
  onClose: () => void;
  onChoose: (variant: string) => void;
}) {
  const trip = activitiesById[ELLA_ID];
  const date = dateAt(data, index);
  // A soft heads-up (never a block): the evening before already has a big night.
  const late = index > 0 ? lateNightItems(data, index - 1) : [];
  return (
    <Sheet open={open} onClose={onClose} eyebrow={`Day ${index + 1}${date ? ` · ${dayLabel(date)}` : ""} · Ella day trip`} title="How do you want to do Ella?">
      <div className="px-4 pb-10">
        {trip?.images[0] && (
          <div className="relative h-32 overflow-hidden rounded-[22px] bg-ocean-800">
            <Photo photo={trip.images[0]} alt="The view from Little Adam's Peak over Ella Gap" sizes="(min-width: 1024px) 440px, 92vw" />
            <span className="absolute inset-0 bg-gradient-to-t from-ink/80 to-transparent" />
            <span className="absolute inset-x-3 bottom-2.5 text-[13px] font-semibold text-paper">
              Easy ~45 min walk up to 1,141 m · ~3.5–4 hrs from Galle each way
            </span>
          </div>
        )}
        {late.length > 0 && (
          <p className="mt-3 flex gap-2 rounded-2xl bg-dusk-800 px-3 py-2 text-[12.5px] leading-snug text-paper/90">
            <MoonStar className="mt-0.5 size-3.5 shrink-0 text-saffron-400" />
            <span>
              Day {index}&apos;s evening has <b className="text-paper">{late[0].title.split(":")[0]}</b> — fine with the easy morning; with sunrise
              it&apos;d be a very short night.
            </span>
          </p>
        )}
        <div className="mt-3 grid gap-3">
          {tripVariants().map((v) => (
            <motion.div key={v.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <VariantCard variant={v} selected={current === v.id} onChoose={() => onChoose(v.id)} />
            </motion.div>
          ))}
        </div>
        <BringList className="mt-3" />
      </div>
    </Sheet>
  );
}
