import type { NextRequest } from "next/server";
import { exportJson, exportLongCsv, exportWideCsv } from "@/lib/server/export";
import { loadPeople, realPeople } from "@/lib/server/group";
import { asOrganizer, logAction } from "@/lib/server/organizer";
import { withTrip } from "@/lib/server/route";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/t/[slug]/admin/export">) {
  return withTrip(ctx, (trip) =>
    asOrganizer(trip, "admin", async (actor) => {
      const format = req.nextUrl.searchParams.get("format") ?? "json";
      // "zz-test-…" users never make it into an export.
      const people = realPeople(await loadPeople(trip));
      const stamp = new Date().toISOString().slice(0, 10);
      if (trip.trip.kind !== "demo") await logAction(trip.trip.id, actor, "export", null, { format });

      const file = (body: string, name: string, type: string) =>
        new Response(body, {
          headers: {
            "Content-Type": `${type}; charset=utf-8`,
            "Content-Disposition": `attachment; filename="${name}"`,
            "Cache-Control": "no-store",
          },
        });

      const base = `caravan-${trip.trip.slug}`;
      if (format === "csv") return file(exportWideCsv(trip.engine, people), `${base}-people-${stamp}.csv`, "text/csv");
      if (format === "csv-long") return file(exportLongCsv(trip.engine, people), `${base}-picks-${stamp}.csv`, "text/csv");
      return file(JSON.stringify(exportJson(trip, people), null, 2), `${base}-export-${stamp}.json`, "application/json");
    }, { readOnly: true }),
  );
}
