"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import type { Option } from "@/content";
import { cn } from "@/lib/cn";
import type { TransportMode } from "@/lib/itinerary";
import { useCurrency } from "../currency";
import { Train, Van } from "../brand/illustrations";

/** "Scenic train 🚂 vs Road trip 🚐" chooser for day trips like Kandy. */
export function TransportChooser({
  option,
  value,
  onChange,
  disabled,
  compact,
}: {
  option: Option;
  value?: TransportMode;
  onChange: (m: TransportMode) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const { range } = useCurrency();
  if (!option.transport) return null;
  return (
    <section>
      {!compact && (
        <div className="px-1 pb-2">
          <h3 className="font-display text-[19px] font-semibold">How do you want to get there?</h3>
          <p className="text-[13px] text-ink-3">Both legs show in your timeline — there and back.</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {(["train", "road"] as const).map((m) => {
          const t = option.transport![m];
          const on = value === m;
          return (
            <motion.button
              key={m}
              whileTap={{ scale: 0.97 }}
              disabled={disabled}
              onClick={() => onChange(m)}
              aria-pressed={on}
              aria-label={`${t.title}: ${t.label}`}
              className={cn(
                "relative flex flex-col items-start rounded-[20px] border-2 p-3 text-left transition disabled:opacity-60",
                on ? "border-ocean-600 bg-ocean-100/70" : "border-transparent bg-paper shadow-card hover:border-sand-300",
              )}
            >
              <span className={cn("grid h-12 w-full place-items-center rounded-xl", m === "train" ? "bg-ocean-100" : "bg-saffron-100")}>
                {m === "train" ? <Train className="h-6 w-[72px]" /> : <Van className="h-8 w-14 text-ocean-600" />}
              </span>
              <span className="mt-2 text-[15px] font-semibold leading-tight">
                {t.title} <span aria-hidden="true">{m === "train" ? "🚂" : "🚐"}</span>
              </span>
              <span className="text-[12.5px] font-semibold text-ocean-700">{t.label}</span>
              <span className="mt-0.5 text-[12px] text-ink-3">{range(t.costUsd)} pp return</span>
              {on && (
                <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-ocean-600 text-white">
                  <Check className="size-3.5" strokeWidth={3.5} />
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
      {value && <p className="mt-2 px-1 text-[12px] leading-snug text-ink-3">{option.transport[value].detail}</p>}
    </section>
  );
}
