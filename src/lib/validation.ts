import { z } from "zod";

// Names and PINs for joining a trip (and naming one).
export const nameSchema = z
  .string()
  .trim()
  .min(1, "Tell us your name")
  .max(30, "That's a long name — keep it under 30 characters")
  .regex(/^[\p{L}\p{M}\p{N} .'\-]+$/u, "Letters, numbers, spaces, dots and dashes only");

export const pinSchema = z.string().regex(/^\d{4}$/, "PIN must be 4 digits");
