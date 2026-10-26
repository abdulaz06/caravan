import type { TripContext } from "@/lib/server/trip";
import { EngineProvider } from "./engine";
import { PresetTheme } from "./preset-theme";

/**
 * Everything below runs inside one trip: its preset's theme is in force for
 * the page, and client components get the trip engine (preset + live rules)
 * and the trip's paths from context. The preset travels in the page payload —
 * never in the bundle.
 */
export function TripShell({ trip, children }: { trip: TripContext; children: React.ReactNode }) {
  return (
    <>
      <PresetTheme theme={trip.preset.theme} />
      <EngineProvider trip={trip.trip} preset={trip.preset} photos={trip.photos} rules={trip.rules}>
        {children}
      </EngineProvider>
    </>
  );
}
