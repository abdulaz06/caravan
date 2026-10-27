/** "25 Dec 2024 – 2 Jan 2025" — a past trip's dates, years included. */
export function longRange(start: string, end: string): string {
  const f = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return `${f(start)} – ${f(end)}`;
}
