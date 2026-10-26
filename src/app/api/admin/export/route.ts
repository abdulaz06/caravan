import type { NextRequest } from "next/server";
import { exportJson, exportLongCsv, exportWideCsv } from "@/lib/server/export";
import { loadPeople, realPeople } from "@/lib/server/group";
import { asOrganizer, logAction } from "@/lib/server/organizer";
import { loadRules } from "@/lib/server/rules";

export async function GET(req: NextRequest) {
  return asOrganizer("admin", async (actor) => {
    const format = req.nextUrl.searchParams.get("format") ?? "json";
    const live = await loadRules();
    // "zz-test-…" users never make it into an export.
    const people = realPeople(await loadPeople());
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

    if (format === "csv") return file(exportWideCsv(people), `lanks-people-${stamp}.csv`, "text/csv");
    if (format === "csv-long") return file(exportLongCsv(people), `lanks-picks-${stamp}.csv`, "text/csv");
    return file(JSON.stringify(exportJson(people, live), null, 2), `lanks-export-${stamp}.json`, "application/json");
  });
}
