"use client";

import { Check, Clock, ExternalLink, Flag, Gauge, Heart, Info, MapPin, Wallet } from "lucide-react";
import { useRef, useState } from "react";
import { COAST_ROAD_KM, regions, type Activity, type Photo as PhotoT, type Where } from "@/content";
import { cn } from "@/lib/cn";
import { distanceLabel } from "@/lib/timeline";
import { useCurrency } from "../currency";
import { Button } from "../ui/button";
import { Photo, PhotoCredit } from "../ui/photo";
import { Sheet } from "../ui/sheet";
import { DaysBadge, VibeDots } from "./bits";

type Option = Activity;

type Props = {
  option: Option | null;
  /** Which pool it's being shown for (distance copy); defaults to the option's first. */
  where?: Where;
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

export function OptionDetail({ option, where, open, onClose, pickLabel, picked, onPick }: Props) {
  const { range, rateNote } = useCurrency();
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
              <span className="rounded-full bg-sand-200 px-2.5 py-1 text-ink-2">
                {distanceLabel(option, where ?? option.where[0])}
              </span>
              {option.kind === "extra" && <span className="rounded-full bg-saffron-200 px-2.5 py-1 text-ink">Quick extra</span>}
              <VibeDots vibe={option.vibe} className="rounded-full bg-sand-200 px-2.5 py-1 text-ink-2" />
              <DaysBadge option={option} className="px-2.5 py-1 text-[12px]" />
            </div>
            <h2 className="font-display mt-3 text-[30px] font-semibold leading-[1.05] tracking-[-0.02em]">{option.title}</h2>
            <p className="font-display mt-2 text-[18px] italic leading-snug text-ocean-700">{option.tagline}</p>
            {option.loved && (
              <p className="mt-3 flex gap-2 rounded-2xl bg-hibiscus-100/70 px-3.5 py-2.5 text-[13.5px] leading-snug text-ink-2">
                <Heart className="mt-0.5 size-4 shrink-0 fill-hibiscus-500 text-hibiscus-500" />
                <span>
                  <b className="text-ink">Why people love it: </b>
                  {option.loved}
                </span>
              </p>
            )}
            {option.routeKm !== undefined && (
              <div className="mt-4 rounded-2xl bg-paper p-3 shadow-card" aria-label={`About ${option.routeKm} km from Colombo on the coast road`}>
                <div className="flex justify-between text-[11px] font-bold uppercase tracking-wide text-ink-3">
                  <span>Colombo</span>
                  <span>On the coast road · km {option.routeKm}</span>
                  <span>Galle</span>
                </div>
                <div className="relative mt-2 h-2 rounded-full bg-sand-200">
                  <span className="absolute inset-y-0 left-0 rounded-full bg-ocean-600" style={{ width: `${(option.routeKm / COAST_ROAD_KM) * 100}%` }} />
                  <span
                    className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-saffron-500 ring-[3px] ring-paper"
                    style={{ left: `${(option.routeKm / COAST_ROAD_KM) * 100}%` }}
                  />
                </div>
              </div>
            )}

            <dl className="mt-5 grid grid-cols-3 gap-2">
              <Fact icon={Clock} label="Time" value={option.duration} />
              <Fact
                icon={Wallet}
                label="Per person"
                value={range(option.estCostUsd)}
              />
              <Fact icon={Gauge} label="Effort" value={option.intensity ? option.intensity[0].toUpperCase() + option.intensity.slice(1) : option.slots[0] === "night" ? "Evening" : "—"} />
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
            {option.course && (
              <section className="mt-6 overflow-hidden rounded-[22px] bg-jungle-800 text-paper">
                <div className="flex items-center gap-2 px-4 pb-2 pt-4">
                  <Flag className="size-5 text-saffron-400" />
                  <h3 className="font-display text-[20px] font-semibold">The course</h3>
                  <span className="ml-auto text-[12px] font-semibold text-paper/60">
                    Par {option.course.reduce((n, h) => n + h.par, 0)}
                  </span>
                </div>
                <ol className="divide-y divide-white/10 px-4 pb-2">
                  {option.course.map((h, i) => (
                    <li key={h.venue} className="flex items-center gap-3 py-2.5">
                      <span className="font-display grid size-8 shrink-0 place-items-center rounded-full bg-saffron-400 text-[15px] font-bold text-ink">
                        {option.course![0].par === 0 ? i : i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-semibold leading-tight">{h.venue}</span>
                        <span className="block text-[11.5px] text-paper/60">
                          {h.area}
                          {h.note ? ` · ${h.note}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold">{h.par ? `Par ${h.par}` : "Tee-off"}</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}
            {option.rules && (
              <section className="relative mt-4 rotate-[-0.6deg] rounded-[18px] border-2 border-dashed border-jungle-600 bg-jungle-100 p-4">
                <span className="label absolute -top-2.5 left-4 rounded-full bg-jungle-600 px-2.5 py-0.5 text-paper">Scorecard</span>
                <h3 className="font-display mt-1 text-[19px] font-semibold text-jungle-900">{option.rules.title}</h3>
                <ul className="mt-2 space-y-1.5">
                  {option.rules.items.map((r) => (
                    <li key={r} className="flex gap-2 text-[13.5px] leading-snug text-jungle-900">
                      <span aria-hidden="true">⛳</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {option.goodToKnow && (
              <div className="mt-6 flex gap-3 rounded-2xl bg-ocean-100/70 p-4 text-[14px] leading-snug text-ocean-900">
                <Info className="mt-0.5 size-4 shrink-0 text-ocean-600" />
                <p>
                  <b>Good to know: </b>
                  {option.goodToKnow}
                </p>
              </div>
            )}
            {option.sources.length > 0 && (
              <section className="mt-6">
                <h3 className="label text-ink-3">Sources we checked</h3>
                <ul className="mt-2 space-y-1.5">
                  {option.sources.map((s) => (
                    <li key={s.url}>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-start gap-1.5 text-[12.5px] leading-snug text-ocean-700 underline-offset-2 hover:underline"
                      >
                        <ExternalLink className="mt-0.5 size-3 shrink-0" /> {s.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <div className="mt-6 space-y-1 border-t border-ink/5 pt-4">
              {option.images.map((img) => (
                <PhotoCredit key={img.src} photo={img} className="block" />
              ))}
              <p className="text-[10.5px] text-ink-3/70">Prices are rough per-person estimates for late 2026 · ≈ {rateNote}.</p>
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
