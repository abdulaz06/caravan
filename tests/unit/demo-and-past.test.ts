import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

// A throwaway local store for this file: never the dev database.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "caravan-demo-"));
process.env.CARAVAN_LOCAL_STORE = "1";
process.env.CARAVAN_LOCAL_STORE_FILE = path.join(dir, "db.json");

const { db } = await import("@/lib/server/db");
const { DEMOS, demoById, resetDemoTrip, resetDemoTrips, seedDemoCrew } = await import("@/lib/server/demo");
const lanka = demoById("sri-lanka")!;
const DEMO_SLUG = lanka.slug;
const { loadPastTrip, pastTrips } = await import("@/lib/server/past-trips");

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("the demo trip", () => {
  it("seeds twelve fictional travellers at every stage", async () => {
    const { slug, people } = await resetDemoTrip(lanka);
    expect(slug).toBe(DEMO_SLUG);
    expect(people).toBe(12);
    const trip = (await db().getTripBySlug(DEMO_SLUG))!;
    expect(trip.kind).toBe("demo");
    const plans = await db().listItineraries(trip.id);
    expect(plans.filter((p) => p.status === "submitted")).toHaveLength(8);
    expect(plans.filter((p) => p.status === "draft")).toHaveLength(3);
    for (const p of plans) expect(p.data.days.length).toBe(6);
  });

  it("has mutual roommate picks and peeks", async () => {
    const trip = (await db().getTripBySlug(DEMO_SLUG))!;
    const people = await db().listParticipants(trip.id);
    const id = (name: string) => people.find((p) => p.display_name === name)!.id;
    const maya = (await db().getItinerary(id("Maya")))!.data.preferences.roommates;
    const priya = (await db().getItinerary(id("Priya")))!.data.preferences.roommates;
    expect(maya?.[0]?.id).toBe(id("Priya"));
    expect(priya?.[0]?.id).toBe(id("Maya"));
    expect(await db().countPeekers(id("Maya"))).toBe(2);
  });

  it("resets cleanly: guests and their plans are gone, nothing doubles up", async () => {
    const before = (await db().getTripBySlug(DEMO_SLUG))!;
    await db().createParticipant(before.id, { name: "Guest Otter 12", pinHash: "x", guest: true });
    await resetDemoTrip(lanka);
    const after = (await db().getTripBySlug(DEMO_SLUG))!;
    expect(after.id).not.toBe(before.id);
    const people = await db().listParticipants(after.id);
    expect(people).toHaveLength(12);
    expect(people.some((p) => p.guest)).toBe(false);
    expect(await db().listParticipants(before.id)).toHaveLength(0);
  });

  it("can join an existing trip, keeping whoever is already there", async () => {
    const trip = (await db().createTrip({ slug: "lanka-own-trip", name: "Sri Lanka '26", preset_id: "sri-lanka" }))!;
    const owner = (await db().createParticipant(trip.id, { name: "maya", pinHash: "x", role: "owner" }))!;
    const { loadPreset } = await import("@/presets/registry");
    const { createEngine } = await import("@/engine/structure");
    const { defaultRules } = await import("@/engine/rules");
    const { preset, catalog } = loadPreset("sri-lanka");
    const ids = await seedDemoCrew(trip.id, lanka, createEngine(catalog, defaultRules(preset)));
    expect(ids.get("Maya")).toBe(owner.id);
    const people = await db().listParticipants(trip.id);
    expect(people).toHaveLength(12);
    expect(people.find((p) => p.id === owner.id)?.role).toBe("owner");
    // The owner's own plan is theirs to make; the other ten with a plan get one.
    expect(await db().getItinerary(owner.id)).toBeNull();
    expect(await db().listItineraries(trip.id)).toHaveLength(10);
    expect(await db().countPeekers(owner.id)).toBe(2);
  });
});

describe("every destination's demo", () => {
  it("builds one per preset, each plan the length of its trip", async () => {
    const out = await resetDemoTrips();
    expect(out.map((d) => d.slug)).toEqual(DEMOS.map((d) => d.slug));
    const georgia = (await db().getTripBySlug("demo-georgia"))!;
    expect(georgia.preset_id).toBe("georgia");
    const plans = await db().listItineraries(georgia.id);
    expect(plans).toHaveLength(11);
    for (const p of plans) expect(p.data.days.length).toBe(9);
    // Georgia's answers use Georgia's own choices.
    const prefs = plans.map((p) => p.data.preferences);
    expect(prefs.some((p) => p.interests?.includes("skiing"))).toBe(true);
  });
});

describe("past trips", () => {
  it("keeps every pick of the Georgia trip on its real dates", () => {
    const t = loadPastTrip("georgia-2025")!;
    const json = JSON.parse(fs.readFileSync(path.join(process.cwd(), "content/past-trips/georgia-2025.json"), "utf8"));
    expect(t.data.startDate).toBe("2025-12-25");
    expect(t.data.endDate).toBe("2026-01-02");
    expect(t.data.days).toHaveLength(9);
    json.days.forEach((d: { day: string[]; night: string[] }, i: number) => {
      expect(t.data.days[i].day.map((x) => x.id)).toEqual(d.day);
      expect(t.data.days[i].night.map((x) => x.id)).toEqual(d.night);
    });
    // New Year's Eve lands on 31 December, day 6.
    expect(t.data.days[6].night.map((x) => x.id)).toContain("nye-liberty-square");
  });

  it("has a photo on every slide and a teaser", () => {
    const [t] = pastTrips();
    expect(t.slides.every((s) => s.photo)).toBe(true);
    expect(t.teaser?.title).toBe("Japan?");
    expect(t.cover).not.toBeNull();
  });
});
