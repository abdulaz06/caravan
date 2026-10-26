import { TripShell } from "@/components/trip-shell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <TripShell>{children}</TripShell>;
}
