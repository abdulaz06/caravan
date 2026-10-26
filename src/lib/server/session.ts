import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { timingSafeEqual, createHash } from "node:crypto";
import { db, isOrganizerRole, roleOf, type ParticipantRow, type Role, type TripRow } from "./db";

/** One device can be in several trips: the cookie maps trip id → participant id. */
const SESSION_COOKIE = "caravan_session";
/** The organizer console: a short session on top of the normal one (or the break-glass password). */
const CONSOLE_COOKIE = "caravan_console";
const YEAR = 60 * 60 * 24 * 365;
const CONSOLE_HOURS = 12;
/** Trips remembered per device (oldest dropped first). */
const MAX_TRIPS = 20;

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    if (process.env.NODE_ENV === "production" && process.env.CARAVAN_LOCAL_STORE !== "1") {
      throw new Error("SESSION_SECRET is missing or too short (see SETUP.md).");
    }
    return new TextEncoder().encode("caravan-local-development-secret-only");
  }
  return new TextEncoder().encode(s);
}

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production" && process.env.CARAVAN_LOCAL_STORE !== "1",
  path: "/",
};

/** Trip id → participant id, from the signed session cookie. */
async function sessionTrips(): Promise<Record<string, string>> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return {};
  try {
    const { payload } = await jwtVerify(token, secret());
    const trips = payload.trips;
    if (!trips || typeof trips !== "object") return {};
    return Object.fromEntries(Object.entries(trips as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === "string"));
  } catch {
    return {};
  }
}

async function writeSession(trips: Record<string, string>) {
  const jar = await cookies();
  if (!Object.keys(trips).length) {
    jar.delete(SESSION_COOKIE);
    return;
  }
  const token = await new SignJWT({ trips }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("365d").sign(secret());
  jar.set(SESSION_COOKIE, token, { ...cookieBase, maxAge: YEAR });
}

/** Remember that this device is `participantId` on this trip. */
export async function startSession(tripId: string, participantId: string) {
  const trips = await sessionTrips();
  delete trips[tripId];
  trips[tripId] = participantId; // most recent last
  const keep = Object.entries(trips).slice(-MAX_TRIPS);
  await writeSession(Object.fromEntries(keep));
}

/** Sign out of one trip (and close its console). */
export async function endSession(tripId: string) {
  const trips = await sessionTrips();
  delete trips[tripId];
  await writeSession(trips);
  (await cookies()).delete(CONSOLE_COOKIE);
}

async function sessionParticipantId(tripId: string): Promise<string | null> {
  return (await sessionTrips())[tripId] ?? null;
}

/** The signed-in participant on this trip, or null (also null if an organizer deleted them). */
export async function currentParticipant(trip: Pick<TripRow, "id">): Promise<ParticipantRow | null> {
  const pid = await sessionParticipantId(trip.id);
  if (!pid) return null;
  const p = await db().getParticipant(pid);
  return p && p.trip_id === trip.id ? p : null;
}

/** Every trip this device is signed in to (for the landing page's "your trips"). */
export async function myTripIds(): Promise<string[]> {
  return Object.keys(await sessionTrips()).reverse();
}

// ── Organizer console ─────────────────────────────────────────────────

function sameSecret(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** The deployment owner's break-glass password (ADMIN_PASSWORD): owner-level on any trip. */
export function checkAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return process.env.NODE_ENV !== "production" && password === "admin";
  return sameSecret(password, expected);
}

/** After an organizer re-confirms their PIN (pid on a trip), or the break-glass password (pid null). */
export async function startConsoleSession(tripId: string, pid: string | null) {
  const token = await new SignJWT(pid ? { pid, trip: tripId } : { bg: true, trip: tripId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${CONSOLE_HOURS}h`)
    .sign(secret());
  (await cookies()).set(CONSOLE_COOKIE, token, { ...cookieBase, maxAge: 60 * 60 * CONSOLE_HOURS });
}

export async function endConsoleSession() {
  (await cookies()).delete(CONSOLE_COOKIE);
}

export type Actor = { id: string | null; name: string; role: Role; breakGlass: boolean };

/**
 * Who is using this trip's console right now, or null. The role is re-read
 * from the database on every request (a demoted admin loses access at once),
 * and a PIN console session must belong to the person signed in to this trip.
 */
export async function consoleActor(trip: Pick<TripRow, "id">): Promise<Actor | null> {
  const token = (await cookies()).get(CONSOLE_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.trip !== trip.id) return null;
    if (payload.bg === true) return { id: null, name: "Organizer (password)", role: "owner", breakGlass: true };
    if (typeof payload.pid !== "string") return null;
    if ((await sessionParticipantId(trip.id)) !== payload.pid) return null;
    const p = await db().getParticipant(payload.pid);
    const role = roleOf(p);
    if (!p || p.trip_id !== trip.id || !isOrganizerRole(role)) return null;
    return { id: p.id, name: p.display_name, role, breakGlass: false };
  } catch {
    return null;
  }
}

export type Gate = { ok: true; actor: Actor } | { ok: false; status: 401 | 403; code: "signin" | "confirm_pin" | "forbidden" };

/**
 * Server-side role check for every organizer endpoint. Members get 403;
 * organizers who haven't re-confirmed their PIN get 401 "confirm_pin".
 */
export async function organizerGate(trip: Pick<TripRow, "id">, level: "admin" | "owner" = "admin"): Promise<Gate> {
  const actor = await consoleActor(trip);
  if (actor) {
    if (level === "owner" && actor.role !== "owner") return { ok: false, status: 403, code: "forbidden" };
    return { ok: true, actor };
  }
  const me = await currentParticipant(trip);
  if (!me) return { ok: false, status: 401, code: "signin" };
  return isOrganizerRole(roleOf(me)) ? { ok: false, status: 401, code: "confirm_pin" } : { ok: false, status: 403, code: "forbidden" };
}
