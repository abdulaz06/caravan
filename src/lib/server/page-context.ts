import "server-only";
import type { TripRules } from "@/lib/rules";
import { db, isOrganizerRole, roleOf, type ParticipantRow, type Role } from "./db";
import { organizersOf } from "./organizer";
import { loadRules } from "./rules";

export type PageContext = {
  rules: TripRules;
  locked: boolean;
  /** Owner + admin names, owner first ("Abdul & Aadil"). */
  organizers: string[];
  organizerIds: string[];
  myRole: Role;
  isOrganizer: boolean;
};

/** What every signed-in page needs: the live rules (put in force), lock state, organizers and my role. */
export async function pageContext(me: ParticipantRow): Promise<PageContext> {
  const [live, people] = await Promise.all([loadRules(), db().listParticipants()]);
  const orgs = organizersOf(people);
  const myRole = roleOf(people.find((p) => p.id === me.id) ?? me);
  return {
    rules: live.rules,
    locked: live.locked,
    organizers: orgs.map((o) => o.name),
    organizerIds: orgs.map((o) => o.id),
    myRole,
    isOrganizer: isOrganizerRole(myRole),
  };
}
