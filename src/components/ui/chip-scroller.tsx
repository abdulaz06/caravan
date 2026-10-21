"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * A horizontal row of chips that always lets you reach every one: touch swipe
 * with scroll-snap, mouse wheel / trackpad and click-drag on desktop, fade
 * edges (and arrows on hover devices) when there's more, and the active chip
 * (`data-active`) scrolled into view.
 */
export function ChipScroller({
  children,
  label,
  activeKey,
  tone = "dark",
  className,
}: {
  children: React.ReactNode;
  label: string;
  /** Changes when the active chip changes, to scroll it into view. */
  activeKey?: string | number | null;
  tone?: "dark" | "light";
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    // A vertical wheel (most mice) scrolls the row sideways.
    const wheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || el.scrollWidth <= el.clientWidth) return;
      const before = el.scrollLeft;
      el.scrollLeft += e.deltaY;
      if (el.scrollLeft !== before) e.preventDefault();
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      ro.disconnect();
      el.removeEventListener("wheel", wheel);
    };
  }, [measure]);

  // Keep the active chip in view (centred where possible).
  useEffect(() => {
    const el = ref.current;
    const chip = el?.querySelector<HTMLElement>("[data-active='true']");
    if (!el || !chip) return;
    const left = chip.offsetLeft - el.clientWidth / 2 + chip.offsetWidth / 2;
    el.scrollTo({ left: Math.max(0, left), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [activeKey]);

  const nudge = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.7, behavior: "smooth" });
  const fade = tone === "dark" ? "from-ocean-800" : "from-sand-100";
  const arrow = tone === "dark" ? "bg-paper text-ink" : "bg-ink text-paper";

  return (
    <div className={cn("relative", className)}>
      <div
        ref={ref}
        role="group"
        aria-label={label}
        onScroll={measure}
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse" || !ref.current) return;
          drag.current = { x: e.clientX, left: ref.current.scrollLeft, moved: false };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || !ref.current) return;
          if (Math.abs(e.clientX - d.x) > 4) d.moved = true;
          if (d.moved) ref.current.scrollLeft = d.left - (e.clientX - d.x);
        }}
        onPointerUp={() => {
          setTimeout(() => (drag.current = null), 0);
        }}
        onPointerLeave={() => (drag.current = null)}
        onClickCapture={(e) => {
          if (drag.current?.moved) {
            e.stopPropagation();
            e.preventDefault();
          }
        }}
        className="no-scrollbar flex snap-x snap-mandatory scroll-px-3 gap-1.5 overflow-x-auto overscroll-x-contain px-3 pb-1 [&>*]:snap-start"
      >
        {children}
      </div>
      <span
        aria-hidden="true"
        className={cn("pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r to-transparent transition-opacity", fade, edges.left ? "opacity-100" : "opacity-0")}
      />
      <span
        aria-hidden="true"
        className={cn("pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l to-transparent transition-opacity", fade, edges.right ? "opacity-100" : "opacity-0")}
      />
      {edges.left && (
        <button
          onClick={() => nudge(-1)}
          aria-label="Scroll back"
          className={cn("absolute left-1 top-[calc(50%-2px)] hidden size-7 -translate-y-1/2 place-items-center rounded-full shadow-card [@media(hover:hover)]:grid", arrow)}
        >
          <ChevronLeft className="size-4" />
        </button>
      )}
      {edges.right && (
        <button
          onClick={() => nudge(1)}
          aria-label="Scroll for more"
          className={cn("absolute right-1 top-[calc(50%-2px)] hidden size-7 -translate-y-1/2 place-items-center rounded-full shadow-card [@media(hover:hover)]:grid", arrow)}
        >
          <ChevronRight className="size-4" />
        </button>
      )}
    </div>
  );
}
