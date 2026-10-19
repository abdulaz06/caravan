import { z } from "zod";
import {
  budgetIds,
  dietaryIds,
  earlyMorningIds,
  flexibilityIds,
  interestIds,
  sharedRoomIds,
  stayIds,
  transportIds,
} from "@/content/preferences";
import { MAX_TRIP_DAYS, TRIP_WINDOW } from "@/content";
import { diffDays, isValidISO } from "./dates";
import { normalize, type ItineraryData } from "./itinerary";

const isoDate = z.string().refine(isValidISO, "Invalid date");
const text = (max: number) => z.string().trim().max(max).optional();

const optionPick = z.object({ pairId: z.string().max(64), optionId: z.string().max(64) });
// "chill" is the pre-Stay-in shape; normalize() upgrades it to { type: "stay" }.
const slotPick = z.union([optionPick, z.object({ type: z.enum(["stay", "chill"]) })]);

export const preferencesSchema = z
  .object({
    budget: z.enum(budgetIds).optional(),
    stay: z.enum(stayIds).optional(),
    sharedRooms: z.enum(sharedRoomIds).optional(),
    interests: z.array(z.enum(interestIds)).max(20).optional(),
    earlyMornings: z.enum(earlyMorningIds).optional(),
    transport: z.enum(transportIds).optional(),
    dietary: z.array(z.enum(dietaryIds)).max(20).optional(),
    dietaryOther: text(200),
    flyingFrom: text(120),
    mustDo: text(1000),
    hardNo: text(1000),
    suggestions: text(1000),
    notes: text(2000),
  })
  .strip();

export const itinerarySchema = z
  .object({
    version: z.literal(1),
    startDate: isoDate.nullable(),
    endDate: isoDate.nullable(),
    flexibility: z.enum(flexibilityIds).nullable(),
    days: z
      .array(
        z.object({
          id: z.string().min(1).max(40),
          day: slotPick.nullable(),
          night: slotPick.nullable(),
          note: z.string().max(280).optional(),
        }),
      )
      .max(MAX_TRIP_DAYS),
    preferences: preferencesSchema,
  })
  .superRefine((d, ctx) => {
    if (!!d.startDate !== !!d.endDate) {
      ctx.addIssue({ code: "custom", message: "Pick both a start and an end date" });
      return;
    }
    if (d.startDate && d.endDate) {
      const len = diffDays(d.startDate, d.endDate) + 1;
      if (d.startDate < TRIP_WINDOW.start || d.endDate > TRIP_WINDOW.end || len < 1 || len > MAX_TRIP_DAYS) {
        ctx.addIssue({ code: "custom", message: "Dates are outside the trip window" });
      }
    }
  });

/** Parse untrusted input into clean, rule-abiding itinerary data. */
export function parseItinerary(input: unknown): ItineraryData | null {
  const res = itinerarySchema.safeParse(input);
  if (!res.success) return null;
  return normalize(res.data as ItineraryData);
}

export const nameSchema = z
  .string()
  .trim()
  .min(1, "Tell us your name")
  .max(30, "That's a long name — keep it under 30 characters")
  .regex(/^[\p{L}\p{M}\p{N} .'\-]+$/u, "Letters, numbers, spaces, dots and dashes only");

export const pinSchema = z.string().regex(/^\d{4}$/, "PIN must be 4 digits");
