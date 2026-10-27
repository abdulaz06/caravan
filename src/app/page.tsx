import { Landing, type MyTrip } from "@/components/caravan/landing";
import { db } from "@/lib/server/db";
import { DEMO_SLUG } from "@/lib/server/demo";
import { destinations } from "@/lib/server/destinations";
import { myTripIds } from "@/lib/server/session";

export default async function Home() {
  const list = destinations();
  let demo: string | null = null;
  let mine: MyTrip[] = [];
  try {
    const store = db();
    const [demoRow, ids] = await Promise.all([store.getTripBySlug(DEMO_SLUG), myTripIds()]);
    demo = demoRow ? `/t/${demoRow.slug}` : null;
    const rows = await Promise.all(ids.slice(0, 6).map((id) => store.getTrip(id)));
    mine = rows
      .filter((r) => r !== null && r.kind === "live")
      .map((r) => ({ slug: r!.slug, name: r!.name, destination: list.find((d) => d.id === r!.preset_id)?.name ?? "" }));
  } catch {
    // The landing page never fails because the database is unreachable.
  }
  return <Landing destinations={list} demoHref={demo} myTrips={mine} />;
}
