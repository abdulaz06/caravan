"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Hand, Moon, Sun, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PeekPlan } from "@/lib/peek";
import { cn } from "@/lib/cn";

const QUIPS = ["Nosy, aren't we?", "Just a little peek…", "We won't tell 🤫", "Curiosity killed the cat. Good thing you're not a cat.", "Shhh… don't let them see you."];

/** A keyhole, as a soft-edged mask image (white = visible). */
const KEYHOLE = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 130'><defs><filter id='b' x='-20%' y='-20%' width='140%' height='140%'><feGaussianBlur stdDeviation='2.2'/></filter></defs><g filter='url(#b)' fill='white'><circle cx='50' cy='42' r='31'/><path d='M37 58h26l11 63H26z'/></g></svg>",
)}")`;
/** Reduced motion: a plain small reveal window. */
const WINDOW = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 70'><rect x='2' y='2' width='96' height='66' rx='10' fill='white'/></svg>",
)}")`;

type Load = { kind: "loading" } | { kind: "ok"; plan: PeekPlan } | { kind: "error"; message: string };

/**
 * 👀 Peek: someone's plan seen through a keyhole you drag around. The plan is
 * one non-interactive, non-selectable layer under a mask, so it's never shown
 * clearly all at once and there's nothing to tap, copy or open.
 */
export function PeekView({ id, name }: { id: string; name: string }) {
  const reduce = useReducedMotion();
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [touched, setTouched] = useState(false);
  const [quip] = useState(() => QUIPS[Math.floor(Math.random() * QUIPS.length)]);
  const stage = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    let alive = true;
    fetch(`/api/peek/${id}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!alive) return;
        if (r.ok) setLoad({ kind: "ok", plan: body as PeekPlan });
        else setLoad({ kind: "error", message: r.status === 403 ? "Peeking is switched off right now." : (body.error ?? "Couldn't peek — try again.") });
      })
      .catch(() => alive && setLoad({ kind: "error", message: "Couldn't peek — try again." }));
    return () => {
      alive = false;
    };
  }, [id]);

  // Start the keyhole in the middle of the stage.
  useEffect(() => {
    const el = stage.current;
    if (el && !pos) setPos({ x: el.clientWidth / 2, y: el.clientHeight * 0.42 });
  }, [load.kind, pos]);

  // Fit the whole plan inside the stage (so dragging covers it all, no scrolling).
  useLayoutEffect(() => {
    const fit = () => {
      const st = stage.current;
      const ly = layer.current;
      if (!st || !ly) return;
      const s = Math.min(1, (st.clientHeight - 16) / ly.scrollHeight, (st.clientWidth - 16) / ly.scrollWidth);
      setScale(Math.max(0.55, s));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [load.kind]);

  const move = useCallback((e: React.PointerEvent) => {
    const el = stage.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ x: Math.min(r.width, Math.max(0, e.clientX - r.left)), y: Math.min(r.height, Math.max(0, e.clientY - r.top)) });
    setTouched(true);
  }, []);

  const hole = reduce ? { w: 170, h: 120 } : { w: 168, h: 218 };
  const x = (pos?.x ?? 0) - hole.w / 2;
  const y = (pos?.y ?? 0) - hole.h * 0.34;
  const mask = {
    WebkitMaskImage: reduce ? WINDOW : KEYHOLE,
    maskImage: reduce ? WINDOW : KEYHOLE,
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskSize: `${hole.w}px ${hole.h}px`,
    maskSize: `${hole.w}px ${hole.h}px`,
    WebkitMaskPosition: `${x}px ${y}px`,
    maskPosition: `${x}px ${y}px`,
  } as React.CSSProperties;

  const block = (e: React.SyntheticEvent) => e.preventDefault();

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#06090d] text-paper lg:left-auto lg:w-[480px]"
      onContextMenu={block}
      onCopy={block}
      onCut={block}
      onDragStart={block}
      style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" }}
    >
      <header className="relative z-20 flex items-center gap-3 px-4 pb-2 pt-[max(0.9rem,env(safe-area-inset-top))]">
        <Link href="/group" aria-label="Stop peeking" className="grid size-10 place-items-center rounded-full bg-white/10 hover:bg-white/15">
          <X className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold">👀 Peeking at {name}&apos;s plan</p>
          <motion.p
            initial={reduce ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="font-display line-clamp-2 text-[15px] italic leading-snug text-saffron-400"
          >
            {quip}
          </motion.p>
        </div>
      </header>

      <div
        ref={stage}
        role="img"
        aria-label={`Peek view of ${name}'s plan — drag to look through the keyhole`}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          move(e);
        }}
        onPointerMove={(e) => (e.buttons || e.pointerType === "mouse" ? move(e) : undefined)}
        className="relative flex-1 cursor-none touch-none"
      >
        {load.kind === "loading" && <p className="absolute inset-0 grid place-items-center text-[14px] text-paper/50">Creeping up to the door…</p>}
        {load.kind === "error" && (
          <div className="absolute inset-0 grid place-items-center p-8 text-center">
            <p className="text-[15px] text-paper/80">{load.message}</p>
          </div>
        )}
        {load.kind === "ok" && (
          <>
            {/* The plan: one masked, non-interactive layer. */}
            <motion.div
              aria-hidden="true"
              data-peek-layer
              className="pointer-events-none absolute inset-0 select-none"
              style={mask}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55, duration: 0.5 }}
            >
              <div className="flex h-full justify-center overflow-hidden pt-2">
                <div ref={layer} style={{ transform: `scale(${scale})`, transformOrigin: "top center" }} className="w-[340px]">
                  <PlanSheet plan={load.plan} />
                </div>
              </div>
            </motion.div>
            {/* The keyhole's brass rim, following the finger. */}
            {pos && !reduce && (
              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute left-0 top-0"
                initial={{ scale: 0, rotate: -14 }}
                animate={{ scale: [0, 1.12, 0.96, 1], rotate: [-14, 6, -3, 0], x: x - 14, y: y - 14 }}
                transition={{ scale: { duration: 0.9, times: [0, 0.55, 0.8, 1] }, rotate: { duration: 0.9 }, x: { duration: 0 }, y: { duration: 0 } }}
              >
                <svg width={hole.w + 28} height={hole.h + 28} viewBox="-14 -14 128 158" className="drop-shadow-[0_0_24px_rgba(242,163,58,0.25)]">
                  <path d="M50 11a31 31 0 0 1 13 59l11 51H26l11-51a31 31 0 0 1 13-59Z" fill="none" stroke="#c9913e" strokeWidth="5" opacity=".55" />
                </svg>
              </motion.div>
            )}
            {pos && reduce && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute rounded-[12px] ring-2 ring-saffron-400/60"
                style={{ left: x, top: y, width: hole.w, height: hole.h }}
              />
            )}
            {!touched && (
              <motion.p
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.4 }}
                className="pointer-events-none absolute inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] flex items-center justify-center gap-2 text-[13.5px] font-semibold text-paper/70"
              >
                <Hand className="size-4" /> Drag to look around
              </motion.p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** The plan, laid out compactly — titles only, no links, no details. */
function PlanSheet({ plan }: { plan: PeekPlan }) {
  const pos = plan.balance.score === null ? 50 : ((plan.balance.score + 2) / 4) * 100;
  return (
    <div className="rounded-[22px] bg-sand-50 p-4 text-ink">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-sunset-600">{plan.status === "submitted" ? "Submitted" : "Still cooking…"}</p>
      <p className="font-display text-[26px] font-semibold leading-none">
        {plan.name}&apos;s <span className="italic text-ocean-700">Sri Lanka</span>
      </p>
      <p className="mt-1 text-[12.5px] text-ink-2">{plan.dates ? `${plan.dates} · ${plan.length}` : "No dates yet"}</p>
      <div className="mt-3 rounded-xl bg-paper p-2.5 shadow-card">
        <p className="text-[12px] font-bold">{plan.balance.title}</p>
        <div className="relative mt-1.5 h-2 rounded-full bg-gradient-to-r from-jungle-600 via-saffron-400 to-hibiscus-500">
          <span className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-ink" style={{ left: `${pos}%` }} />
        </div>
        <p className="mt-1 flex justify-between text-[9.5px] font-bold uppercase tracking-wide text-ink-3">
          <span>Nature</span>
          <span>Nightlife</span>
        </p>
      </div>
      <ol className="mt-3 space-y-2">
        {plan.days.map((d, i) => (
          <li key={i} className="rounded-xl bg-paper p-2.5 shadow-card">
            <p className="text-[11.5px] font-bold">
              <span className="text-sunset-600">Day {i + 1}</span> · {d.label} · <span className="text-ink-3">{d.name}</span>
            </p>
            {d.day.length + d.night.length === 0 ? (
              <p className="mt-1 text-[12px] text-ink-3">{i === plan.days.length - 1 ? "Fly home ✈️" : "Nothing yet"}</p>
            ) : (
              <>
                <Slot items={d.day} icon="day" />
                <Slot items={d.night} icon="night" />
              </>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Slot({ items, icon }: { items: PeekPlan["days"][number]["day"]; icon: "day" | "night" }) {
  if (!items.length) return null;
  return (
    <ul className="mt-1.5 space-y-1">
      {items.map((it, k) => (
        <li key={k} className="flex items-center gap-2">
          {it.photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- a tiny static thumbnail inside the masked, non-interactive peek layer
            <img src={it.photo} alt="" draggable={false} className="size-8 shrink-0 rounded-lg object-cover" />
          ) : (
            <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg text-[14px]", icon === "day" ? "bg-saffron-100" : "bg-dusk-900")}>
              {it.emoji ?? "🌴"}
            </span>
          )}
          {icon === "day" ? <Sun className="size-3 shrink-0 text-saffron-600" /> : <Moon className="size-3 shrink-0 text-dusk-700" />}
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{it.title}</span>
          {it.area && <span className="shrink-0 text-[10.5px] text-ink-3">{it.area}</span>}
        </li>
      ))}
    </ul>
  );
}
