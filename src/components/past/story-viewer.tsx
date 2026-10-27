"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Pause, Play, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { StorySlide } from "@/lib/server/past-trips";
import { cn } from "@/lib/cn";
import { CaravanMark } from "../brand/wordmark";

const SLIDE_MS = 5000;

type Props = {
  title: string;
  cover: StorySlide;
  slides: StorySlide[];
  teaser: StorySlide | null;
  /** Where "close" and "full itinerary" go. */
  backHref: string;
};

/**
 * A trip told as a story: full-bleed 9:16 slides with progress bars at the
 * top. Taps on the left go back, anywhere else goes forward; holding pauses;
 * arrow keys and Escape work too. Slides advance on their own every 5 s and
 * the story stops on its last slide.
 */
export function StoryViewer({ title, cover, slides, teaser, backHref }: Props) {
  const all = [cover, ...slides, ...(teaser ? [teaser] : [])];
  const last = all.length - 1;
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [held, setHeld] = useState(false);
  const [progress, setProgress] = useState(0);
  const reduce = useReducedMotion();
  const startedAt = useRef(0);
  const elapsed = useRef(0);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didHold = useRef(false);

  const go = useCallback(
    (n: number) => {
      const next = Math.max(0, Math.min(last, n));
      elapsed.current = 0;
      startedAt.current = performance.now();
      setProgress(0);
      setI(next);
    },
    [last],
  );

  // The clock: fills the current bar, then moves on (never past the last slide).
  const running = !paused && !held && i < last;
  useEffect(() => {
    if (!running) return;
    startedAt.current = performance.now() - elapsed.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = now - startedAt.current;
      elapsed.current = t;
      if (t >= SLIDE_MS) {
        go(i + 1);
        return;
      }
      setProgress(t / SLIDE_MS);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, i, go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(i + 1);
      else if (e.key === "ArrowLeft") go(i - 1);
      else if (e.key === " ") {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (e.key === "Escape") window.location.assign(backHref);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [i, go, backHref]);

  // Press and hold pauses; a quick tap navigates.
  function down() {
    didHold.current = false;
    holdTimer.current = setTimeout(() => {
      didHold.current = true;
      setHeld(true);
    }, 220);
  }
  function up(e: React.PointerEvent<HTMLDivElement>) {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    setHeld(false);
    if (didHold.current) return;
    const box = e.currentTarget.getBoundingClientRect();
    if (e.clientX - box.left < box.width * 0.3) go(i - 1);
    else go(i + 1);
  }

  const s = all[i];
  const isCover = i === 0;
  const isTeaser = !!teaser && i === last;
  const nextPhoto = all[i + 1]?.photo;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-night-950">
      {/* Blurred backdrop on wide screens */}
      {s.photo && (
        <Image src={s.photo.src} alt="" fill sizes="10vw" className="scale-110 object-cover opacity-40 blur-3xl" aria-hidden="true" />
      )}
      <div
        className="relative h-dvh w-full overflow-hidden bg-night-900 sm:h-[min(92dvh,880px)] sm:w-auto sm:rounded-[28px] sm:shadow-lift"
        style={{ aspectRatio: "9 / 16" }}
        role="region"
        aria-roledescription="story"
        aria-label={`${title}: slide ${i + 1} of ${all.length}`}
      >
        <AnimatePresence initial={false}>
          <motion.div
            key={i}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.35 }}
          >
            {s.photo ? (
              <motion.div
                className="absolute inset-0"
                initial={{ scale: reduce ? 1 : 1.08 }}
                animate={{ scale: 1 }}
                transition={{ duration: reduce ? 0 : SLIDE_MS / 1000 + 0.5, ease: "linear" }}
              >
                <Image
                  src={s.photo.src}
                  alt={`${s.title}, ${s.place}`}
                  fill
                  priority={i < 2}
                  sizes="(min-width: 640px) 500px, 100vw"
                  placeholder={s.photo.blurDataURL ? "blur" : "empty"}
                  blurDataURL={s.photo.blurDataURL}
                  className="object-cover"
                />
              </motion.div>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-primary-700 to-night-900" />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/5 via-40% to-black/55" />
          </motion.div>
        </AnimatePresence>
        {nextPhoto && <Image src={nextPhoto.src} alt="" width={10} height={10} className="hidden" sizes="(min-width: 640px) 500px, 100vw" aria-hidden="true" />}

        {/* Tap zones */}
        <div
          className="absolute inset-0 z-10 cursor-pointer select-none"
          onPointerDown={down}
          onPointerUp={up}
          onPointerLeave={() => {
            if (holdTimer.current) clearTimeout(holdTimer.current);
            setHeld(false);
          }}
          onContextMenu={(e) => e.preventDefault()}
        />

        {/* Progress bars */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex gap-1 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          {all.map((_, k) => (
            <span key={k} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
              <span className="block h-full rounded-full bg-white" style={{ width: `${k < i ? 100 : k === i ? (i === last ? 100 : progress * 100) : 0}%` }} />
            </span>
          ))}
        </div>

        {/* Top bar */}
        <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-2.5 px-3 pt-[max(1.6rem,calc(env(safe-area-inset-top)+0.85rem))]">
          <span className="grid size-8 place-items-center rounded-full bg-black/30 backdrop-blur">
            <CaravanMark tone="light" className="size-5" />
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white/90">{title}</span>
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? "Play" : "Pause"}
            className="grid size-9 place-items-center rounded-full text-white hover:bg-white/15"
          >
            {paused ? <Play className="size-4.5" fill="currentColor" /> : <Pause className="size-4.5" fill="currentColor" />}
          </button>
          <Link href={backHref} aria-label="Close the story" className="grid size-9 place-items-center rounded-full text-white hover:bg-white/15">
            <X className="size-5" />
          </Link>
        </div>

        {/* Words, in the style of the original deck: DAY 3 / SKI DAY / GUDAURI */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={i}
            className={cn("pointer-events-none absolute inset-x-0 z-20 px-6 text-white", isTeaser ? "bottom-0 pb-[max(2.6rem,calc(env(safe-area-inset-bottom)+1.6rem))]" : "top-[18%]")}
            initial={{ opacity: 0, y: reduce ? 0 : 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.4, delay: reduce ? 0 : 0.12 }}
          >
            <p className="text-[15px] font-bold uppercase tracking-[0.06em] text-white/90 [text-shadow:0_1px_12px_rgb(0_0_0/0.45)]">{s.kicker}</p>
            <h2
              className={cn(
                "mt-1 font-extrabold uppercase leading-[0.92] tracking-[-0.02em] [text-shadow:0_2px_20px_rgb(0_0_0/0.4)]",
                isCover || isTeaser ? "text-[54px]" : "text-[40px]",
              )}
            >
              {s.title}
            </h2>
            {s.place && <p className="mt-2 text-[16px] font-semibold uppercase tracking-[0.04em] text-white/95 [text-shadow:0_1px_12px_rgb(0_0_0/0.45)]">{s.place}</p>}
            {(s.time || s.text) && (
              <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-black/35 px-3 py-1.5 text-[13px] font-semibold backdrop-blur">
                {s.time && <span className="text-highlight-400">{s.time}</span>}
                {s.time && s.text && <span className="text-white/40">·</span>}
                {s.text}
              </p>
            )}
            {isTeaser && (
              <div className="pointer-events-auto mt-6 flex flex-col gap-2.5">
                <Link
                  href="/new"
                  className="flex h-13 items-center justify-center gap-2 rounded-full bg-white text-[15px] font-bold text-night-900 transition active:scale-[0.98]"
                >
                  Plan the next one on Caravan <ArrowRight className="size-4.5" strokeWidth={2.5} />
                </Link>
                <Link href={backHref} className="flex h-12 items-center justify-center rounded-full text-[14.5px] font-semibold text-white ring-1 ring-white/40 backdrop-blur">
                  See the full itinerary
                </Link>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {s.photo && (
          <a
            href={s.photo.source}
            target="_blank"
            rel="noreferrer"
            className="absolute bottom-[max(0.6rem,env(safe-area-inset-bottom))] right-3 z-20 max-w-[70%] truncate text-[10px] text-white/55"
          >
            Photo: {s.photo.credit} · {s.photo.license}
          </a>
        )}
        {held && <span className="sr-only">Paused</span>}
      </div>
    </div>
  );
}
