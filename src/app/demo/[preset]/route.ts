import { after, NextResponse } from "next/server";
import { demoById, ensureDemoTrip } from "@/lib/server/demo";

/**
 * A destination's demo trip, straight away. A demo from an older seed keeps
 * serving while its rebuild runs after the response; it's also rebuilt after
 * each production build and nightly by the cron.
 */
export async function GET(req: Request, ctx: RouteContext<"/demo/[preset]">) {
  const demo = demoById((await ctx.params).preset);
  if (!demo) return NextResponse.redirect(new URL("/demo", req.url));
  const slug = await ensureDemoTrip(demo, (task) => after(task));
  return NextResponse.redirect(new URL(`/t/${slug}`, req.url));
}
