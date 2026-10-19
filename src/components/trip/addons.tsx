"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Plus } from "lucide-react";
import { addOns, addOnsById, type AddOn, type BaseId } from "@/content";
import { cn } from "@/lib/cn";
import type { SlotKind } from "@/lib/itinerary";
import { useCurrency } from "../currency";
import { Photo } from "../ui/photo";

export function addOnsFor(base: BaseId, slot: SlotKind): AddOn[] {
  return addOns.filter((a) => a.base === base && a.slots.includes(slot));
}

/** Small chips under a pick on day cards and in the timeline. */
export function AddOnChips({
  ids,
  tone = "light",
  onAdd,
  className,
}: {
  ids?: string[];
  tone?: "light" | "dark";
  onAdd?: () => void;
  className?: string;
}) {
  const list = (ids ?? []).map((id) => addOnsById[id]).filter(Boolean);
  if (!list.length && !onAdd) return null;
  const dark = tone === "dark";
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {list.map((a) => (
        <span
          key={a.id}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold",
            dark ? "bg-white/10 text-paper/90 ring-1 ring-white/10" : "bg-saffron-100 text-ink ring-1 ring-saffron-200",
          )}
        >
          <span aria-hidden="true">{a.emoji}</span> {a.title}
        </span>
      ))}
      {onAdd && (
        <button
          onClick={onAdd}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-[11.5px] font-semibold transition",
            dark ? "border-white/25 text-paper/70 hover:bg-white/10" : "border-sand-400 text-ink-3 hover:bg-sand-100",
          )}
        >
          <Plus className="size-3" strokeWidth={3} /> Add-on
        </button>
      )}
    </div>
  );
}

/** Multi-select add-on chips in the option sheet, filtered to the base and time of day. */
export function AddOnPicker({
  base,
  slot,
  selected,
  onChange,
  disabled,
}: {
  base: BaseId;
  slot: SlotKind;
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const { range } = useCurrency();
  const list = addOnsFor(base, slot);
  if (!list.length) return null;
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <section>
      <div className="flex items-baseline justify-between px-1 pb-2">
        <h3 className="font-display text-[19px] font-semibold">Add-ons</h3>
        <span className="text-[12px] text-ink-3">Optional extras · {base === "colombo" ? "Colombo" : "Galle"}</span>
      </div>
      <ul className="grid gap-2">
        {list.map((a) => {
          const on = selected.includes(a.id);
          return (
            <li key={a.id}>
              <button
                disabled={disabled}
                onClick={() => toggle(a.id)}
                aria-pressed={on}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border-2 p-2 pr-3 text-left transition active:scale-[0.99] disabled:opacity-60",
                  on ? "border-ocean-600 bg-ocean-100/60" : "border-transparent bg-paper shadow-card",
                )}
              >
                <span className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-ocean-800">
                  <Photo photo={a.images[0]} alt={a.title} sizes="48px" />
                  <span className="absolute bottom-0.5 right-0.5 grid size-5 place-items-center rounded-md bg-paper/95 text-[12px] shadow">
                    {a.emoji}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-semibold leading-tight">{a.title}</span>
                  <span className="block truncate text-[12px] text-ink-3">{a.venue}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[12.5px] font-bold tabular-nums">{range(a.estCostUsd)}</span>
                  <span className="text-[10.5px] text-ink-3">{a.duration}</span>
                </span>
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full border-2 transition",
                    on ? "border-ocean-600 bg-ocean-600 text-white" : "border-sand-300",
                  )}
                >
                  <AnimatePresence>
                    {on && (
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                        <Check className="size-3.5" strokeWidth={3.5} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
