// Caravan's own brand, shared by the React wordmark and the canvas share
// images so both draw the same mark. App-level and destination-neutral: each
// trip's preset theme carries its own palette.

export const BRAND = {
  name: "Caravan",
  tagline: "Plan the trip together",
} as const;

export type Disc = { cx: number; cy: number; r: number; color: string };

/**
 * The mark: three overlapping discs on a rising line — a caravan on the move,
 * and everyone's version of the trip overlapping. Drawn in a 32×32 box.
 */
export const MARK: Record<"light" | "dark", Disc[]> = {
  light: [
    { cx: 9.5, cy: 20, r: 7.2, color: "#c95c3c" },
    { cx: 16, cy: 16, r: 7.2, color: "#d4a24a" },
    { cx: 22.5, cy: 12, r: 7.2, color: "#2e4266" },
  ],
  dark: [
    { cx: 9.5, cy: 20, r: 7.2, color: "#e4825f" },
    { cx: 16, cy: 16, r: 7.2, color: "#e2bb6e" },
    { cx: 22.5, cy: 12, r: 7.2, color: "#b9c7de" },
  ],
};
