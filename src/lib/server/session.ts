import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { timingSafeEqual, createHash } from "node:crypto";
import { db, type ParticipantRow } from "./db";

const SESSION_COOKIE = "lanks_session";
const ADMIN_COOKIE = "lanks_admin";
const YEAR = 60 * 60 * 24 * 365;

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    if (process.env.NODE_ENV === "production" && process.env.LANKS_LOCAL_STORE !== "1") {
      throw new Error("SESSION_SECRET is missing or too short (see SETUP.md).");
    }
    return new TextEncoder().encode("lanks-local-development-secret-only");
  }
  return new TextEncoder().encode(s);
}

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production" && process.env.LANKS_LOCAL_STORE !== "1",
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
  (await cookies()).delete(SESSION_COOKIE);
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

/** The signed-in participant, or null (also null if the admin deleted them). */
export async function currentParticipant(): Promise<ParticipantRow | null> {
  const pid = await sessionParticipantId();
  if (!pid) return null;
  return db().getParticipant(pid);
}

// ── Admin ─────────────────────────────────────────────────────────────

function sameSecret(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function checkAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return process.env.NODE_ENV !== "production" && password === "admin";
  return sameSecret(password, expected);
}

export async function startAdminSession() {
  const token = await new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret());
  (await cookies()).set(ADMIN_COOKIE, token, { ...cookieBase, maxAge: 60 * 60 * 12 });
}

export async function endAdminSession() {
  (await cookies()).delete(ADMIN_COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.role === "admin";
  } catch {
    return false;
  }
}
