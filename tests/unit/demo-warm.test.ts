import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

// A throwaway local store for this file: never the dev database.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "caravan-warm-"));
process.env.CARAVAN_LOCAL_STORE = "1";
process.env.CARAVAN_LOCAL_STORE_FILE = path.join(dir, "db.json");

const { db } = await import("@/lib/server/db");
const { DEMO_SEED, demoById, ensureDemoTrip, isCurrentDemo, resetDemoTrip, warmDemoTrips } = await import("@/lib/server/demo");

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const demo = demoById("sri-lanka")!;
const leftovers = async () => (await db().listTripsBySlugPrefix(`${demo.slug}-`)).map((t) => t.slug);

describe("the demo never makes a visitor wait", () => {
  it("a missing demo is built on the spot (before the first warm-up)", async () => {
    expect(await db().getTripBySlug(demo.slug)).toBeNull();
    expect(await ensureDemoTrip(demo)).toBe(demo.slug);
    const row = (await db().getTripBySlug(demo.slug))!;
    expect(isCurrentDemo(row.rules)).toBe(true);
    expect(await db().getPublishedPlan(row.id)).not.toBeNull();
  }, 30_000);

  it("a rebuild swaps a fresh copy in under the same slug, and leaves nothing behind", async () => {
    const before = (await db().getTripBySlug(demo.slug))!;
    await resetDemoTrip(demo);
    const after = (await db().getTripBySlug(demo.slug))!;
    expect(after.id).not.toBe(before.id);
    expect(await db().getTrip(before.id)).toBeNull();
    expect((await db().listParticipants(after.id)).length).toBe(12);
    expect(await leftovers()).toEqual([]);
  }, 30_000);

  it("a demo from an older seed keeps serving while its rebuild runs after the response", async () => {
    const stale = (await db().getTripBySlug(demo.slug))!;
    await db().updateTrip(stale.id, { rules: { demoSeed: DEMO_SEED - 1 } });
    const tasks: (() => Promise<unknown>)[] = [];
    const t = performance.now();
    expect(await ensureDemoTrip(demo, (task) => tasks.push(task))).toBe(demo.slug);
    expect(performance.now() - t).toBeLessThan(1000);
    // Still the old trip, with its whole crew, while the rebuild is queued.
    expect((await db().getTripBySlug(demo.slug))!.id).toBe(stale.id);
    expect((await db().listParticipants(stale.id)).length).toBe(12);
    expect(tasks).toHaveLength(1);
    // A second visitor meanwhile doesn't start another rebuild.
    await ensureDemoTrip(demo, (task) => tasks.push(task));
    expect(tasks).toHaveLength(1);
    await tasks[0]();
    const fresh = (await db().getTripBySlug(demo.slug))!;
    expect(fresh.id).not.toBe(stale.id);
    expect(isCurrentDemo(fresh.rules)).toBe(true);
    expect(await leftovers()).toEqual([]);
  }, 30_000);

  it("a demo from a newer seed (a newer deploy) is left alone", async () => {
    const row = (await db().getTripBySlug(demo.slug))!;
    await db().updateTrip(row.id, { rules: { demoSeed: DEMO_SEED + 1 } });
    const tasks: (() => Promise<unknown>)[] = [];
    await ensureDemoTrip(demo, (task) => tasks.push(task));
    expect(tasks).toEqual([]);
    expect((await db().getTripBySlug(demo.slug))!.id).toBe(row.id);
  });

  it("the after-deploy warm-up rebuilds only what's missing or stale", async () => {
    const row = (await db().getTripBySlug(demo.slug))!;
    await db().updateTrip(row.id, { rules: { demoSeed: DEMO_SEED } });
    const out = await warmDemoTrips();
    expect(out).toEqual([
      { slug: "demo-sri-lanka", rebuilt: false },
      { slug: "demo-georgia", rebuilt: true },
    ]);
    expect((await db().getTripBySlug(demo.slug))!.id).toBe(row.id);
  }, 30_000);

  it("the warm-up endpoint is protected, and waits for the live deployment to be the expected commit", async () => {
    const { POST } = await import("@/app/api/cron/warm-demos/route");
    const call = (headers: Record<string, string>) => POST(new Request("http://localhost/api/cron/warm-demos", { method: "POST", headers }));
    process.env.CRON_SECRET = "test-secret";
    process.env.VERCEL_GIT_COMMIT_SHA = "abc123";
    try {
      expect((await call({})).status).toBe(401);
      expect((await call({ authorization: "Bearer nope" })).status).toBe(401);
      // An older deployment still serving: nothing is warmed yet.
      const early = await call({ authorization: "Bearer test-secret", "x-expect-commit": "def456" });
      expect(await early.json()).toMatchObject({ live: false, commit: "abc123" });
      const row = (await db().getTripBySlug(demo.slug))!;
      await db().updateTrip(row.id, { rules: { demoSeed: DEMO_SEED - 1 } });
      const res = await call({ authorization: "Bearer test-secret", "x-expect-commit": "abc123" });
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ live: true, seed: DEMO_SEED, demos: [{ slug: "demo-sri-lanka", rebuilt: true }, { slug: "demo-georgia", rebuilt: false }] });
      expect((await db().getTripBySlug(demo.slug))!.id).not.toBe(row.id);
    } finally {
      delete process.env.CRON_SECRET;
      delete process.env.VERCEL_GIT_COMMIT_SHA;
    }
  }, 30_000);
});
