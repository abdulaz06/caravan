"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { ItineraryData, ItineraryStatus } from "@/lib/itinerary";
import { useToast } from "../ui/toast";
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
};

function initialStep(data: ItineraryData, status: ItineraryStatus, locked: boolean, requested?: string): Step {
  if (requested && STEPS.includes(requested as Step) && (requested === "dates" || data.startDate)) {
    return requested as Step;
  }
  if (status === "submitted" || locked) return "review";
  return data.startDate ? "build" : "dates";
}

export function TripApp({ name, initialData, initialStatus, initialUpdatedAt, editsLocked, requestedStep }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [data, setData] = useState(initialData);
  const [locked, setLocked] = useState(editsLocked);
  const [step, setStepState] = useState<Step>(() =>
    initialStep(initialData, initialStatus, editsLocked, requestedStep),
  );
  const [direction, setDirection] = useState(1);

  const save = useAutosave(data, {
    enabled: !locked,
    onLocked: () => {
      setLocked(true);
      toast("Edits are closed now — your last change wasn't saved.", "error");
    },
    onSignedOut: () => router.replace("/join"),
  });
  const status = save.status ?? initialStatus;
  const updatedAt = save.updatedAt ?? initialUpdatedAt;

  const setStep = useCallback(
    (next: Step, push = true) => {
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
    },
    [],
  );

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

  const canVisit = (s: Step) => s === "dates" || !!data.startDate;

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
      />
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
            <DatesStep data={data} update={update} locked={locked} onNext={() => setStep("build")} />
          )}
          {step === "build" && (
            <BuildStep
              data={data}
              update={update}
              locked={locked}
              onBack={() => setStep("dates")}
              onNext={() => setStep("prefs")}
            />
          )}
          {step === "prefs" && (
            <PrefsStep data={data} update={update} locked={locked} onNext={() => setStep("review")} />
          )}
          {step === "review" && (
            <ReviewStep
              name={name}
              data={data}
              status={status}
              updatedAt={updatedAt}
              locked={locked}
              saveState={save.state}
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
    </div>
  );
}
