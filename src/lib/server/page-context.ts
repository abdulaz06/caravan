import "server-only";
import { db, isOrganizerRole, roleOf, type ParticipantRow, type Role } from "./db";
import { organizersOf } from "./organizer";
import type { TripContext } from "./trip";

export type PageContext = {
  trip: TripContext;
  locked: boolean;
  /** Owner + admin names, owner first. */
  organizers: string[];
  organizerIds: string[];
  myRole: Role;
  isOrganizer: boolean;
};

/** What every signed-in page needs: the trip (preset + live rules), lock state, organizers and my role. */
export async function pageContext(trip: TripContext, me: ParticipantRow): Promise<PageContext> {
  const people = await db().listParticipants(trip.trip.id);
  const orgs = organizersOf(people);
  const myRole = roleOf(people.find((p) => p.id === me.id) ?? me);
  return {
    trip,
    locked: trip.locked,
    organizers: orgs.map((o) => o.name),
    organizerIds: orgs.map((o) => o.id),
    myRole,
    isOrganizer: isOrganizerRole(myRole),
  };
}
