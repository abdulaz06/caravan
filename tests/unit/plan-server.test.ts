import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

// A throwaway local store for this file: never the dev database.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "caravan-plan-"));
process.env.CARAVAN_LOCAL_STORE = "1";
process.env.CARAVAN_LOCAL_STORE_FILE = path.join(dir, "db.json");

const { db } = await import("@/lib/server/db");
const { demoById, resetDemoTrip } = await import("@/lib/server/demo");
const { tripContext } = await import("@/lib/server/trip");
const { loadPublicPlan, organizerPlanState, ballotsOf, generateFor } = await import("@/lib/server/plan");

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("the group plan on the server", () => {
  it("each demo trip is seeded with a published plan and the crew's RSVPs", async () => {
    await resetDemoTrip(demoById("sri-lanka")!);
    const row = (await db().getTripBySlug("demo-sri-lanka"))!;
    const published = (await db().getPublishedPlan(row.id))!;
    expect(published.version).toBe(1);
    expect(published.data.settings.mode).toBe("together");
    const rsvps = await db().listRsvps(row.id);
    expect(rsvps.length).toBeGreaterThan(40);
    expect(new Set(rsvps.map((r) => r.status))).toEqual(new Set(["in", "skip"]));
  });

  it("travellers see counts, never who: no names anywhere in their view", async () => {
    const row = (await db().getTripBySlug("demo-sri-lanka"))!;
    const trip = tripContext(row)!;
    const people = await db().listParticipants(row.id);
    const sofia = people.find((p) => p.display_name === "Sofia")!;
    const view = (await loadPublicPlan(trip, sofia))!;
    const text = JSON.stringify(view);
    for (const p of people) if (p.id !== sofia.id) expect(text).not.toContain(`"${p.display_name}"`);
    expect(text).not.toMatch(/pickedBy|floorFor|aBy|bBy|"names"/);
    expect(view.you?.picks).toBeGreaterThan(0);
    expect(view.you?.name).toBe("");
    expect(view.decided).toMatch(/^Planned with: Everyone gets a say\. Whoever would have got the smallest share of their picks was lifted first.* Everyone got at least \d+% of the picks that fit their dates\.$/);
    expect(view.fairness).toEqual({ min: expect.any(Number), median: expect.any(Number) });
    expect(view.you?.feasible).toBeGreaterThan(0);
    const key = Object.keys(view.rsvps)[0];
    expect(view.rsvps[key].in + view.rsvps[key].skip).toBeGreaterThan(0);
  });

  it("a plan published before shares existed still shows (the plain line, no share)", async () => {
    const row = (await db().getTripBySlug("demo-sri-lanka"))!;
    const plan = (await db().getPublishedPlan(row.id))!;
    // The shape plan versions had before: a count-based floor, no per-person "feasible".
    const old = structuredClone(plan.data) as unknown as Record<string, unknown> & { people: Record<string, unknown>[]; fairness: Record<string, unknown> };
    for (const p of old.people) delete p.feasible;
    old.fairness = { min: 0.3, median: 0.5, mean: 0.5, index: 0.9, floor: 2, floorMet: 10, floorOf: 10 };
    const { decidedLine } = await import("@/lib/server/plan");
    expect(decidedLine(old as never)).toBe(
      "Planned with: Everyone gets a say. Whoever would have got the smallest share of their picks was lifted first, then the rest went to the most popular.",
    );
  });

  it("organizers see names on RSVPs; demo guests and test users never count", async () => {
    const row = (await db().getTripBySlug("demo-sri-lanka"))!;
    const trip = tripContext(row)!;
    const plan = (await db().getPublishedPlan(row.id))!;
    const key = plan.data.slots.flatMap((s) => s.items).find((i) => i.id !== "stay")!.key;
    const guest = (await db().createParticipant(row.id, { name: "Guest Otter 7", pinHash: "x", guest: true }))!;
    const tester = (await db().createParticipant(row.id, { name: "zz-test-ana", pinHash: "x" }))!;
    const before = (await loadPublicPlan(trip, null))!.rsvps[key];
    await db().setRsvp({ trip_id: row.id, item_key: key, participant_id: guest.id, status: "in", choice: null });
    await db().setRsvp({ trip_id: row.id, item_key: key, participant_id: tester.id, status: "in", choice: null });
    const after = (await loadPublicPlan(trip, null))!.rsvps[key];
    expect(after.in).toBe(before.in);
    // …except to themselves.
    expect((await loadPublicPlan(trip, guest))!.rsvps[key].in).toBe(before.in + 1);
    const maya = (await db().listParticipants(row.id)).find((p) => p.display_name === "Maya")!;
    expect((await loadPublicPlan(trip, maya))!.rsvps[key].names?.in.length).toBe(before.in);
    const state = await organizerPlanState(trip);
    expect(state.versions[0]).toMatchObject({ version: 1, mode: "together" });
    expect(state.rsvps[key].names).toBeDefined();
  });

  it("guests and test users never vote, and saved versions number up with the latest published shown", async () => {
    const row = (await db().getTripBySlug("demo-sri-lanka"))!;
    const trip = tripContext(row)!;
    const ballots = await ballotsOf(trip);
    expect(ballots.map((b) => b.name)).not.toContain("Guest Otter 7");
    expect(ballots.map((b) => b.name)).not.toContain("zz-test-ana");
    const plan = generateFor(trip, ballots, { mode: "majority" });
    const v2 = await db().savePlanVersion({ trip_id: row.id, data: plan, settings: plan.settings, created_by: null, created_by_name: "Theo", published_at: null });
    expect(v2.version).toBe(2);
    expect((await loadPublicPlan(trip, null))!.version).toBe(1);
    await db().publishPlanVersion(row.id, v2.id, new Date(Date.now() + 1000).toISOString());
    const view = (await loadPublicPlan(trip, null))!;
    expect(view.version).toBe(2);
    expect(view.changes?.from).toBe(1);
    expect(view.decided).toMatch(/Majority rules/);
  });
});
