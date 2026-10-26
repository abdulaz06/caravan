import { loadTrip } from "@/lib/server/trip";
import { EngineProvider } from "./engine";
import { PresetTheme } from "./preset-theme";

/**
 * Everything below runs inside one trip: its preset's theme is in force for
 * the page, and client components get the trip engine (preset + live rules)
 * from context. The preset travels in the page payload — never in the bundle.
 */
export async function TripShell({ children }: { children: React.ReactNode }) {
  const trip = await loadTrip();
  return (
    <>
      <PresetTheme theme={trip.preset.theme} />
      <EngineProvider preset={trip.preset} photos={trip.photos} rules={trip.rules}>
        {children}
      </EngineProvider>
    </>
  );
}
