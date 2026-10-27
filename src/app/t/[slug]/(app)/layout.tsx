import Image from "next/image";
import Link from "next/link";
import { Lockup, Stamp } from "@/components/brand/wordmark";
import { nightsFor, tripDays } from "@/engine/structure";
import { tripFromParams } from "@/lib/server/trip";

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

/**
 * Participant pages live in a phone-width column. On desktop the column sits
 * on the right of a big travel-poster panel for the trip's destination.
 */
export default async function AppLayout({ children, params }: LayoutProps<"/t/[slug]">) {
  const trip = await tripFromParams(params);
  const { preset, catalog, engine } = trip;
  const hero = catalog.heroPhotos[1] ?? catalog.heroPhotos[0];
  const days = tripDays(engine);
  const split = nightsFor(engine, days).filter((s) => s.nights > 0);
  const nightWord = (n: number, first: boolean) => (n === 1 && first ? "a night" : `${WORDS[n] ?? n}${first ? (n === 1 ? " night" : " nights") : ""}`);
  const shape = split.map((s, i) => `${nightWord(s.nights, i === 0)} in ${s.base.name}`).join(", then ");
  const d = preset.destination;
  return (
    <>
      <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,1fr)_480px]">
        <aside className="sticky top-0 hidden h-dvh overflow-hidden bg-primary-900 lg:block">
          {hero && (
            <Image
              src={hero.src}
              alt={preset.name}
              fill
              sizes="(min-width: 1024px) 60vw, 1px"
              placeholder={hero.blurDataURL ? "blur" : "empty"}
              blurDataURL={hero.blurDataURL}
              className="object-cover"
              priority
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-primary-950/90 via-primary-950/20 to-primary-950/40" />
          <div className="sunburst absolute inset-0 opacity-60" />
          <div className="relative flex h-full flex-col justify-between p-12 text-paper">
            <Link href="/" className="self-start" aria-label="Caravan home">
              <Lockup size="lg" tone="light" />
            </Link>
            <div className="max-w-xl">
              <Stamp className="mb-8 size-28 text-highlight-500" text={`${preset.name.toUpperCase()} · ${d.season.toUpperCase()} · `} />
              <p className="label text-highlight-400">
                {trip.trip.name} · {d.season}
              </p>
              <h2 className="font-display mt-3 text-6xl font-semibold leading-[0.95] tracking-[-0.03em] xl:text-7xl">
                {d.headline[0]}
                <br />
                <span className="italic text-highlight-400">{d.headline[1]}</span>
              </h2>
              <p className="mt-5 max-w-md text-lg text-paper/80">
                {days} days · {days - 1} nights: {shape}.{" "}
                {d.familyTagline ? (
                  <>
                    <span className="family-hide">{d.tagline}.</span>
                    <span className="family-only">{d.familyTagline}.</span>
                  </>
                ) : (
                  `${d.tagline}.`
                )}{" "}
                {d.blurb}
              </p>
              {hero && (
                <a href={hero.source} target="_blank" rel="noreferrer" className="mt-8 block text-xs text-paper/50 hover:text-paper/80">
                  Photo: {hero.credit} · {hero.license}
                </a>
              )}
            </div>
          </div>
        </aside>
        <main className="relative min-h-dvh bg-surface-100 lg:shadow-[-30px_0_60px_-30px_rgb(0_0_0/0.5)]">{children}</main>
      </div>
    </>
  );
}
