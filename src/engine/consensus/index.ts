// The consensus itinerary generator: from everyone's plans to one suggested
// group trip. Pure engine code — the server adapter (src/lib/server/plan.ts)
// loads the ballots and stores versions. See docs/CONSENSUS.md.
export * from "./types";
export * from "./dates";
export { generatePlan, isBigTrip, isMeal, itemKey, modeParams, slotKey } from "./generate";
export { compareModes, protectEffect, type ModeSummary } from "./compare";
