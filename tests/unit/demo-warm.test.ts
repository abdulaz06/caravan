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

  it("the post-build warm-up rebuilds only what's missing or stale", async () => {
    const row = (await db().getTripBySlug(demo.slug))!;
    await db().updateTrip(row.id, { rules: { demoSeed: DEMO_SEED } });
    const out = await warmDemoTrips();
    expect(out).toEqual([
      { slug: "demo-sri-lanka", rebuilt: false },
      { slug: "demo-georgia", rebuilt: true },
    ]);
    expect((await db().getTripBySlug(demo.slug))!.id).toBe(row.id);
  }, 30_000);
});
