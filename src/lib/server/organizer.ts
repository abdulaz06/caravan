import "server-only";
import { db, isOrganizerRole, roleOf, type ParticipantRow } from "./db";
import { error } from "./http";
import { organizerGate, type Actor, type Gate } from "./session";

const MESSAGES = {
  signin: "Sign in first",
  confirm_pin: "Confirm your PIN to open the console",
  forbidden: "Organizers only",
} as const;

/** Turn a failed gate into its JSON error (401 sign in / 401 confirm PIN / 403). */
export function gateError(gate: Extract<Gate, { ok: false }>) {
  return error(MESSAGES[gate.code], gate.status, { code: gate.code });
}

/** Run an admin route behind the server-side role check. */
export async function asOrganizer(level: "admin" | "owner", fn: (actor: Actor) => Promise<Response>): Promise<Response> {
  const gate = await organizerGate(level);
  if (!gate.ok) return gateError(gate);
  return fn(gate.actor);
}

/** Record an organizer action (or a peek). Never breaks the request if the log can't be written. */
export async function logAction(
  actor: { id: string | null; name: string },
  action: string,
  target?: { id: string; name: string } | null,
  details?: Record<string, unknown>,
) {
  try {
    await db().addLog({
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
