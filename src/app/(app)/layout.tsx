import Image from "next/image";
import { heroPhotos } from "@/content";
import { Stamp, Wordmark } from "@/components/brand/wordmark";

/**
 * Participant pages live in a phone-width column. On desktop the column sits
 * on the right of a big travel-poster panel.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const hero = heroPhotos[1] ?? heroPhotos[0];
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,1fr)_480px]">
      <aside className="sticky top-0 hidden h-dvh overflow-hidden bg-ocean-900 lg:block">
        {hero && (
          <Image
            src={hero.src}
            alt="Coconut Tree Hill, Mirissa"
            fill
            sizes="(min-width: 1024px) 60vw, 1px"
            placeholder={hero.blurDataURL ? "blur" : "empty"}
            blurDataURL={hero.blurDataURL}
            className="object-cover"
            priority
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ocean-950/90 via-ocean-950/20 to-ocean-950/40" />
        <div className="sunburst absolute inset-0 opacity-60" />
        <div className="relative flex h-full flex-col justify-between p-12 text-paper">
          <Wordmark tone="light" className="text-3xl" />
          <div className="max-w-xl">
            <Stamp className="mb-8 size-28 text-saffron-500" />
            <p className="label text-saffron-400">The group trip · Dec 2026 – Jan 2027</p>
            <h2 className="font-display mt-3 text-6xl font-semibold leading-[0.95] tracking-[-0.03em] xl:text-7xl">
              Sri Lanka,
              <br />
              <span className="italic text-saffron-400">your way.</span>
            </h2>
            <p className="mt-5 max-w-md text-lg text-paper/80">
              Whales, leopards, sunrise climbs, tea country and beach parties. Build your dream version, then
              we&apos;ll plan the trip together.
            </p>
            {hero && (
              <a href={hero.source} target="_blank" rel="noreferrer" className="mt-8 block text-xs text-paper/50 hover:text-paper/80">
                Photo: {hero.credit} · {hero.license}
              </a>
            )}
          </div>
        </div>
      </aside>
      <main className="relative min-h-dvh bg-sand-100 lg:shadow-[-30px_0_60px_-30px_rgb(0_0_0/0.5)]">{children}</main>
    </div>
  );
}
