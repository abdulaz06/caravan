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
import { CURRENCY_CODES } from "./currency";
import { diffDays, isValidISO } from "./dates";
import { MAX_ITEMS, normalize, type ItineraryData } from "./itinerary";
import { allowedLengths, tripDays, tripWindow } from "./rules";

const isoDate = z.string().refine(isValidISO, "Invalid date");
const text = (max: number) => z.string().trim().max(max).optional();

const slotItems = z
  .array(
    z
      .object({ key: z.string().min(1).max(16), id: z.string().min(1).max(64), pairId: z.string().max(64).optional(), variant: z.string().max(32).optional() })
      .strip(),
  )
  .max(MAX_ITEMS);

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
    currency: z.enum(CURRENCY_CODES).optional(),
  })
  .strip();

export const itinerarySchema = z
  .object({
    version: z.literal(3),
    startDate: isoDate.nullable(),
    endDate: isoDate.nullable(),
    flexibility: z.enum(flexibilityIds).nullable(),
    days: z
      .array(
        z.object({
          id: z.string().min(1).max(40),
          day: slotItems,
          night: slotItems,
          note: z.string().max(280).optional(),
        }),
      )
      .max(12),
    preferences: preferencesSchema,
    budget: z
      .object({ excluded: z.array(z.string().max(120)).max(300).optional(), accommodation: z.boolean().optional() })
      .strip()
      .optional(),
  })
  .superRefine((d, ctx) => {
    if (!!d.startDate !== !!d.endDate) {
      ctx.addIssue({ code: "custom", message: "Pick both a start and an end date" });
      return;
    }
    if (d.startDate && d.endDate) {
      const len = diffDays(d.startDate, d.endDate) + 1;
      if (d.startDate < tripWindow().start || d.endDate > tripWindow().end) {
        ctx.addIssue({ code: "custom", message: "Dates are outside the trip window" });
      }
      // The Trip rules decide the length (6 days · 5 nights by default); the preview is only saved if allowed.
      if (!allowedLengths().includes(len) || d.days.length !== len) {
        ctx.addIssue({ code: "custom", message: `The trip is ${tripDays()} days` });
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
