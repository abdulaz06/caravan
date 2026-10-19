"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownUp, Check, Info, MapPin, Repeat2 } from "lucide-react";
import { useMemo, useState } from "react";
import { bases, dayPairs, nightPairs, nyePairs, optionsById, stayIn, type Option, type Pair } from "@/content";
import { cn } from "@/lib/cn";
import { dayLabel, parseISO } from "@/lib/dates";
import {
  STAY,
  alsoOn,
  baseAt,
  dateAt,
  isPick,
  isStay,
  nyeIndex,
  type ItineraryData,
  type OptionPick,
  type TransportMode,
} from "@/lib/itinerary";
import { baseDistanceLabel, hoursFromBase } from "@/lib/timeline";
import { Firework, StayInIcon } from "../brand/illustrations";
import { Photo } from "../ui/photo";
import { Sheet } from "../ui/sheet";
import { Button } from "../ui/button";
import { DaysBadge, VibeDots } from "./bits";
import { OptionDetail } from "./option-detail";
import { TransportChooser } from "./transport";

type Props = {
  open: boolean;
  onClose: () => void;
  data: ItineraryData;
  index: number;
  slot: "day" | "night";
  onPick: (pick: OptionPick) => void;
  onStay: () => void;
};

/** "Also on Day 3" / "Also on Days 2 & 5" — repeats are fine, this is just a nudge. */
function alsoLabel(days: number[]): string | null {
  if (!days.length) return null;
  const n = days.map((d) => d + 1);
  if (n.length === 1) return `Also on Day ${n[0]}`;
  return `Also on Days ${n.slice(0, -1).join(", ")} & ${n[n.length - 1]}`;
}

export function MatchupSheet({ open, onClose, data, index, slot, onPick, onStay }: Props) {
  const [sort, setSort] = useState<"near" | "all">("near");
  const [chosen, setChosen] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ option: Option; pair: Pair } | null>(null);
  const [transportFor, setTransportFor] = useState<{ option: Option; pair: Pair } | null>(null);
  const [mode, setMode] = useState<TransportMode>("train");

  const nye = slot === "night" && nyeIndex(data) === index;
  const night = slot === "night";
  const date = dateAt(data, index);
  const weekday = date ? parseISO(date).getUTCDay() : null;
  const base = baseAt(data, index);
  const current = data.days[index]?.[slot] ?? null;
  const currentId = isPick(current) ? current.optionId : null;

  const pairs = useMemo(() => {
    const list = (slot === "day" ? dayPairs : nye ? [nyePairs[base]] : nightPairs).filter((p) => p.base === base);
    if (sort === "all") return list;
    const dist = (p: Pair) => Math.min(hoursFromBase(optionsById[p.a]), hoursFromBase(optionsById[p.b]));
    return [...list].sort((a, b) => dist(a) - dist(b));
  }, [slot, nye, sort, base]);

  function commit(pair: Pair, option: Option, transport?: TransportMode) {
    if (chosen) return;
    setChosen(option.id);
    setDetail(null);
    setTimeout(() => {
      onPick({ pairId: pair.id, optionId: option.id, ...(transport ? { transport } : {}) });
      setChosen(null);
      onClose();
    }, 480);
  }

  function choose(pair: Pair, option: Option) {
    if (option.transport) {
      // Day trips ask how you want to get there first.
      setDetail(null);
      setMode(isPick(current) && current.optionId === option.id && current.transport ? current.transport : "train");
      setTransportFor({ option, pair });
      return;
    }
    commit(pair, option);
  }

  function chooseStay() {
    if (chosen) return;
    setChosen("stay");
    setTimeout(() => {
      onStay();
      setChosen(null);
      onClose();
    }, 480);
  }

  const title = nye ? (
    <>
      New Year&apos;s Eve <Firework className="inline size-6 -translate-y-0.5 text-hibiscus-300" />
    </>
  ) : night ? (
    "Pick your evening"
  ) : (
    "Pick your daytime"
  );

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        tone={night ? "dusk" : "light"}
        eyebrow={`Day ${index + 1}${date ? ` · ${dayLabel(date)}` : ""}`}
        title={title}
      >
        <div className="px-4 pb-10">
          <div className={cn("flex items-center justify-between gap-2 px-1 pb-3 text-[13px]", night ? "text-paper/65" : "text-ink-3")}>
            <span className="flex min-w-0 items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate">
                Times from your {bases[base].name} base
              </span>
            </span>
            {!nye && (
              <button
                onClick={() => setSort((s) => (s === "near" ? "all" : "near"))}
                className={cn(
                  "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 font-semibold",
                  night ? "bg-white/10 text-paper" : "bg-sand-200 text-ink-2",
                )}
              >
                <ArrowDownUp className="size-3.5" /> {sort === "near" ? "Nearest first" : "All matchups"}
              </button>
            )}
          </div>

          {nye && (
            <p className="mb-4 rounded-2xl bg-white/5 p-3.5 text-[14px] leading-snug text-paper/80 ring-1 ring-white/10">
              The big one. Your New Year&apos;s Eve pick stays pinned to 31 December, even if you reorder your days.
            </p>
          )}

          <StayInCard
            slot={slot}
            selected={isStay(current)}
            state={chosen ? (chosen === "stay" ? "won" : "lost") : "idle"}
            also={alsoLabel(alsoOn(data, slot, index, STAY))}
            onChoose={chooseStay}
          />

          <div className="space-y-4">
            {pairs.map((pair, k) => {
              const a = optionsById[pair.a];
              const b = optionsById[pair.b];
              return (
                <motion.section
                  key={pair.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(k, 6) * 0.04 }}
                  className={cn(
                    "rounded-[26px] p-2.5",
                    night ? "bg-white/[0.06] ring-1 ring-white/10" : "bg-paper shadow-card",
                  )}
                >
                  <div className="flex items-center justify-between gap-2 px-1.5 pb-2.5 pt-1">
                    <p className="font-display text-[17px] font-medium italic leading-tight">{pair.theme}</p>
                  </div>
                  <div className="relative grid grid-cols-2 gap-2">
                    {[a, b].map((o) => (
                      <OptionTile
                        key={o.id}
                        option={o}
                        weekday={weekday}
                        isCurrent={currentId === o.id}
                        also={alsoLabel(alsoOn(data, slot, index, { pairId: pair.id, optionId: o.id }))}
                        state={chosen ? (chosen === o.id ? "won" : "lost") : "idle"}
                        onChoose={() => choose(pair, o)}
                        onInfo={() => setDetail({ option: o, pair })}
                      />
                    ))}
                    <span
                      className={cn(
                        "font-display pointer-events-none absolute left-1/2 top-[44%] grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-saffron-500 text-[17px] font-black italic text-ink ring-4",
                        night ? "ring-dusk-900" : "ring-paper",
                      )}
                    >
                      vs
                    </span>
                  </div>
                </motion.section>
              );
            })}
          </div>
        </div>
      </Sheet>
      <OptionDetail
        open={!!detail}
        option={detail?.option ?? null}
        onClose={() => setDetail(null)}
        picked={!!detail && currentId === detail.option.id}
        pickLabel={`Pick for Day ${index + 1}`}
        onPick={() => detail && choose(detail.pair, detail.option)}
      />
      <Sheet
        open={!!transportFor}
        onClose={() => setTransportFor(null)}
        size="auto"
        eyebrow={transportFor?.option.title}
        title="Train or road?"
        footer={
          transportFor ? (
            <Button
              size="lg"
              block
              onClick={() => {
                const t = transportFor;
                setTransportFor(null);
                commit(t.pair, t.option, mode);
              }}
            >
              Pick for Day {index + 1} · {mode === "train" ? "Scenic train 🚂" : "Road trip 🚐"}
            </Button>
          ) : undefined
        }
      >
        {transportFor && (
          <div className="px-4 pb-4">
            <TransportChooser option={transportFor.option} value={mode} onChange={setMode} compact />
            {transportFor.option.goodToKnow && (
              <p className="mt-3 rounded-2xl bg-saffron-100 p-3 text-[12.5px] leading-snug text-ink-2">{transportFor.option.goodToKnow}</p>
            )}
          </div>
        )}
      </Sheet>
    </>
  );
}

function OptionTile({
  option,
  weekday,
  isCurrent,
  also,
  state,
  onChoose,
  onInfo,
}: {
  option: Option;
  weekday: number | null;
  isCurrent: boolean;
  also: string | null;
  state: "idle" | "won" | "lost";
  onChoose: () => void;
  onInfo: () => void;
}) {
  const offDay = !!option.availableDays && weekday !== null && !option.availableDays.includes(weekday);
  return (
    <motion.div
      animate={state === "won" ? { scale: 1.04, zIndex: 2 } : state === "lost" ? { scale: 0.94, opacity: 0.35 } : { scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 24 }}
      className="relative"
    >
      <button
        onClick={onChoose}
        aria-label={`Pick ${option.title}`}
        className={cn(
          "relative block aspect-[3/4.1] w-full overflow-hidden rounded-[20px] bg-ocean-800 text-left text-paper transition active:scale-[0.98]",
          (isCurrent || state === "won") && "ring-[3px] ring-saffron-400",
        )}
      >
        <Photo photo={option.images[0]} alt={option.title} sizes="(min-width: 1024px) 220px, 46vw" />
        <span className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/25 to-transparent" />
        <span className="absolute left-2 right-11 top-2 flex flex-wrap gap-1">
          <span className="rounded-full bg-ink/45 px-2 py-0.5 text-[10.5px] font-bold text-white backdrop-blur-md">
            {option.transport ? "Day trip · train or road" : baseDistanceLabel(option)}
          </span>
        </span>
        <span className="absolute inset-x-2.5 bottom-2.5">
          {also && <AlsoChip label={also} />}
          {option.availableDays && <DaysBadge option={option} warn={offDay} className="mb-1.5" />}
          <span className="font-display line-clamp-3 block text-[16px] font-semibold leading-[1.12]">{option.title}</span>
          <span className="mt-1 flex items-center gap-2 text-[11px] font-semibold text-paper/75">
            <span className="truncate">{offDay ? "Not on this day" : option.duration.split(" (")[0]}</span>
            <VibeDots vibe={option.vibe} />
          </span>
        </span>
        <AnimatePresence>
          {(isCurrent || state === "won") && (
            <motion.span
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0 }}
              transition={{ type: "spring", stiffness: 600, damping: 18 }}
              className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-saffron-400 text-ink shadow-lg"
            >
              <Check className="size-[18px]" strokeWidth={3.5} />
            </motion.span>
          )}
        </AnimatePresence>
      </button>
      {!(isCurrent || state === "won") && (
        <button
          onClick={onInfo}
          aria-label={`More about ${option.title}`}
          className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-ink/45 text-white backdrop-blur-md transition hover:bg-ink/65"
        >
          <Info className="size-[17px]" />
        </button>
      )}
    </motion.div>
  );
}

function AlsoChip({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        "mb-1.5 inline-flex items-center gap-1 rounded-full bg-saffron-400/95 px-2 py-0.5 text-[10.5px] font-bold text-ink",
        className,
      )}
    >
      <Repeat2 className="size-3" strokeWidth={2.75} /> {label}
    </span>
  );
}

/** "Stay in" — a first-class choice on every slot, as often as you like. */
function StayInCard({
  slot,
  selected,
  state,
  also,
  onChoose,
}: {
  slot: "day" | "night";
  selected: boolean;
  state: "idle" | "won" | "lost";
  also: string | null;
  onChoose: () => void;
}) {
  const s = stayIn[slot];
  const night = slot === "night";
  const on = selected || state === "won";
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={
        state === "won"
          ? { opacity: 1, y: 0, scale: 1.02 }
          : state === "lost"
            ? { opacity: 0.35, y: 0, scale: 0.97 }
            : { opacity: 1, y: 0, scale: 1 }
      }
      transition={{ type: "spring", stiffness: 420, damping: 26 }}
      className={cn("mb-4 rounded-[26px] p-2.5", night ? "bg-white/[0.06] ring-1 ring-white/10" : "bg-paper shadow-card")}
    >
      <div className="flex items-center justify-between gap-2 px-1.5 pb-2.5 pt-1">
        <p className="font-display text-[17px] font-medium italic leading-tight">Or keep it easy</p>
        <span className={cn("text-[11px] font-bold uppercase tracking-[0.12em]", night ? "text-saffron-400" : "text-jungle-600")}>
          Always available
        </span>
      </div>
      <button
        onClick={onChoose}
        aria-label={`Pick Stay in — ${s.tagline}`}
        className={cn(
          "relative flex min-h-[132px] w-full overflow-hidden rounded-[20px] bg-ocean-800 text-left text-paper transition active:scale-[0.99]",
          on && "ring-[3px] ring-saffron-400",
        )}
      >
        <Photo photo={s.images[0]} alt="A villa pool in Sri Lanka" sizes="(min-width: 1024px) 440px, 92vw" />
        <span className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/75 via-55% to-ink/25" />
        <span className="relative flex w-full items-center gap-3.5 p-3.5 pr-12">
          <span className="grid size-[68px] shrink-0 place-items-center rounded-[18px] bg-paper/95 shadow-lg">
            <StayInIcon variant={slot} className="size-[54px]" />
          </span>
          <span className="min-w-0 flex-1">
            {also && <AlsoChip label={also} />}
            <span className="font-display block text-[22px] font-semibold leading-none">{s.title}</span>
            <span className="mt-1.5 block max-w-[15rem] text-[13.5px] font-medium leading-snug text-paper/90">{s.tagline}</span>
            <span className="mt-1.5 flex items-center gap-2 text-[11px] font-semibold text-paper/70">
              No travel
              <span className="inline-flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-saffron-500" /> Balanced
              </span>
            </span>
          </span>
        </span>
        <AnimatePresence>
          {on && (
            <motion.span
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0 }}
              transition={{ type: "spring", stiffness: 600, damping: 18 }}
              className="absolute right-2.5 top-2.5 grid size-8 place-items-center rounded-full bg-saffron-400 text-ink shadow-lg"
            >
              <Check className="size-[18px]" strokeWidth={3.5} />
            </motion.span>
          )}
        </AnimatePresence>
      </button>
    </motion.section>
  );
}
