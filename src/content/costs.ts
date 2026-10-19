import type { BaseId } from "./types";

/**
 * Assumptions behind the budget tracker. All USD, per person unless noted.
 * Edit freely — they're estimates for late December 2026.
 */

/** Group size and shared vans used to split transport costs per person. */
export const GROUP_SIZE = 12;
export const VANS = 2;

/** Private van (KDH with driver) per driving hour, per van — used for trips away from base. */
export const VAN_RATE_PER_HOUR: [number, number] = [15, 22];

/** Accommodation per person per night, by preferred style and base (twin share / split villa). */
export const ACCOMMODATION: Record<"hostel" | "boutique" | "villa" | "mix", Record<BaseId, [number, number]>> = {
  hostel: { colombo: [12, 25], galle: [12, 25] },
  boutique: { colombo: [35, 70], galle: [35, 75] },
  villa: { colombo: [30, 60], galle: [30, 65] },
  mix: { colombo: [25, 55], galle: [25, 60] },
};

/** Budget tiers on the preferences step (per person, excl. flights). */
export const BUDGET_BOUNDS: Record<string, [number, number]> = {
  lt400: [0, 400],
  "400_700": [400, 700],
  "700_1000": [700, 1000],
  "1000_1500": [1000, 1500],
  gt1500: [1500, Number.POSITIVE_INFINITY],
};
