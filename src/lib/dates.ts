// Date helpers on plain "YYYY-MM-DD" strings, done in UTC so they never
// shift with the viewer's timezone.

const DAY_MS = 86_400_000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function parseISO(d: string): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

export function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(d: string, n: number): string {
  return toISO(new Date(parseISO(d).getTime() + n * DAY_MS));
}

/** Whole days from a to b (b - a). */
export function diffDays(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / DAY_MS);
}

/** Inclusive list of dates from start to end. */
export function dateRange(start: string, end: string): string[] {
  const n = diffDays(start, end);
  return Array.from({ length: Math.max(0, n + 1) }, (_, i) => addDays(start, i));
}

export function weekday(d: string): string {
  return WEEKDAYS[parseISO(d).getUTCDay()];
}

/** "Sat 26 Dec" */
export function dayLabel(d: string): string {
  const dt = parseISO(d);
  return `${WEEKDAYS[dt.getUTCDay()]} ${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]}`;
}

/** "26 Dec" */
export function shortDate(d: string): string {
  const dt = parseISO(d);
  return `${dt.getUTCDate()} ${MONTHS[dt.getUTCMonth()]}`;
}

export function monthName(year: number, monthIndex: number): string {
  return `${MONTHS_LONG[monthIndex]} ${year}`;
}

/** "26 Dec – 30 Dec" or "26–30 Dec" */
export function rangeLabel(start: string, end: string): string {
  const a = parseISO(start);
  const b = parseISO(end);
  if (a.getUTCMonth() === b.getUTCMonth()) {
    return `${a.getUTCDate()}–${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]}`;
  }
  return `${shortDate(start)} – ${shortDate(end)}`;
}

export function isValidISO(d: unknown): d is string {
  return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && toISO(parseISO(d)) === d;
}
