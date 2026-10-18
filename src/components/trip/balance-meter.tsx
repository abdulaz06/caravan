"use client";

import { motion } from "framer-motion";
import { Leaf, Martini } from "lucide-react";
import { cn } from "@/lib/cn";
import { balanceLabel, type Balance } from "@/lib/timeline";

type Props = { balance: Balance; size?: "compact" | "full"; tone?: "light" | "dark"; className?: string; title?: string };

/** Nature ↔ nightlife meter. Position = average vibe of all picks (-2 … +2). */
export function BalanceMeter({ balance, size = "full", tone = "light", className, title = "Your vibe" }: Props) {
  const { score } = balance;
  const pos = score === null ? 50 : ((score + 2) / 4) * 100;
  const label = balanceLabel(score);
  const dark = tone === "dark";

  return (
    <div className={className}>
      {size === "full" && (
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className={cn("label", dark ? "text-saffron-400" : "text-ink-3")}>{title}</p>
            <motion.p
              key={label.title}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-display text-[26px] font-semibold leading-tight"
            >
              {label.title}
            </motion.p>
          </div>
          <p className={cn("pb-1 text-right text-[12.5px]", dark ? "text-paper/60" : "text-ink-3")}>{label.line}</p>
        </div>
      )}
      <div className="flex items-center gap-2.5">
        <span
          className={cn("flex items-center gap-1 text-[11.5px] font-bold uppercase tracking-wide", dark ? "text-jungle-400" : "text-jungle-600")}
        >
          <Leaf className="size-3.5" strokeWidth={2.5} />
          {size === "full" && "Nature"}
        </span>
        <div className="relative h-3 flex-1">
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-jungle-600 via-saffron-400 to-hibiscus-500" />
          <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-white/60" />
          <motion.div
            className="absolute top-1/2 -ml-[11px] -mt-[11px] size-[22px] rounded-full border-[3px] border-white bg-ink shadow-lg"
            initial={false}
            animate={{ left: `${pos}%`, opacity: score === null ? 0.35 : 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
          />
        </div>
        <span
          className={cn("flex items-center gap-1 text-[11.5px] font-bold uppercase tracking-wide", dark ? "text-hibiscus-300" : "text-hibiscus-600")}
        >
          {size === "full" && "Nightlife"}
          <Martini className="size-3.5" strokeWidth={2.5} />
        </span>
      </div>
      {size === "full" && balance.count > 0 && (
        <p className={cn("mt-2.5 text-center text-[12px]", dark ? "text-paper/55" : "text-ink-3")}>
          {balance.nature} outdoorsy · {balance.balanced} in-between · {balance.nightlife} social & nightlife
        </p>
      )}
    </div>
  );
}
