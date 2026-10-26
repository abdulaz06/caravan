import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CurrencyProvider } from "@/components/currency";
import { PeekView } from "@/components/group/peek-view";
import { initialCurrency } from "@/lib/server/currency-pref";
import { db } from "@/lib/server/db";
import { getRates } from "@/lib/server/rates";
import { currentParticipant } from "@/lib/server/session";
import { tripFromParams, tripPath } from "@/lib/server/trip";

export const metadata: Metadata = { title: "👀 Peek" };

/** The peek page. The plan itself comes from the peek endpoint, which returns only what a peek may show. */
export default async function PeekPage({ params }: PageProps<"/t/[slug]/group/peek/[id]">) {
  const trip = await tripFromParams(params);
  const me = await currentParticipant(trip.trip);
  if (!me) redirect(tripPath(trip.trip.slug, "/join"));
  const { id } = await params;
  if (!trip.rules.peek || id === me.id) redirect(tripPath(trip.trip.slug, "/group"));
  const [person, mine, rates] = await Promise.all([db().getParticipant(id), db().getItinerary(me.id), getRates()]);
  if (!person || person.trip_id !== trip.trip.id) notFound();
  const currency = await initialCurrency(mine?.data.preferences?.currency, trip.rules.defaultCurrency);
  return (
    <CurrencyProvider initial={currency} rates={rates}>
      <PeekView id={person.id} name={person.display_name} />
    </CurrencyProvider>
  );
}
