import { ArrowLeft, ArrowRight, CalendarHeart, Eye, KeyRound, Layers, Map, Scale, ShieldCheck, Smartphone, Sparkles, Swords, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/cn";
import { CaravanMark, Lockup } from "../brand/wordmark";
import { ArchitectureDiagram } from "./architecture";
import { ConsensusDiagram } from "./consensus-diagram";
import { WalkthroughVideo } from "./walkthrough-video";

export type CaseStudyStats = {
  trip: string;
  period: string;
  joined: number;
  submitted: number;
  drafting: number;
  topPicks: { title: string; picked: number; slot: "day" | "night" }[];
  stayIn: { picked: number; detail: string };
  vibe: string;
  dateOverlap: {
    peak: string;
    peakPeople: number;
    sweetSpot: string;
    sweetSpotPeople: number;
    of: number;
    days: { date: string; people: number }[];
  };
  repo: { url: string; public: boolean };
};

/** The group plan on the Sri Lanka demo crew, worked out by the engine when the page is built. */
export type ConsensusExample = {
  people: number;
  dates: { chosen: string; length: number; full: number; of: number; runnersUp: { range: string; full: number }[] };
  modes: { label: string; min: number; median: number; index: number; leftOut: number; differs: number }[];
  items: { when: string; title: string; reasons: string[] }[];
};

const FLOW = [
  {
    step: "1",
    title: "Pick your dates",
    body: "Tap your first and last day. (Our group had voted on six days, so theirs was a window to drag.) New Year's Eve lights up when it's inside.",
    shot: "/case-study/dates.webp",
  },
  { step: "2", title: "This or that?", body: "Each daytime and evening starts as a matchup between two real, photographed options.", shot: "/case-study/matchup.webp" },
  { step: "3", title: "Build your days", body: "Add more from a catalog, reorder, see drive times and a soft time total per slot.", shot: "/case-study/days.webp" },
  { step: "4", title: "See the overlap", body: "The organizer — and, once they submit, everyone — sees dates, favourites and vibes side by side.", shot: "/case-study/group.webp" },
];

const DECISIONS = [
  {
    icon: Swords,
    title: "Matchups, not a blank canvas",
    body: "A blank itinerary is homework. Two photographed options per slot turn it into a series of quick, fun decisions — and a curated pair says more about someone than a free-text wishlist. Depth is one tap away (“+ Add another”), so the five-minute path and the hour-long path both feel natural.",
  },
  {
    icon: KeyRound,
    title: "A name and a PIN, nothing else",
    body: "The link is opened from a group chat, usually inside WhatsApp's in-app browser. Accounts would lose half the group at the door, so it's a display name and a 4-digit PIN (bcrypt, locked after five wrong tries) and a signed cookie that lasts a year.",
  },
  {
    icon: Eye,
    title: "Independent picks first",
    body: "You only see other people's plans after submitting your own, so the first plan in doesn't anchor everyone else. A playful exception — “👀 Peek” — shows someone's picks and dates, never their private answers, and tells them anonymously how many people peeked.",
  },
  {
    icon: CalendarHeart,
    title: "The organizer's view is the product",
    body: "Everything people do turns into structure: a date heatmap with the sweet spot, the most-picked options, a nature ↔ nightlife spectrum, roommate matches — and a generator that turns it all into one group plan.",
  },
  {
    icon: Smartphone,
    title: "Built for a phone opened from a link",
    body: "Mobile-first, big photography with credits, a poster-style trip summary and Instagram-ready share images drawn on a canvas — so people want to finish, and show it off when they do.",
  },
  {
    icon: Layers,
    title: "Destinations as data",
    body: "Everything that makes a trip that trip — the day structure, options, drive times, map, costs, copy and theme — lives in a validated JSON preset. Sri Lanka and Georgia run on the same code and look nothing alike.",
  },
];

const CHALLENGES = [
  {
    title: "Changing the data model while people were using it",
    body: "The group voted to change the trip's length and shape mid-way. Plans are versioned; every migration is idempotent, keeps every pick it can (by day role and order) and leaves a one-time note. A field an older client doesn't send means “unchanged”, so a stale tab can never wipe someone's answers.",
  },
  {
    title: "From one hard-coded trip to an engine",
    body: "The original app knew it was in Sri Lanka everywhere. The engine now receives an explicit context — the compiled preset plus the trip's live rules — on every call, instead of reading globals, so two trips can render in the same server process without leaking into each other.",
  },
  {
    title: "Share images that work on an iPhone",
    body: "WebKit's canvas ignores a variable font's weight axis, so the exports ship fixed-weight copies of the fonts loaded through the FontFace API. Map labels and day badges share collision-avoidance helpers so nothing overlaps on a 1080×1920 poster.",
  },
  {
    title: "Maps without a map library",
    body: "Each preset carries its own projected outline, generated from Natural Earth's public-domain data: a latitude correction keeps Georgia from stretching sideways, and neighbouring countries are drawn as quiet land so a border never reads as coastline.",
  },
  {
    title: "A family-friendly mode you can trust",
    body: "One switch swaps every nightlife pick for a wholesome alternative, view-only. A single banned-word list is checked against everything the mode can show when a preset is validated, so the guarantee doesn't depend on someone remembering.",
  },
  {
    title: "Forking without touching the original",
    body: "The original app is still in use, so Caravan has its own database, deployment and secrets — and a startup guard that refuses to boot against the original database, stored only as a hash so the public repo never names it.",
  },
];

/** The story of the project: problem, idea, results, decisions, the group plan, architecture, challenges. */
export function CaseStudy({ stats, consensus }: { stats: CaseStudyStats; consensus: ConsensusExample }) {
  const pct = Math.round((stats.submitted / stats.joined) * 100);
  return (
    <div className="min-h-dvh bg-surface-100 text-ink">
      <header className="sticky top-0 z-40 border-b border-ink/[0.06] bg-surface-100/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <Link href="/" className="flex items-center gap-1.5 rounded-full px-1 py-1 text-ink-2 hover:text-ink" aria-label={`${BRAND.name} home`}>
            <ArrowLeft className="size-4" />
            <Lockup size="sm" />
          </Link>
          <span className="flex-1" />
          <Link href="/demo" className="rounded-full px-3 py-1.5 text-[13.5px] font-semibold text-ink-2 hover:bg-surface-200">
            Try the demo
          </Link>
        </div>
      </header>

      <main>
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="mx-auto max-w-5xl px-5 pb-10 pt-10 sm:pt-16">
          <p className="label text-accent-600">Case study</p>
          <h1 className="font-display mt-3 max-w-3xl text-[44px] font-semibold leading-[0.98] tracking-[-0.035em] sm:text-[64px]">
            Planning a group trip <span className="italic text-accent-600">without the group chat.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-ink-2">
            Thirteen friends, one trip, and a chat where every plan dies under “I’m easy”. I built an app where each person plans their own
            version of the trip — then generalised it into {BRAND.name}, a planner for any group and any destination.
          </p>
          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-ink/10 pt-6 text-[14px] sm:grid-cols-4">
            <div>
              <dt className="label text-ink-3">Role</dt>
              <dd className="mt-1 font-semibold">Product, design & engineering</dd>
            </div>
            <div>
              <dt className="label text-ink-3">First trip</dt>
              <dd className="mt-1 font-semibold">{stats.trip}</dd>
            </div>
            <div>
              <dt className="label text-ink-3">Stack</dt>
              <dd className="mt-1 font-semibold">Next.js · TypeScript · Supabase</dd>
            </div>
            <div>
              <dt className="label text-ink-3">Links</dt>
              <dd className="mt-1 flex flex-wrap gap-x-3 font-semibold">
                <Link href="/demo" className="text-accent-600 underline-offset-2 hover:underline">
                  Live demo
                </Link>
                {stats.repo.public && (
                  <a href={stats.repo.url} className="text-accent-600 underline-offset-2 hover:underline">
                    Code
                  </a>
                )}
              </dd>
            </div>
          </dl>
          <div className="mt-10">
            <WalkthroughVideo youtubeId="K-CRkvDnjPc" poster="/case-study/video-poster.webp" label="Watch the 1-minute demo" />
          </div>
        </section>

        {/* ── Problem ──────────────────────────────────────────── */}
        <Section label="The problem" title={<>Group chats are where plans <em className="text-accent-600">go to die.</em></>}>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["Nobody commits", "Ask twelve people what they want to do and you get “anything's fine” — until the plan is set."],
              ["The loudest voice wins", "Whoever replies first and most often shapes the trip; quieter friends never say what they'd love."],
              ["Dates are a puzzle", "Twelve calendars, flights from different cities and New Year's Eve in the middle of it."],
            ].map(([t, b]) => (
              <div key={t} className="rounded-[22px] bg-paper p-5 shadow-card">
                <h3 className="text-[17px] font-semibold">{t}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{b}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Idea & flow ──────────────────────────────────────── */}
        <Section label="The idea" title={<>Everyone builds <em className="text-accent-600">their own version.</em></>}>
          <p className="max-w-2xl text-[16px] leading-relaxed text-ink-2">
            Instead of debating one plan, each friend opens the same link and crafts the trip they’d want, from curated options. The
            organizer gets structured preferences from everyone — and the overlap tells you what the trip should be.
          </p>
          <ol className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {FLOW.map((f) => (
              <li key={f.step} className="overflow-hidden rounded-[22px] bg-paper shadow-card">
                <div className="relative aspect-[9/14] bg-surface-200">
                  <Image src={f.shot} alt={`${f.title} — screenshot`} fill sizes="(min-width: 1024px) 240px, 45vw" className="object-cover object-top" />
                </div>
                <div className="p-3 sm:p-4">
                  <span className="font-display text-[24px] font-semibold italic leading-none text-accent-600 sm:text-[28px]">{f.step}</span>
                  <h3 className="mt-1.5 text-[15px] font-semibold sm:mt-2 sm:text-[16.5px]">{f.title}</h3>
                  <p className="mt-1 text-[13px] leading-snug text-ink-2 sm:text-[14px] sm:leading-relaxed">{f.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Section>

        {/* ── Results ──────────────────────────────────────────── */}
        <Section label="Results" title={<>The first trip, <em className="text-accent-600">in a week.</em></>} dark>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat value={stats.joined} label="friends joined" />
            <Stat value={stats.submitted} label={`submitted a full plan (${pct}%)`} />
            <Stat value={stats.drafting} label="still drafting" />
          </div>
          <p className="mt-4 text-[14px] text-paper/60">Within {stats.period} of the link going into the group chat.</p>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <TopPicks picks={stats.topPicks} stayIn={stats.stayIn} vibe={stats.vibe} />
            <DateOverlap overlap={stats.dateOverlap} />
          </div>
        </Section>

        {/* ── Decisions ────────────────────────────────────────── */}
        <Section label="Design decisions" title={<>Small choices that got people <em className="text-accent-600">to finish.</em></>}>
          <ul className="grid gap-4 md:grid-cols-2">
            {DECISIONS.map((d) => (
              <li key={d.title} className="flex gap-4 rounded-[22px] bg-paper p-5 shadow-card">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-900 text-highlight-400">
                  <d.icon className="size-5" />
                </span>
                <div>
                  <h3 className="text-[16.5px] font-semibold">{d.title}</h3>
                  <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-2">{d.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        {/* ── The group plan ───────────────────────────────────── */}
        <Section label="The decision" title={<>From twelve plans <em className="text-accent-600">to one trip.</em></>}>
          <p className="max-w-2xl text-[16px] leading-relaxed text-ink-2">
            Individual plans show what people want; someone still has to decide. {BRAND.name}&apos;s generator does it in the open: no AI,
            the same inputs always give the same plan, and every pick says why it&apos;s there. The organizer chooses how the group decides —
            and can compare the options side by side before choosing.
          </p>
          <div className="mt-8 overflow-x-auto rounded-[22px] bg-surface-50 p-4 ring-1 ring-ink/[0.06]">
            <ConsensusDiagram className="h-auto w-full min-w-[560px]" />
          </div>
          <ConsensusDemo example={consensus} />
          <RealResults />
          <p className="mt-6 text-[14px] text-ink-3">
            The algorithm in plain language, with the formulas:{" "}
            <a href={`${stats.repo.url}/blob/main/docs/CONSENSUS.md`} className="font-semibold text-accent-600 underline-offset-2 hover:underline">
              docs/CONSENSUS.md
            </a>
            .
          </p>
        </Section>

        {/* ── Architecture ─────────────────────────────────────── */}
        <Section label="Architecture" title={<>One engine, <em className="text-accent-600">any destination.</em></>}>
          <div className="grid items-start gap-8 lg:grid-cols-[1.25fr_1fr]">
            <div className="overflow-x-auto rounded-[22px] bg-surface-50 p-4 ring-1 ring-ink/[0.06]">
              <ArchitectureDiagram className="h-auto w-full min-w-[520px]" />
            </div>
            <ul className="space-y-4 text-[15px] leading-relaxed text-ink-2">
              <li className="flex gap-3">
                <Map className="mt-1 size-5 shrink-0 text-accent-600" />
                <span>
                  <b className="text-ink">Presets</b> are typed JSON validated with zod: options with sources and credited photos, the day
                  structure, drive times, the map and a theme. A validator checks every cross-reference and family mode’s word list.
                </span>
              </li>
              <li className="flex gap-3">
                <Sparkles className="mt-1 size-5 shrink-0 text-accent-600" />
                <span>
                  <b className="text-ink">The engine</b> is pure TypeScript, shared by server and client: it builds the days, timelines,
                  budgets and routes from a preset plus the trip’s live rules.
                </span>
              </li>
              <li className="flex gap-3">
                <ShieldCheck className="mt-1 size-5 shrink-0 text-accent-600" />
                <span>
                  <b className="text-ink">The server</b> owns all data: Supabase is reached only with a server key behind row-level
                  security, every organizer endpoint re-checks the role, and inputs are validated.
                </span>
              </li>
              <li className="flex gap-3">
                <Users className="mt-1 size-5 shrink-0 text-accent-600" />
                <span>
                  <b className="text-ink">Trips</b> are isolated: people, plans, rules and logs all belong to one trip and its invite link.
                </span>
              </li>
            </ul>
          </div>
        </Section>

        {/* ── Challenges ───────────────────────────────────────── */}
        <Section label="Challenges" title={<>The hard parts.</>}>
          <ul className="grid gap-x-10 gap-y-7 md:grid-cols-2">
            {CHALLENGES.map((c, i) => (
              <li key={c.title} className="border-t border-ink/10 pt-4">
                <p className="font-display text-[15px] italic text-accent-600">{String(i + 1).padStart(2, "0")}</p>
                <h3 className="mt-1 text-[17.5px] font-semibold">{c.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{c.body}</p>
              </li>
            ))}
          </ul>
        </Section>

        {/* ── CTA ──────────────────────────────────────────────── */}
        <section className="mx-auto max-w-5xl px-5 pb-8 pt-16">
          <div className="relative overflow-hidden rounded-[32px] bg-primary-900 px-6 py-12 text-center text-paper sm:px-12">
            <CaravanMark tone="light" className="mx-auto size-12" />
            <h2 className="font-display mt-5 text-[34px] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[46px]">
              See it <span className="italic text-highlight-400">for yourself.</span>
            </h2>
            <p className="mx-auto mt-3 max-w-md text-[15.5px] text-paper/75">
              Open a demo trip as a guest, or look around the organizer console. It resets every night.
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/demo"
                className="inline-flex h-13 items-center justify-center gap-2 rounded-full bg-highlight-500 px-7 font-semibold text-ink shadow-[0_4px_0_0_var(--color-highlight-600)] transition active:translate-y-[3px] active:shadow-[0_1px_0_0_var(--color-highlight-600)]"
              >
                Try the demo <ArrowRight className="size-4.5" strokeWidth={2.5} />
              </Link>
              <Link href="/past" className="inline-flex h-13 items-center justify-center rounded-full px-7 font-semibold ring-1 ring-white/30 hover:bg-white/10">
                Watch a past trip
              </Link>
            </div>
          </div>
        </section>
        <footer className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-5 pb-12 pt-6 text-center text-[13px] text-ink-3">
          <Lockup size="sm" />
          <p>Designed and built by Abdul.</p>
        </footer>
      </main>
    </div>
  );
}

/** The generator on the demo crew: dates, the three modes side by side, and a few picks with their reasons. */
function ConsensusDemo({ example }: { example: ConsensusExample }) {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  return (
    <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_1.15fr]">
      <div className="rounded-[22px] bg-primary-900 p-5 text-paper shadow-card">
        <p className="label text-highlight-400">Demo crew · {example.people} travellers</p>
        <p className="font-display mt-3 text-[30px] font-semibold leading-none">{example.dates.chosen}</p>
        <p className="mt-2 text-[14.5px] text-paper/75">
          {example.dates.length} days, the middle length of the submitted plans · {example.dates.full} of {example.dates.of} free for all of it
        </p>
        <ul className="mt-3 space-y-1 text-[13.5px] text-paper/65">
          {example.dates.runnersUp.map((r) => (
            <li key={r.range}>
              Runner-up {r.range} · {r.full} free throughout
            </li>
          ))}
        </ul>
        <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/10 pt-4">
          {example.modes.map((m) => (
            <div key={m.label} className="rounded-2xl bg-white/[0.06] p-3 ring-1 ring-white/10">
              <p className="text-[12.5px] font-bold leading-tight">{m.label}</p>
              <p className="font-display mt-2 text-[22px] font-semibold leading-none">{pct(m.min)}</p>
              <p className="text-[11px] uppercase tracking-wide text-paper/55">lowest</p>
              <p className="mt-1.5 text-[12px] text-paper/70">
                median {pct(m.median)} · fairness {m.index.toFixed(2)}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-paper/65">
          Here nobody falls below the fair floor, so “Everyone gets a say” and “Majority rules” agree; turning the Custom slider all the way to
          fairness lifts the least-satisfied travellers at a small cost to the most popular picks.
        </p>
      </div>
      <ul className="space-y-3">
        {example.items.map((it) => (
          <li key={it.when} className="rounded-[22px] bg-paper p-4 shadow-card">
            <p className="label text-ink-3">{it.when}</p>
            <p className="mt-1 text-[16px] font-semibold">{it.title}</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {it.reasons.map((r) => (
                <li key={r} className="rounded-full bg-surface-200 px-2.5 py-0.5 text-[12.5px] font-semibold text-ink-2">
                  {r}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Placeholders for the real trip: filled in after the group travels (Dec 2026 – Jan 2027). */
function RealResults() {
  const slots = [
    { label: "Plans that went in", hint: "submitted · drafts" },
    { label: "How the group decided", hint: "the decision mode, and why" },
    { label: "Everyone's picks", hint: "lowest · median · fairness index" },
    { label: "What we actually did", hint: "RSVPs, splits taken, what changed on the ground" },
  ];
  return (
    <div className="mt-6 rounded-[22px] border-2 border-dashed border-ink/15 p-5">
      <p className="label flex items-center gap-1.5 text-accent-600">
        <Scale className="size-3.5" /> The real Sri Lanka trip · results to come
      </p>
      <p className="mt-1.5 text-[14.5px] text-ink-2">
        Placeholder: anonymized numbers from the real 13-person trip will go here after we travel (January 2027).
      </p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {slots.map((s) => (
          <div key={s.label} className="rounded-2xl bg-surface-200/50 p-4">
            <dt className="text-[13px] font-semibold text-ink-2">{s.label}</dt>
            <dd className="font-display mt-1 text-[28px] font-semibold leading-none text-ink-3/50">TBD</dd>
            <dd className="mt-1 text-[12px] text-ink-3">{s.hint}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Section({ label, title, dark, children }: { label: string; title: React.ReactNode; dark?: boolean; children: React.ReactNode }) {
  return (
    <section className={cn(dark ? "bg-night-900 text-paper" : "", "py-14 sm:py-20")}>
      <div className="mx-auto max-w-5xl px-5">
        <p className={cn("label", dark ? "text-highlight-400" : "text-accent-600")}>{label}</p>
        <h2 className="font-display mb-8 mt-3 max-w-3xl text-[34px] font-semibold leading-[1.04] tracking-[-0.03em] sm:text-[46px] [&_em]:italic">
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-[22px] bg-white/[0.06] p-5 ring-1 ring-white/10">
      <p className="font-display text-[56px] font-semibold leading-none tracking-[-0.03em]">{value}</p>
      <p className="mt-2 text-[14.5px] text-paper/70">{label}</p>
    </div>
  );
}

/** The group's favourites, counted once per person, as ranked bars. */
function TopPicks({ picks, stayIn, vibe }: Pick<CaseStudyStats, "vibe" | "stayIn"> & { picks: CaseStudyStats["topPicks"] }) {
  const max = Math.max(...picks.map((p) => p.picked));
  return (
    <div className="rounded-[22px] bg-white/[0.06] p-5 ring-1 ring-white/10">
      <h3 className="label text-highlight-400">Most picked</h3>
      <ol className="mt-4 space-y-3">
        {picks.map((p, i) => (
          <li key={p.title} className="grid grid-cols-[1.25rem_1fr] gap-x-2">
            <span className="font-display row-span-2 text-[17px] leading-tight text-highlight-400">{i + 1}</span>
            <span className="flex items-baseline gap-2 text-[14.5px] leading-snug">
              <span className="min-w-0 flex-1">{p.title}</span>
              <span className="shrink-0 tabular-nums text-paper/60">{p.picked}</span>
            </span>
            <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-white/10">
              <span
                className={cn("block h-full rounded-full", p.slot === "night" ? "bg-pop-500" : "bg-highlight-500")}
                style={{ width: `${(p.picked / max) * 100}%` }}
              />
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-5 border-t border-white/10 pt-4 text-[13.5px] leading-relaxed text-paper/65">
        <b className="text-paper">Stay in</b> was picked {stayIn.picked} times ({stayIn.detail}). The group&apos;s vibe:{" "}
        <b className="text-paper">{vibe}</b>.
      </p>
    </div>
  );
}

/** When everyone can go: a strip of the busiest fortnight, then the best windows. */
function DateOverlap({ overlap }: { overlap: CaseStudyStats["dateOverlap"] }) {
  const tone = (n: number) => {
    const r = n / overlap.of;
    return r >= 0.9 ? "bg-pop-500 text-paper" : r >= 0.75 ? "bg-accent-500 text-paper" : r >= 0.45 ? "bg-highlight-500 text-ink" : r > 0.2 ? "bg-highlight-200 text-ink" : "bg-white/10 text-paper/70";
  };
  const day = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDate();
  return (
    <div className="rounded-[22px] bg-white/[0.06] p-5 ring-1 ring-white/10">
      <h3 className="label text-highlight-400">Date overlap</h3>
      <p className="font-display mt-3 text-[34px] font-semibold leading-none tracking-[-0.02em]">{overlap.peak}</p>
      <p className="mt-2 text-[15px] text-paper/75">
        {overlap.peakPeople} of {overlap.of} can make every one of those days
      </p>
      <div className="mt-5 grid grid-cols-7 gap-1" role="img" aria-label={`People free each day, 21 Dec to 3 Jan: ${overlap.days.map((d) => d.people).join(", ")} of ${overlap.of}`}>
        {overlap.days.map((d) => (
          <span key={d.date} className={cn("grid aspect-square place-items-center rounded-lg text-center leading-none", tone(d.people))}>
            <span>
              <span className="block text-[12px] font-semibold">{day(d.date)}</span>
              <span className="mt-0.5 block text-[10px] opacity-80">{d.people}</span>
            </span>
          </span>
        ))}
      </div>
      <p className="mt-4 text-[13.5px] leading-relaxed text-paper/65">
        Best full six-day window: <b className="text-paper">{overlap.sweetSpot}</b> ({overlap.sweetSpotPeople} of {overlap.of} free throughout).
      </p>
    </div>
  );
}
