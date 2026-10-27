import type { Metadata } from "next";
import { NewTrip } from "@/components/caravan/new-trip";
import { destinations } from "@/lib/server/destinations";

export const metadata: Metadata = {
  title: "Start a trip",
  description: "Pick a destination, name the trip and share one link with the group. Everyone builds their own version; you see where it overlaps.",
};

export default async function NewTripPage({ searchParams }: PageProps<"/new">) {
  const { preset } = await searchParams;
  const list = destinations();
  const initial = typeof preset === "string" && list.some((d) => d.id === preset) ? preset : list.length === 1 ? list[0].id : null;
  return <NewTrip destinations={list} initial={initial} />;
}
