import type { Metadata } from "next";
import { DemoChooser } from "@/components/caravan/demo-chooser";
import { DEMOS } from "@/lib/server/demo";
import { destinations } from "@/lib/server/destinations";

export const metadata: Metadata = {
  title: "Try a demo trip",
  description: "A trip mid-planning with 12 fictional travellers: plan your own version as a guest, or look around the organizer console.",
};

export default function DemoPage() {
  const ids = new Set(DEMOS.map((d) => d.id));
  return <DemoChooser destinations={destinations().filter((d) => ids.has(d.id))} />;
}
