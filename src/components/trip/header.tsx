"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, CloudOff, Loader2, Lock, LogOut, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Avatar } from "../avatar";
import { Lockup } from "../brand/wordmark";
import type { SaveState } from "./use-autosave";

export type Step = "dates" | "build" | "prefs" | "review";
const LABELS: Record<Step, string> = { dates: "Dates", build: "Days", prefs: "Extras", review: "Review" };

type Props = {
  name: string;
  step: Step;
  canVisit: (s: Step) => boolean;
  onStep: (s: Step) => void;
  saveState: SaveState;
  submitted: boolean;
  locked: boolean;
  beforeLeave: () => Promise<unknown>;
};

export function TripHeader({ name, step, canVisit, onStep, saveState, submitted, locked, beforeLeave }: Props) {
  const [menu, setMenu] = useState(false);
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setMenu(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menu]);

  async function logout() {
    await beforeLeave();
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/");
    router.refresh();
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-ink/[0.06] bg-sand-100/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="flex h-16 items-center gap-2.5 px-3.5">
          <Lockup size="sm" className="shrink-0" />
          <nav className="flex flex-1 items-center gap-1" aria-label="Steps">
            {(Object.keys(LABELS) as Step[]).map((s) => {
              const active = s === step;
              const enabled = canVisit(s);
              return (
                <button
                  key={s}
                  disabled={!enabled}
                  onClick={() => onStep(s)}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "relative flex h-8 flex-1 items-center justify-center rounded-full text-[12.5px] font-semibold tracking-[-0.01em] transition-colors",
                    active ? "text-paper" : enabled ? "text-ink-2 hover:bg-sand-200" : "text-ink-3/50",
                  )}
                >
                  {active && (
                    <motion.span layoutId="step-pill" className="absolute inset-0 rounded-full bg-ink" />
                  )}
                  <span className="relative">{LABELS[s]}</span>
                </button>
              );
            })}
          </nav>
          <div className="relative" ref={ref}>
            <button
              onClick={() => setMenu((m) => !m)}
              aria-label="Account menu"
              aria-expanded={menu}
              className="relative block rounded-full"
            >
              <Avatar name={name} className="size-9 ring-0" />
              <SaveDot state={saveState} />
            </button>
            <AnimatePresence>
              {menu && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  className="absolute right-0 top-12 w-60 origin-top-right overflow-hidden rounded-2xl bg-paper p-1.5 shadow-lift ring-1 ring-ink/5"
                >
                  <div className="px-3 pb-2 pt-2">
                    <p className="font-display text-lg font-semibold leading-tight">{name}</p>
                    <p className="mt-0.5 text-xs text-ink-3">
                      {submitted ? "Trip submitted ✓" : "Draft — saved as you go"}
                    </p>
                  </div>
                  <Link
                    href="/group"
                    onClick={() => void beforeLeave()}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[15px] font-medium hover:bg-sand-100"
                  >
                    <Users className="size-[18px] text-ocean-600" /> Group overview
                  </Link>
                  <button
                    onClick={logout}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[15px] font-medium hover:bg-sand-100"
                  >
                    <LogOut className="size-[18px] text-ink-3" /> Log out
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>
      {locked && (
        <div className="flex items-center gap-2.5 bg-ocean-800 px-4 py-3 text-[14px] font-medium text-paper">
          <Lock className="size-4 shrink-0 text-saffron-400" />
          Edits are closed — the final plan is coming!
        </div>
      )}
    </>
  );
}

function SaveDot({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  const label = { saving: "Saving…", saved: "Saved", error: "Not saved", idle: "" }[state];
  return (
    <span
      title={label}
      aria-label={label}
      role="status"
      className={cn(
        "absolute -bottom-1 -right-1 grid size-[18px] place-items-center rounded-full ring-2 ring-sand-100",
        state === "saving" && "bg-sand-300 text-ink",
        state === "saved" && "bg-jungle-600 text-white",
        state === "error" && "bg-sunset-600 text-white",
      )}
    >
      {state === "saving" && <Loader2 className="size-3 animate-spin" strokeWidth={3} />}
      {state === "saved" && <Check className="size-3" strokeWidth={3.5} />}
      {state === "error" && <CloudOff className="size-2.5" strokeWidth={3} />}
    </span>
  );
}
