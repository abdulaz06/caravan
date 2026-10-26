import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CurrencyProvider } from "@/components/currency";
import { PersonView } from "@/components/group/person-view";
import { emptyItinerary, normalize } from "@/engine/itinerary";
import { initialCurrency } from "@/lib/server/currency-pref";
import { db, roleOf } from "@/lib/server/db";
import { getRates } from "@/lib/server/rates";
import { consoleActor } from "@/lib/server/session";
import { tripFromParams, tripPath } from "@/lib/server/trip";

export const metadata: Metadata = { title: "A plan, in full" };

/** Organizers see anyone's full plan, private answers included. (The demo shows its made-up answers to everyone.) */
export default async function AdminViewPage({ params }: PageProps<"/t/[slug]/admin/view/[id]">) {
  const trip = await tripFromParams(params);
  if (trip.trip.kind !== "demo" && !(await consoleActor(trip.trip))) redirect(tripPath(trip.trip.slug, "/admin"));
  const { id } = await params;
  const [person, row, rates] = await Promise.all([db().getParticipant(id), db().getItinerary(id), getRates()]);
  if (!person || person.trip_id !== trip.trip.id) notFound();
  const data = row ? normalize(trip.engine, row.data) : emptyItinerary();
  const currency = await initialCurrency(null, trip.rules.defaultCurrency);
  return (
    <CurrencyProvider initial={currency} rates={rates}>
      <PersonView
        name={person.display_name}
        data={data}
        isMe={false}
        role={roleOf(person)}
        organizer={{ id: person.id, status: row?.status ?? "new", stamp: row?.stamp ? { by: row.stamp.by, at: row.stamp.at, kind: row.stamp.kind } : null, readOnly: trip.trip.kind === "demo" }}
      />
    </CurrencyProvider>
  );
}
