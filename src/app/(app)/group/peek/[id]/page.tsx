import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CurrencyProvider } from "@/components/currency";
import { PeekView } from "@/components/group/peek-view";
import { initialCurrency } from "@/lib/server/currency-pref";
import { db } from "@/lib/server/db";
import { getRates } from "@/lib/server/rates";
import { loadTrip } from "@/lib/server/trip";
import { currentParticipant } from "@/lib/server/session";

export const metadata: Metadata = { title: "👀 Peek" };

/** The peek page. The plan itself comes from /api/peek/[id], which returns only what a peek may show. */
export default async function PeekPage({ params }: PageProps<"/group/peek/[id]">) {
  const me = await currentParticipant();
  if (!me) redirect("/join");
  const { rules } = await loadTrip();
  const { id } = await params;
  if (!rules.peek || id === me.id) redirect("/group");
  const [person, mine, rates] = await Promise.all([db().getParticipant(id), db().getItinerary(me.id), getRates()]);
  if (!person) notFound();
  const currency = await initialCurrency(mine?.data.preferences?.currency, rules.defaultCurrency);
  return (
      <CurrencyProvider initial={currency} rates={rates}>
        <PeekView id={person.id} name={person.display_name} />
      </CurrencyProvider>
  );
}
