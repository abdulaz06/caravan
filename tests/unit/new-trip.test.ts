import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// A throwaway local store for this file: never the dev database.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "caravan-test-"));
process.env.CARAVAN_LOCAL_STORE = "1";
process.env.CARAVAN_LOCAL_STORE_FILE = path.join(dir, "db.json");

const { db } = await import("@/lib/server/db");
const { LIMITS, clientIp, creationBlocked, creatorHash, makeSlug } = await import("@/lib/server/new-trip");

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("makeSlug", () => {
  it("is readable, URL-safe and ends in a random tail", () => {
    const slug = makeSlug("Sri Lanka '26 🌴", "sri-lanka");
    expect(slug).toMatch(/^sri-lanka-26-[a-z0-9]{6}$/);
    expect(makeSlug("Sri Lanka '26 🌴", "sri-lanka")).not.toBe(slug);
  });

  it("drops accents and falls back to the preset id for names without letters", () => {
    expect(makeSlug("Tbilisi — Gergeti & Kazbegi", "georgia")).toMatch(/^tbilisi-gergeti-kazbegi-[a-z0-9]{6}$/);
    expect(makeSlug("Café Crème", "x")).toMatch(/^cafe-creme-/);
    expect(makeSlug("🌴🌴", "sri-lanka")).toMatch(/^sri-lanka-[a-z0-9]{6}$/);
  });

  it("always matches the trip slug format", () => {
    for (const name of ["a", "A very long trip name that keeps going and going and going", "--x--", "日本"]) {
      expect(makeSlug(name, "sri-lanka")).toMatch(/^[a-z0-9][a-z0-9-]{2,63}$/);
    }
  });
});

describe("creator hashes", () => {
  it("never contain the IP and are stable per IP", () => {
    const h = creatorHash("203.0.113.7");
    expect(h).not.toContain("203.0.113.7");
    expect(h).toHaveLength(32);
    expect(creatorHash("203.0.113.7")).toBe(h);
    expect(creatorHash("203.0.113.8")).not.toBe(h);
  });

  it("read the first forwarded address", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "198.51.100.1, 10.0.0.1" } });
    expect(clientIp(req)).toBe("198.51.100.1");
    expect(clientIp(new Request("http://x"))).toBe("local");
  });
});

describe("trip creation limits", () => {
  beforeAll(async () => {
    for (let i = 0; i < LIMITS.perVisitorPerHour; i++) {
      await db().createTrip({ slug: `limit-test-${i}`, name: "Limit test", preset_id: "sri-lanka", creator_hash: creatorHash("192.0.2.1") });
    }
  });

  it("stops a visitor after the hourly limit, but not anyone else", async () => {
    expect(await creationBlocked(creatorHash("192.0.2.1"))).toMatch(/try again/);
    expect(await creationBlocked(creatorHash("192.0.2.2"))).toBeNull();
  });

  it("lets the visitor in again once the hour has passed", async () => {
    expect(await creationBlocked(creatorHash("192.0.2.1"), Date.now() + 2 * 3600_000)).toBeNull();
  });
});
