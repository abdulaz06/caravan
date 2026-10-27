import { ArrowLeft, ArrowUpRight, Play } from "lucide-react";
import Link from "next/link";
import type { Photo as PhotoT } from "@/engine/catalog";
import { Lockup } from "../brand/wordmark";
import { Photo } from "../ui/photo";
import { CaseStudyLink } from "../caravan/case-study-link";

type Item = { id: string; title: string; dates: string; summary: string; days: number; cover: PhotoT | null };

/** The archive: every past trip as a card, with its story one tap away. */
export function PastTripsList({ trips }: { trips: Item[] }) {
  return (
    <div className="min-h-dvh bg-surface-100">
      <div className="mx-auto max-w-[760px] px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))]">
        <header className="flex h-14 items-center justify-between">
          <Link href="/" aria-label="Caravan home" className="-ml-1 flex items-center gap-1 rounded-full px-1 py-1 text-ink-2 hover:text-ink">
            <ArrowLeft className="size-4" />
            <Lockup size="sm" />
          </Link>
          <CaseStudyLink />
        </header>
        <h1 className="font-display mt-4 text-[40px] font-semibold leading-[1] tracking-[-0.03em]">
          Past <span className="italic text-accent-600">trips</span>
        </h1>
        <p className="mt-3 max-w-lg text-[15.5px] leading-relaxed text-ink-2">
          Real group trips, anonymised: the plan, the route and the days as they happened — told as a story.
        </p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {trips.map((t) => (
            <li key={t.id} className="overflow-hidden rounded-[26px] bg-paper shadow-card">
              <Link href={`/past/${t.id}`} className="group block">
                <span className="relative block aspect-[4/3] bg-primary-800">
                  <Photo photo={t.cover ?? undefined} alt={t.title} sizes="(min-width: 640px) 380px, 100vw" className="transition duration-700 group-hover:scale-[1.04]" />
                  <span className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <span className="absolute inset-x-4 bottom-4 text-white">
                    <span className="label block text-white/80">{t.dates}</span>
                    <span className="font-display mt-1 block text-[28px] font-semibold leading-none">{t.title}</span>
                  </span>
                </span>
                <span className="block p-4">
                  <span className="line-clamp-3 block text-[14px] leading-relaxed text-ink-2">{t.summary}</span>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-semibold text-accent-600">
                    See the trip <ArrowUpRight className="size-4" />
                  </span>
                </span>
              </Link>
              <Link
                href={`/past/${t.id}/story`}
                className="flex items-center justify-center gap-2 border-t border-ink/5 py-3 text-[14px] font-semibold text-ink hover:bg-surface-100"
              >
                <Play className="size-4" fill="currentColor" /> Watch the story
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
