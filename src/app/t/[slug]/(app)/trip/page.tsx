import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CurrencyProvider } from "@/components/currency";
import { TripApp } from "@/components/trip/trip-app";
import { emptyItinerary, normalize } from "@/engine/itinerary";
import { initialCurrency } from "@/lib/server/currency-pref";
import { db } from "@/lib/server/db";
import { pageContext } from "@/lib/server/page-context";
import { getPopular } from "@/lib/server/popular";
import { getRates } from "@/lib/server/rates";
import { roommateCandidates } from "@/lib/server/roommates";
import { currentParticipant } from "@/lib/server/session";
import { tripFromParams, tripPath } from "@/lib/server/trip";

export const metadata: Metadata = { title: "My trip" };

export default async function TripPage({ params, searchParams }: PageProps<"/t/[slug]/trip">) {
  const trip = await tripFromParams(params);
  const me = await currentParticipant(trip.trip);
  if (!me) redirect(tripPath(trip.trip.slug, "/join"));
  const ctx = await pageContext(trip, me);
  const [row, sp, rates, peekCount, popular, candidates] = await Promise.all([
    db().getItinerary(me.id),
    searchParams,
    getRates(),
    db().countPeekers(me.id).catch(() => 0),
    getPopular(trip),
    roommateCandidates(trip.trip.id, me.id).catch(() => []),
  ]);
  const data = row ? normalize(ctx.trip.engine, row.data) : emptyItinerary();
  const currency = await initialCurrency(data.preferences.currency, ctx.trip.rules.defaultCurrency);
  const stamp = row?.stamp && !row.stamp.seen ? row.stamp : null;
  return (
    <CurrencyProvider initial={currency} rates={rates}>
      <TripApp
          name={me.display_name}
          initialData={data}
          initialStatus={row?.status ?? "draft"}
          initialUpdatedAt={row?.updated_at ?? null}
          editsLocked={ctx.locked}
          requestedStep={typeof sp.step === "string" ? sp.step : undefined}
          organizers={ctx.organizers}
          isOrganizer={ctx.isOrganizer}
          peekCount={peekCount}
          popular={popular}
          roommateCandidates={candidates}
          stamp={stamp ? { kind: stamp.kind, by: stamp.by, at: stamp.at, lost: stamp.lost, text: stamp.text } : null}
        />
      </CurrencyProvider>
  );
}
