"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ItineraryData, ItineraryStatus } from "@/lib/itinerary";

export type SaveState = "idle" | "saving" | "saved" | "error";

type Result = { ok: true; status: ItineraryStatus; updatedAt: string } | { ok: false; error: string; code: number };

async function put(data: ItineraryData, submit: boolean, keepalive = false): Promise<Result> {
  try {
    const res = await fetch("/api/itinerary", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data, submit }),
      keepalive,
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, status: body.status, updatedAt: body.updatedAt };
    return { ok: false, error: body.error ?? "Save failed", code: res.status };
  } catch {
    return { ok: false, error: "offline", code: 0 };
  }
}

/**
 * Debounced autosave of the draft. Every change is saved ~0.8s after the last
 * edit, and flushed immediately when the tab is hidden.
 */
export function useAutosave(
  data: ItineraryData,
  opts: { enabled: boolean; onLocked: () => void; onSignedOut: () => void; saveOnMount?: boolean },
) {
  const [state, setState] = useState<SaveState>("idle");
  const [status, setStatus] = useState<ItineraryStatus | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  // Skip the initial render unless the data needs persisting (e.g. a v1 → v2 upgrade).
  const first = useRef(!opts.saveOnMount);
  const pending = useRef<ItineraryData | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const optsRef = useRef(opts);
  const retry = useRef<() => void>(() => {});
  useEffect(() => {
    optsRef.current = opts;
  });

  const handle = useCallback((r: Result) => {
    if (r.ok) {
      setState("saved");
      setStatus(r.status);
      setUpdatedAt(r.updatedAt);
      return true;
    }
    if (r.code === 423) optsRef.current.onLocked();
    if (r.code === 401) optsRef.current.onSignedOut();
    setState("error");
    return false;
  }, []);

  const flush = useCallback(
    async (keepalive = false) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      const d = pending.current;
      if (!d) return true;
      pending.current = null;
      setState("saving");
      const r = await put(d, false, keepalive);
      if (!r.ok && r.code === 0 && !keepalive) {
        // Offline / flaky connection: keep the change and try again shortly.
        pending.current ??= d;
        timer.current = setTimeout(() => retry.current(), 5000);
      }
      return handle(r);
    },
    [handle],
  );
  useEffect(() => {
    retry.current = () => void flush();
  }, [flush]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!opts.enabled) return;
    pending.current = data;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 800);
  }, [data, opts.enabled, flush]);

  useEffect(() => {
    const onHide = () => document.visibilityState === "hidden" && void flush(true);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, [flush]);

  const submit = useCallback(
    async (d: ItineraryData) => {
      if (timer.current) clearTimeout(timer.current);
      pending.current = null;
      setState("saving");
      const r = await put(d, true);
      handle(r);
      return r;
    },
    [handle],
  );

  return { state, status, updatedAt, flush, submit };
}
