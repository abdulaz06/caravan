import "server-only";

/** The public demo trip (seeded and reset nightly), at /t/<DEMO_SLUG>. */
export const DEMO_SLUG = process.env.DEMO_TRIP_SLUG?.trim() || "demo-sri-lanka";
