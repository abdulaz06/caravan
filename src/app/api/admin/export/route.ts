import type { NextRequest } from "next/server";
import { exportJson, exportLongCsv, exportWideCsv } from "@/lib/server/export";
import { loadPeople, realPeople } from "@/lib/server/group";
import { asOrganizer, logAction } from "@/lib/server/organizer";
import { loadTrip } from "@/lib/server/trip";

export async function GET(req: NextRequest) {
  return asOrganizer("admin", async (actor) => {
    const format = req.nextUrl.searchParams.get("format") ?? "json";
    const trip = await loadTrip();
    // "zz-test-…" users never make it into an export.
    const people = realPeople(await loadPeople(trip.engine));
    const stamp = new Date().toISOString().slice(0, 10);
    await logAction(actor, "export", null, { format });

    const file = (body: string, name: string, type: string) =>
      new Response(body, {
        headers: {
          "Content-Type": `${type}; charset=utf-8`,
          "Content-Disposition": `attachment; filename="${name}"`,
          "Cache-Control": "no-store",
        },
      });

    const base = `caravan-${trip.preset.id}`;
    if (format === "csv") return file(exportWideCsv(trip.engine, people), `${base}-people-${stamp}.csv`, "text/csv");
    if (format === "csv-long") return file(exportLongCsv(trip.engine, people), `${base}-picks-${stamp}.csv`, "text/csv");
    return file(JSON.stringify(exportJson(trip, people), null, 2), `${base}-export-${stamp}.json`, "application/json");
  });
}
