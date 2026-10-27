import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";

// Anyone can start a trip, so creation is rate limited per visitor (by a
// salted hash of their IP; the IP itself is never stored) and overall, to
// keep a public deployment on a free database tier.
export const LIMITS = {
  perVisitorPerHour: 3,
  perVisitorPerDay: 10,
  allPerDay: 300,
} as const;

/** The visitor's IP as the platform reports it (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || req.headers.get("x-real-ip")?.trim() || "local";
}

export function creatorHash(ip: string): string {
  const salt = process.env.SESSION_SECRET ?? "caravan";
  return createHash("sha256").update(`${salt}:trip-creator:${ip}`).digest("hex").slice(0, 32);
}

/** Null when this visitor may create a trip now, otherwise why not. */
export async function creationBlocked(hash: string, now = Date.now()): Promise<string | null> {
  const hourAgo = new Date(now - 3600_000).toISOString();
  const dayAgo = new Date(now - 86400_000).toISOString();
  const store = db();
  const [hour, day, all] = await Promise.all([
    store.countTripsCreated(hash, hourAgo),
    store.countTripsCreated(hash, dayAgo),
    store.countTripsCreated(null, dayAgo),
  ]);
  if (hour >= LIMITS.perVisitorPerHour || day >= LIMITS.perVisitorPerDay) {
    return "You've started a few trips already — try again a bit later.";
  }
  if (all >= LIMITS.allPerDay) return "Lots of trips are being started today — try again tomorrow.";
  return null;
}

/** "Sri Lanka '26 🌴" → "sri-lanka-26-k3f9": readable, with a random tail so links can't be guessed. */
export function makeSlug(name: string, fallback: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  const tail = randomBytes(4).readUInt32BE(0).toString(36).padStart(6, "0").slice(-6);
  return `${base.length >= 3 ? base : fallback}-${tail}`;
}
