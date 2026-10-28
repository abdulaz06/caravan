"use client";

import { Play } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

/**
 * The 1-minute demo, on YouTube: a poster with a play button until asked, so
 * nothing from YouTube loads for people who only read. Then a privacy-enhanced
 * (youtube-nocookie.com) player takes the poster's place.
 */
export function WalkthroughVideo({ youtubeId, poster, label }: { youtubeId: string; poster: string; label: string }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div>
      <div className="relative aspect-video overflow-hidden rounded-[24px] bg-primary-950 shadow-lift ring-1 ring-ink/10">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0&playsinline=1`}
            title="Caravan: the 1-minute demo (YouTube video)"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            loading="lazy"
            className="absolute inset-0 size-full border-0"
          />
        ) : (
          <button type="button" onClick={() => setPlaying(true)} className="group absolute inset-0 block size-full text-left" aria-label={`Play: ${label}`}>
            <Image src={poster} alt="" fill priority sizes="(min-width: 1024px) 1000px, 100vw" className="object-cover" />
            {/* Over the poster's heatmap, clear of its headline on the left. */}
            <span className="absolute left-[73.75%] top-[43.5%] grid size-[60px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-accent-500 text-paper shadow-lift ring-[6px] ring-paper/45 transition group-hover:scale-110 sm:size-[88px] sm:ring-8">
              <Play className="size-6 translate-x-0.5 sm:size-8" fill="currentColor" />
            </span>
            {/* On a phone this would sit on the poster's overlap days: the aria-label says it there. */}
            <span className="absolute bottom-4 right-4 hidden rounded-full bg-primary-950/85 px-3 py-1 text-[14px] font-semibold text-paper sm:block">{label}</span>
          </button>
        )}
      </div>
      <a
        href={`https://www.youtube.com/watch?v=${youtubeId}`}
        className="mt-2.5 inline-block text-[13.5px] font-semibold text-ink-3 underline-offset-2 hover:text-ink hover:underline"
      >
        Watch on YouTube
      </a>
    </div>
  );
}
