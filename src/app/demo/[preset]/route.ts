import { NextResponse } from "next/server";
import { demoById, ensureDemoTrip } from "@/lib/server/demo";

/** A destination's demo trip: built on first visit (and rebuilt nightly by the cron). */
export async function GET(req: Request, ctx: RouteContext<"/demo/[preset]">) {
  const demo = demoById((await ctx.params).preset);
  if (!demo) return NextResponse.redirect(new URL("/demo", req.url));
  const slug = await ensureDemoTrip(demo);
  return NextResponse.redirect(new URL(`/t/${slug}`, req.url));
}
