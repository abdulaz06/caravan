"use client";

import { Check, Clock, Flag, Gauge, Info, MapPin, Wallet } from "lucide-react";
import { useRef, useState } from "react";
import { bases, regions, type Option, type Photo as PhotoT } from "@/content";
import { cn } from "@/lib/cn";
import { baseDistanceLabel } from "@/lib/timeline";
import { useCurrency } from "../currency";
import { Train, Van } from "../brand/illustrations";
import { Button } from "../ui/button";
import { Photo, PhotoCredit } from "../ui/photo";
import { Sheet } from "../ui/sheet";
import { DaysBadge, VibeDots } from "./bits";

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
                {option.transport ? `Day trip from ${bases[option.base].name}` : baseDistanceLabel(option)}
              </span>
              <VibeDots vibe={option.vibe} className="rounded-full bg-sand-200 px-2.5 py-1 text-ink-2" />
              <DaysBadge option={option} className="px-2.5 py-1 text-[12px]" />
            </div>
            <h2 className="font-display mt-3 text-[30px] font-semibold leading-[1.05] tracking-[-0.02em]">{option.title}</h2>
            <p className="font-display mt-2 text-[18px] italic leading-snug text-ocean-700">{option.tagline}</p>

            <dl className="mt-5 grid grid-cols-3 gap-2">
              <Fact icon={Clock} label="Time" value={option.duration} />
              <Fact
                icon={Wallet}
                label="Per person"
                value={option.estCostUsd ? range(option.estCostUsd) : "—"}
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
            {option.transport && (
              <section className="mt-6">
                <h3 className="font-display text-[20px] font-semibold">Getting there: your choice</h3>
                <div className="mt-2 grid gap-2">
                  {(["train", "road"] as const).map((m) => {
                    const t = option.transport![m];
                    return (
                      <div key={m} className="flex items-start gap-3 rounded-2xl bg-paper p-3 shadow-card">
                        <span className={cn("grid h-10 w-14 shrink-0 place-items-center rounded-xl", m === "train" ? "bg-ocean-100" : "bg-saffron-100")}>
                          {m === "train" ? <Train className="h-4 w-12" /> : <Van className="h-6 w-10 text-ocean-600" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14.5px] font-semibold">
                            {t.title} · <span className="text-ocean-700">{t.label}</span>
                          </span>
                          <span className="block text-[12.5px] leading-snug text-ink-3">{t.detail}</span>
                        </span>
                        <span className="shrink-0 text-[12.5px] font-bold tabular-nums">{range(t.costUsd)}</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
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
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-semibold leading-tight">{h.venue}</span>
                        <span className="block text-[11.5px] text-paper/60">
                          {h.area}
                          {h.note ? ` · ${h.note}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold">Par {h.par}</span>
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
