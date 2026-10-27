import { NextResponse } from "next/server";
import { ensureDemoTrip } from "@/lib/server/demo";

/** The public demo trip: built on first visit (and rebuilt nightly by the cron). */
export async function GET(req: Request) {
  const slug = await ensureDemoTrip();
  return NextResponse.redirect(new URL(`/t/${slug}`, req.url));
}
