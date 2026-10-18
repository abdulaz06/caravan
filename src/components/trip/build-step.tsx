"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, ArrowRightLeft, Eye, Repeat2, Sparkles, Trash2, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";
import { chillNight, optionsById } from "@/content";
import { cn } from "@/lib/cn";
import { dayLabel } from "@/lib/dates";
import {
  canSwapSlot,
  clearAllPicks,
  clearSlot,
  countPicks,
  dateAt,
  isChill,
  optionFor,
  pickChill,
  pickOption,
  reorderDays,
  setNote,
  swapSlot,
  type ItineraryData,
} from "@/lib/itinerary";
import { quickFill } from "@/lib/quickfill";
import { balanceOf, buildTimeline } from "@/lib/timeline";
import { Button } from "../ui/button";
import { Photo } from "../ui/photo";
import { Sheet } from "../ui/sheet";
import { useToast } from "../ui/toast";
import { BalanceMeter } from "./balance-meter";
import { ToAirport } from "./bits";
import { DateStub, DayCard } from "./day-card";
import { MatchupSheet } from "./matchup-sheet";
import { OptionDetail } from "./option-detail";

type Props = {
  data: ItineraryData;
  update: (fn: (d: ItineraryData) => ItineraryData) => void;
  locked: boolean;
  onBack: () => void;
  onNext: () => void;
};

type SlotRef = { index: number; slot: "day" | "night" };

export function BuildStep({ data, update, locked, onBack, onNext }: Props) {
  const toast = useToast();
  const timeline = useMemo(() => buildTimeline(data), [data]);
  const balance = useMemo(() => balanceOf(data), [data]);
  const picks = countPicks(data);
  const slots = data.days.length * 2;

  const [matchup, setMatchup] = useState<SlotRef | null>(null);
  const [actions, setActions] = useState<SlotRef | null>(null);
  const [moving, setMoving] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<number | null>(null);
  const [noteText, setNoteText] = useState("");
  const [fillAsk, setFillAsk] = useState(false);
  const [fillKey, setFillKey] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const from = data.days.findIndex((d) => d.id === e.active.id);
    const to = data.days.findIndex((d) => d.id === e.over!.id);
    if (from < 0 || to < 0) return;
    update((d) => reorderDays(d, from, to));
  }

  function openSlot(ref: SlotRef) {
    if (locked) return;
    const filled = data.days[ref.index][ref.slot];
    if (filled) {
      setMoving(false);
      setActions(ref);
    } else {
      setMatchup(ref);
    }
  }

  function runQuickFill(onlyEmpty: boolean) {
    setFillAsk(false);
    update((d) => quickFill(d, { onlyEmpty }));
    setFillKey((k) => k + 1);
    toast("✨ Filled! Tweak anything you like.");
  }

  const actionPick = actions ? data.days[actions.index][actions.slot] : null;
  const actionOption = actions ? (isChill(actionPick) ? null : optionFor(actionPick)) : null;

  if (!data.startDate) {
    return (
      <div className="px-5 pt-16 text-center">
        <p className="font-display text-2xl font-semibold">Pick your dates first</p>
        <Button className="mt-6" onClick={onBack}>
          <ArrowLeft className="size-4" /> Choose dates
        </Button>
      </div>
    );
  }

  return (
    <div className="grain pb-36">
      <section className="relative z-[1] px-5 pt-7">
        <p className="label text-sunset-600">Step 2 · Your days</p>
        <h1 className="font-display mt-2 text-[38px] font-semibold leading-[1] tracking-[-0.025em]">
          Build your <span className="italic text-ocean-700">days</span>
        </h1>
        <p className="mt-3 text-[15px] text-ink-2">
          A daytime and an evening plan for each day. Drag days to reorder — the dates stay put.
        </p>
        {!locked && (
          <div className="mt-5 flex gap-2.5">
            <Button
              variant="ocean"
              size="md"
              className="flex-1"
              onClick={() => (picks > 0 ? setFillAsk(true) : runQuickFill(false))}
            >
              <Wand2 className="size-[18px]" /> Quick fill
            </Button>
            {picks > 0 && (
              <Button
                variant="light"
                size="md"
                onClick={() => {
                  update(clearAllPicks);
                  toast("Cleared — a fresh start");
                }}
              >
                <Trash2 className="size-4" /> Clear
              </Button>
            )}
          </div>
        )}
      </section>

      <div className="sticky top-[calc(4rem+env(safe-area-inset-top))] z-30 mt-5 px-3">
        <div className="rounded-[22px] bg-paper/90 px-4 py-3 shadow-card ring-1 ring-ink/[0.04] backdrop-blur-xl">
          <div className="mb-2 flex items-center justify-between text-[12.5px] font-semibold">
            <span className="text-ink-2">
              {picks}/{slots} picked
            </span>
            <span className="text-ink-3">
              {timeline.regionsVisited.length} {timeline.regionsVisited.length === 1 ? "stop" : "stops"} · ~{Math.round(timeline.totalHours)} hrs on the road
            </span>
          </div>
          <BalanceMeter balance={balance} size="compact" />
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} modifiers={[restrictToVerticalAxis]}>
        <SortableContext items={data.days.map((d) => d.id)} strategy={verticalListSortingStrategy}>
          <ol key={fillKey} className="relative z-[1] mt-4 space-y-3 px-3">
            {data.days.map((entry, i) => (
              <motion.li
                key={i}
                initial={fillKey ? { opacity: 0, y: 14 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex"
              >
                <DateStub date={dateAt(data, i)} index={i} t={timeline.days[i]} />
                <DayCard
                  entry={entry}
                  index={i}
                  t={timeline.days[i]}
                  locked={locked}
                  onSlot={(slot) => openSlot({ index: i, slot })}
                  onNote={() => {
                    setNoteText(entry.note ?? "");
                    setNoteFor(i);
                  }}
                />
              </motion.li>
            ))}
          </ol>
        </SortableContext>
      </DndContext>

      {timeline.toAirport && <ToAirport seg={timeline.toAirport} className="relative z-[1] mt-4 px-5" />}

      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 flex gap-2.5 bg-gradient-to-t from-sand-100 via-sand-100/90 to-transparent px-4 pt-6 lg:left-auto lg:w-[480px]">
        <Button variant="light" size="lg" onClick={onBack} aria-label="Back to dates" className="px-5">
          <ArrowLeft className="size-5" />
        </Button>
        <Button size="lg" className="flex-1" onClick={onNext}>
          Next: a few extras <ArrowRight className="size-5" strokeWidth={2.5} />
        </Button>
      </div>

      {/* ── Sheets ─────────────────────────────────────────── */}
      {matchup && (
        <MatchupSheet
          open={!!matchup}
          onClose={() => setMatchup(null)}
          data={data}
          index={matchup.index}
          slot={matchup.slot}
          onPick={(pick) => update((d) => pickOption(d, matchup.index, matchup.slot, pick))}
          onChill={() => update((d) => pickChill(d, matchup.index))}
        />
      )}

      <Sheet
        open={!!actions}
        onClose={() => setActions(null)}
        size="auto"
        eyebrow={actions ? `Day ${actions.index + 1} · ${actions.slot === "day" ? "Daytime" : "Evening"}` : ""}
        title={actionOption?.title ?? (isChill(actionPick) ? chillNight.title : "")}
      >
        {actions && !moving && (
          <div className="grid gap-2 px-5 pb-8 pt-1">
            {actionOption && (
              <ActionRow icon={Eye} label="See details" onClick={() => setDetail(actionOption.id)} />
            )}
            <ActionRow
              icon={Repeat2}
              label="Change pick"
              onClick={() => {
                const ref = actions;
                setActions(null);
                setMatchup(ref);
              }}
            />
            {data.days.length > 1 && !(actions.slot === "night" && timeline.days[actions.index].tags.includes("nye")) && (
              <ActionRow icon={ArrowRightLeft} label="Move to another day" onClick={() => setMoving(true)} />
            )}
            <ActionRow
              icon={Trash2}
              label="Clear this slot"
              danger
              onClick={() => {
                update((d) => clearSlot(d, actions.index, actions.slot));
                setActions(null);
              }}
            />
          </div>
        )}
        {actions && moving && (
          <div className="px-4 pb-8">
            <p className="px-1 pb-3 text-[14px] text-ink-2">Pick a day — whatever&apos;s there swaps over here.</p>
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
              {data.days.map((d, i) => {
                if (i === actions.index) return null;
                const ok = canSwapSlot(data, actions.slot, actions.index, i);
                const there = d[actions.slot];
                const o = isChill(there) ? null : optionFor(there);
                const label = isChill(there) ? chillNight.title : o?.title ?? "Empty";
                return (
                  <li key={d.id}>
                    <button
                      disabled={!ok}
                      onClick={() => {
                        update((cur) => swapSlot(cur, actions.slot, actions.index, i));
                        setActions(null);
                        toast(`Moved to Day ${i + 1}`);
                      }}
                      className="flex w-full items-center gap-3 rounded-2xl bg-paper p-2.5 text-left shadow-card transition enabled:hover:-translate-y-0.5 disabled:opacity-40"
                    >
                      <span className="grid w-12 shrink-0 text-center">
                        <span className="label text-ink-3">Day {i + 1}</span>
                        <span className="text-[12px] font-semibold">{dayLabel(dateAt(data, i)!).split(" ").slice(1).join(" ")}</span>
                      </span>
                      <span className="relative size-11 shrink-0 overflow-hidden rounded-xl bg-sand-200">
                        {(o || isChill(there)) && (
                          <Photo photo={o ? o.images[0] : chillNight.images[0]} alt={label} sizes="44px" />
                        )}
                      </span>
                      <span className={cn("min-w-0 flex-1 truncate text-[14px] font-semibold", !there && "text-ink-3")}>
                        {ok ? label : "New Year's Eve is pinned"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Sheet>

      <OptionDetail open={!!detail} option={detail ? optionsById[detail] : null} onClose={() => setDetail(null)} />

      <Sheet
        open={noteFor !== null}
        onClose={() => setNoteFor(null)}
        size="auto"
        eyebrow={noteFor !== null ? `Day ${noteFor + 1} · ${dayLabel(dateAt(data, noteFor)!)}` : ""}
        title="A note for this day"
        footer={
          <Button
            size="lg"
            block
            onClick={() => {
              if (noteFor !== null) update((d) => setNote(d, noteFor, noteText));
              setNoteFor(null);
            }}
          >
            Save note
          </Button>
        }
      >
        <div className="px-5 pb-4">
          <textarea
            autoFocus
            value={noteText}
            maxLength={280}
            onChange={(e) => setNoteText(e.target.value)}
            rows={4}
            placeholder="e.g. My birthday! · Would love to do this with Priya · Could skip if we're tired"
            className="w-full resize-none rounded-2xl border-2 border-sand-300 bg-paper p-4 text-[16px] outline-none focus:border-ocean-600"
          />
          <p className="mt-1 text-right text-xs text-ink-3">{noteText.length}/280</p>
        </div>
      </Sheet>

      <Sheet open={fillAsk} onClose={() => setFillAsk(false)} size="auto" eyebrow="Quick fill" title="Keep your picks?">
        <div className="grid gap-2.5 px-5 pb-8">
          <p className="pb-1 text-[15px] text-ink-2">
            We&apos;ll plan a route that makes sense on the map, balanced between adventure and nights out.
          </p>
          <Button size="lg" variant="ocean" onClick={() => runQuickFill(true)}>
            <Sparkles className="size-5" /> Fill the empty slots
          </Button>
          <Button size="lg" variant="light" onClick={() => runQuickFill(false)}>
            Start fresh — replace everything
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

function ActionRow({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: typeof Eye;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex h-14 items-center gap-3 rounded-2xl bg-paper px-4 text-left text-[16px] font-semibold shadow-card transition hover:-translate-y-0.5 active:scale-[0.99]",
        danger && "text-sunset-600",
      )}
    >
      <Icon className={cn("size-5", danger ? "text-sunset-500" : "text-ocean-600")} />
      {label}
    </button>
  );
}

