"use client";

import Image from "next/image";
import { useState } from "react";
import type { Photo as PhotoT } from "@/content";
import { cn } from "@/lib/cn";
import { PalmScene } from "../brand/illustrations";

type Props = {
  photo?: PhotoT;
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
  quality?: number;
};

/** next/image with blur-up placeholder and an on-brand illustrated fallback. */
export function Photo({ photo, alt, sizes, className, priority, quality = 75 }: Props) {
  const [failed, setFailed] = useState(false);
  if (!photo || failed) {
    return (
      <div className={cn("absolute inset-0 overflow-hidden bg-ocean-700", className)} role="img" aria-label={alt}>
        <PalmScene className="absolute inset-0 size-full" />
      </div>
    );
  }
  return (
    <Image
      src={photo.src}
      alt={alt}
      fill
      sizes={sizes}
      quality={quality}
      priority={priority}
      placeholder={photo.blurDataURL ? "blur" : "empty"}
      blurDataURL={photo.blurDataURL}
      onError={() => setFailed(true)}
      className={cn("object-cover", className)}
    />
  );
}

export function PhotoCredit({ photo, className }: { photo?: PhotoT; className?: string }) {
  if (!photo) return null;
  return (
    <a
      href={photo.source}
      target="_blank"
      rel="noreferrer"
      className={cn("text-[10.5px] leading-tight opacity-60 hover:opacity-100", className)}
    >
      Photo: {photo.credit} · {photo.license}
    </a>
  );
}
