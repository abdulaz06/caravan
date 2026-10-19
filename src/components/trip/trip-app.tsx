"use client";

import { AnimatePresence, motion } from "framer-motion";
import { MapPinned, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { computeBudget } from "@/lib/budget";
import type { CurrencyCode } from "@/lib/currency";
import type { ItineraryData, ItineraryStatus } from "@/lib/itinerary";
import { useToast } from "../ui/toast";
import { BudgetSheet, BudgetSidePanel } from "./budget";
import { BuildStep } from "./build-step";
import { DatesStep } from "./dates-step";
import { TripHeader, type Step } from "./header";
import { PrefsStep } from "./prefs-step";
import { ReviewStep } from "./review-step";
import { useAutosave } from "./use-autosave";

const STEPS: Step[] = ["dates", "build", "prefs", "review"];

type Props = {
  name: string;
  initialData: ItineraryData;
  initialStatus: ItineraryStatus;
  initialUpdatedAt: string | null;
  editsLocked: boolean;
  requestedStep?: string;
  /** Picks cleared when an old (pre-bases) itinerary was upgraded. */
  migratedPicks?: number;
  needsUpgradeSave?: boolean;
};

function initialStep(data: ItineraryData, status: ItineraryStatus, locked: boolean, requested?: string): Step {
  if (requested && STEPS.includes(requested as Step) && (requested === "dates" || data.startDate)) {
    return requested as Step;
  }
  if (status === "submitted" || locked) return "review";
  return data.startDate ? "build" : "dates";
}

export function TripApp({
  name,
  initialData,
  initialStatus,
  initialUpdatedAt,
  editsLocked,
  requestedStep,
  migratedPicks = 0,
  needsUpgradeSave = false,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [data, setData] = useState(initialData);
  const [locked, setLocked] = useState(editsLocked);
  const [step, setStepState] = useState<Step>(() =>
    initialStep(initialData, initialStatus, editsLocked, migratedPicks > 0 ? "build" : requestedStep),
  );
  const [direction, setDirection] = useState(1);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [notice, setNotice] = useState(migratedPicks > 0);

  const save = useAutosave(data, {
    enabled: !locked,
    saveOnMount: needsUpgradeSave && !editsLocked,
    onLocked: () => {
      setLocked(true);
      toast("Edits are closed now — your last change wasn't saved.", "error");
    },
    onSignedOut: () => router.replace("/join"),
  });
  const status = save.status ?? initialStatus;
  const updatedAt = save.updatedAt ?? initialUpdatedAt;
  const budget = useMemo(() => computeBudget(data), [data]);

  const setStep = useCallback((next: Step, push = true) => {
    setStepState((cur) => {
      setDirection(STEPS.indexOf(next) >= STEPS.indexOf(cur) ? 1 : -1);
      return next;
    });
    if (push) {
      const url = new URL(window.location.href);
      url.searchParams.set("step", next);
      window.history.pushState({ step: next }, "", url);
    }
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, []);

  useEffect(() => {
    const onPop = () => {
      const s = new URLSearchParams(window.location.search).get("step") as Step | null;
      if (s && STEPS.includes(s)) setStep(s, false);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [setStep]);

  const update = useCallback(
    (fn: (d: ItineraryData) => ItineraryData) => {
      if (locked) return;
      setData((d) => fn(d));
    },
    [locked],
  );

  const onCurrency = useCallback(
    (code: CurrencyCode) => update((d) => ({ ...d, preferences: { ...d.preferences, currency: code } })),
    [update],
  );

  const toggleLine = useCallback(
    (id: string, include: boolean) =>
      update((d) => {
        const excluded = new Set(d.budget?.excluded ?? []);
        if (include) excluded.delete(id);
        else excluded.add(id);
        return { ...d, budget: { ...d.budget, excluded: [...excluded] } };
      }),
    [update],
  );
  const toggleAccommodation = useCallback(
    (on: boolean) => update((d) => ({ ...d, budget: { ...d.budget, accommodation: on } })),
    [update],
  );

  const canVisit = (s: Step) => s === "dates" || !!data.startDate;
  const showBudget = !!data.startDate && step !== "dates";

  return (
    <div className="min-h-dvh">
      <TripHeader
        name={name}
        step={step}
        canVisit={canVisit}
        onStep={(s) => setStep(s)}
        saveState={save.state}
        submitted={status === "submitted"}
        locked={locked}
        beforeLeave={() => save.flush()}
        onCurrency={onCurrency}
      />
      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mx-3 mt-3 flex items-start gap-3 rounded-2xl bg-saffron-100 p-3.5 text-[14px] leading-snug text-ink-2 ring-1 ring-saffron-200">
              <MapPinned className="mt-0.5 size-5 shrink-0 text-sunset-600" />
              <p className="flex-1">
                <b className="text-ink">We&apos;ve locked in Colombo + Galle as bases,</b> so a few picks need redoing
                {migratedPicks > 0 ? ` (${migratedPicks} cleared)` : ""}. Everything else is just as you left it.
              </p>
              <button onClick={() => setNotice(false)} aria-label="Dismiss" className="-mr-1 -mt-1 grid size-8 place-items-center rounded-full hover:bg-saffron-200">
                <X className="size-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div
          key={step}
          custom={direction}
          initial={{ opacity: 0, x: 36 * direction }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -36 * direction }}
          transition={{ type: "spring", stiffness: 420, damping: 38 }}
        >
          {step === "dates" && <DatesStep data={data} update={update} locked={locked} onNext={() => setStep("build")} />}
          {step === "build" && (
            <BuildStep
              data={data}
              update={update}
              locked={locked}
              budget={budget}
              onOpenBudget={() => setBudgetOpen(true)}
              onBack={() => setStep("dates")}
              onNext={() => setStep("prefs")}
            />
          )}
          {step === "prefs" && <PrefsStep data={data} update={update} locked={locked} onNext={() => setStep("review")} />}
          {step === "review" && (
            <ReviewStep
              name={name}
              data={data}
              status={status}
              updatedAt={updatedAt}
              locked={locked}
              saveState={save.state}
              budget={budget}
              onOpenBudget={() => setBudgetOpen(true)}
              onEdit={(s) => setStep(s)}
              onSubmit={async () => {
                const r = await save.submit(data);
                if (!r.ok) toast(r.code === 423 ? "Edits are closed." : "Couldn't submit — try again.", "error");
                return r.ok;
              }}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {showBudget && (
        <BudgetSidePanel
          budget={budget}
          locked={locked}
          onToggleLine={toggleLine}
          onToggleAccommodation={toggleAccommodation}
          onEditBudget={() => setStep("prefs")}
        />
      )}
      <BudgetSheet
        open={budgetOpen}
        onClose={() => setBudgetOpen(false)}
        budget={budget}
        locked={locked}
        onToggleLine={toggleLine}
        onToggleAccommodation={toggleAccommodation}
        onEditBudget={() => {
          setBudgetOpen(false);
          setStep("prefs");
        }}
      />
    </div>
  );
}
