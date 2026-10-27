import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StoryViewer } from "@/components/past/story-viewer";
import { PresetTheme } from "@/components/preset-theme";
import { longRange } from "@/lib/past-dates";
import { loadPastTrip } from "@/lib/server/past-trips";

export async function generateMetadata({ params }: PageProps<"/past/[id]/story">): Promise<Metadata> {
  const t = loadPastTrip((await params).id);
  return { title: t ? `${t.title} · The story` : "Story not found" };
}

export default async function StoryPage({ params }: PageProps<"/past/[id]/story">) {
  const t = loadPastTrip((await params).id);
  if (!t) notFound();
  return (
    <>
      <PresetTheme theme={t.preset.preset.theme} />
      <StoryViewer
        title={t.title}
        cover={{ kicker: "The", title: t.preset.preset.name, place: `Itinerary · ${longRange(t.start, t.end)}`, photo: t.cover }}
        slides={t.slides}
        teaser={t.teaser}
        backHref={`/past/${t.id}`}
      />
    </>
  );
}
