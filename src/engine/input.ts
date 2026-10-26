// Validating an itinerary sent by the browser: the shape (zod), the
// preset's own preference choices, the trip window and allowed lengths from
// the rules — then normalised so every pick is valid for its day.
import { z } from "zod";
import { CURRENCY_CODES } from "@/lib/currency";
import { diffDays, isValidISO } from "@/lib/dates";
import type { Choice } from "./preset-schema";
import { MAX_ITEMS, MAX_ROOMMATES, normalize, type ItineraryData } from "./itinerary";
import { allowedLengths, tripDays, type Engine } from "./structure";

const isoDate = z.string().refine(isValidISO, "Invalid date");
const text = (max: number) => z.string().trim().max(max).optional();
const oneOf = (list: Choice[]) => z.enum(list.map((c) => c.id) as [string, ...string[]]);

const slotItems = z
  .array(
    z
      .object({ key: z.string().min(1).max(16), id: z.string().min(1).max(64), pairId: z.string().max(64).optional(), variant: z.string().max(32).optional() })
      .strip(),
  )
  .max(MAX_ITEMS);

export function preferencesSchema(e: Engine) {
  const p = e.catalog.preset.preferences;
  return z
    .object({
      budget: oneOf(p.budgets).optional(),
      stay: oneOf(p.stays).optional(),
      sharedRooms: oneOf(p.sharedRooms).optional(),
      interests: z.array(oneOf(p.interests)).max(30).optional(),
      earlyMornings: oneOf(p.earlyMornings).optional(),
      transport: oneOf(p.transport).optional(),
      dietary: z.array(oneOf(p.dietary)).max(20).optional(),
      dietaryOther: text(200),
      flyingFrom: text(120),
      mustDo: text(1000),
      hardNo: text(1000),
      suggestions: text(1000),
      notes: text(2000),
      currency: z.enum(CURRENCY_CODES).optional(),
      roommates: z
        // A longer list isn't worth refusing the whole save over — the server keeps the first MAX_ROOMMATES.
        .array(z.object({ id: z.string().min(1).max(64).optional(), name: z.string().trim().min(1).max(40) }).strip())
        .max(MAX_ROOMMATES * 4)
        .optional(),
    })
    .strip();
}

export function itinerarySchema(e: Engine) {
  return z
    .object({
      version: z.literal(3),
      startDate: isoDate.nullable(),
      endDate: isoDate.nullable(),
      flexibility: oneOf(e.catalog.preset.preferences.flexibility).nullable(),
      days: z
        .array(z.object({ id: z.string().min(1).max(40), day: slotItems, night: slotItems, note: z.string().max(280).optional() }))
        .max(40),
      preferences: preferencesSchema(e),
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
        if (d.startDate < e.rules.window.start || d.endDate > e.rules.window.end) {
          ctx.addIssue({ code: "custom", message: "Dates are outside the trip window" });
        }
        // The Trip rules decide the length; the preview is only saved if allowed.
        if (!allowedLengths(e).includes(len) || d.days.length !== len) {
          ctx.addIssue({ code: "custom", message: `The trip is ${tripDays(e)} days` });
        }
      }
    });
}

/** Parse untrusted input into clean, rule-abiding itinerary data. */
export function parseItinerary(e: Engine, input: unknown): ItineraryData | null {
  const res = itinerarySchema(e).safeParse(input);
  if (!res.success) return null;
  return normalize(e, res.data as ItineraryData);
}
