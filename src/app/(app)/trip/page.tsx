import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TripApp } from "@/components/trip/trip-app";
import { emptyItinerary, normalize } from "@/lib/itinerary";
import { db } from "@/lib/server/db";
import { currentParticipant } from "@/lib/server/session";

export const metadata: Metadata = { title: "My trip" };

export default async function TripPage({ searchParams }: PageProps<"/trip">) {
  const me = await currentParticipant();
  if (!me) redirect("/join");
  const [row, settings, sp] = await Promise.all([db().getItinerary(me.id), db().getSettings(), searchParams]);
  return (
    <TripApp
      name={me.display_name}
      initialData={row ? normalize(row.data) : emptyItinerary()}
      initialStatus={row?.status ?? "draft"}
      initialUpdatedAt={row?.updated_at ?? null}
      editsLocked={settings.edits_locked}
      requestedStep={typeof sp.step === "string" ? sp.step : undefined}
    />
  );
}
