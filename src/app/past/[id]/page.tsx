import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EngineProvider } from "@/components/engine";
import { PastTripView } from "@/components/past/past-trip-view";
import { PresetTheme } from "@/components/preset-theme";
import { longRange } from "@/lib/past-dates";
import { loadPastTrip } from "@/lib/server/past-trips";

export async function generateMetadata({ params }: PageProps<"/past/[id]">): Promise<Metadata> {
  const t = loadPastTrip((await params).id);
  if (!t) return { title: "Past trip not found" };
  const og = `/og/${t.preset.preset.id}.jpg`;
  return {
    title: `${t.title} · Past trip`,
    description: t.summary,
    openGraph: { title: t.title, description: t.summary, images: [{ url: og, width: 1200, height: 630 }] },
  };
}

export default async function PastTripPage({ params }: PageProps<"/past/[id]">) {
  const t = loadPastTrip((await params).id);
  if (!t) notFound();
  const { preset, photos } = t.preset;
  return (
    <>
      <PresetTheme theme={preset.theme} />
      <EngineProvider trip={{ id: `past-${t.id}`, slug: `past-${t.id}`, name: t.title, kind: "demo" }} preset={preset} photos={photos} rules={t.rules}>
        <PastTripView
          data={t.data}
          trip={{
            id: t.id,
            title: t.title,
            crew: t.crew,
            dates: longRange(t.start, t.end),
            summary: t.summary,
            days: t.days,
            places: t.places,
            slides: t.slides.length + 1 + (t.teaser ? 1 : 0),
            cover: t.cover,
            storyCover: t.slides[0]?.photo ?? t.cover,
          }}
        />
      </EngineProvider>
    </>
  );
}
