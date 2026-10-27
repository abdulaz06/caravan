import type { Metadata } from "next";
import { PastTripsList } from "@/components/past/past-trips-list";
import { longRange } from "@/lib/past-dates";
import { pastTrips } from "@/lib/server/past-trips";

export const metadata: Metadata = {
  title: "Past trips",
  description: "Trips planned on Caravan, told as stories: the plan, the route and the days as they happened.",
};

export default function PastTripsPage() {
  const trips = pastTrips().map((t) => ({
    id: t.id,
    title: t.title,
    dates: longRange(t.start, t.end),
    summary: t.summary,
    days: t.days,
    cover: t.cover,
  }));
  return <PastTripsList trips={trips} />;
}
