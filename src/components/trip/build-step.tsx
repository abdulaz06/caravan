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
import { bases, optionsById, stayIn, type BaseId } from "@/content";
import type { BudgetResult } from "@/lib/budget";
import { cn } from "@/lib/cn";
import { dayLabel } from "@/lib/dates";
import {
  baseAt,
  baseSplit,
  canReorder,
  canSwapSlot,
  clearAllPicks,
  clearSlot,
  countPicks,
  dateAt,
  isPick,
  isStay,
  optionFor,
  pickOption,
  pickStay,
  reorderDays,
  setAddOns,
  setNote,
  setTransport,
  swapSlot,
  type ItineraryData,
  type SlotKind,
} from "@/lib/itinerary";
import { quickFill } from "@/lib/quickfill";
import { balanceOf, buildTimeline } from "@/lib/timeline";
import { Van } from "../brand/illustrations";
import { Button } from "../ui/button";
import { Photo } from "../ui/photo";
import { Sheet } from "../ui/sheet";
import { useToast } from "../ui/toast";
import { AddOnPicker } from "./addons";
import { BalanceMeter } from "./balance-meter";
import { BudgetPill } from "./budget";
import { DateStub, DayCard, StayThumb } from "./day-card";
import { MatchupSheet } from "./matchup-sheet";
import { OptionDetail } from "./option-detail";
import { TransportChooser } from "./transport";

type Props = {
  data: ItineraryData;
  update: (fn: (d: ItineraryData) => ItineraryData) => void;
  locked: boolean;
  budget: BudgetResult;
  onOpenBudget: () => void;
  onBack: () => void;
  onNext: () => void;
};

type SlotRef = { index: number; slot: SlotKind };

export function BuildStep({ data, update, locked, budget, onOpenBudget, onBack, onNext }: Props) {
  const toast = useToast();
  const timeline = useMemo(() => buildTimeline(data), [data]);
  const balance = useMemo(() => balanceOf(data), [data]);
  const picks = countPicks(data);
  const slots = data.days.length * 2;
  const split = baseSplit(data.days.length);

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
    if (!canReorder(data, from, to)) {
      toast("Days can only move within the same base");
      return;
    }
    update((d) => reorderDays(d, from, to));
  }

  function openSlot(ref: SlotRef) {
    if (locked) return;
    if (data.days[ref.index][ref.slot]) {
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
  const actionOption = actions ? optionFor(actionPick) : null;

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

  const sections = (["colombo", "galle"] as BaseId[])
    .map((b) => ({ base: b, indices: data.days.map((_, i) => i).filter((i) => baseAt(data, i) === b) }))
    .filter((s) => s.indices.length);

  return (
    <div className="grain pb-36">
      <section className="relative z-[1] px-5 pt-6">
        <p className="label text-sunset-600">Step 2 · Your days</p>
        <h1 className="font-display mt-2 text-[38px] font-semibold leading-[1] tracking-[-0.025em]">
          Build your <span className="italic text-ocean-700">days</span>
        </h1>
        <p className="mt-3 text-[15px] text-ink-2">
          Two bases: a few days in Colombo, then down the coast to Galle. Pick a daytime and an evening for each day.
        </p>
        <BaseSplitBanner colombo={split.colombo} galle={split.galle} className="mt-4" />
        {!locked && (
          <div className="mt-4 flex gap-2.5">
            <Button variant="ocean" size="md" className="flex-1" onClick={() => (picks > 0 ? setFillAsk(true) : runQuickFill(false))}>
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

      <div className="sticky top-[calc(5.75rem+env(safe-area-inset-top))] z-30 mt-5 px-3">
        <div className="space-y-2 rounded-[22px] bg-paper/90 px-3.5 py-3 shadow-card ring-1 ring-ink/[0.04] backdrop-blur-xl">
          <div className="flex items-center justify-between px-0.5 text-[12.5px] font-semibold">
            <span className="text-ink-2">
              {picks}/{slots} picked
            </span>
            <span className="text-ink-3">~{Math.round(timeline.totalHours)} hrs travelling</span>
          </div>
          <BalanceMeter balance={balance} size="compact" />
          <BudgetPill budget={budget} onOpen={onOpenBudget} />
        </div>
      </div>

      {sections.map(({ base, indices }) => (
        <section key={base} className="relative z-[1] mt-5">
          <BaseHeader base={base} from={indices[0]} to={indices[indices.length - 1]} />
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} modifiers={[restrictToVerticalAxis]}>
            <SortableContext items={indices.map((i) => data.days[i].id)} strategy={verticalListSortingStrategy}>
              <ol key={fillKey} className="mt-3 space-y-3 px-3">
                {indices.map((i) => {
                  const entry = data.days[i];
                  return (
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
                        onAddOns={(slot) => {
                          setMoving(false);
                          setActions({ index: i, slot });
                        }}
                        onNote={() => {
                          setNoteText(entry.note ?? "");
                          setNoteFor(i);
                        }}
                      />
                    </motion.li>
                  );
                })}
              </ol>
            </SortableContext>
          </DndContext>
        </section>
      ))}

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
          onStay={() => update((d) => pickStay(d, matchup.index, matchup.slot))}
        />
      )}

      <Sheet
        open={!!actions}
        onClose={() => setActions(null)}
        eyebrow={actions ? `Day ${actions.index + 1} · ${actions.slot === "day" ? "Daytime" : "Evening"} · ${bases[baseAt(data, actions.index)].name}` : ""}
        title={actionOption?.title ?? (actions && isStay(actionPick) ? `${stayIn[actions.slot].title} · ${stayIn[actions.slot].tagline}` : "")}
      >
        {actions && actionPick && !moving && (
          <div className="space-y-5 px-4 pb-10 pt-1">
            {actionOption?.transport && isPick(actionPick) && (
              <TransportChooser
                option={actionOption}
                value={actionPick.transport ?? "train"}
                disabled={locked}
                onChange={(m) => update((d) => setTransport(d, actions.index, actions.slot, m))}
              />
            )}
            <AddOnPicker
              base={baseAt(data, actions.index)}
              slot={actions.slot}
              selected={actionPick.addOns ?? []}
              disabled={locked}
              onChange={(ids) => update((d) => setAddOns(d, actions.index, actions.slot, ids))}
            />
            <div className="grid gap-2">
              {actionOption && <ActionRow icon={Eye} label="See details" onClick={() => setDetail(actionOption.id)} />}
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
          </div>
        )}
        {actions && moving && (
          <div className="px-4 pb-8">
            <p className="px-1 pb-3 text-[14px] text-ink-2">
              Pick a day in {bases[baseAt(data, actions.index)].name} — whatever&apos;s there swaps over here.
            </p>
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
              {data.days.map((d, i) => {
                if (i === actions.index) return null;
                const sameBase = baseAt(data, i) === baseAt(data, actions.index);
                const ok = canSwapSlot(data, actions.slot, actions.index, i);
                const there = d[actions.slot];
                const o = optionFor(there);
                const label = isStay(there) ? stayIn[actions.slot].title : (o?.title ?? "Empty");
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
                      {isStay(there) ? (
                        <StayThumb kind={actions.slot} className="size-11" />
                      ) : (
                        <span className="relative size-11 shrink-0 overflow-hidden rounded-xl bg-sand-200">
                          {o && <Photo photo={o.images[0]} alt={label} sizes="44px" />}
                        </span>
                      )}
                      <span className={cn("min-w-0 flex-1 truncate text-[14px] font-semibold", !there && "text-ink-3")}>
                        {ok ? label : sameBase ? "New Year's Eve is pinned" : `${bases[baseAt(data, i)].name} base`}
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
            We&apos;ll fill each base with a balanced mix of adventures and nights out, keeping travel light.
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

/** "Colombo · 2 days → Galle · 3 days" */
export function BaseSplitBanner({ colombo, galle, className }: { colombo: number; galle: number; className?: string }) {
  const tile = (b: BaseId, n: number) => (
    <div className="relative flex h-[68px] min-w-0 flex-1 items-end overflow-hidden rounded-2xl bg-ocean-800 p-2.5 text-paper">
      <Photo photo={bases[b].images[0]} alt={bases[b].name} sizes="200px" />
      <span className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/50 to-ink/5" />
      <span className="relative [text-shadow:0_1px_8px_rgb(0_0_0/0.5)]">
        <span className="font-display block text-[19px] font-semibold leading-none">{bases[b].name}</span>
        <span className="text-[12px] font-semibold text-paper/85">
          {n} {n === 1 ? "day" : "days"}
        </span>
      </span>
    </div>
  );
  return (
    <div className={cn("flex items-center gap-2", className)} aria-label={`Colombo ${colombo} ${colombo === 1 ? "day" : "days"}${galle ? `, then Galle ${galle} ${galle === 1 ? "day" : "days"}` : ""}`}>
      {tile("colombo", colombo)}
      {galle > 0 && (
        <>
          <span className="flex shrink-0 flex-col items-center text-ocean-600">
            <Van className="h-5 w-8" />
            <ArrowRight className="size-4" strokeWidth={2.5} />
          </span>
          {tile("galle", galle)}
        </>
      )}
    </div>
  );
}

function BaseHeader({ base, from, to }: { base: BaseId; from: number; to: number }) {
  const b = bases[base];
  return (
    <div className="mx-3 overflow-hidden rounded-[22px] bg-ocean-800 text-paper shadow-card">
      <div className="relative h-24">
        <Photo photo={b.images[0]} alt={b.name} sizes="(min-width: 1024px) 460px, 94vw" />
        <span className="absolute inset-0 bg-gradient-to-r from-ocean-950/90 via-ocean-950/55 to-transparent" />
        <div className="relative flex h-full flex-col justify-center px-4">
          <p className="label text-saffron-400">
            Base {base === "colombo" ? "1" : "2"} · Day{from === to ? ` ${from + 1}` : `s ${from + 1}–${to + 1}`}
          </p>
          <h2 className="font-display text-[28px] font-semibold leading-none">{b.name}</h2>
          <p className="mt-1 text-[12.5px] text-paper/80">{b.tagline}</p>
        </div>
      </div>
    </div>
  );
}

function ActionRow({ icon: Icon, label, onClick, danger }: { icon: typeof Eye; label: string; onClick: () => void; danger?: boolean }) {
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
