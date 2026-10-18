"use client";

import { Check, Clock, Gauge, Info, MapPin, Wallet } from "lucide-react";
import { useRef, useState } from "react";
import { regions, type Option, type Photo as PhotoT } from "@/content";
import { cn } from "@/lib/cn";
import { Button } from "../ui/button";
import { Photo, PhotoCredit } from "../ui/photo";
import { Sheet } from "../ui/sheet";
import { VibeDots } from "./bits";

type Props = {
  option: Option | null;
  open: boolean;
  onClose: () => void;
  pickLabel?: string;
  picked?: boolean;
  onPick?: () => void;
};

export function Gallery({ images, alt, className }: { images: PhotoT[]; alt: string; className?: string }) {
  const [i, setI] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className={cn("relative", className)}>
      <div
        ref={ref}
        onScroll={(e) => {
          const el = e.currentTarget;
          setI(Math.round(el.scrollLeft / el.clientWidth));
        }}
        className="no-scrollbar flex h-full snap-x snap-mandatory overflow-x-auto"
      >
        {images.map((img, k) => (
          <div key={img.src} className="relative h-full w-full shrink-0 snap-center bg-ocean-800">
            <Photo photo={img} alt={`${alt} — photo ${k + 1}`} sizes="(min-width: 1024px) 480px, 100vw" priority={k === 0} quality={85} />
          </div>
        ))}
      </div>
      {images.length > 1 && (
        <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
          {images.map((img, k) => (
            <button
              key={img.src}
              aria-label={`Photo ${k + 1}`}
              onClick={() => ref.current?.scrollTo({ left: k * ref.current.clientWidth, behavior: "smooth" })}
              className={cn("h-1.5 rounded-full bg-white transition-all", k === i ? "w-5" : "w-1.5 opacity-60")}
            />
          ))}
        </div>
      )}
      <PhotoCredit photo={images[i]} className="absolute bottom-2.5 right-3 hidden text-white drop-shadow sm:block" />
    </div>
  );
}

export function OptionDetail({ option, open, onClose, pickLabel, picked, onPick }: Props) {
  return (
    <Sheet
      open={open && !!option}
      onClose={onClose}
      bare
      footer={
        onPick && option ? (
          <Button size="lg" block onClick={onPick} variant={picked ? "ocean" : "primary"}>
            {picked ? (
              <>
                <Check className="size-5" strokeWidth={3} /> Your pick
              </>
            ) : (
              (pickLabel ?? "Pick this")
            )}
          </Button>
        ) : undefined
      }
    >
      {option && (
        <article>
          <Gallery images={option.images} alt={option.title} className="aspect-[4/3.4] w-full" />
          <div className="px-5 pb-8 pt-5">
            <div className="flex flex-wrap items-center gap-2 text-[12px] font-semibold text-ink-3">
              <span className="inline-flex items-center gap-1 rounded-full bg-ocean-100 px-2.5 py-1 text-ocean-700">
                <MapPin className="size-3.5" /> {regions[option.region].name}
              </span>
              <VibeDots vibe={option.vibe} className="rounded-full bg-sand-200 px-2.5 py-1 text-ink-2" />
            </div>
            <h2 className="font-display mt-3 text-[30px] font-semibold leading-[1.05] tracking-[-0.02em]">{option.title}</h2>
            <p className="font-display mt-2 text-[18px] italic leading-snug text-ocean-700">{option.tagline}</p>

            <dl className="mt-5 grid grid-cols-3 gap-2">
              <Fact icon={Clock} label="Time" value={option.duration} />
              <Fact
                icon={Wallet}
                label="Per person"
                value={option.estCostUsd ? (option.estCostUsd[0] === 0 && option.estCostUsd[1] === 0 ? "Free" : `$${option.estCostUsd[0]}–${option.estCostUsd[1]}`) : "—"}
              />
              <Fact icon={Gauge} label="Effort" value={option.intensity ? option.intensity[0].toUpperCase() + option.intensity.slice(1) : option.slot === "night" ? "Evening" : "—"} />
            </dl>

            <p className="mt-5 text-[15.5px] leading-relaxed text-ink-2">{option.description}</p>
            <ul className="mt-5 space-y-2.5">
              {option.highlights.map((h) => (
                <li key={h} className="flex gap-3 text-[15px]">
                  <span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-saffron-200 text-ink">
                    <Check className="size-3" strokeWidth={3.5} />
                  </span>
                  {h}
                </li>
              ))}
            </ul>
            {option.goodToKnow && (
              <div className="mt-6 flex gap-3 rounded-2xl bg-ocean-100/70 p-4 text-[14px] leading-snug text-ocean-900">
                <Info className="mt-0.5 size-4 shrink-0 text-ocean-600" />
                <p>
                  <b>Good to know: </b>
                  {option.goodToKnow}
                </p>
              </div>
            )}
            <div className="mt-6 space-y-1 border-t border-ink/5 pt-4">
              {option.images.map((img) => (
                <PhotoCredit key={img.src} photo={img} className="block" />
              ))}
              <p className="text-[10.5px] text-ink-3/70">Prices are rough estimates for late 2026.</p>
            </div>
          </div>
        </article>
      )}
    </Sheet>
  );
}

function Fact({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-paper px-3 py-2.5 shadow-card">
      <dt className="flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wide text-ink-3">
        <Icon className="size-3" /> {label}
      </dt>
      <dd className="mt-0.5 text-[13.5px] font-semibold leading-tight">{value}</dd>
    </div>
  );
}
