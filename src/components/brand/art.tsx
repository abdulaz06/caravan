"use client";

// The preset's illustration set: the photo fallback scene, the "Stay in"
// mark, the vehicle and custom activity icons. Components ask for art by
// role ("the vehicle"), never by destination.
import { useMaybeEngine } from "../engine";
import { Car, ChaletIcon, HillSunIcon, MountainScene, Palm, PalmScene, Pine, SnowPeakIcon, StayInIcon, Van } from "./illustrations";

type P = { className?: string };

const SETS = {
  tropical: { Scene: PalmScene, StayIn: StayInIcon, DayTrip: HillSunIcon, Decor: Palm },
  alpine: { Scene: MountainScene, StayIn: ChaletIcon, DayTrip: SnowPeakIcon, Decor: Pine },
} as const;

/** Named activity icons a preset can use (`activity.icon`). */
const ICONS: Record<string, (p: P & { rising?: boolean }) => React.ReactElement> = {
  "hill-sun": HillSunIcon,
  "snow-peak": SnowPeakIcon,
};

export function useArt() {
  const preset = useMaybeEngine()?.catalog.preset;
  const set = SETS[preset?.theme.illustrations ?? "tropical"];
  const selfDrive = preset?.travel.selfDrive ?? false;
  return {
    ...set,
    Vehicle: selfDrive ? Car : Van,
    /** A custom icon for an activity, or the set's day-trip mark. */
    Icon: ({ name, ...p }: P & { name?: string; rising?: boolean }) => {
      const C = (name && ICONS[name]) || set.DayTrip;
      return <C {...p} />;
    },
  };
}

export function SceneArt({ className }: P) {
  const { Scene } = useArt();
  return <Scene className={className} />;
}
