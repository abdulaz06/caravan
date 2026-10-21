"use client";

import { motion } from "framer-motion";
import { Leaf, Lock, Martini, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { balanceLabel } from "@/lib/timeline";
import { Avatar } from "../avatar";

type Person = { id: string; name: string; isMe: boolean; balance: number | null; organizer?: boolean };

const AVATAR = 36; // px
const LANE = 44; // px between lanes

/** Lane per person so avatars never overlap: alternate above/below the line, further out as needed. */
function layout(people: Person[], width: number) {
  const gap = ((AVATAR + 4) / Math.max(1, width)) * 100; // in %
  const placed = people
    .filter((p) => p.balance !== null)
    .map((p) => ({ ...p, x: ((p.balance! + 2) / 4) * 100 }))
    .sort((a, b) => a.x - b.x);
  const lastX: number[] = [];
  return placed.map((p) => {
    let lane = 0;
    while (lastX[lane] !== undefined && p.x - lastX[lane] < gap) lane++;
    lastX[lane] = p.x;
    return { ...p, lane };
  });
}

/** Everyone on one Nature ↔ Nightlife line. Tap an avatar to open their trip. */
export function GroupSpectrum({ people, canBrowse, submitted }: { people: Person[]; canBrowse: boolean; submitted: number }) {
  // The line's real width decides how close two avatars can sit before one moves out a lane.
  const strip = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(280);
  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth || 280));
    ro.observe(el);
    return () => ro.disconnect();
  }, [canBrowse]);
  const dots = layout(people, width);
  const lanes = dots.reduce((m, d) => Math.max(m, d.lane), 0) + 1;
  const above = Math.ceil(lanes / 2);
  const below = Math.floor(lanes / 2);
  const lineY = 18 + above * LANE;
  const height = lineY + 18 + below * LANE + 6;
  // lane 0 → just above, 1 → just below, 2 → further above, …
  const yFor = (lane: number) => (lane % 2 === 0 ? lineY - LANE * (lane / 2 + 1) + 6 : lineY + LANE * ((lane - 1) / 2) + 16);

  return (
    <section className="relative overflow-hidden rounded-[26px] bg-paper p-4 shadow-card" aria-label="Group spectrum">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="label text-sunset-600">Group spectrum</p>
          <p className="font-display text-[24px] font-semibold leading-tight">Where everyone lands</p>
        </div>
        <p className="pb-1 text-right text-[12px] text-ink-3">{canBrowse ? "Tap someone to open their trip" : `${submitted} submitted`}</p>
      </div>

      {canBrowse && dots.length > 0 ? (
        <div ref={strip} className="relative mt-3 mx-[18px]" style={{ height }}>
          <div className="absolute inset-x-0 h-3 -translate-y-1/2 rounded-full bg-gradient-to-r from-jungle-600 via-saffron-400 to-hibiscus-500" style={{ top: lineY }} />
          <div className="absolute h-5 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-white/80" style={{ top: lineY, left: "50%" }} />
          {/* stems and line dots first, so no stem ever crosses another person's avatar */}
          {dots.map((d, i) => {
            const y = yFor(d.lane);
            const up = d.lane % 2 === 0;
            return (
              <motion.div
                key={`stem-${d.id}`}
                className="absolute"
                style={{ left: `${d.x}%`, top: 0 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.1 + i * 0.05 }}
              >
                <span
                  className="absolute w-0.5 -translate-x-1/2 bg-ink/25"
                  style={up ? { top: y + AVATAR, height: Math.max(0, lineY - (y + AVATAR)) } : { top: lineY, height: Math.max(0, y - lineY) }}
                />
                <span className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-paper bg-ink" style={{ top: lineY }} />
              </motion.div>
            );
          })}
          {dots.map((d, i) => (
            <motion.div
              key={d.id}
              className="absolute"
              style={{ left: `${d.x}%`, top: yFor(d.lane) }}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 380, damping: 22, delay: 0.1 + i * 0.05 }}
            >
              <Link
                href={`/group/${d.id}`}
                aria-label={`${d.name}${d.isMe ? " (you)" : ""}${d.organizer ? " · organizer" : ""} — ${balanceLabel(d.balance).title}. Open their trip`}
                className="absolute block -translate-x-1/2 rounded-full transition hover:scale-110 active:scale-95"
              >
                <Avatar name={d.name} className={cn("size-9 text-[14px] shadow-card", d.isMe ? "ring-[3px] ring-saffron-500" : "ring-2 ring-paper")} />
                {d.organizer && (
                  <span className="absolute -bottom-1 -right-1 grid size-4 place-items-center rounded-full bg-jungle-800 ring-2 ring-paper" title="Organizer">
                    <ShieldCheck className="size-2.5 text-saffron-400" />
                  </span>
                )}
              </Link>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="relative mt-3 overflow-hidden rounded-2xl bg-sand-100 p-4">
          <div className="relative mx-2 h-3 rounded-full bg-gradient-to-r from-jungle-600 via-saffron-400 to-hibiscus-500 opacity-60 blur-[1px]" />
          <p className="mt-3 flex items-center gap-2 text-[13.5px] text-ink-2">
            <Lock className="size-4 shrink-0 text-ink-3" />
            {canBrowse ? "Nobody's on the line yet." : "Submit yours to see where everyone lands."}
          </p>
        </div>
      )}

      <div className="mt-1 flex items-center justify-between text-[11.5px] font-bold uppercase tracking-wide">
        <span className="flex items-center gap-1 text-jungle-600">
          <Leaf className="size-3.5" strokeWidth={2.5} /> Nature
        </span>
        <span className="text-ink-3">↔</span>
        <span className="flex items-center gap-1 text-hibiscus-600">
          Nightlife <Martini className="size-3.5" strokeWidth={2.5} />
        </span>
      </div>
    </section>
  );
}

/** A small Nature ↔ Nightlife bar for list cards. */
export function MiniMeter({ score, className }: { score: number | null; className?: string }) {
  const pos = score === null ? 50 : ((score + 2) / 4) * 100;
  return (
    <span className={cn("relative inline-block h-2 w-full rounded-full bg-gradient-to-r from-jungle-600 via-saffron-400 to-hibiscus-500", className)} aria-hidden="true">
      <span className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-ink shadow" style={{ left: `${pos}%`, opacity: score === null ? 0.35 : 1 }} />
    </span>
  );
}
