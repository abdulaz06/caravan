"use client";

import { useSyncExternalStore } from "react";

type Format = "datetime" | "date" | ((d: Date) => string);

const never = () => () => {};

function format(iso: string, f: Format): string {
  const d = new Date(iso);
  if (typeof f === "function") return f(d);
  return f === "date"
    ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
    : d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/**
 * A time in the viewer's own timezone. Rendered in the browser only (empty on
 * the server), so the server's UTC never mismatches the hydrated text.
 */
export function LocalTime({ iso, as = "datetime", fallback = "—" }: { iso: string | null | undefined; as?: Format; fallback?: string }) {
  const text = useSyncExternalStore(
    never,
    () => (iso ? format(iso, as) : fallback),
    () => "",
  );
  return iso ? <time dateTime={iso}>{text}</time> : <>{fallback}</>;
}
