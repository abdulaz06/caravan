import type { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { exportJson, exportLongCsv, exportWideCsv } from "@/lib/server/export";
import { loadPeople } from "@/lib/server/group";
import { error } from "@/lib/server/http";
import { isAdmin } from "@/lib/server/session";

export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return error("Not allowed", 401);
  const format = req.nextUrl.searchParams.get("format") ?? "json";
  const people = await loadPeople();
  const stamp = new Date().toISOString().slice(0, 10);

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
  const settings = await db().getSettings();
  return file(
    JSON.stringify(exportJson(people, settings.edits_locked), null, 2),
    `lanks-export-${stamp}.json`,
    "application/json",
  );
}
