"use client";

import { motion, useReducedMotion } from "framer-motion";
import { createContext, useCallback, useContext, useEffect, useId, useState } from "react";
import { cn } from "@/lib/cn";
import type { PopularPayload } from "@/engine/popular";
import { useMaybeTrip, useRules } from "./engine";
import { useFamily } from "./family";

// 🔥 Popular picks on the client: seeded from the page, refreshed every few
// minutes from /api/popular while the tab is visible. Badges show only when
// the organizers have them on, and never in family-friendly mode.
const REFRESH_MS = 3 * 60_000;
const PopularContext = createContext<PopularPayload | null>(null);

export function PopularProvider({ initial, children }: { initial: PopularPayload | null; children: React.ReactNode }) {
  const [data, setData] = useState(initial);
  const slug = useMaybeTrip()?.slug;
  useEffect(() => {
    if (!initial || !slug) return;
    let alive = true;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      fetch(`/api/t/${slug}/popular`)
        .then((r) => (r.ok ? r.json() : null))
        .then((p: PopularPayload | null) => alive && p && setData(p))
        .catch(() => {});
    };
    const t = window.setInterval(refresh, REFRESH_MS);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [initial, slug]);
  return <PopularContext.Provider value={data}>{children}</PopularContext.Provider>;
}

/** How many people picked this — only for popular ones, and only when badges should show. */
export function usePopular(): (id: string) => number | null {
  const data = useContext(PopularContext);
  const rules = useRules();
  const family = useFamily();
  const off = !data?.on || !rules.popularBadges || family;
  const counts = data?.counts;
  return useCallback((id: string) => (off || !counts ? null : (counts[id] ?? null)), [off, counts]);
}

/** A little two-tone flame that flickers (still for reduced motion). */
export function Flame({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  const id = useId();
  return (
    <motion.svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      style={{ transformOrigin: "50% 90%" }}
      animate={reduce ? undefined : { scaleY: [1, 1.08, 0.97, 1.05, 1], rotate: [0, -2, 1.5, -1, 0] }}
      transition={reduce ? undefined : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
    >
      <defs>
        <linearGradient id={`${id}o`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="var(--color-pop-500)" />
          <stop offset="0.55" stopColor="var(--color-accent-500)" />
          <stop offset="1" stopColor="var(--color-highlight-500)" />
        </linearGradient>
      </defs>
      <path
        d="M12 1.8c1.1 3.4 6 5.9 6 11.6A6 6 0 0 1 12 19.6a6 6 0 0 1-6-6.2c0-3 1.7-4.8 3-6.2.3 2 1.1 3.2 2.4 3.8-.5-3.7-.1-6.4.6-9.2Z"
        fill={`url(#${id}o)`}
      />
      <path d="M12.3 9.8c.7 2.1 3.1 3.3 3.1 6.1a3.4 3.4 0 0 1-6.8 0c0-1.5.8-2.5 1.5-3.3.2 1 .7 1.6 1.3 1.9-.2-1.8 0-3.2.9-4.7Z" fill="var(--color-highlight-200)" />
    </motion.svg>
  );
}

/** "🔥 Popular · 7 picked" — `photo` sits on a cover photo, `light` on cards, `dark` on dusk panels. */
export function PopularBadge({ count, tone = "light", short, className }: { count: number; tone?: "light" | "photo" | "dark"; short?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full py-0.5 pl-1 pr-2 text-[10.5px] font-bold leading-none",
        tone === "photo" && "bg-gradient-to-r from-accent-500 to-pop-500 py-[3px] pl-[3px] text-white shadow-lg shadow-ink/25",
        tone === "light" && "bg-accent-100 text-accent-700 ring-1 ring-accent-500/20",
        tone === "dark" && "bg-white/10 text-highlight-200 ring-1 ring-white/10",
        className,
      )}
      aria-label={`Popular: ${count} people picked this`}
    >
      {tone === "photo" ? (
        <span className="grid size-[18px] shrink-0 place-items-center rounded-full bg-paper">
          <Flame className="size-[14px]" />
        </span>
      ) : (
        <Flame className="size-[15px] shrink-0" />
      )}
      {short ? `${count} picked` : `Popular · ${count} picked`}
    </span>
  );
}
