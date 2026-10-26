import "server-only";
import { db, isOrganizerRole, roleOf, type ParticipantRow, type Role } from "./db";
import { organizersOf } from "./organizer";
import { loadTrip, type TripContext } from "./trip";

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
export async function pageContext(me: ParticipantRow): Promise<PageContext> {
  const [trip, people] = await Promise.all([loadTrip(), db().listParticipants()]);
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
