"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownUp, Check, Info, MapPin, Sofa } from "lucide-react";
import { useMemo, useState } from "react";
import {
  chillNight,
  dayPairs,
  formatHours,
  nightPairs,
  nyePair,
  optionsById,
  regions,
  travelHours,
  type Option,
  type Pair,
} from "@/content";
import { cn } from "@/lib/cn";
import { dayLabel } from "@/lib/dates";
import { dateAt, isChill, isPick, nyeIndex, pairUsage, type DayPick, type ItineraryData } from "@/lib/itinerary";
import { locationBefore } from "@/lib/timeline";
import { Firework } from "../brand/illustrations";
import { Photo } from "../ui/photo";
import { Sheet } from "../ui/sheet";
import { VibeDots } from "./bits";
import { OptionDetail } from "./option-detail";

type Props = {
  open: boolean;
  onClose: () => void;
  data: ItineraryData;
  index: number;
  slot: "day" | "night";
  onPick: (pick: DayPick) => void;
  onChill: () => void;
};

export function MatchupSheet({ open, onClose, data, index, slot, onPick, onChill }: Props) {
  const [sort, setSort] = useState<"near" | "all">("near");
  const [chosen, setChosen] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ option: Option; pair: Pair } | null>(null);

  const nye = slot === "night" && nyeIndex(data) === index;
  const night = slot === "night";
  const date = dateAt(data, index);
  const from = locationBefore(data, index, slot);
  const usage = pairUsage(data);
  const current = data.days[index]?.[slot] ?? null;
  const currentId = isPick(current) ? current.optionId : null;

  const pairs = useMemo(() => {
    const list = slot === "day" ? dayPairs : nye ? [nyePair] : nightPairs;
    if (sort === "all") return list;
    const dist = (p: Pair) =>
      Math.min(travelHours(from, optionsById[p.a].region), travelHours(from, optionsById[p.b].region));
    return [...list].sort((a, b) => dist(a) - dist(b));
  }, [slot, nye, sort, from]);

  function choose(pair: Pair, option: Option) {
    if (chosen) return;
    setChosen(option.id);
    setDetail(null);
    setTimeout(() => {
      onPick({ pairId: pair.id, optionId: option.id });
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
                {from === "airport" ? "Starting from the airport" : `You'll be coming from ${regions[from].short}`}
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

          {night && (
            <ChillCard selected={isChill(current)} onChoose={() => (onChill(), onClose())} />
          )}

          <div className="space-y-4">
            {pairs.map((pair, k) => {
              const used = usage.get(pair.id);
              const usedElsewhere = used && !(used.index === index && used.slot === slot);
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
                    {usedElsewhere && (
                      <span className="shrink-0 rounded-full bg-ocean-600 px-2.5 py-1 text-[11px] font-bold text-white">
                        Used on Day {used.index + 1}
                      </span>
                    )}
                  </div>
                  <div className={cn("relative grid grid-cols-2 gap-2", usedElsewhere && "saturate-[0.55]")}>
                    {[a, b].map((o) => (
                      <OptionTile
                        key={o.id}
                        option={o}
                        from={from}
                        isCurrent={currentId === o.id}
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
                  {usedElsewhere && (
                    <p className={cn("px-1.5 pb-1 pt-2.5 text-[12.5px] leading-snug", night ? "text-paper/60" : "text-ink-3")}>
                      Tap one to move it here
                      {current ? " — Day " + (used.index + 1) + " gets this slot's current pick instead." : " from Day " + (used.index + 1) + "."}
                    </p>
                  )}
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
    </>
  );
}

function OptionTile({
  option,
  from,
  isCurrent,
  state,
  onChoose,
  onInfo,
}: {
  option: Option;
  from: ReturnType<typeof locationBefore>;
  isCurrent: boolean;
  state: "idle" | "won" | "lost";
  onChoose: () => void;
  onInfo: () => void;
}) {
  const hours = travelHours(from, option.region);
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
        <span className="absolute left-2 top-2 rounded-full bg-ink/45 px-2 py-0.5 text-[10.5px] font-bold text-white backdrop-blur-md">
          {hours === 0 ? "You're here" : `${formatHours(hours)} away`}
        </span>
        <span className="absolute inset-x-2.5 bottom-2.5">
          <span className="font-display line-clamp-3 block text-[16px] font-semibold leading-[1.12]">{option.title}</span>
          <span className="mt-1 flex items-center gap-2 text-[11px] font-semibold text-paper/75">
            <span className="truncate">{regions[option.region].short}</span>
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

function ChillCard({ selected, onChoose }: { selected: boolean; onChoose: () => void }) {
  return (
    <button
      onClick={onChoose}
      className={cn(
        "mb-4 flex w-full items-center gap-3 rounded-[22px] bg-white/[0.07] p-2.5 pr-4 text-left ring-1 transition active:scale-[0.99]",
        selected ? "ring-[3px] ring-saffron-400" : "ring-white/10 hover:bg-white/10",
      )}
    >
      <span className="relative size-16 shrink-0 overflow-hidden rounded-2xl bg-ocean-800">
        <Photo photo={chillNight.images[0]} alt={chillNight.title} sizes="64px" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 font-display text-[18px] font-semibold">
          <Sofa className="size-4 text-saffron-400" /> {chillNight.title}
        </span>
        <span className="block text-[12.5px] text-paper/60">{chillNight.tagline} Always available.</span>
      </span>
      {selected ? (
        <span className="grid size-8 place-items-center rounded-full bg-saffron-400 text-ink">
          <Check className="size-[18px]" strokeWidth={3.5} />
        </span>
      ) : (
        <span className="rounded-full bg-saffron-500 px-3 py-1.5 text-[12px] font-bold text-ink">Pick</span>
      )}
    </button>
  );
}

