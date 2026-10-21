import "server-only";
import { roleOf, type ParticipantRow } from "./db";
import type { Actor } from "./session";

export type Power = "delete" | "reset_pin" | "set_role" | "edit_plan" | "view_plan";

/**
 * Who may do what to whom. Nobody can demote or delete the owner; anything
 * that could take over an organizer account (deleting an admin, resetting an
 * admin's or the owner's PIN, changing roles) is owner-only. Admins get every
 * other control.
 */
export function allowed(actor: Actor, target: ParticipantRow, power: Power): { ok: true } | { ok: false; reason: string } {
  const role = roleOf(target);
  const owner = actor.role === "owner";
  if (power === "view_plan" || power === "edit_plan") return { ok: true };
  if (power === "set_role") {
    if (role === "owner") return { ok: false, reason: "Nobody can change the owner's role" };
    return owner ? { ok: true } : { ok: false, reason: "Only the owner can make or remove admins" };
  }
  if (power === "delete") {
    if (role === "owner") return { ok: false, reason: "Nobody can delete the owner" };
    if (role === "admin" && !owner) return { ok: false, reason: "Only the owner can remove an admin" };
    return { ok: true };
  }
  // reset_pin
  if (role !== "member" && !owner) return { ok: false, reason: "Only the owner can reset an organizer's PIN" };
  return { ok: true };
}
