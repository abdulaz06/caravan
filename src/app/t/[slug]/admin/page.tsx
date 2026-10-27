import type { Metadata } from "next";
import { AdminLogin, ConfirmPin } from "@/components/admin/admin";
import { Console } from "@/components/admin/console";
import { roommateBoard } from "@/lib/roommates";
import { db, isOrganizerRole, isUsingLocalStore, roleOf } from "@/lib/server/db";
import { loadPeople, realPeople } from "@/lib/server/group";
import { DEMO_ACTOR } from "@/lib/server/organizer";
import { consoleActor, currentParticipant } from "@/lib/server/session";
import { tripFromParams } from "@/lib/server/trip";
import { isTestName } from "@/lib/test-users";

export const metadata: Metadata = { title: "Organizer" };

export default async function AdminPage({ params }: PageProps<"/t/[slug]/admin">) {
  const trip = await tripFromParams(params);
  // The demo's console is open to everyone, read-only (every organizer endpoint refuses demo writes).
  const demo = trip.trip.kind === "demo";
  const actor = demo ? DEMO_ACTOR : await consoleActor(trip.trip);
  if (!actor) {
    const me = await currentParticipant(trip.trip);
    if (me && isOrganizerRole(roleOf(me))) return <ConfirmPin name={me.display_name} />;
    return <AdminLogin />;
  }
  const [everyone, log] = await Promise.all([loadPeople(trip), db().listLog(trip.trip.id, 300).catch(() => [])]);
  // Demo guests come and go with the nightly reset; they aren't part of the trip.
  const people = everyone.filter((p) => !p.guest);
  const peekers = await Promise.all(people.map((p) => db().countPeekers(p.id).catch(() => 0)));
  return (
    <Console
      actor={{ name: actor.name, role: actor.role === "owner" ? "owner" : "admin", breakGlass: actor.breakGlass, id: actor.id }}
      readOnly={demo}
      rules={trip.rules}
      editsLocked={trip.editsLocked}
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
  );
}
