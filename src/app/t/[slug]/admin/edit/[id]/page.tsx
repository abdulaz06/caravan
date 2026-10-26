import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CurrencyProvider } from "@/components/currency";
import { TripApp } from "@/components/trip/trip-app";
import { emptyItinerary, normalize } from "@/engine/itinerary";
import { initialCurrency } from "@/lib/server/currency-pref";
import { db } from "@/lib/server/db";
import { organizersOf } from "@/lib/server/organizer";
import { getPopular } from "@/lib/server/popular";
import { getRates } from "@/lib/server/rates";
import { roommateCandidates } from "@/lib/server/roommates";
import { consoleActor } from "@/lib/server/session";
import { tripFromParams, tripPath } from "@/lib/server/trip";

export const metadata: Metadata = { title: "Edit a plan" };

/** An organizer edits someone's plan in the normal day builder (saved via the organizer endpoint, stamped). */
export default async function AdminEditPage({ params, searchParams }: PageProps<"/t/[slug]/admin/edit/[id]">) {
  const trip = await tripFromParams(params);
  if (trip.trip.kind === "demo" || !(await consoleActor(trip.trip))) redirect(tripPath(trip.trip.slug, "/admin"));
  const { id } = await params;
  const [person, row, people, rates, sp, popular, candidates] = await Promise.all([
    db().getParticipant(id),
    db().getItinerary(id),
    db().listParticipants(trip.trip.id),
    getRates(),
    searchParams,
    getPopular(trip),
    roommateCandidates(trip.trip.id, id),
  ]);
  if (!person || person.trip_id !== trip.trip.id) notFound();
  const data = row ? normalize(trip.engine, row.data) : emptyItinerary();
  const currency = await initialCurrency(data.preferences.currency, trip.rules.defaultCurrency);
  return (
    <CurrencyProvider initial={currency} rates={rates}>
      <TripApp
        name={person.display_name}
        initialData={data}
        initialStatus={row?.status ?? "draft"}
        initialUpdatedAt={row?.updated_at ?? null}
        editsLocked={trip.locked}
        requestedStep={typeof sp.step === "string" ? sp.step : data.startDate ? "build" : "dates"}
        organizers={organizersOf(people).map((o) => o.name)}
        admin={{ targetId: person.id, targetName: person.display_name }}
        popular={popular}
        roommateCandidates={candidates}
      />
    </CurrencyProvider>
  );
}
