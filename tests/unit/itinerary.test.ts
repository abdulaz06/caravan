import { describe, expect, it } from "vitest";
import { computeBudget } from "@/engine/budget";
import { shownText } from "@/engine/catalog";
import { familyView } from "@/engine/family";
import { bannedIn } from "@/engine/family-words";
import {
  STAY_ID,
  canMoveItem,
  countItems,
  isSpecialSlot,
  makeItem,
  moveItem,
  normalize,
  reorderDays,
  restructure,
  setStart,
  type ItineraryData,
} from "@/engine/itinerary";
import { quickFill } from "@/engine/quickfill";
import { createEngine } from "@/engine/structure";
import { buildTimeline } from "@/engine/timeline";
import { mini, placed, seeded, sriLanka } from "./helpers";

const ids = (d: ItineraryData, i: number, slot: "day" | "night") => d.days[i][slot].map((x) => x.id);
const put = (e: ReturnType<typeof mini>, d: ItineraryData, i: number, slot: "day" | "night", ...picks: string[]) => {
  d.days[i][slot].push(...picks.map((id) => makeItem(e, id)));
  return d;
};

describe("normalize", () => {
  it("drops picks that don't belong in a slot's pool", () => {
    const e = mini();
    const d = put(e, placed(e, "2026-12-01"), 2, "day", "b-day-1", "road-1", "a-day-1");
    expect(ids(normalize(e, d), 2, "day")).toEqual(["b-day-1"]);
  });

  it("lets any pool's option in when base-area filtering is off", () => {
    const e = mini({ baseFiltering: false });
    const d = put(e, placed(e, "2026-12-01"), 2, "day", "b-day-1", "road-1");
    expect(ids(normalize(e, d), 2, "day")).toEqual(["b-day-1", "road-1"]);
  });

  it("keeps special-date options to their date's slot, first in line", () => {
    const e = mini();
    // Starting 29 Dec, 31 Dec is Day 3 (index 2) in Beta.
    const d = placed(e, "2026-12-29");
    expect(isSpecialSlot(e, d, 2, "night")?.id).toBe("nye");
    put(e, d, 2, "night", "b-night-1", "nye-b-1");
    put(e, d, 4, "night", "nye-c-1");
    const n = normalize(e, d);
    expect(ids(n, 2, "night")).toEqual(["nye-b-1", "b-night-1"]);
    expect(ids(n, 4, "night")).toEqual([]);
  });

  it("only allows big day trips on a base's ordinary days, and their extras alongside them", () => {
    const e = mini();
    const d = placed(e, "2026-12-01");
    put(e, d, 3, "day", "c-trip"); // transfer day into Gamma
    put(e, d, 4, "day", "c-trip", "x-with-trip");
    put(e, d, 4, "night", "x-anywhere");
    const n = normalize(e, d);
    expect(ids(n, 3, "day")).toEqual([]);
    expect(ids(n, 4, "day")).toEqual(["c-trip", "x-with-trip"]);
    expect(n.days[4].day[0].variant).toBe("early"); // a variant pick defaults to the first
    const without = put(e, placed(e, "2026-12-01"), 4, "day", "x-with-trip");
    expect(ids(normalize(e, without), 4, "day")).toEqual([]);
  });

  it("keeps nothing on the fly-home day and fixes the length", () => {
    const e = mini();
    const d = put(e, placed(e, "2026-12-01"), 5, "night", STAY_ID);
    d.days.push({ id: "extra", day: [], night: [] });
    const n = normalize(e, d);
    expect(n.days).toHaveLength(6);
    expect(n.endDate).toBe("2026-12-06");
    expect(countItems(n)).toBe(0);
  });
});

describe("editing", () => {
  it("moving the window keeps picks on their trip day, but special picks follow their date", () => {
    const e = mini();
    const d = put(e, placed(e, "2026-12-29"), 2, "night", "nye-b-1", "b-night-1");
    const moved = setStart(e, d, "2026-12-30");
    // 31 Dec is now Day 2 (the road into Beta, whose evening is in Beta).
    expect(ids(moved, 1, "night")).toEqual(["nye-b-1"]);
    expect(ids(moved, 2, "night")).toEqual(["b-night-1"]);
  });

  it("reordering days moves their contents but leaves the special evening on its date", () => {
    const e = sriLanka();
    const d = placed(e, "2026-12-28"); // 31 Dec = index 3, a Galle day
    d.days[3].day.push(makeItem(e, "galle-fort"));
    d.days[3].night.push(makeItem(e, "nye-galle-fort"));
    d.days[2].day.push(makeItem(e, "rumassala-hike"));
    const r = reorderDays(e, normalize(e, d), 3, 2);
    expect(ids(r, 2, "day")).toEqual(["galle-fort"]);
    expect(ids(r, 3, "day")).toEqual(["rumassala-hike"]);
    expect(ids(r, 3, "night")).toEqual(["nye-galle-fort"]);
  });

  it("moves single picks only within a movable pool", () => {
    const e = sriLanka();
    const d = normalize(e, put(e as never, placed(e, "2026-12-01"), 2, "night", "galle-fort-sunset-dinner"));
    expect(canMoveItem(e, d, "night", 2, 4, "galle-fort-sunset-dinner")).toBe(true);
    expect(canMoveItem(e, d, "night", 2, 1, "galle-fort-sunset-dinner")).toBe(true); // the road day's evening is in Galle
    expect(canMoveItem(e, d, "night", 2, 0, "galle-fort-sunset-dinner")).toBe(false); // Colombo
    expect(canMoveItem(e, d, "night", 2, 5, "galle-fort-sunset-dinner")).toBe(false); // fly-home day
    const m = moveItem(e, d, "night", 2, d.days[2].night[0].key, 4);
    expect(ids(m, 4, "night")).toEqual(["galle-fort-sunset-dinner"]);
    expect(ids(m, 2, "night")).toEqual([]);
  });

  it("carries a day trip's extras along when it moves", () => {
    const e = mini();
    const d = normalize(e, put(e, placed(e, "2026-12-01"), 4, "day", "c-trip", "x-with-trip"));
    // Gamma has one ordinary day here; give it two by changing the rules.
    const e2 = mini({ nights: { alpha: 1, beta: 2, gamma: 3 } });
    const d2 = restructure(d, e, e2).data;
    const key = d2.days[4].day[0].key;
    const m = moveItem(e2, d2, "day", 4, key, 5);
    expect(ids(m, 5, "day")).toEqual(["c-trip", "x-with-trip"]);
  });
});

describe("restructure (organizers change the nights)", () => {
  it("keeps each base's picks on that base's days, in order", () => {
    const from = sriLanka();
    const to = createEngine(from.catalog, { ...from.rules, nights: { colombo: 2, galle: 3 } });
    const d = placed(from, "2026-12-03");
    d.days[0].day.push(makeItem(from, "colombo-tuk-tuk"));
    d.days[1].day.push(makeItem(from, "bentota-water-sports"));
    d.days[2].day.push(makeItem(from, "galle-fort"));
    d.days[4].day.push(makeItem(from, "rumassala-hike"));
    const r = restructure(normalize(from, d), from, to);
    expect(r.data.days).toHaveLength(6);
    expect(ids(r.data, 0, "day")).toEqual(["colombo-tuk-tuk"]); // still the arrival day
    expect(ids(r.data, 2, "day")).toEqual(["bentota-water-sports"]); // the road trip moved a day later
    expect(ids(r.data, 3, "day")).toEqual(["galle-fort"]);
    expect(r.lost).toBe(1); // the last Galle day had no home
    expect(r.changed).toBe(true);
  });
});

describe("quick fill", () => {
  for (const [name, make] of [["Sri Lanka", sriLanka], ["three bases", mini]] as const) {
    it(`fills every slot with valid picks — ${name}`, () => {
      const e = make();
      const d = quickFill(e, placed(e, "2026-12-27"), { rng: seeded() });
      const slots = d.days.slice(0, -1).flatMap((x) => [x.day.length, x.night.length]);
      expect(slots.every((c) => c >= 1)).toBe(true);
      expect(countItems(normalize(e, d))).toBe(countItems(d));
    });
  }
});

describe("timeline & budget", () => {
  it("adds the fixed legs and a scenic road when stops are picked", () => {
    const e = mini();
    const d = normalize(e, put(e, placed(e, "2026-12-01"), 1, "day", "road-2", "road-1"));
    const t = buildTimeline(e, d);
    expect(t.days[0].legsBefore[0].title).toBe("Port → Alpha");
    expect(t.days[1].legsBefore[0].title).toBe("Alpha → Beta the long way");
    expect(t.days[1].legsBefore[0].stops?.map((s) => s.region)).toEqual(["stopx", "stopy"]);
    expect(t.days[3].legsBefore[0].title).toBe("Beta → Gamma");
    expect(t.days[5].legsBefore[0].title).toBe("Gamma → Port");
  });

  it("prices legs per person and stays per base", () => {
    const e = mini();
    const b = computeBudget(e, placed(e, "2026-12-01"));
    const lines = b.groups.flatMap((g) => g.lines);
    const arrival = lines.find((l) => l.id === "leg:arrival")!;
    expect(arrival.range).toEqual([(20 * 2) / 10, (30 * 2) / 10]);
    expect(lines.filter((l) => l.kind === "stay").map((l) => l.label)).toEqual(["Alpha · 1 night", "Beta · 2 nights", "Gamma · 2 nights"]);
  });
});

describe("family-friendly mode", () => {
  it("swaps nightlife for its stand-in and shows no drinks or nightlife words", () => {
    const e = sriLanka();
    const d = placed(e, "2026-12-03");
    const nightlife = e.catalog.activities.filter((a) => e.catalog.isNightlife(a) && a.slots.includes("night") && a.areas.includes("galle"));
    nightlife.slice(0, 4).forEach((a, i) => d.days[2 + (i % 3)].night.push(makeItem(e, a.id)));
    const view = familyView(e, normalize(e, d));
    const shown = view.days.flatMap((x) => [...x.day, ...x.night]).map((x) => e.catalog.byId[x.id]);
    expect(shown.every((a) => a && !e.catalog.isNightlife(a))).toBe(true);
    expect(shown.flatMap((a) => shownText(a!)).flatMap(bannedIn)).toEqual([]);
  });
});
