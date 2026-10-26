"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownUp, Ban, Check, Info, MapPin, Repeat2, Star } from "lucide-react";
import { useMemo, useState } from "react";
import { activitiesById, pairsFor, regions, stayIn, type Activity, type Pair, type Where } from "@/content";
import { cn } from "@/lib/cn";
import { dayLabel, parseISO } from "@/lib/dates";
import { STAY_ID, alsoOn, dateAt, nyeIndex, nyePairAt, roleAt, slotWhere, type ItineraryData } from "@/lib/itinerary";
import { isFeatured, isHidden } from "@/lib/rules";
import { distanceLabel, hoursFrom } from "@/lib/timeline";
import { Firework, StayInIcon } from "../brand/illustrations";
import { PopularBadge, usePopular } from "../popular";
import { Photo } from "../ui/photo";
import { Sheet } from "../ui/sheet";
import { DaysBadge, VibeDots } from "./bits";
import { OptionDetail } from "./option-detail";

type Option = Activity;

type Props = {
  open: boolean;
  onClose: () => void;
  data: ItineraryData;
  index: number;
  slot: "day" | "night";
  onPick: (id: string, pairId: string) => void;
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
  const popular = usePopular();

  const nye = slot === "night" && nyeIndex(data) === index && !!nyePairAt(data);
  const night = slot === "night";
  const date = dateAt(data, index);
  const weekday = date ? parseISO(date).getUTCDay() : null;
  const where: Where = slotWhere(roleAt(data, index), slot) ?? "galle";
  const first = data.days[index]?.[slot][0] ?? null;
  const currentId = first?.id ?? null;
  const enroute = where === "enroute";

  const pairs = useMemo(() => {
    // Organizers can hide options (both hidden = the matchup goes) and feature them (shown first).
    const list = (nye ? [nyePairAt(data)!] : pairsFor(where, slot)).filter((p) => !(isHidden(p.a) && isHidden(p.b)));
    const featured = (p: Pair) => (isFeatured(p.a) || isFeatured(p.b) ? 0 : 1);
    if (sort === "all") return [...list].sort((a, b) => featured(a) - featured(b));
    const key = (a: Option) => (enroute ? (a.routeKm ?? 0) : hoursFrom(a, where));
    const dist = (p: Pair) => Math.min(key(activitiesById[p.a]), key(activitiesById[p.b]));
    return [...list].sort((a, b) => featured(a) - featured(b) || dist(a) - dist(b));
  }, [data, nye, where, slot, sort, enroute]);

  function choose(pair: Pair, option: Option) {
    if (chosen) return;
    setChosen(option.id);
    setDetail(null);
    setTimeout(() => {
      onPick(option.id, pair.id);
      setChosen(null);
      onClose();
    }, 480);
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
  ) : enroute ? (
    "Stops on the way"
  ) : (
    "Pick your daytime"
  );
  const home = where === "colombo" ? "Colombo" : "Galle";

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
                {enroute ? `Colombo → ${regions.galle.short} along the coast` : `Times from ${home}`}
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
                <ArrowDownUp className="size-3.5" /> {sort === "near" ? (enroute ? "Route order" : "Nearest first") : "All matchups"}
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
            enroute={enroute}
            selected={currentId === STAY_ID}
            state={chosen ? (chosen === "stay" ? "won" : "lost") : "idle"}
            also={enroute ? null : alsoLabel(alsoOn(data, slot, index, STAY_ID))}
            onChoose={chooseStay}
          />

          <div className="space-y-4">
            {pairs.map((pair, k) => {
              const a = activitiesById[pair.a];
              const b = activitiesById[pair.b];
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
                        where={where}
                        weekday={weekday}
                        isCurrent={currentId === o.id}
                        also={alsoLabel(alsoOn(data, slot, index, o.id))}
                        popular={popular(o.id)}
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
    </>
  );
}

function OptionTile({
  option,
  where,
  weekday,
  isCurrent,
  also,
  popular,
  state,
  onChoose,
  onInfo,
}: {
  option: Option;
  where: Where;
  weekday: number | null;
  isCurrent: boolean;
  also: string | null;
  popular: number | null;
  state: "idle" | "won" | "lost";
  onChoose: () => void;
  onInfo: () => void;
}) {
  const offDay = !!option.availableDays && weekday !== null && !option.availableDays.includes(weekday);
  const gone = isHidden(option.id);
  if (gone) {
    return (
      <div className="relative grid aspect-[3/4.1] w-full place-items-center overflow-hidden rounded-[20px] bg-sand-200 p-3 text-center text-ink-3" aria-label={`${option.title} — no longer available`}>
        <span>
          <Ban className="mx-auto size-6" />
          <span className="mt-2 block text-[13px] font-semibold leading-tight">{option.title}</span>
          <span className="mt-1 block text-[11.5px] font-bold uppercase tracking-wide">No longer available</span>
        </span>
      </div>
    );
  }
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
          {isFeatured(option.id) && (
            <span className="inline-flex items-center gap-1 rounded-full bg-saffron-400 px-2 py-0.5 text-[10.5px] font-bold text-ink">
              <Star className="size-3 fill-ink" /> Featured
            </span>
          )}
          {popular !== null && <PopularBadge count={popular} tone="photo" />}
          <span className="rounded-full bg-ink/45 px-2 py-0.5 text-[10.5px] font-bold text-white backdrop-blur-md">
            {distanceLabel(option, where)}
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
  enroute,
  selected,
  state,
  also,
  onChoose,
}: {
  slot: "day" | "night";
  enroute?: boolean;
  selected: boolean;
  state: "idle" | "won" | "lost";
  also: string | null;
  onChoose: () => void;
}) {
  const s = enroute ? stayIn.enroute : stayIn[slot];
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
        aria-label={`Pick ${s.title} — ${s.tagline}`}
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
              {enroute ? "~2 hrs on the expressway" : "No travel"}
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
