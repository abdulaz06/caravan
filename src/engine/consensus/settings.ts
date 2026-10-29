// The organizer's plan knobs, validated: they arrive from the console (and,
// on the demo, from anyone), and they're stored with the trip's rules.
import { z } from "zod";
import { isValidISO } from "@/lib/dates";
import { DEFAULT_SETTINGS, type PlanSettings } from "./types";

const isoDate = z.string().refine(isValidISO, "Invalid date");
const unit = z.number().min(0).max(1);
const id = z.string().min(1).max(64);

export const planSettingsSchema = z
  .object({
    mode: z.enum(["together", "majority", "custom"]).nullable(),
    fairness: unit,
    draftWeight: unit,
    tolerance: z.number().min(0).max(0.5),
    splitShare: z.number().min(0.15).max(0.75),
    variety: unit,
    budgetFit: unit,
    start: isoDate.nullable(),
    length: z.number().int().min(1).max(30).nullable(),
    locks: z
      .array(z.object({ date: isoDate, slot: z.enum(["day", "night"]), id, variant: z.string().max(32).optional(), role: z.enum(["main", "extra"]) }).strip())
      .max(60),
    splits: z
      .record(z.string().regex(/^\d{4}-\d{2}-\d{2}:(day|night)$/), z.object({ status: z.enum(["accepted", "rejected"]), a: id, b: id }).strip())
      .refine((r) => Object.keys(r).length <= 60, "Too many split decisions"),
  })
  .strip();

/** Stored or sent settings → a complete set (bad fields fall back to the defaults, one by one). */
export function parsePlanSettings(raw: unknown): PlanSettings {
  const out: PlanSettings = structuredClone(DEFAULT_SETTINGS);
  if (!raw || typeof raw !== "object") return out;
  const shape = planSettingsSchema.shape;
  for (const k of Object.keys(shape) as (keyof typeof shape)[]) {
    const v = (raw as Record<string, unknown>)[k];
    if (v === undefined) continue;
    const ok = shape[k].safeParse(v);
    if (ok.success) (out as Record<string, unknown>)[k] = ok.data;
  }
  return out;
}
