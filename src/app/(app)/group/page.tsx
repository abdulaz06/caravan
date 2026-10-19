import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CurrencyProvider } from "@/components/currency";
import { GroupView } from "@/components/group/group-view";
import { tripLength } from "@/lib/itinerary";
import { balanceOf } from "@/lib/timeline";
import { db } from "@/lib/server/db";
import { initialCurrency } from "@/lib/server/currency-pref";
import { computeStats, loadPeople } from "@/lib/server/group";
import { getRates } from "@/lib/server/rates";
import { currentParticipant } from "@/lib/server/session";

export const metadata: Metadata = { title: "The crew" };

export default async function GroupPage() {
  const me = await currentParticipant();
  if (!me) redirect("/join");
  const [people, settings, rates] = await Promise.all([loadPeople(), db().getSettings(), getRates()]);
  const stats = computeStats(people);
  const mine = people.find((p) => p.id === me.id);
  const canBrowse = mine?.status === "submitted";
  const itineraries = canBrowse
    ? people
        .filter((p) => p.status === "submitted" && p.data)
        .map((p) => ({
          id: p.id,
          name: p.name,
          isMe: p.id === me.id,
          startDate: p.data!.startDate,
          endDate: p.data!.endDate,
          days: tripLength(p.data!),
          picks: p.picks,
          balance: balanceOf(p.data!).score,
        }))
    : [];
  const currency = await initialCurrency(mine?.data?.preferences.currency);
  return (
    <CurrencyProvider initial={currency} rates={rates}>
      <GroupView
        stats={stats}
        myStatus={mine?.status ?? "new"}
        canBrowse={canBrowse}
        itineraries={itineraries}
        editsLocked={settings.edits_locked}
      />
    </CurrencyProvider>
  );
}
