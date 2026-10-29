// The consensus generator's inputs and outputs. Everything here is plain
// data (JSON-safe), so a generated plan can be stored as-is in a plan version
// and sent to the browser. See docs/CONSENSUS.md.
import type { Slot } from "../catalog";
import type { ItineraryData } from "../itinerary";
import type { LengthOption, WindowScore } from "./dates";

/** How the group decides. There's no default: an organizer picks one the first time they generate. */
export type DecisionMode = "together" | "majority" | "custom";

export const MODE_COPY: Record<DecisionMode, { label: string; short: string; line: string; how: string }> = {
  together: {
    label: "Everyone gets a say",
    short: "Fair first",
    line: "Whoever would have got the smallest share of their picks was lifted first, then the rest went to the most popular.",
    how: "Lifts whoever would get the smallest share of their picks — then the next lowest — giving up a little of the plan's popularity to do it. Then the rest goes to whatever's most popular.",
  },
  majority: {
    label: "Majority rules",
    short: "Most picked",
    line: "The most-picked option won every slot.",
    how: "The most-picked option wins every slot. Simple and popular — but someone with unusual taste might get very little.",
  },
  custom: {
    label: "Custom",
    short: "Your balance",
    line: "The organizers balanced the most popular picks against lifting whoever got the smallest share of theirs.",
    how: "Slide between Majority rules and Everyone gets a say: the further towards fairness, the more popularity the plan may give up to lift whoever gets the least.",
  },
};

/** An item the organizers locked in place: kept by every regenerate (if it still fits). */
export type PlanLock = { date: string; slot: Slot; id: string; variant?: string; role: "main" | "extra" };

/** A split the organizers accepted: the group splits up for that slot. Keyed by `${date}:${slot}`. */
export type SplitDecision = { status: "accepted" | "rejected"; a: string; b: string };

/** The organizer's knobs. Stored with the trip; the demo keeps them in the browser. */
export type PlanSettings = {
  /** null until an organizer chooses. */
  mode: DecisionMode | null;
  /** Custom only: 0 = Majority rules … 1 = Everyone gets a say (scales the tolerance and the fairness pull). */
  fairness: number;
  /** How much a draft plan counts (a submitted plan counts 1). */
  draftWeight: number;
  /** "Everyone gets a say": the share of the plan's popularity it may give up to lift the lowest shares (0–0.5). */
  tolerance: number;
  /** A split needs each camp to be at least this share of the travellers there that day (and at least 3). */
  splitShare: number;
  /** 0 = don't mind repeats … 1 = mix it up. */
  variety: number;
  /** 0 = ignore cost … 1 = lean towards what fits the group's budgets. */
  budgetFit: number;
  /** A window the organizers pinned (its first day), and a length. */
  start: string | null;
  length: number | null;
  locks: PlanLock[];
  splits: Record<string, SplitDecision>;
};

export const DEFAULT_SETTINGS: PlanSettings = {
  mode: null,
  fairness: 0.5,
  draftWeight: 0.5,
  tolerance: 0.15,
  splitShare: 0.4,
  variety: 0.5,
  budgetFit: 0,
  start: null,
  length: null,
  locks: [],
  splits: {},
};

/** One traveller's say: their (normalised) plan. */
export type Ballot = { id: string; name: string; status: "submitted" | "draft"; data: ItineraryData };

export type ReasonKind = "votes" | "fair" | "weekday" | "special" | "travel" | "locked" | "rest" | "variant" | "budget" | "free" | "extra";
/** A human-readable chip on a placed item ("9 of 12 picked this"). */
export type Reason = { kind: ReasonKind; text: string };

export type PlanItem = {
  /** Stable across versions while the same thing sits in the same slot on the same date (RSVPs key on it). */
  key: string;
  /** An activity id or "stay". */
  id: string;
  variant?: string;
  role: "main" | "extra";
  locked: boolean;
  /** Travellers who picked it, and how many of them are there that day. */
  votes: number;
  present: number;
  /** Its equal-voice support (≈ people), for the organizers. */
  score: number;
  reasons: Reason[];
  /** The best thing that didn't get this slot. */
  runnerUp: { id: string; votes: number } | null;
  /** Organizers only (stripped for travellers): who picked it, and who it was added for. */
  pickedBy: string[];
  floorFor: string[];
};

export type PlanSplit = {
  a: { id: string; votes: number };
  b: { id: string; votes: number; variant?: string };
  /** People who picked both. */
  both: number;
  status: "suggested" | "accepted" | "rejected";
  /** Organizers only: who picked which. */
  aBy: string[];
  bBy: string[];
};

export type PlanSlot = {
  /** `${date}:${slot}` */
  key: string;
  day: number;
  date: string;
  slot: Slot;
  area: string;
  /** The special date this slot belongs to (e.g. "nye"). */
  special: string | null;
  items: PlanItem[];
  split: PlanSplit | null;
  /** Ranked alternatives for swapping (organizers only). */
  alternatives: { id: string; votes: number; present: number; elsewhere: boolean }[];
};

export type MissedPick = { id: string; reason: string };

export type PersonResult = {
  id: string;
  name: string;
  status: "submitted" | "draft";
  /** Days of the plan they're there for. */
  daysThere: number;
  /** Their distinct picks (activities), and the ones in the plan on days they're there. */
  picks: number;
  made: string[];
  missed: MissedPick[];
  /** made ÷ what could fit (null: no picks). */
  satisfaction: number | null;
  /** Their picks that could fit the days they're there in the chosen window (the share's denominator). */
  feasible: number;
  /** Picks the fairness step added to lift them. */
  floorAdded: number;
};

export type FairnessStats = {
  /** Everyone's share of their feasible picks: the lowest, the median, the mean. */
  min: number;
  median: number;
  mean: number;
  /** Jain's index: 1 = everyone equally satisfied, 1/n = one person gets everything. */
  index: number;
  /** The share of popularity this mode could give up (0 for Majority rules). */
  tolerance: number;
  /** The same numbers for the most popular plan (what Majority rules makes). */
  majority: { min: number; median: number; index: number };
  /** This plan's score ÷ the most popular plan's (1 = nothing given up). */
  scoreKept: number;
  /** People whose share is higher than in the most popular plan. */
  lifted: number;
  /** Why the lowest share couldn't go higher, in plain words (null when it could, or for Majority rules). */
  note: string | null;
};

export type ConsensusPlan = {
  engine: 1;
  /** The settings as used (mode resolved; λ and the floor worked out). */
  /** The settings as used: the mode resolved, its strength (0 Majority … 1 Everyone gets a say), λ and the tolerance. */
  settings: PlanSettings & { mode: DecisionMode; strength: number; lambda: number; effectiveTolerance: number };
  dates: {
    chosen: WindowScore;
    runnersUp: WindowScore[];
    length: number;
    lengthReason: string;
    /** Each allowed length's best window and who can do all of it (empty with a fixed trip length). */
    lengths: (LengthOption & { recommended: boolean })[];
    pinned: boolean;
    /** Travellers with dates (the denominator for "x of y free"). */
    withDates: number;
  };
  /** The plan as an itinerary (main items then extras per slot; split alternatives not included). */
  itinerary: ItineraryData;
  slots: PlanSlot[];
  people: PersonResult[];
  fairness: FairnessStats;
  budget: { perPerson: [number, number]; withBudget: number; over: number; note: string | null };
  notes: string[];
  stats: { voters: number; submitted: number; drafts: number; picks: number };
};
