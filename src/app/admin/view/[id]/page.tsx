import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CurrencyProvider } from "@/components/currency";
import { PersonView } from "@/components/group/person-view";
import { emptyItinerary, normalize } from "@/engine/itinerary";
import { initialCurrency } from "@/lib/server/currency-pref";
import { db, roleOf } from "@/lib/server/db";
import { getRates } from "@/lib/server/rates";
import { loadTrip } from "@/lib/server/trip";
import { consoleActor } from "@/lib/server/session";

export const metadata: Metadata = { title: "A plan, in full" };

/** Organizers see anyone's full plan, private answers included. */
export default async function AdminViewPage({ params }: PageProps<"/admin/view/[id]">) {
  if (!(await consoleActor())) redirect("/admin");
  const { id } = await params;
  const live = await loadTrip();
  const [person, row, rates] = await Promise.all([db().getParticipant(id), db().getItinerary(id), getRates()]);
  if (!person) notFound();
  const data = row ? normalize(live.engine, row.data) : emptyItinerary();
  const currency = await initialCurrency(null, live.rules.defaultCurrency);
  return (
      <CurrencyProvider initial={currency} rates={rates}>
        <PersonView
          name={person.display_name}
          data={data}
          isMe={false}
          role={roleOf(person)}
          organizer={{ id: person.id, status: row?.status ?? "new", stamp: row?.stamp ? { by: row.stamp.by, at: row.stamp.at, kind: row.stamp.kind } : null }}
        />
      </CurrencyProvider>
  );
}
