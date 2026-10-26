import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CurrencyProvider } from "@/components/currency";
import { PersonView } from "@/components/group/person-view";
import { normalize } from "@/engine/itinerary";
import { browsePlan } from "@/lib/privacy";
import { initialCurrency } from "@/lib/server/currency-pref";
import { db, roleOf } from "@/lib/server/db";
import { getRates } from "@/lib/server/rates";
import { currentParticipant } from "@/lib/server/session";
import { tripFromParams, tripPath } from "@/lib/server/trip";

export const metadata: Metadata = { title: "Their trip" };

export default async function PersonPage({ params }: PageProps<"/t/[slug]/group/[id]">) {
  const trip = await tripFromParams(params);
  const me = await currentParticipant(trip.trip);
  if (!me) redirect(tripPath(trip.trip.slug, "/join"));
  const { id } = await params;
  const mine = await db().getItinerary(me.id);
  // Browsing others follows the Trip rule: after submitting your own (default), always, or off.
  const { browse } = trip.rules;
  const allowed = browse === "always" || (browse === "after_submit" && mine?.status === "submitted");
  if (!allowed && id !== me.id) redirect(tripPath(trip.trip.slug, "/group"));
  const [person, row] = await Promise.all([db().getParticipant(id), db().getItinerary(id)]);
  if (!person || person.trip_id !== trip.trip.id || !row || row.status !== "submitted") notFound();
  const [rates, currency] = await Promise.all([getRates(), initialCurrency(mine?.data.preferences?.currency, trip.rules.defaultCurrency)]);
  const data = normalize(trip.engine, row.data);
  return (
    <CurrencyProvider initial={currency} rates={rates}>
      {/* Someone else's private answers (incl. roommate picks) never reach the browser. */}
      <PersonView name={person.display_name} data={person.id === me.id ? data : browsePlan(data)} isMe={person.id === me.id} role={roleOf(person)} />
    </CurrencyProvider>
  );
}
