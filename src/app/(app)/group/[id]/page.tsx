import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CurrencyProvider } from "@/components/currency";
import { PersonView } from "@/components/group/person-view";
import { RulesProvider } from "@/components/rules";
import { normalize } from "@/lib/itinerary";
import { browsePlan } from "@/lib/privacy";
import { initialCurrency } from "@/lib/server/currency-pref";
import { db, roleOf } from "@/lib/server/db";
import { pageContext } from "@/lib/server/page-context";
import { getRates } from "@/lib/server/rates";
import { currentParticipant } from "@/lib/server/session";

export const metadata: Metadata = { title: "Their trip" };

export default async function PersonPage({ params }: PageProps<"/group/[id]">) {
  const me = await currentParticipant();
  if (!me) redirect("/join");
  const ctx = await pageContext(me);
  const { id } = await params;
  const mine = await db().getItinerary(me.id);
  // Browsing others follows the Trip rule: after submitting your own (default), always, or off.
  const allowed = ctx.rules.browse === "always" || (ctx.rules.browse === "after_submit" && mine?.status === "submitted");
  if (!allowed && id !== me.id) redirect("/group");
  const [person, row] = await Promise.all([db().getParticipant(id), db().getItinerary(id)]);
  if (!person || !row || row.status !== "submitted") notFound();
  const [rates, currency] = await Promise.all([getRates(), initialCurrency(mine?.data.preferences?.currency, ctx.rules.defaultCurrency)]);
  return (
    <RulesProvider rules={ctx.rules}>
      <CurrencyProvider initial={currency} rates={rates}>
        {/* Someone else's private answers (incl. roommate picks) never reach the browser. */}
        <PersonView
          name={person.display_name}
          data={person.id === me.id ? normalize(row.data) : browsePlan(normalize(row.data))}
          isMe={person.id === me.id}
          role={roleOf(person)}
        />
      </CurrencyProvider>
    </RulesProvider>
  );
}
