import type { Metadata } from "next";
import { AdminDashboard, AdminLogin } from "@/components/admin/admin";
import { tripLength } from "@/lib/itinerary";
import { db, isUsingLocalStore } from "@/lib/server/db";
import { loadPeople } from "@/lib/server/group";
import { isAdmin } from "@/lib/server/session";

export const metadata: Metadata = { title: "Organizer" };

export default async function AdminPage() {
  if (!(await isAdmin())) return <AdminLogin />;
  const [people, settings] = await Promise.all([loadPeople(), db().getSettings()]);
  return (
    <AdminDashboard
      locked={settings.edits_locked}
      localStore={isUsingLocalStore()}
      people={people.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        joinedAt: p.joinedAt,
        updatedAt: p.updatedAt,
        picks: p.picks,
        startDate: p.data?.startDate ?? null,
        endDate: p.data?.endDate ?? null,
        days: p.data ? tripLength(p.data) : 0,
      }))}
    />
  );
}
