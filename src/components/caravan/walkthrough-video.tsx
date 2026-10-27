"use client";

import { Play } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

/**
 * The 1-minute walkthrough: a poster with a play button until asked, so the
 * page doesn't download 12 MB of video for people who only read.
 */
export function WalkthroughVideo({ src, poster, label }: { src: string; poster: string; label: string }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="relative aspect-video overflow-hidden rounded-[24px] bg-primary-950 shadow-lift ring-1 ring-ink/10">
      {playing ? (
        <video src={src} poster={poster} controls autoPlay playsInline className="absolute inset-0 size-full object-contain">
          {label}
        </video>
      ) : (
        <button type="button" onClick={() => setPlaying(true)} className="group absolute inset-0 block size-full text-left" aria-label={`Play: ${label}`}>
          <Image src={poster} alt="" fill priority sizes="(min-width: 1024px) 1000px, 100vw" className="object-cover" />
          <span className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
          <span className="absolute left-1/2 top-1/2 grid size-[72px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-paper/95 text-ink shadow-lift transition group-hover:scale-110 sm:size-[88px]">
            <Play className="size-8 translate-x-0.5" fill="currentColor" />
          </span>
          <span className="absolute bottom-4 left-5 text-[14px] font-semibold text-paper sm:bottom-5 sm:left-6 sm:text-[15px]">{label}</span>
        </button>
      )}
    </div>
  );
}
