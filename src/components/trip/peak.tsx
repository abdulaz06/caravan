"use client";

import { motion } from "framer-motion";
import { AlertTriangle, ArrowRightLeft, Check, Clock, MoonStar, Trash2 } from "lucide-react";
import { ADAMS_PEAK_SEASON_START, activitiesById, type ActivityVariant } from "@/content";
import { PEAK_ID, clashTargets, eveningClash, peakVariants, poyaDaysIn, type ClashChoice } from "@/lib/adams-peak";
import { cn } from "@/lib/cn";
import { dayLabel, parseISO } from "@/lib/dates";
import { dateAt, resolve, type ItineraryData } from "@/lib/itinerary";
import { SummitIcon } from "../brand/illustrations";
import { Button } from "../ui/button";
import { Photo } from "../ui/photo";
import { Sheet } from "../ui/sheet";

/** One way to do Adam's Peak: a little schedule plus the honest trade-offs. */
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
  const sunrise = !!variant.overnight;
  const body = (
    <>
      <span className="flex items-center gap-3">
        <span className={cn("grid size-12 shrink-0 place-items-center rounded-2xl", sunrise ? "bg-dusk-900" : "bg-saffron-200")}>
          <SummitIcon className="size-10" night={sunrise} />
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
            {variant.honest.map((h) => (
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

/** Season / poya / weekend notes for a would-be climb day (shown before choosing). */
export function peakNotes(data: ItineraryData, index: number): string[] {
  const date = dateAt(data, index);
  if (!date) return [];
  const out: string[] = [];
  if (date < ADAMS_PEAK_SEASON_START) {
    out.push(`Before pilgrim season (opens ${dayLabel(ADAMS_PEAK_SEASON_START)}): path lights off, tea stalls shut, more rain.`);
  }
  const wd = parseISO(date).getUTCDay();
  if (wd === 0 || wd === 6) out.push("A weekend — the steps are extremely crowded (5+ hours up).");
  const poyas = poyaDaysIn(data);
  if (poyas.length) out.push(`Poya days in your trip: ${poyas.map((p) => `${p.name} ${dayLabel(p.date)}`).join(", ")} — the busiest climbs of all.`);
  return out;
}

/** Picking Adam's Peak: choose sunrise summit or calm morning climb. */
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
  const peak = activitiesById[PEAK_ID];
  const date = dateAt(data, index);
  const notes = peakNotes(data, index);
  return (
    <Sheet open={open} onClose={onClose} eyebrow={`Day ${index + 1}${date ? ` · ${dayLabel(date)}` : ""} · Adam's Peak`} title="How do you want to climb?">
      <div className="px-4 pb-10">
        {peak?.images[0] && (
          <div className="relative h-32 overflow-hidden rounded-[22px] bg-ocean-800">
            <Photo photo={peak.images[0]} alt="Sunrise from the summit of Adam's Peak" sizes="(min-width: 1024px) 440px, 92vw" />
            <span className="absolute inset-0 bg-gradient-to-t from-ink/80 to-transparent" />
            <span className="absolute inset-x-3 bottom-2.5 text-[13px] font-semibold text-paper">
              ~5,500 steps to 2,243 m · ~5–6 hrs from Galle each way · tough
            </span>
          </div>
        )}
        {notes.length > 0 && (
          <ul className="mt-3 space-y-1.5" aria-label="Before you choose">
            {notes.map((n) => (
              <li key={n} className="flex gap-2 rounded-2xl bg-sunset-100 px-3 py-2 text-[12.5px] leading-snug text-sunset-700">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {n}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 grid gap-3">
          {peakVariants().map((v) => (
            <motion.div key={v.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <VariantCard variant={v} selected={current === v.id} onChoose={() => onChoose(v.id)} />
            </motion.div>
          ))}
        </div>
      </div>
    </Sheet>
  );
}

/** The sunrise climb's overnight drive meets an evening that already has plans. */
export function ClashSheet({
  open,
  data,
  climbIndex,
  onClose,
  onResolve,
}: {
  open: boolean;
  data: ItineraryData;
  climbIndex: number;
  onClose: () => void;
  onResolve: (choice: ClashChoice) => void;
}) {
  const items = eveningClash(data, climbIndex);
  const canMove = items.some((it) => clashTargets(data, climbIndex, it).length > 0);
  const titles = items.map((it) => {
    const r = resolve(it, "night");
    return r?.kind === "stay" ? r.stay.title : (r?.activity.title ?? it.id);
  });
  return (
    <Sheet open={open} onClose={onClose} size="auto" eyebrow={`Day ${climbIndex} · the night before`} title="Tonight's plans meet the overnight drive">
      <div className="grid gap-2.5 px-5 pb-8">
        <p className="flex gap-2 text-[14.5px] leading-snug text-ink-2">
          <MoonStar className="mt-0.5 size-4 shrink-0 text-dusk-700" />
          <span>
            The van leaves for Adam&apos;s Peak around <b className="text-ink">9pm</b>. You already have{" "}
            <b className="text-ink">{titles.join(" + ")}</b> that evening — no stress, pick what works:
          </span>
        </p>
        <Button size="lg" variant="ocean" onClick={() => onResolve("keep")}>
          <Clock className="size-5" /> Keep them — we&apos;ll go early
        </Button>
        <Button size="lg" variant="light" disabled={!canMove} onClick={() => onResolve("move")}>
          <ArrowRightLeft className="size-5" /> Move them to another evening
        </Button>
        <Button size="lg" variant="light" onClick={() => onResolve("clear")}>
          <Trash2 className="size-5" /> Clear that evening
        </Button>
      </div>
    </Sheet>
  );
}
