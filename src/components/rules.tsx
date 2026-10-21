"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Clock, Megaphone, X } from "lucide-react";
import { createContext, useContext, useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { DEFAULT_RULES, applyRules, type TripRules } from "@/lib/rules";

const RulesContext = createContext<TripRules>(DEFAULT_RULES);

/**
 * Puts the Trip rules the page was rendered with in force for everything
 * below (trip structure helpers read them synchronously) and shares them.
 */
export function RulesProvider({ rules, children }: { rules: TripRules; children: React.ReactNode }) {
  applyRules(rules);
  return <RulesContext.Provider value={rules}>{children}</RulesContext.Provider>;
}

export const useRules = () => useContext(RulesContext);

/** The organizers' banner message (on/off in the console). Dismissible per message. */
export function AnnouncementBar({ className }: { className?: string }) {
  const { announcement } = useRules();
  const key = `lanks_ann_${announcement.text.slice(0, 40)}`;
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    // Read the dismissal after hydration (localStorage isn't there on the server).
    const t = setTimeout(() => {
      try {
        setHidden(localStorage.getItem(key) === "1");
      } catch {
        setHidden(false);
      }
    }, 0);
    return () => clearTimeout(t);
  }, [key]);
  const show = announcement.on && !!announcement.text.trim() && !hidden;
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          role="status"
          aria-label="Announcement"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className={cn("overflow-hidden", className)}
        >
          <div className="mx-3 mt-3 flex items-start gap-3 rounded-2xl bg-ocean-800 p-3.5 text-[14px] leading-snug text-paper shadow-card">
            <Megaphone className="mt-0.5 size-5 shrink-0 text-saffron-400" />
            <p className="flex-1 whitespace-pre-line">{announcement.text}</p>
            <button
              onClick={() => {
                setHidden(true);
                try {
                  localStorage.setItem(key, "1");
                } catch {
                  /* private mode */
                }
              }}
              aria-label="Dismiss announcement"
              className="-mr-1 -mt-1 grid size-8 shrink-0 place-items-center rounded-full hover:bg-white/10"
            >
              <X className="size-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function left(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60_000));
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  if (d >= 2) return `${d} days`;
  if (d === 1) return `1 day ${h} hr${h === 1 ? "" : "s"}`;
  if (h >= 1) return `${h} hr${h === 1 ? "" : "s"} ${m % 60} min`;
  return `${m % 60} min`;
}

/** "✏️ Edits close in 3 days" — the scheduled auto-lock, shown to everyone. */
export function LockCountdown({ className, onLocked }: { className?: string; onLocked?: () => void }) {
  const { autoLockAt } = useRules();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);
  const at = autoLockAt ? Date.parse(autoLockAt) : null;
  useEffect(() => {
    if (at && now && now >= at) onLocked?.();
  }, [at, now, onLocked]);
  if (!at || now === null || now >= at) return null;
  const when = new Date(at).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return (
    <p
      role="status"
      aria-label="Edits close soon"
      className={cn("mx-3 mt-3 flex items-center gap-2 rounded-2xl bg-saffron-100 px-3.5 py-2.5 text-[13.5px] text-ink-2 ring-1 ring-saffron-200", className)}
    >
      <Clock className="size-4 shrink-0 text-sunset-600" />
      <span>
        Edits close in <b className="text-ink">{left(at - now)}</b> · {when}
      </span>
    </p>
  );
}
