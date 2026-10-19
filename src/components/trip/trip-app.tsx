"use client";

import { AnimatePresence, motion } from "framer-motion";
import { FlaskConical, MapPinned, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { computeBudget } from "@/lib/budget";
import type { CurrencyCode } from "@/lib/currency";
import { PREVIEW_DAYS, TRIP_DAYS } from "@/content";
import { makePreview, type ItineraryData, type ItineraryStatus } from "@/lib/itinerary";
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
  /** Picks cleared when an older itinerary moved onto the 6-day structure (-1 = no upgrade). */
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
  migratedPicks = -1,
  needsUpgradeSave = false,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  // `data` is the real 6-day plan (autosaved). `preview` is a 5-day sandbox
  // that lives only in this tab — switching back restores `data` untouched.
  const [data, setData] = useState(initialData);
  const [preview, setPreview] = useState<ItineraryData | null>(null);
  const view = preview ?? data;
  const [locked, setLocked] = useState(editsLocked);
  const [step, setStepState] = useState<Step>(() =>
    initialStep(initialData, initialStatus, editsLocked, migratedPicks > 0 ? "build" : requestedStep),
  );
  const [direction, setDirection] = useState(1);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [notice, setNotice] = useState(migratedPicks >= 0);

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
  const budget = useMemo(() => computeBudget(view), [view]);

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

  const previewing = preview !== null;
  const update = useCallback(
    (fn: (d: ItineraryData) => ItineraryData) => {
      if (locked) return;
      if (previewing) setPreview((p) => (p ? fn(p) : p));
      else setData((d) => fn(d));
    },
    [locked, previewing],
  );
  const setLength = useCallback(
    (len: number) => {
      if (len === PREVIEW_DAYS) {
        setPreview(makePreview(data));
        toast("Previewing 5 days · 4 nights — nothing here is saved");
      } else if (previewing) {
        setPreview(null);
        toast("Back to your 6-day plan");
      }
    },
    [data, previewing, toast],
  );

  // Currency is a display preference: it always sticks, even while previewing.
  const onCurrency = useCallback(
    (code: CurrencyCode) => {
      if (locked) return;
      const set = (d: ItineraryData) => ({ ...d, preferences: { ...d.preferences, currency: code } });
      setData(set);
      setPreview((p) => (p ? set(p) : p));
    },
    [locked],
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

  const canVisit = (s: Step) => s === "dates" || !!view.startDate;
  const showBudget = !!view.startDate && step !== "dates";

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
        preview={previewing ? { onExit: () => setLength(TRIP_DAYS) } : null}
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
                <b className="text-ink">The group voted for 6 days · 5 nights</b> — 1 night in Colombo, then 4 in Galle. We&apos;ve
                moved your plan over{migratedPicks > 0 ? ` and a few picks need redoing (${migratedPicks} cleared)` : ""}. Everything else
                is just as you left it.
              </p>
              <button onClick={() => setNotice(false)} aria-label="Dismiss" className="-mr-1 -mt-1 grid size-8 place-items-center rounded-full hover:bg-saffron-200">
                <X className="size-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {previewing && (
        <div className="relative z-20 mx-3 mt-3 flex items-center gap-3 rounded-2xl bg-saffron-400 p-3 text-[13.5px] leading-snug text-ink shadow-card">
          <FlaskConical className="size-5 shrink-0" />
          <p className="flex-1">
            <b>Previewing 5 days · 4 nights.</b> A sandbox — nothing here is saved.
          </p>
          <button
            onClick={() => setLength(TRIP_DAYS)}
            className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-[12.5px] font-bold text-paper hover:bg-ink-2"
          >
            Back to 6 days
          </button>
        </div>
      )}
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div
          key={step}
          custom={direction}
          initial={{ opacity: 0, x: 36 * direction }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -36 * direction }}
          transition={{ type: "spring", stiffness: 420, damping: 38 }}
        >
          {step === "dates" && (
            <DatesStep
              data={view}
              update={update}
              locked={locked}
              length={previewing ? PREVIEW_DAYS : TRIP_DAYS}
              onLength={setLength}
              onNext={() => setStep("build")}
            />
          )}
          {step === "build" && (
            <BuildStep
              data={view}
              update={update}
              locked={locked}
              budget={budget}
              onOpenBudget={() => setBudgetOpen(true)}
              onBack={() => setStep("dates")}
              onNext={() => setStep("prefs")}
            />
          )}
          {step === "prefs" && <PrefsStep data={view} update={update} locked={locked} onNext={() => setStep("review")} />}
          {step === "review" && (
            <ReviewStep
              name={name}
              data={view}
              previewing={previewing}
              onExitPreview={() => setLength(TRIP_DAYS)}
              status={status}
              updatedAt={updatedAt}
              locked={locked}
              saveState={save.state}
              budget={budget}
              onOpenBudget={() => setBudgetOpen(true)}
              onEdit={(s) => setStep(s)}
              onSubmit={async () => {
                if (previewing) return false;
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
