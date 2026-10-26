"use client";

import { motion } from "framer-motion";
import { Check, Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { CATEGORIES, activities, isNightlife, stayIn, type Activity, type Category, type Where } from "@/content";
import { cn } from "@/lib/cn";
import { dayLabel, parseISO } from "@/lib/dates";
import { STAY_ID, dateAt, itemAllowed, nyeIndex, roleAt, slotWhere, type ItineraryData, type SlotKind } from "@/lib/itinerary";
import { isFeatured, isHidden } from "@/lib/rules";
import { distanceLabel, hoursFrom } from "@/lib/timeline";
import { useCurrency } from "../currency";
import { useHalal } from "../halal";
import { Flame, PopularBadge, usePopular } from "../popular";
import { StayInIcon } from "../brand/illustrations";
import { Photo } from "../ui/photo";
import { Sheet } from "../ui/sheet";
import { DaysBadge, VibeDots } from "./bits";
import { OptionDetail } from "./option-detail";

type Props = {
  open: boolean;
  onClose: () => void;
  data: ItineraryData;
  index: number;
  slot: SlotKind;
  /** "add" appends; "replace" swaps the item being changed. */
  mode?: "add" | "replace";
  onChoose: (id: string) => void;
};

/** Everything valid for one day's slot — options, Quick extras and Stay in — with filters and search. */
export function CatalogSheet({ open, onClose, data, index, slot, mode = "add", onChoose }: Props) {
  const { range } = useCurrency();
  const [cat, setCat] = useState<Category | "all" | "popular">("all");
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<Activity | null>(null);
  const where: Where = slotWhere(roleAt(data, index), slot) ?? "galle";
  const date = dateAt(data, index);
  const weekday = date ? parseISO(date).getUTCDay() : null;
  const isNye = slot === "night" && nyeIndex(data) === index;
  const slotIds = (data.days[index]?.[slot] ?? []).map((x) => x.id).join(",");
  const inSlot = useMemo(() => new Set(slotIds ? slotIds.split(",") : []), [slotIds]);
  const night = slot === "night";
  const halal = useHalal();
  const popular = usePopular();

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return activities
      .filter((a) => itemAllowed(a.id, slot, where, isNye) && !isHidden(a.id))
      .filter((a) => !a.onlyRole || a.onlyRole === roleAt(data, index))
      // Ella extras only alongside the Ella day trip, in this same slot.
      .filter((a) => !a.onlyWith || inSlot.has(a.onlyWith))
      .filter((a) => !halal || !isNightlife(a))
      .filter((a) => cat === "all" || (cat === "popular" ? popular(a.id) !== null : a.categories.includes(cat)))
      .filter(
        (a) =>
          !term ||
          [a.title, a.tagline, a.venue ?? "", ...a.tags].some((s) => s.toLowerCase().includes(term)) ||
          a.region.includes(term),
      )
      .sort((a, b) => {
        if (!!a.onlyWith !== !!b.onlyWith) return a.onlyWith ? -1 : 1;
        if (cat === "popular") return (popular(b.id) ?? 0) - (popular(a.id) ?? 0);
        if (isFeatured(a.id) !== isFeatured(b.id)) return isFeatured(a.id) ? -1 : 1;
        if (a.kind !== b.kind) return a.kind === "option" ? -1 : 1;
        if (where === "enroute") return (a.routeKm ?? 0) - (b.routeKm ?? 0);
        return hoursFrom(a, where) - hoursFrom(b, where);
      });
  }, [q, cat, slot, where, isNye, data, index, halal, inSlot, popular]);
  // The 🔥 filter only shows when something in this slot's pool is popular.
  const anyPopular = useMemo(
    () => activities.some((a) => popular(a.id) !== null && itemAllowed(a.id, slot, where, isNye) && !isHidden(a.id) && (!a.onlyWith || inSlot.has(a.onlyWith))),
    [popular, slot, where, isNye, inSlot],
  );

  const showStay = (cat === "all" || cat === "chill") && (!q.trim() || "stay in villa chill".includes(q.trim().toLowerCase()));
  const stay = where === "enroute" ? stayIn.enroute : stayIn[slot];

  function choose(id: string) {
    onChoose(id);
    onClose();
  }

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        tone={night ? "dusk" : "light"}
        eyebrow={`Day ${index + 1}${date ? ` · ${dayLabel(date)}` : ""} · ${night ? "Evening" : where === "enroute" ? "On the way" : "Daytime"}`}
        title={mode === "replace" ? "Swap it for…" : "Add another"}
      >
        <div className="px-4 pb-10">
          <label className={cn("flex h-11 items-center gap-2 rounded-2xl px-3", night ? "bg-white/10 text-paper" : "bg-paper shadow-card")}>
            <Search className={cn("size-4 shrink-0", night ? "text-paper/60" : "text-ink-3")} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={`Search ${list.length + (showStay ? 1 : 0)} things to do…`}
              aria-label="Search activities"
              className={cn("min-w-0 flex-1 bg-transparent text-[15px] outline-none", night ? "placeholder:text-paper/45" : "placeholder:text-ink-3/70")}
            />
            {q && (
              <button onClick={() => setQ("")} aria-label="Clear search" className="grid size-7 place-items-center rounded-full hover:bg-black/5">
                <X className="size-4" />
              </button>
            )}
          </label>
          <div className="no-scrollbar -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1" role="group" aria-label="Categories">
            {[
              { id: "all" as const, label: "All", icon: <span aria-hidden="true">✨</span> },
              ...(anyPopular ? [{ id: "popular" as const, label: "Popular", icon: <Flame className="-ml-0.5 size-[18px]" /> }] : []),
              ...CATEGORIES.filter((c) => !halal || c.id !== "party").map((c) => ({ id: c.id, label: c.label, icon: <span aria-hidden="true">{c.emoji}</span> })),
            ].map((c) => {
              const on = cat === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setCat(c.id)}
                  aria-pressed={on}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition active:scale-95",
                    on ? (night ? "bg-saffron-400 text-ink" : "bg-ink text-paper") : night ? "bg-white/10 text-paper/85" : "bg-paper text-ink-2 shadow-card",
                  )}
                >
                  {c.icon} {c.label}
                </button>
              );
            })}
          </div>

          <ul className="mt-3 space-y-2">
            {showStay && (
              <li>
                <CatalogRow
                  night={night}
                  title={stay.title}
                  subtitle={stay.tagline}
                  meta={where === "enroute" ? "~2 hrs on the expressway" : "No travel · free"}
                  thumb={
                    <span className={cn("grid size-14 shrink-0 place-items-center rounded-xl", night ? "bg-gradient-to-b from-dusk-700 to-ocean-800" : "bg-gradient-to-b from-saffron-200 to-sand-200")}>
                      <StayInIcon variant={slot} className="size-11" />
                    </span>
                  }
                  added={inSlot.has(STAY_ID)}
                  onAdd={() => choose(STAY_ID)}
                />
              </li>
            )}
            {list.map((a, k) => {
              const offDay = !!a.availableDays && weekday !== null && !a.availableDays.includes(weekday);
              return (
                <motion.li key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(k, 10) * 0.02 }}>
                  <CatalogRow
                    night={night}
                    title={a.title}
                    subtitle={a.tagline}
                    meta={`${isFeatured(a.id) ? "★ Featured · " : ""}${distanceLabel(a, where)} · ${range(a.estCostUsd)}`}
                    badges={
                      <>
                        {a.kind === "extra" && (
                          <span className={cn("rounded-full px-1.5 py-px text-[10px] font-bold", night ? "bg-white/15" : "bg-saffron-200 text-ink")}>Quick extra</span>
                        )}
                        {popular(a.id) !== null && <PopularBadge count={popular(a.id)!} tone={night ? "dark" : "light"} />}
                        <VibeDots vibe={a.vibe} />
                        <DaysBadge option={a} warn={offDay} />
                      </>
                    }
                    thumb={
                      <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-ocean-800">
                        <Photo photo={a.images[0]} alt={a.title} sizes="56px" />
                        {a.emoji && (
                          <span className="absolute bottom-0.5 right-0.5 grid size-5 place-items-center rounded-md bg-paper/95 text-[12px] shadow">{a.emoji}</span>
                        )}
                      </span>
                    }
                    added={inSlot.has(a.id)}
                    onAdd={() => choose(a.id)}
                    onInfo={() => setDetail(a)}
                    addLabel={`Add ${a.title}`}
                  />
                </motion.li>
              );
            })}
            {!list.length && !showStay && (
              <li className={cn("rounded-2xl p-5 text-center text-[14px]", night ? "bg-white/5 text-paper/70" : "bg-paper text-ink-3")}>
                Nothing matches — try another category or search.
              </li>
            )}
          </ul>
        </div>
      </Sheet>
      <OptionDetail
        open={!!detail}
        option={detail}
        where={where}
        onClose={() => setDetail(null)}
        pickLabel={mode === "replace" ? `Swap in on Day ${index + 1}` : `Add to Day ${index + 1}`}
        onPick={() => {
          if (!detail) return;
          setDetail(null);
          choose(detail.id);
        }}
      />
    </>
  );
}

function CatalogRow({
  night,
  title,
  subtitle,
  meta,
  badges,
  thumb,
  added,
  onAdd,
  onInfo,
  addLabel,
}: {
  night: boolean;
  title: string;
  subtitle: string;
  meta: string;
  badges?: React.ReactNode;
  thumb: React.ReactNode;
  added: boolean;
  onAdd: () => void;
  onInfo?: () => void;
  addLabel?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 rounded-2xl p-2 pr-2.5", night ? "bg-white/[0.06] ring-1 ring-white/10" : "bg-paper shadow-card")}>
      <button onClick={onInfo ?? onAdd} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={onInfo ? `More about ${title}` : undefined}>
        {thumb}
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-[14.5px] font-semibold leading-tight">{title}</span>
          <span className={cn("mt-0.5 block truncate text-[12px]", night ? "text-paper/60" : "text-ink-3")}>{subtitle}</span>
          <span className={cn("mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-semibold", night ? "text-paper/55" : "text-ink-3")}>
            <span>{meta}</span>
            {badges}
          </span>
        </span>
      </button>
      <button
        onClick={onAdd}
        disabled={added}
        aria-label={added ? `${title} is already in this slot` : (addLabel ?? `Add ${title}`)}
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-full transition active:scale-90",
          added ? (night ? "bg-white/10 text-saffron-400" : "bg-jungle-100 text-jungle-700") : night ? "bg-saffron-500 text-ink" : "bg-ink text-paper",
        )}
      >
        {added ? <Check className="size-[18px]" strokeWidth={3} /> : <Plus className="size-[18px]" strokeWidth={3} />}
      </button>
    </div>
  );
}
