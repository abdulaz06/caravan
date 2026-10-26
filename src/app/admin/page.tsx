import type { Metadata } from "next";
import { AdminLogin, ConfirmPin } from "@/components/admin/admin";
import { Console } from "@/components/admin/console";
import { RulesProvider } from "@/components/rules";
import { db, isOrganizerRole, isUsingLocalStore, roleOf } from "@/lib/server/db";
import { loadPeople, realPeople } from "@/lib/server/group";
import { roommateBoard } from "@/lib/roommates";
import { isTestName } from "@/lib/test-users";
import { loadRules } from "@/lib/server/rules";
import { consoleActor, currentParticipant } from "@/lib/server/session";

export const metadata: Metadata = { title: "Organizer" };

export default async function AdminPage() {
  const actor = await consoleActor();
  if (!actor) {
    const me = await currentParticipant();
    if (me && isOrganizerRole(roleOf(me))) return <ConfirmPin name={me.display_name} />;
    return <AdminLogin />;
  }
  const live = await loadRules();
  const [people, log] = await Promise.all([loadPeople(), db().listLog(300).catch(() => [])]);
  const peekers = await Promise.all(people.map((p) => db().countPeekers(p.id).catch(() => 0)));
  return (
    <RulesProvider rules={live.rules}>
      <Console
        actor={{ name: actor.name, role: actor.role === "owner" ? "owner" : "admin", breakGlass: actor.breakGlass, id: actor.id }}
        rules={live.rules}
        editsLocked={live.editsLocked}
        localStore={isUsingLocalStore()}
        roommates={roommateBoard(realPeople(people).map((p) => ({ id: p.id, name: p.name, picks: p.data?.preferences.roommates })))}
        log={log.map((e) => ({ id: e.id, at: e.at, actor_name: e.actor_name, action: e.action, target_name: e.target_name, details: e.details }))}
        people={people.map((p, i) => ({
          id: p.id,
          name: p.name,
          role: p.role,
          status: p.status,
          joinedAt: p.joinedAt,
          updatedAt: p.updatedAt,
          picks: p.picks,
          startDate: p.data?.startDate ?? null,
          endDate: p.data?.endDate ?? null,
          days: p.data?.days.length ?? 0,
          pickedIds: p.data ? p.data.days.flatMap((d) => [...d.day, ...d.night].map((x) => x.id)) : [],
          stamp: p.stamp ? { kind: p.stamp.kind, by: p.stamp.by, at: p.stamp.at } : null,
          peekers: peekers[i],
          test: isTestName(p.name),
        }))}
      />
    </RulesProvider>
  );
}
