import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { timingSafeEqual, createHash } from "node:crypto";
import { db, isOrganizerRole, roleOf, type ParticipantRow, type Role } from "./db";

const SESSION_COOKIE = "caravan_session";
/** The organizer console: a short session on top of the normal one (or the owner's break-glass password). */
const CONSOLE_COOKIE = "caravan_console";
const YEAR = 60 * 60 * 24 * 365;
const CONSOLE_HOURS = 12;

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

export async function startSession(participantId: string) {
  const token = await new SignJWT({ pid: participantId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("365d")
    .sign(secret());
  (await cookies()).set(SESSION_COOKIE, token, { ...cookieBase, maxAge: YEAR });
}

export async function endSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(CONSOLE_COOKIE);
}

async function sessionParticipantId(): Promise<string | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.pid === "string" ? payload.pid : null;
  } catch {
    return null;
  }
}

/** The signed-in participant, or null (also null if an organizer deleted them). */
export async function currentParticipant(): Promise<ParticipantRow | null> {
  const pid = await sessionParticipantId();
  if (!pid) return null;
  return db().getParticipant(pid);
}

// ── Organizer console ─────────────────────────────────────────────────

function sameSecret(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** The owner's break-glass password (ADMIN_PASSWORD). */
export function checkAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return process.env.NODE_ENV !== "production" && password === "admin";
  return sameSecret(password, expected);
}

/** After an organizer re-confirms their PIN (pid), or the break-glass password (pid null = owner level). */
export async function startConsoleSession(pid: string | null) {
  const token = await new SignJWT(pid ? { pid } : { bg: true })
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
 * Who is using the console right now, or null. The role is re-read from the
 * database on every request (a demoted admin loses access at once), and a PIN
 * console session must belong to the person who is signed in.
 */
export async function consoleActor(): Promise<Actor | null> {
  const token = (await cookies()).get(CONSOLE_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.bg === true) return { id: null, name: "Organizer (password)", role: "owner", breakGlass: true };
    if (typeof payload.pid !== "string") return null;
    if ((await sessionParticipantId()) !== payload.pid) return null;
    const p = await db().getParticipant(payload.pid);
    const role = roleOf(p);
    if (!p || !isOrganizerRole(role)) return null;
    return { id: p.id, name: p.display_name, role, breakGlass: false };
  } catch {
    return null;
  }
}

export type Gate = { ok: true; actor: Actor } | { ok: false; status: 401 | 403; code: "signin" | "confirm_pin" | "forbidden" };

/**
 * Server-side role check for every /api/admin/* route. Members get 403;
 * organizers who haven't re-confirmed their PIN get 401 "confirm_pin".
 */
export async function organizerGate(level: "admin" | "owner" = "admin"): Promise<Gate> {
  const actor = await consoleActor();
  if (actor) {
    if (level === "owner" && actor.role !== "owner") return { ok: false, status: 403, code: "forbidden" };
    return { ok: true, actor };
  }
  const me = await currentParticipant();
  if (!me) return { ok: false, status: 401, code: "signin" };
  return isOrganizerRole(roleOf(me)) ? { ok: false, status: 401, code: "confirm_pin" } : { ok: false, status: 403, code: "forbidden" };
}
