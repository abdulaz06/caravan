import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CurrencyProvider } from "@/components/currency";
import { GroupView } from "@/components/group/group-view";
import { RulesProvider } from "@/components/rules";
import { tripLength } from "@/lib/itinerary";
import { balanceOf } from "@/lib/timeline";
import { initialCurrency } from "@/lib/server/currency-pref";
import { computeStats, loadPeople, realPeople } from "@/lib/server/group";
import { getPopular } from "@/lib/server/popular";
import { PopularProvider } from "@/components/popular";
import { isTestName } from "@/lib/test-users";
import { pageContext } from "@/lib/server/page-context";
import { getRates } from "@/lib/server/rates";
import { currentParticipant } from "@/lib/server/session";

export const metadata: Metadata = { title: "The crew" };

export default async function GroupPage() {
  const me = await currentParticipant();
  if (!me) redirect("/join");
  const ctx = await pageContext(me);
  // Test users ("zz-test-…") never show up or count here — except to themselves.
  const [all, rates, popular] = await Promise.all([loadPeople(), getRates(), getPopular()]);
  const people = all.filter((p) => p.id === me.id || !isTestName(p.name));
  const stats = computeStats(realPeople(people));
  const mine = people.find((p) => p.id === me.id);
  // Browsing others: after submitting (default), always, or off — a Trip rule.
  const canBrowse = ctx.rules.browse === "always" || (ctx.rules.browse === "after_submit" && mine?.status === "submitted");
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
  const order = { submitted: 0, draft: 1, new: 2 } as const;
  const members = people
    .map((p) => ({ id: p.id, name: p.name, isMe: p.id === me.id, status: p.status, organizer: p.role !== "member" }))
    .sort((a, b) => Number(b.isMe) - Number(a.isMe) || order[a.status] - order[b.status]);
  const currency = await initialCurrency(mine?.data?.preferences.currency, ctx.rules.defaultCurrency);
  return (
    <RulesProvider rules={ctx.rules}>
      <CurrencyProvider initial={currency} rates={rates}>
        <PopularProvider initial={popular}>
        <GroupView
          stats={stats}
          myStatus={mine?.status ?? "new"}
          canBrowse={canBrowse}
          itineraries={itineraries}
          members={members}
          editsLocked={ctx.locked}
          isOrganizer={ctx.isOrganizer}
        />
        </PopularProvider>
      </CurrencyProvider>
    </RulesProvider>
  );
}
