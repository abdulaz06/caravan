"use client";

import { Download, Loader2, Share2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Photo } from "@/engine/catalog";
import { tripHighlights } from "@/engine/highlights";
import type { ItineraryData } from "@/engine/itinerary";
import { dayRoutes } from "@/engine/routes";
import { daysNightsLabel, tripDays, type Engine } from "@/engine/structure";
import { balanceOf, buildTimeline } from "@/engine/timeline";
import { cn } from "@/lib/cn";
import { renderShareImage, type ShareFormat, type ShareModel } from "@/lib/share-image";
import { useEngine } from "../engine";
import { Button } from "../ui/button";
import { Sheet } from "../ui/sheet";

type Img = { blob: Blob; url: string };

const FORMATS: { id: ShareFormat; label: string; sub: string }[] = [
  { id: "story", label: "Story", sub: "9:16 · 1080×1920" },
  { id: "square", label: "Square", sub: "1:1 · 1080×1080" },
];

/** Up to three highlight photos, one per day where possible. */
function pickPhotos(model: Omit<ShareModel, "photos">): ShareModel["photos"] {
  const out: { photo: Photo; title: string }[] = [];
  const seen = new Set<string>();
  for (const pass of ["day", "night"] as const) {
    for (const t of model.timeline.days) {
      const it = t[pass].items.find((v) => v.resolved.kind === "activity" && v.resolved.activity.images.length);
      if (!it || it.resolved.kind !== "activity") continue;
      const a = it.resolved.activity;
      if (seen.has(a.id) || seen.has(a.images[0].src)) continue;
      seen.add(a.id);
      seen.add(a.images[0].src);
      out.push({ photo: a.images[0], title: a.title });
      if (out.length === 3) return out;
    }
  }
  return out;
}

/** `family`: the plan is already swapped — its highlights replace the vibe meter (no other sign of the mode). */
export function buildShareModel(engine: Engine, name: string, data: ItineraryData, family = false): ShareModel {
  const timeline = buildTimeline(engine, data);
  const base = { engine, name, data, timeline, routes: dayRoutes(engine, data, timeline), balance: balanceOf(engine, data) };
  return { ...base, photos: pickPhotos(base), ...(family ? { highlights: tripHighlights(engine, data) } : {}) };
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "trip";

function download(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * "Share my trip": both images are drawn as soon as the sheet opens so the
 * Share button can hand the file to the Web Share API inside the tap.
 * Mount it only while open (state resets each time).
 */
export function ShareSheet({ onClose, name, data, family = false }: { onClose: () => void; name: string; data: ItineraryData; family?: boolean }) {
  const engine = useEngine();
  const { preset } = engine.catalog;
  const model = useMemo(() => buildShareModel(engine, name, data, family), [engine, name, data, family]);
  const [imgs, setImgs] = useState<Partial<Record<ShareFormat, Img>>>({});
  const [failed, setFailed] = useState(false);
  const [canShareFiles, setCanShareFiles] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const made: string[] = [];
    (async () => {
      for (const f of FORMATS) {
        const blob = await renderShareImage(f.id, model);
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        made.push(url);
        setImgs((prev) => ({ ...prev, [f.id]: { blob, url } }));
        if (f.id === "story") {
          const probe = new File([blob], "probe.png", { type: "image/png" });
          setCanShareFiles(typeof navigator.canShare === "function" && navigator.canShare({ files: [probe] }));
        }
      }
    })().catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      made.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [model]);

  const filename = (f: ShareFormat) => `caravan-${slug(name)}-${preset.id}-${f}.png`;

  async function share(f: ShareFormat) {
    const img = imgs[f];
    if (!img) return;
    const file = new File([img.blob], filename(f), { type: "image/png" });
    try {
      await navigator.share({
        files: [file],
        title: `${name}'s ${preset.name}`,
        text: `My ${preset.name} trip — ${daysNightsLabel(data.days.length || tripDays(engine))}`,
      });
    } catch (e) {
      if ((e as DOMException)?.name !== "AbortError") download(img.url, filename(f));
    }
  }

  return (
    <Sheet open onClose={onClose} eyebrow="Share my trip" title="Your trip, poster-style">
      <div className="px-4 pb-10">
        <p className="px-1 text-[14px] text-ink-2">
          Made for Instagram Stories and the group chat. {canShareFiles ? "Tap Share to send it or save it to Photos." : "Save it and post it anywhere."}
        </p>
        {failed && (
          <p className="mt-3 rounded-2xl bg-accent-100 p-3 text-[13.5px] text-accent-700">Couldn&apos;t draw the image on this device — try again in a moment.</p>
        )}
        <div className="mt-4 grid grid-cols-[0.62fr_1fr] items-start gap-3">
          {FORMATS.map((f) => {
            const img = imgs[f.id];
            return (
              <figure key={f.id} className="min-w-0">
                <div
                  className={cn(
                    "relative overflow-hidden rounded-2xl bg-primary-800 shadow-card ring-1 ring-ink/5",
                    f.id === "story" ? "aspect-[9/16]" : "aspect-square",
                  )}
                >
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element -- a local blob preview, not a page image
                    <img src={img.url} alt={`${f.label} image of ${name}'s trip`} className="size-full object-cover" />
                  ) : (
                    <span className="absolute inset-0 grid place-items-center text-paper/70">
                      <Loader2 className="size-6 animate-spin" />
                    </span>
                  )}
                </div>
                <figcaption className="mt-2 px-0.5">
                  <span className="block text-[14px] font-semibold">{f.label}</span>
                  <span className="block text-[11.5px] text-ink-3">{f.sub}</span>
                </figcaption>
                <div className="mt-2 grid gap-1.5">
                  {canShareFiles && (
                    <Button size="md" block disabled={!img} onClick={() => share(f.id)} aria-label={`Share ${f.label} image`}>
                      <Share2 className="size-4" /> Share
                    </Button>
                  )}
                  <Button
                    size="md"
                    block
                    variant={canShareFiles ? "light" : "primary"}
                    disabled={!img}
                    onClick={() => img && download(img.url, filename(f.id))}
                    aria-label={`Save ${f.label} image`}
                  >
                    <Download className="size-4" /> Save image
                  </Button>
                </div>
              </figure>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
}
