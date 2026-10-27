"use client";

import { motion } from "framer-motion";
import { ArrowRight, CalendarHeart, Loader2, Lock, Megaphone, ShieldCheck, Swords, PartyPopper } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Photo } from "./ui/photo";
import { Lockup, Stamp } from "./brand/wordmark";
import { SiteFooter } from "./brand/site-footer";
import { WaveEdge } from "./brand/illustrations";
import { useArt } from "./brand/art";
import { useCatalog, useTrip } from "./engine";
import type { Catalog } from "@/engine/catalog";
import { AvatarStack } from "./avatar";
import type { PublicCounts } from "@/lib/server/group";

/** The photo strip: the preset's showcase, or the first options with photos. */
function marquee(catalog: Catalog) {
  const ids = catalog.preset.destination.showcase ?? catalog.options.filter((o) => o.images.length).slice(0, 12).map((o) => o.id);
  return ids.map((id) => catalog.byId[id]).filter((o) => o?.images.length);
}

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven"];
const shortDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** The three steps, worded from the live trip shape. */
function steps(t: PublicCounts["trip"], special: string | null) {
  const nights = (n: number) => `${WORDS[n] ?? n} ${n === 1 ? "night" : "nights"}`;
  const where = t.bases.filter((b) => b.nights > 0).map((b) => `${nights(b.nights)} in ${b.name}`);
  const shape = where.length > 1 ? `${where.slice(0, -1).join(", ")}, then ${where.at(-1)}` : (where[0] ?? "");
  return [
    {
      icon: CalendarHeart,
      title: `Place your ${t.days} days`,
      body: `The trip is ${t.days} days · ${t.days - 1} nights. Slide the window anywhere from ${shortDay(t.start)} to ${shortDay(t.end)}${special ? ` — over ${special}, maybe?` : "."}`,
    },
    {
      icon: Swords,
      title: "Build your days",
      body: `${shape.replace(/^./, (c) => c.toUpperCase())}. Pick A vs B for each daytime and evening, add extras, or tap Quick fill.`,
    },
    {
      icon: PartyPopper,
      title: "Submit & compare",
      body: "See which dates work for everyone, what's most popular, and peek at the crew's picks.",
    },
  ];
}

const rise = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
};

export function Welcome({ counts }: { counts: PublicCounts }) {
  const catalog = useCatalog();
  const trip = useTrip();
  const { preset } = catalog;
  const { Decor, Vehicle } = useArt();
  const hero = catalog.heroPhotos[0];
  const strip = marquee(catalog);
  const teaser = preset.destination.teaser ?? ["This or that?", "You get to choose."];
  return (
    <div className="grain">
      {/* ── Hero poster ─────────────────────────────────────────── */}
      <section className="relative flex min-h-[100svh] flex-col overflow-hidden bg-primary-900 text-paper">
        <motion.div
          className="absolute inset-0"
          initial={{ scale: 1.12 }}
          animate={{ scale: 1 }}
          transition={{ duration: 2.4, ease: [0.2, 0.7, 0.2, 1] }}
        >
          <Photo photo={hero} alt={preset.name} sizes="(min-width: 1024px) 480px, 100vw" priority quality={85} />
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-b from-primary-950/55 via-transparent via-35% to-primary-950" />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-primary-950 via-primary-950/85 to-transparent" />

        <header className="relative z-10 flex items-center justify-between px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
          <Lockup size="md" tone="light" className="lg:invisible" />
          <span className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold ring-1 ring-white/25 backdrop-blur-md">
            {preset.destination.season}
          </span>
        </header>

        <motion.div
          initial={{ opacity: 0, rotate: -40, scale: 0.6 }}
          animate={{ opacity: 1, rotate: -12, scale: 1 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 160, damping: 14 }}
          className="absolute right-4 top-[22%] z-10 [@media(max-height:740px)]:top-[10%]"
        >
          <Stamp
            className="size-[104px] text-highlight-500 drop-shadow-xl [@media(max-height:740px)]:size-[78px]"
            text={`${preset.name.toUpperCase()} · ${preset.destination.season.toUpperCase()} · `}
          />
        </motion.div>

        <motion.div
          className="relative z-10 mt-auto px-5 pb-[max(1.75rem,env(safe-area-inset-bottom))]"
          initial="hidden"
          animate="show"
          transition={{ staggerChildren: 0.09, delayChildren: 0.25 }}
        >
          <motion.p variants={rise} className="label text-highlight-400">
            {trip.name} · {preset.name}
          </motion.p>
          <motion.h1
            variants={rise}
            className="font-display mt-3 text-[46px] font-semibold leading-[0.98] tracking-[-0.03em] sm:text-[52px] [@media(max-height:740px)]:text-[38px]"
          >
            Build your dream <span className="relative inline-block italic text-highlight-400">{preset.name}</span> trip.
          </motion.h1>
          <motion.p variants={rise} className="mt-4 max-w-sm text-[17px] leading-snug text-paper/85 [@media(max-height:740px)]:mt-2.5 [@media(max-height:740px)]:text-[15.5px]">
            Takes 5 minutes, or as long as you like. Pick your days and nights, and we&apos;ll plan the trip from
            everyone&apos;s picks.
          </motion.p>

          <motion.div variants={rise} className="mt-6 flex items-center gap-3 [@media(max-height:740px)]:mt-4">
            {counts.joined > 0 ? (
              <>
                <AvatarStack initials={counts.initials} />
                <p className="text-sm text-paper/85">
                  <b className="text-paper">{counts.joined}</b> {counts.joined === 1 ? "friend has" : "friends have"} joined
                  {counts.submitted > 0 && (
                    <>
                      {" "}
                      · <b className="text-paper">{counts.submitted}</b> submitted
                    </>
                  )}
                </p>
              </>
            ) : (
              <p className="text-sm text-paper/85">Be the first of the crew to join ✨</p>
            )}
          </motion.div>

          {counts.announcement && (
            <motion.p
              variants={rise}
              role="status"
              aria-label="Announcement"
              className="mt-5 flex items-start gap-2 rounded-2xl bg-white/12 px-4 py-3 text-[14px] font-medium leading-snug ring-1 ring-white/20 backdrop-blur-md"
            >
              <Megaphone className="mt-0.5 size-4 shrink-0 text-highlight-400" /> <span className="whitespace-pre-line">{counts.announcement}</span>
            </motion.p>
          )}
          {counts.locked && (
            <motion.p
              variants={rise}
              className="mt-5 flex items-center gap-2 rounded-2xl bg-white/12 px-4 py-3 text-[14px] font-medium ring-1 ring-white/20 backdrop-blur-md"
            >
              <Lock className="size-4 shrink-0 text-highlight-400" /> Edits are closed — the final plan is coming!
            </motion.p>
          )}
          {trip.demo ? (
            <motion.div variants={rise}>
              <DemoActions />
            </motion.div>
          ) : (
          <motion.div variants={rise} className="mt-6 flex flex-col gap-3 [@media(max-height:740px)]:mt-4 [@media(max-height:740px)]:gap-2">
            <Link href={trip.href("/join")} className="group">
              <span className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-accent-500 text-base font-semibold text-white shadow-[0_4px_0_0_var(--color-accent-700)] transition group-active:translate-y-[3px] group-active:shadow-[0_1px_0_0_var(--color-accent-700)]">
                Join the trip
                <ArrowRight className="size-5 transition group-hover:translate-x-0.5" strokeWidth={2.5} />
              </span>
            </Link>
            <Link
              href={trip.href("/join?returning=1")}
              className="flex h-12 items-center justify-center rounded-full text-[15px] font-semibold text-paper/90 ring-1 ring-white/30 backdrop-blur-md transition hover:bg-white/10"
            >
              I&apos;ve been here before
            </Link>
          </motion.div>
          )}
        </motion.div>
        {hero && (
          <a
            href={hero.source}
            target="_blank"
            rel="noreferrer"
            className="absolute bottom-1 right-3 z-10 text-[9px] text-paper/35"
          >
            Photo: {hero.credit}
          </a>
        )}
      </section>

      {/* ── How it works ────────────────────────────────────────── */}
      <section className="relative z-[1] px-5 pb-6 pt-12">
        <p className="label text-accent-600">How it works</p>
        <h2 className="font-display mt-2 text-[34px] font-semibold leading-[1.02] tracking-[-0.02em]">
          Your trip, <span className="italic text-primary-700">your way.</span>
        </h2>
        <ol className="mt-7 space-y-3">
          {steps(counts.trip, catalog.specialDates[0]?.name ?? null).map((s, i) => (
            <motion.li
              key={s.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: i * 0.08 }}
              className="flex gap-4 rounded-[22px] bg-paper p-4 shadow-card"
            >
              <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-highlight-100 text-accent-600">
                <s.icon className="size-6" strokeWidth={2} />
              </div>
              <div>
                <h3 className="font-display text-[19px] font-semibold">
                  <span className="mr-1.5 text-ink-3">0{i + 1}</span>
                  {s.title}
                </h3>
                <p className="mt-1 text-[14.5px] leading-snug text-ink-2">{s.body}</p>
              </div>
            </motion.li>
          ))}
        </ol>
      </section>

      {/* ── Photo marquee ───────────────────────────────────────── */}
      <section className="relative z-[1] overflow-hidden py-8" aria-label="A taste of the options">
        <div className="flex w-max animate-marquee gap-3 hover:[animation-play-state:paused]">
          {[...strip, ...strip].map((o, i) => (
            <div key={`${o.id}-${i}`} className="relative h-56 w-40 shrink-0 overflow-hidden rounded-[22px] bg-primary-800 shadow-card">
              <Photo photo={o.images[0]} alt={o.title} sizes="160px" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-transparent to-transparent" />
              <p className="font-display absolute inset-x-3 bottom-3 text-[15px] font-semibold leading-tight text-paper">
                {o.title}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Closing CTA ─────────────────────────────────────────── */}
      <section className="relative z-[1] mt-4 overflow-hidden bg-primary-800 px-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-14 text-paper">
        <WaveEdge className="absolute inset-x-0 top-0 h-5 rotate-180 text-surface-100" fill="var(--color-surface-100)" />
        <Decor className="absolute -right-6 bottom-0 h-56 text-secondary-900/70" />
        <div className="relative">
          <h2 className="font-display text-[32px] font-semibold leading-[1.02] tracking-[-0.02em]">
            {teaser[0]} <span className="italic text-highlight-400">{teaser[1]}</span>
          </h2>
          <p className="mt-3 max-w-xs text-paper/80">You decide. Everyone&apos;s picks shape the final plan.</p>
          <div className="mt-7 flex items-center gap-4">
            {trip.demo ? (
              <GuestButton className="inline-flex h-14 items-center gap-2 rounded-full bg-highlight-500 px-7 font-semibold text-ink shadow-[0_4px_0_0_var(--color-highlight-600)] transition active:translate-y-[3px] active:shadow-[0_1px_0_0_var(--color-highlight-600)]">
                Start building
              </GuestButton>
            ) : (
            <Link
              href={trip.href("/join")}
              className="inline-flex h-14 items-center gap-2 rounded-full bg-highlight-500 px-7 font-semibold text-ink shadow-[0_4px_0_0_var(--color-highlight-600)] transition active:translate-y-[3px] active:shadow-[0_1px_0_0_var(--color-highlight-600)]"
            >
              Start building <ArrowRight className="size-5" strokeWidth={2.5} />
            </Link>
            )}
            <Vehicle className="w-20 animate-float text-highlight-400" />
          </div>
        </div>
        <SiteFooter tone="light" className="relative mt-12 border-t border-white/10 px-0 pb-0" />
      </section>
    </div>
  );
}

/** "Try it as a guest": a throwaway traveller on the demo trip, straight into the planner. */
function GuestButton({ className, children }: { className: string; children: React.ReactNode }) {
  const trip = useTrip();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function go() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(trip.api("/auth/guest"), { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        router.push(trip.href("/trip"));
        router.refresh();
        return;
      }
      setErr(body.error ?? "Couldn't start — try again.");
    } catch {
      setErr("Couldn't reach the server — check your connection.");
    }
    setBusy(false);
  }
  return (
    <>
      <button type="button" onClick={go} disabled={busy} className={className}>
        {children} {busy ? <Loader2 className="size-5 animate-spin" /> : <ArrowRight className="size-5" strokeWidth={2.5} />}
      </button>
      {err && (
        <p role="alert" className="mt-2 text-sm font-semibold text-highlight-200">
          {err}
        </p>
      )}
    </>
  );
}

/** The demo trip's front door: plan as a guest, or look around the organizer console. */
function DemoActions() {
  const trip = useTrip();
  return (
    <div className="mt-6 [@media(max-height:740px)]:mt-4">
      <div className="flex flex-col gap-3 [@media(max-height:740px)]:gap-2">
        <GuestButton className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-accent-500 text-base font-semibold text-white shadow-[0_4px_0_0_var(--color-accent-700)] transition active:translate-y-[3px] active:shadow-[0_1px_0_0_var(--color-accent-700)] disabled:opacity-70">
          Try it as a guest
        </GuestButton>
        <Link
          href={trip.href("/admin")}
          className="flex h-12 items-center justify-center gap-2 rounded-full text-[15px] font-semibold text-paper/90 ring-1 ring-white/30 backdrop-blur-md transition hover:bg-white/10"
        >
          <ShieldCheck className="size-4 text-highlight-400" /> View as organizer (demo)
        </Link>
      </div>
      <p className="mt-3 text-center text-[12.5px] leading-snug text-paper/65">
        A demo trip with 12 fictional travellers. Plan your own version as a guest — everything resets every night.{" "}
        <Link href="/demo" className="font-semibold text-paper/85 underline decoration-white/40 underline-offset-2">
          Switch demo
        </Link>
        {" · "}
        <Link href="/case-study" className="font-semibold text-paper/85 underline decoration-white/40 underline-offset-2">
          Read the case study
        </Link>
      </p>
    </div>
  );
}
