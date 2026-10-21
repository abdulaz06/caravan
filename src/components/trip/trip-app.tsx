"use client";

import { AnimatePresence, motion } from "framer-motion";
import { FlaskConical, MapPinned, PencilRuler, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { computeBudget } from "@/lib/budget";
import type { CurrencyCode } from "@/lib/currency";
import {
  daysNightsLabel,
  expandToFull,
  isSubmittable,
  makePreview,
  nights,
  type ItineraryData,
  type ItineraryStatus,
} from "@/lib/itinerary";
import { allowedLengths, previewAvailable, previewDays, tripDays } from "@/lib/rules";
import { AnnouncementBar, LockCountdown } from "../rules";
import { LocalTime } from "../ui/local-time";
import { useToast } from "../ui/toast";
import { BudgetSheet, BudgetSidePanel } from "./budget";
import { BuildStep } from "./build-step";
import { DatesStep } from "./dates-step";
import { TripHeader, type Step } from "./header";
import { PrefsStep } from "./prefs-step";
import { ReviewStep } from "./review-step";
import { useAutosave } from "./use-autosave";

const STEPS: Step[] = ["dates", "build", "prefs", "review"];

export type PlanStamp = { kind: "edit" | "rules"; by: string; at: string; lost?: number; text?: string };

type Props = {
  name: string;
  initialData: ItineraryData;
  initialStatus: ItineraryStatus;
  initialUpdatedAt: string | null;
  /** Locked by hand or by the scheduled auto-lock. */
  editsLocked: boolean;
  requestedStep?: string;
  /** Picks cleared when an older itinerary moved onto the day structure (-1 = no upgrade). */
  migratedPicks?: number;
  needsUpgradeSave?: boolean;
  /** Owner + admin names for the privacy line ("Abdul & Aadil"). */
  organizers: string[];
  isOrganizer?: boolean;
  /** Unique people who peeked at this plan. */
  peekCount?: number;
  /** An unseen organizer edit or rules change to mention once. */
  stamp?: PlanStamp | null;
  /** An organizer editing someone else's plan from the console. */
  admin?: { targetId: string; targetName: string } | null;
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
  organizers,
  isOrganizer = false,
  peekCount = 0,
  stamp = null,
  admin = null,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const full = tripDays();
  const short = previewDays();
  // `data` is the real plan (autosaved). `preview` is the shorter sandbox that
  // lives only in this tab — switching back restores `data` untouched.
  const [data, setData] = useState(initialData);
  const [preview, setPreview] = useState<ItineraryData | null>(null);
  // Halal mode: a view-only easter egg on the review page. Never saved; resets on leaving the page.
  const [halal, setHalal] = useState(false);
  const view = preview ?? data;
  // Organizers editing on someone's behalf can edit even while edits are locked.
  const [locked, setLocked] = useState(editsLocked && !admin);
  const [step, setStepState] = useState<Step>(() =>
    initialStep(initialData, initialStatus, editsLocked && !admin, migratedPicks > 0 ? "build" : requestedStep),
  );
  const [direction, setDirection] = useState(1);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [notice, setNotice] = useState(migratedPicks >= 0 && !admin);
  const [stampNote, setStampNote] = useState(admin ? null : stamp);

  const save = useAutosave(data, {
    enabled: !locked,
    saveOnMount: needsUpgradeSave && !editsLocked && !admin,
    url: admin ? `/api/admin/participants/${admin.targetId}/itinerary` : undefined,
    onLocked: () => {
      setLocked(true);
      toast("Edits are closed now — your last change wasn't saved.", "error");
    },
    onSignedOut: () => router.replace(admin ? "/admin" : "/join"),
  });
  const status = save.status ?? initialStatus;
  const updatedAt = save.updatedAt ?? initialUpdatedAt;
  const budget = useMemo(() => computeBudget(view), [view]);

  const setStep = useCallback((next: Step, push = true) => {
    setHalal(false);
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
  /** A shorter plan that was submitted while the rules allowed it. */
  const savedShort = !!data.startDate && data.days.length === short && short !== full;
  const length = view.days.length || (previewing ? short : full);
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
      if (len === short) {
        if (!previewAvailable() || savedShort || previewing) return;
        setPreview(makePreview(data));
        toast(
          allowedLengths().includes(short)
            ? `Trying ${daysNightsLabel(short)} — submit it if you prefer it`
            : `Previewing ${daysNightsLabel(short)} — nothing here is saved`,
        );
      } else if (previewing) {
        setPreview(null);
        toast(`Back to your ${daysNightsLabel(full)} plan`);
      } else if (savedShort && !locked) {
        setData((d) => expandToFull(d));
        toast(`Back to ${daysNightsLabel(full)} — an empty Galle day is back in`);
      }
    },
    [data, full, locked, previewing, savedShort, short, toast],
  );

  // Currency is a display preference: it always sticks, even while previewing.
  const onCurrency = useCallback(
    (code: CurrencyCode) => {
      if (locked || halal) return;
      const set = (d: ItineraryData) => ({ ...d, preferences: { ...d.preferences, currency: code } });
      setData(set);
      setPreview((p) => (p ? set(p) : p));
    },
    [locked, halal],
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
  const n = nights(full);
  const submittablePreview = previewing && allowedLengths().includes(short);

  function dismissStamp() {
    setStampNote(null);
    void fetch("/api/itinerary/ack", { method: "POST" });
  }

  return (
    <div className="min-h-dvh">
      <TripHeader
        name={admin ? admin.targetName : name}
        step={step}
        canVisit={canVisit}
        onStep={(s) => setStep(s)}
        saveState={save.state}
        submitted={status === "submitted"}
        locked={locked}
        beforeLeave={() => save.flush()}
        onCurrency={onCurrency}
        preview={previewing ? { onExit: () => setLength(full), label: `${short}-day ${submittablePreview ? "plan" : "preview"}` } : null}
        organizer={isOrganizer && !admin}
        admin={admin ? { targetName: admin.targetName } : null}
      />
      {admin && (
        <div className="mx-3 mt-3 flex items-center gap-3 rounded-2xl bg-jungle-800 p-3 text-[13.5px] leading-snug text-paper shadow-card" role="status">
          <PencilRuler className="size-5 shrink-0 text-saffron-400" />
          <p className="flex-1">
            <b>Editing {admin.targetName}&apos;s plan as an organizer.</b> <span className="text-paper/70">Changes save as you go and are stamped with your name — even while edits are locked.</span>
          </p>
        </div>
      )}
      {!admin && (
        <>
          <AnnouncementBar />
          <LockCountdown onLocked={() => setLocked(true)} />
        </>
      )}
      <AnimatePresence>
        {notice && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mx-3 mt-3 flex items-start gap-3 rounded-2xl bg-saffron-100 p-3.5 text-[14px] leading-snug text-ink-2 ring-1 ring-saffron-200">
              <MapPinned className="mt-0.5 size-5 shrink-0 text-sunset-600" />
              <p className="flex-1">
                <b className="text-ink">The group voted for {daysNightsLabel(full)}</b> — {n.colombo} {n.colombo === 1 ? "night" : "nights"} in Colombo, then{" "}
                {n.galle} in Galle. We&apos;ve moved your plan over{migratedPicks > 0 ? ` and a few picks need redoing (${migratedPicks} cleared)` : ""}.
                Everything else is just as you left it.
              </p>
              <button onClick={() => setNotice(false)} aria-label="Dismiss" className="-mr-1 -mt-1 grid size-8 place-items-center rounded-full hover:bg-saffron-200">
                <X className="size-4" />
              </button>
            </div>
          </motion.div>
        )}
        {stampNote && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div role="status" aria-label="Organizer update" className="mx-3 mt-3 flex items-start gap-3 rounded-2xl bg-paper p-3.5 text-[13.5px] leading-snug text-ink-2 shadow-card ring-1 ring-ink/5">
              <PencilRuler className="mt-0.5 size-[18px] shrink-0 text-ocean-600" />
              <p className="flex-1">
                {stampNote.kind === "edit" ? (
                  <>
                    <b className="text-ink">{stampNote.by}</b> updated your plan on <LocalTime iso={stampNote.at} as="date" />.
                  </>
                ) : (
                  <>
                    <b className="text-ink">The organizers changed the trip</b>
                    {stampNote.text ? ` to ${stampNote.text}` : ""} on <LocalTime iso={stampNote.at} as="date" />. We&apos;ve moved your plan over
                    {stampNote.lost ? ` — ${stampNote.lost} ${stampNote.lost === 1 ? "pick needs" : "picks need"} redoing` : ""}.
                  </>
                )}
              </p>
              <button onClick={dismissStamp} aria-label="Dismiss update" className="-mr-1 -mt-1 grid size-8 place-items-center rounded-full hover:bg-sand-100">
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
            {submittablePreview ? (
              <>
                <b>Trying {daysNightsLabel(short)}.</b> Submit it if you prefer the shorter trip — your {full}-day plan stays until you do.
              </>
            ) : (
              <>
                <b>Previewing {daysNightsLabel(short)}.</b> A sandbox — nothing here is saved.
              </>
            )}
          </p>
          <button
            onClick={() => setLength(full)}
            className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-[12.5px] font-bold text-paper hover:bg-ink-2"
          >
            Back to {full} days
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
            <DatesStep data={view} update={update} locked={locked} length={length} onLength={setLength} onNext={() => setStep("build")} />
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
          {step === "prefs" && <PrefsStep data={view} update={update} locked={locked} organizers={organizers} onNext={() => setStep("review")} />}
          {step === "review" && (
            <ReviewStep
              name={admin ? admin.targetName : name}
              data={view}
              previewing={previewing}
              canSubmitPreview={submittablePreview}
              onExitPreview={() => setLength(full)}
              halal={halal}
              onHalal={admin ? undefined : setHalal}
              status={status}
              updatedAt={updatedAt}
              locked={locked}
              saveState={save.state}
              budget={budget}
              onOpenBudget={() => setBudgetOpen(true)}
              onEdit={(s) => setStep(s)}
              peekCount={admin ? 0 : peekCount}
              adminMode={!!admin}
              onSubmit={async () => {
                const target = preview ?? data;
                if (admin || !isSubmittable(target)) return false;
                const r = await save.submit(target);
                if (!r.ok) toast(r.code === 423 ? "Edits are closed." : "Couldn't submit — try again.", "error");
                else if (preview) {
                  setData(preview);
                  setPreview(null);
                }
                return r.ok;
              }}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {showBudget && (
        <BudgetSidePanel
          budget={budget}
          locked={locked || halal}
          onToggleLine={toggleLine}
          onToggleAccommodation={toggleAccommodation}
          onEditBudget={() => setStep("prefs")}
        />
      )}
      <BudgetSheet
        open={budgetOpen}
        onClose={() => setBudgetOpen(false)}
        budget={budget}
        locked={locked || halal}
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
