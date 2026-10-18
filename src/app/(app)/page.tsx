import { redirect } from "next/navigation";
import { Welcome } from "@/components/welcome";
import { publicCounts } from "@/lib/server/group";
import { currentParticipant } from "@/lib/server/session";

export default async function Home() {
  if (await currentParticipant()) redirect("/trip");
  const counts = await publicCounts();
  return <Welcome counts={counts} />;
}
