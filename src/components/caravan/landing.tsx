import {
  ArrowRight,
  Play,
  ArrowUpRight,
  CalendarHeart,
  Eye,
  Flame,
  ImageIcon,
  Link2,
  ShieldCheck,
  Sparkles,
  Swords,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/cn";
import type { Destination } from "@/lib/server/destinations";
import { CaravanMark, Lockup } from "../brand/wordmark";
import { Photo } from "../ui/photo";

export type MyTrip = { slug: string; name: string; destination: string };
export type ArchiveTrip = { id: string; title: string; dates: string; summary: string; slides: number; cover: Destination["photo"]; storyCover: Destination["photo"] };

const STEPS = [
  {
    icon: Link2,
    title: "Start a trip, share one link",
    body: "Pick a destination, name the trip and set a PIN. You get an invite link for the group chat. No accounts, no emails.",
  },
  {
    icon: Swords,
    title: "Everyone builds their own version",
    body: "Friends drag a date window onto the calendar, then fill each day and evening with this-or-that matchups from a curated catalog. Five minutes, or fifty.",
  },
  {
    icon: CalendarHeart,
    title: "See where it overlaps",
    body: "A date heatmap, the most-picked options, everyone on one nature ↔ nightlife line, and clean exports for the final plan.",
  },
];

const FEATURES = [
  { icon: Swords, title: "A-vs-B matchups", body: "Each slot starts as a choice between two real, photographed options." },
  { icon: CalendarHeart, title: "Date heatmap", body: "Who's free when, across every draft and submission." },
  { icon: Flame, title: "Popular picks", body: "Live 🔥 counts on what the group keeps choosing — counts only, never who." },
  { icon: Eye, title: "Peek", body: "A sneaky look at a friend's draft: picks and dates, never their private answers." },
  { icon: Wallet, title: "Budget in 10 currencies", body: "A per-person estimate that updates as you plan, with live exchange rates." },
  { icon: ImageIcon, title: "Story & square exports", body: "Poster-quality share images with the route map, drawn on a canvas." },
  { icon: ShieldCheck, title: "Organizer console", body: "Owner and admin roles, live trip rules, edit locks, announcements, CSV/JSON exports." },
  { icon: Sparkles, title: "Family-friendly mode", body: "One switch swaps every nightlife pick for a wholesome alternative, view-only." },
];

/** Caravan's own front page: what it is, how it works, and where to start. */
export function Landing({
  destinations,
  demoHref,
  myTrips,
  archive,
}: {
  destinations: Destination[];
  demoHref: string | null;
  myTrips: MyTrip[];
  archive: ArchiveTrip[];
}) {
  const lead = destinations[0];
  return (
    <div className="min-h-dvh bg-surface-100 text-ink">
      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-primary-950 text-paper">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 top-[-10%] size-[420px] rounded-full bg-accent-500/25 blur-[110px]" />
          <div className="absolute right-[-15%] top-[30%] size-[460px] rounded-full bg-highlight-500/20 blur-[120px]" />
          <div className="absolute bottom-[-20%] left-[30%] size-[380px] rounded-full bg-primary-500/30 blur-[110px]" />
          <div className="grain absolute inset-0 opacity-60" />
        </div>
        <nav className="relative z-10 mx-auto flex h-16 max-w-6xl items-center justify-between px-5 pt-[env(safe-area-inset-top)]">
          <Lockup size="sm" tone="light" />
          <span className="flex-1" />
          <Link href="/case-study" className="hidden rounded-full px-3 py-2 text-[13.5px] font-semibold text-paper/80 hover:text-paper sm:block">
            Case study
          </Link>
          <Link href="/past" className="mr-1 rounded-full px-3 py-2 text-[13.5px] font-semibold text-paper/80 hover:text-paper">
            Past trips
          </Link>
          <Link
            href="/new"
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/10 px-4 text-[13.5px] font-semibold ring-1 ring-white/20 backdrop-blur transition hover:bg-white/20"
          >
            Start a trip <ArrowRight className="size-3.5" />
          </Link>
        </nav>

        <div className="relative z-10 mx-auto grid max-w-6xl gap-12 px-5 pb-16 pt-8 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-8 lg:pb-24 lg:pt-14">
          <div>
            <p className="label text-highlight-400">Group trip planner</p>
            <h1 className="font-display mt-4 text-[56px] font-semibold leading-[0.92] tracking-[-0.035em] sm:text-[72px] lg:text-[88px]">
              Plan the trip
              <br />
              <span className="italic text-highlight-400">together.</span>
            </h1>
            <p className="mt-6 max-w-[34rem] text-[17px] leading-relaxed text-paper/80 sm:text-lg">
              Drop one link in the group chat. Everyone builds their own version of the trip from curated options, and you see
              exactly where the group overlaps.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/new"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-accent-500 px-7 text-base font-semibold text-white shadow-[0_4px_0_0_var(--color-accent-700)] transition hover:bg-accent-600 active:translate-y-[3px] active:shadow-[0_1px_0_0_var(--color-accent-700)]"
              >
                Start a trip <ArrowRight className="size-5" strokeWidth={2.5} />
              </Link>
              {demoHref && (
                <Link
                  href={demoHref}
                  className="inline-flex h-14 items-center justify-center gap-2 rounded-full px-7 text-base font-semibold text-paper ring-1 ring-white/30 backdrop-blur transition hover:bg-white/10"
                >
                  Try a demo trip
                </Link>
              )}
            </div>
            <p className="mt-6 text-[13px] text-paper/55">Free · no accounts · works great on a phone</p>
          </div>
          {lead && <HeroVisual d={lead} />}
        </div>
      </section>

      {/* ── Your trips ─────────────────────────────────────────── */}
      {myTrips.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 pt-10" aria-labelledby="mine">
          <h2 id="mine" className="label text-ink-3">
            Pick up where you left off
          </h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {myTrips.map((t) => (
              <li key={t.slug}>
                <Link
                  href={`/t/${t.slug}/trip`}
                  className="flex items-center gap-3 rounded-2xl bg-paper p-3.5 shadow-card transition hover:-translate-y-0.5"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-900">
                    <CaravanMark tone="light" className="size-7" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15.5px] font-semibold">{t.name}</span>
                    <span className="block truncate text-[12.5px] text-ink-3">{t.destination}</span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-ink-3" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── How it works ───────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 pt-16 lg:pt-24" aria-labelledby="how">
        <p className="label text-accent-600">How it works</p>
        <h2 id="how" className="font-display mt-3 max-w-2xl text-[38px] font-semibold leading-[1.02] tracking-[-0.03em] sm:text-[48px]">
          Twelve opinions, <span className="italic text-accent-600">one trip.</span>
        </h2>
        <ol className="mt-10 grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative overflow-hidden rounded-[26px] bg-paper p-6 shadow-card">
              <span className="font-display absolute -right-2 -top-6 text-[120px] font-semibold italic leading-none text-surface-200" aria-hidden="true">
                {i + 1}
              </span>
              <s.icon className="relative size-7 text-primary-700" strokeWidth={2} />
              <h3 className="relative mt-5 text-[19px] font-semibold tracking-[-0.01em]">{s.title}</h3>
              <p className="relative mt-2 text-[15px] leading-relaxed text-ink-2">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Features ───────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 pt-16 lg:pt-24" aria-labelledby="features">
        <p className="label text-accent-600">Everything in the box</p>
        <h2 id="features" className="font-display mt-3 max-w-2xl text-[38px] font-semibold leading-[1.02] tracking-[-0.03em] sm:text-[48px]">
          Built for the group chat, <span className="italic text-accent-600">polished like a product.</span>
        </h2>
        <ul className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex gap-4 rounded-[22px] border border-ink/[0.06] bg-surface-50 p-4 sm:block sm:p-5">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-900 text-highlight-400">
                <f.icon className="size-5" />
              </span>
              <div className="min-w-0">
                <h3 className="text-[16px] font-semibold sm:mt-4">{f.title}</h3>
                <p className="mt-1 text-[14px] leading-relaxed text-ink-2 sm:mt-1.5">{f.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Destinations ───────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 pt-16 lg:pt-24" aria-labelledby="where">
        <p className="label text-accent-600">Destinations</p>
        <h2 id="where" className="font-display mt-3 max-w-2xl text-[38px] font-semibold leading-[1.02] tracking-[-0.03em] sm:text-[48px]">
          Each trip brings <span className="italic text-accent-600">its own world.</span>
        </h2>
        <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-ink-2">
          A destination is a typed JSON preset: researched options with photos and sources, the day structure, drive times, the
          route map and a theme of its own.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {destinations.map((d) => (
            <Link
              key={d.id}
              href={`/new?preset=${d.id}`}
              className="group relative block aspect-[4/5] overflow-hidden rounded-[28px] shadow-card sm:aspect-[16/10]"
              style={{ background: d.colors.deep }}
            >
              <Photo photo={d.photo ?? undefined} alt={d.name} sizes="(min-width: 768px) 50vw, 100vw" className="transition duration-700 group-hover:scale-[1.04]" />
              <span className="absolute inset-0" style={{ background: `linear-gradient(to top, ${d.colors.deep} 8%, ${d.colors.deep}d9 34%, ${d.colors.deep}66 58%, transparent 82%)` }} />
              <span className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-6">
                <span className="label block" style={{ color: d.colors.glow }}>
                  {d.season} · {d.length}
                </span>
                <span className="font-display mt-1.5 block text-[40px] font-semibold leading-none tracking-[-0.03em]">
                  {d.headline[0]} <span className="italic" style={{ color: d.colors.glow }}>{d.headline[1]}</span>
                </span>
                <span className="mt-2.5 block text-[14px] font-medium text-white/90">{d.shape}</span>
                <span className="mt-0.5 block text-[13.5px] text-white/70">
                  {d.tagline} · {d.options} things to do
                </span>
                <span className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-semibold" style={{ color: d.colors.glow }}>
                  Plan a {d.name} trip <ArrowUpRight className="size-4 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </span>
              </span>
            </Link>
          ))}
          <div className="flex min-h-[220px] flex-col justify-end rounded-[28px] border-2 border-dashed border-surface-300 p-6">
            <CaravanMark className="size-10 opacity-60" />
            <p className="font-display mt-4 text-[26px] font-semibold leading-tight tracking-[-0.02em]">More on the way</p>
            <p className="mt-2 max-w-sm text-[14.5px] leading-relaxed text-ink-2">
              Adding a destination is one preset file and a folder of credited photos — no code changes.
            </p>
          </div>
        </div>
      </section>

      {/* ── From the archive ───────────────────────────────────── */}
      {archive[0] && <ArchiveSection trip={archive[0]} />}

      {/* ── Closing CTA ────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 pb-6 pt-16 lg:pt-24">
        <div className="relative overflow-hidden rounded-[32px] bg-primary-900 px-6 py-12 text-center text-paper sm:px-12 sm:py-16">
          <div aria-hidden="true" className="absolute -right-16 -top-20 size-72 rounded-full bg-accent-500/25 blur-3xl" />
          <div aria-hidden="true" className="absolute -bottom-24 -left-10 size-72 rounded-full bg-highlight-500/20 blur-3xl" />
          <CaravanMark tone="light" className="relative mx-auto size-14" />
          <h2 className="font-display relative mt-5 text-[38px] font-semibold leading-[1] tracking-[-0.03em] sm:text-[52px]">
            Where&apos;s the crew <span className="italic text-highlight-400">headed?</span>
          </h2>
          <p className="relative mx-auto mt-4 max-w-md text-[16px] text-paper/75">Start a trip in under a minute. Everyone else just needs the link.</p>
          <Link
            href="/new"
            className="relative mt-8 inline-flex h-14 items-center gap-2 rounded-full bg-highlight-500 px-8 font-semibold text-ink shadow-[0_4px_0_0_var(--color-highlight-600)] transition active:translate-y-[3px] active:shadow-[0_1px_0_0_var(--color-highlight-600)]"
          >
            Start a trip <ArrowRight className="size-5" strokeWidth={2.5} />
          </Link>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-5 pb-12 pt-10 text-center">
        <Lockup size="md" />
        <p className="text-[13px] text-ink-2">{BRAND.tagline}. Made by Abdul.</p>
        <p className="flex gap-4 text-[13px] font-semibold">
          <Link href="/case-study" className="text-accent-600 hover:underline">
            Case study
          </Link>
          <Link href="/demo" className="text-accent-600 hover:underline">
            Demo
          </Link>
          <Link href="/past" className="text-accent-600 hover:underline">
            Past trips
          </Link>
        </p>
      </footer>
    </div>
  );
}

/**
 * The product in one picture: a this-or-that matchup card with two friends'
 * plans fanned out behind it, a 🔥 popular chip and a date-overlap chip.
 */
function HeroVisual({ d }: { d: Destination }) {
  const m = d.matchup;
  return (
    <div className="relative mx-auto h-[520px] w-full max-w-[400px] sm:h-[480px]" aria-hidden="true">
      {/* Two friends' plans behind */}
      <div className="absolute left-1/2 top-6 h-[380px] w-[280px] -translate-x-[62%] -rotate-[9deg] rounded-[30px] bg-accent-500/90 shadow-lift sm:w-[300px]" />
      <div className="absolute left-1/2 top-4 h-[380px] w-[280px] -translate-x-[40%] rotate-[7deg] rounded-[30px] bg-highlight-500/90 shadow-lift sm:w-[300px]" />
      {/* The matchup card */}
      <div className="absolute left-1/2 top-0 w-[292px] -translate-x-1/2 rounded-[30px] bg-paper p-3 text-ink shadow-lift sm:w-[312px]">
        <div className="flex items-center justify-between px-1.5 pb-2.5 pt-1">
          <span className="label text-ink-3">Day 3 · Daytime</span>
          <span className="font-display text-[15px] font-semibold italic text-accent-600">This or that?</span>
        </div>
        <div className="relative grid grid-cols-2 gap-2">
          {m ? (
            [m.a, m.b].map((side, i) => (
              <div key={side.title} className="relative aspect-[3/4] overflow-hidden rounded-[20px] bg-primary-800">
                <Photo photo={side.photo} alt="" sizes="160px" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                <span className="absolute inset-x-2.5 bottom-2.5 text-[13.5px] font-semibold leading-tight text-white">{side.title}</span>
                {i === 0 && (
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-paper/95 px-2 py-0.5 text-[10.5px] font-bold text-ink">
                    <Flame className="size-3 text-accent-500" fill="currentColor" /> 7 picked
                  </span>
                )}
              </div>
            ))
          ) : (
            <>
              <div className="aspect-[3/4] rounded-[20px] bg-primary-700" />
              <div className="aspect-[3/4] rounded-[20px] bg-secondary-700" />
            </>
          )}
          <span className="font-display absolute left-1/2 top-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-highlight-500 text-[15px] font-bold italic text-ink ring-4 ring-paper">
            vs
          </span>
        </div>
        <div className="flex items-center gap-2 px-1.5 pb-1 pt-3">
          <span className="flex -space-x-2">
            {["#c95c3c", "#3e5680", "#5f7f63", "#c25576"].map((c, i) => (
              <span key={c} className="grid size-7 place-items-center rounded-full text-[11px] font-bold text-white ring-2 ring-paper" style={{ background: c }}>
                {"MTPJ"[i]}
              </span>
            ))}
          </span>
          <span className="text-[12px] font-medium text-ink-3">4 friends planning · {d.name}</span>
        </div>
      </div>
      {/* Date overlap chip */}
      <div className="absolute bottom-2 right-0 w-[214px] rounded-[20px] bg-paper p-3.5 text-ink shadow-lift sm:-right-4">
        <p className="label text-ink-3">Best dates</p>
        <div className="mt-2 flex h-12 items-end gap-1">
          {[3, 5, 8, 10, 11, 11, 9, 6, 4].map((v, i) => (
            <span
              key={i}
              className={cn("flex-1 rounded-t-[4px]", v >= 10 ? "bg-accent-500" : "bg-primary-300")}
              style={{ height: `${(v / 11) * 100}%` }}
            />
          ))}
        </div>
        <p className="mt-2 text-[12.5px] font-semibold">11 of 12 free · 29 Dec – 2 Jan</p>
      </div>
      {/* Spectrum chip */}
      <div className="absolute left-0 top-[300px] w-[176px] rounded-[18px] bg-night-900 p-3 text-paper shadow-lift sm:-left-6 sm:bottom-24 sm:top-auto">
        <p className="label text-paper/60">Group vibe</p>
        <div className="relative mt-3 h-1.5 rounded-full bg-gradient-to-r from-secondary-400 via-highlight-400 to-pop-500">
          {[12, 31, 49, 63, 84].map((x) => (
            <span key={x} className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-paper ring-2 ring-night-900" style={{ left: `${x}%` }} />
          ))}
        </div>
        <p className="mt-2.5 flex justify-between text-[10.5px] font-semibold text-paper/70">
          <span>Nature</span>
          <span>Nightlife</span>
        </p>
      </div>
    </div>
  );
}

/** A real trip, told as a story: a phone-shaped story card next to the pitch. */
function ArchiveSection({ trip }: { trip: ArchiveTrip }) {
  return (
    <section className="mx-auto max-w-6xl px-5 pt-16 lg:pt-24" aria-labelledby="archive">
      <div className="grid items-center gap-8 overflow-hidden rounded-[32px] bg-night-900 p-6 text-paper sm:p-10 md:grid-cols-[1fr_auto]">
        <div>
          <p className="label text-highlight-400">From the archive</p>
          <h2 id="archive" className="font-display mt-3 text-[38px] font-semibold leading-[1.02] tracking-[-0.03em] sm:text-[48px]">
            {trip.title}
          </h2>
          <p className="mt-2 text-[14px] font-semibold text-paper/60">{trip.dates}</p>
          <p className="mt-4 max-w-md text-[16px] leading-relaxed text-paper/75">{trip.summary}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/past/${trip.id}/story`}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-paper px-6 font-semibold text-night-900 transition active:scale-[0.98]"
            >
              <Play className="size-4" fill="currentColor" /> Watch the story
            </Link>
            <Link href={`/past/${trip.id}`} className="inline-flex h-12 items-center gap-2 rounded-full px-5 font-semibold text-paper ring-1 ring-white/25 hover:bg-white/10">
              Full itinerary <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
        <Link
          href={`/past/${trip.id}/story`}
          aria-label={`Watch the story of ${trip.title}`}
          className="group relative mx-auto block aspect-[9/16] w-[200px] overflow-hidden rounded-[26px] bg-night-800 shadow-lift ring-4 ring-white/10 sm:w-[230px]"
        >
          <Photo photo={trip.storyCover ?? undefined} alt="" sizes="230px" className="transition duration-700 group-hover:scale-105" />
          <span className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/40" />
          <span className="absolute inset-x-2.5 top-2.5 flex gap-1">
            {Array.from({ length: Math.min(trip.slides, 10) }, (_, k) => (
              <span key={k} className={cn("h-[2px] flex-1 rounded-full", k < 2 ? "bg-white" : "bg-white/35")} />
            ))}
          </span>
          <span className="absolute left-4 top-12 text-white">
            <span className="block text-[11px] font-bold uppercase tracking-[0.06em] text-white/85">Day 3</span>
            <span className="block text-[26px] font-extrabold uppercase leading-none tracking-[-0.02em]">Ski day</span>
            <span className="mt-1 block text-[11px] font-semibold uppercase tracking-[0.04em]">Gudauri</span>
          </span>
          <span className="absolute bottom-4 left-1/2 grid size-11 -translate-x-1/2 place-items-center rounded-full bg-white/90 text-night-900 transition group-hover:scale-110">
            <Play className="size-5 translate-x-px" fill="currentColor" />
          </span>
        </Link>
      </div>
    </section>
  );
}
