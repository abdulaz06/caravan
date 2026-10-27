import "server-only";
import { db, isOrganizerRole, roleOf, type ParticipantRow } from "./db";
import { error } from "./http";
import { organizerGate, type Actor, type Gate } from "./session";
import type { TripContext } from "./trip";

const MESSAGES = {
  signin: "Sign in first",
  confirm_pin: "Confirm your PIN to open the console",
  forbidden: "Organizers only",
} as const;

/** Turn a failed gate into its JSON error (401 sign in / 401 confirm PIN / 403). */
export function gateError(gate: Extract<Gate, { ok: false }>) {
  return error(MESSAGES[gate.code], gate.status, { code: gate.code });
}

/** Who's looking at the demo trip's (read-only) console. */
export const DEMO_ACTOR: Actor = { id: null, name: "Demo visitor", role: "owner", breakGlass: false };

/**
 * Run an organizer route behind the server-side role check for this trip.
 * Demo trips refuse every write; `readOnly` routes (exports) run for anyone there.
 */
export async function asOrganizer(
  trip: TripContext,
  level: "admin" | "owner",
  fn: (actor: Actor) => Promise<Response>,
  opts: { readOnly?: boolean } = {},
): Promise<Response> {
  if (trip.trip.kind === "demo") return opts.readOnly ? fn(DEMO_ACTOR) : error("The demo's console is read-only", 403, { code: "demo" });
  const gate = await organizerGate(trip.trip, level);
  if (!gate.ok) return gateError(gate);
  return fn(gate.actor);
}

/** Record an organizer action (or a peek). Never breaks the request if the log can't be written. */
export async function logAction(
  tripId: string,
  actor: { id: string | null; name: string },
  action: string,
  target?: { id: string; name: string } | null,
  details?: Record<string, unknown>,
) {
  try {
    await db().addLog({
      trip_id: tripId,
      actor_id: actor.id,
      actor_name: actor.name,
      action,
      target_id: target?.id ?? null,
      target_name: target?.name ?? null,
      details: details ?? null,
    });
  } catch (e) {
    console.error("activity log write failed", e);
  }
}

/** Owner first, then admins, in join order — for badges and the privacy line. */
export function organizersOf(people: ParticipantRow[]): { id: string; name: string; role: "owner" | "admin" }[] {
  return people
    .filter((p) => isOrganizerRole(roleOf(p)))
    .sort((a, b) => (roleOf(a) === "owner" ? -1 : roleOf(b) === "owner" ? 1 : a.created_at.localeCompare(b.created_at)))
    .map((p) => ({ id: p.id, name: p.display_name, role: roleOf(p) as "owner" | "admin" }));
}
