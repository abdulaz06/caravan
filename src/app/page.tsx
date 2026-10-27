import { Landing, type MyTrip } from "@/components/caravan/landing";
import { db } from "@/lib/server/db";
import { longRange } from "@/lib/past-dates";
import { destinations } from "@/lib/server/destinations";
import { pastTrips } from "@/lib/server/past-trips";
import { myTripIds } from "@/lib/server/session";

export default async function Home() {
  const list = destinations();
  let mine: MyTrip[] = [];
  try {
    const store = db();
    const ids = await myTripIds();
    const rows = await Promise.all(ids.slice(0, 6).map((id) => store.getTrip(id)));
    mine = rows
      .filter((r) => r !== null && r.kind === "live")
      .map((r) => ({ slug: r!.slug, name: r!.name, destination: list.find((d) => d.id === r!.preset_id)?.name ?? "" }));
  } catch {
    // The landing page never fails because the database is unreachable.
  }
  const archive = pastTrips().map((t) => ({
    id: t.id,
    title: t.title,
    dates: longRange(t.start, t.end),
    summary: t.summary,
    slides: t.slides.length + 2,
    cover: t.cover,
    storyCover: t.slides.find((s) => s.title === "Ski day")?.photo ?? t.cover,
  }));
  return <Landing destinations={list} demoHref="/demo" myTrips={mine} archive={archive} />;
}
