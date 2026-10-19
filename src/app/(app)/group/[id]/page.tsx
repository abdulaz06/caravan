import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CurrencyProvider } from "@/components/currency";
import { PersonView } from "@/components/group/person-view";
import { normalize } from "@/lib/itinerary";
import { initialCurrency } from "@/lib/server/currency-pref";
import { db } from "@/lib/server/db";
import { getRates } from "@/lib/server/rates";
import { currentParticipant } from "@/lib/server/session";

export const metadata: Metadata = { title: "Their trip" };

export default async function PersonPage({ params }: PageProps<"/group/[id]">) {
  const me = await currentParticipant();
  if (!me) redirect("/join");
  const { id } = await params;
  const mine = await db().getItinerary(me.id);
  // Browsing others is only unlocked once you've submitted your own.
  if (mine?.status !== "submitted") redirect("/group");
  const [person, row] = await Promise.all([db().getParticipant(id), db().getItinerary(id)]);
  if (!person || !row || row.status !== "submitted") notFound();
  const [rates, currency] = await Promise.all([getRates(), initialCurrency(mine.data.preferences?.currency)]);
  return (
    <CurrencyProvider initial={currency} rates={rates}>
      <PersonView name={person.display_name} data={normalize(row.data)} isMe={person.id === me.id} />
    </CurrencyProvider>
  );
}
