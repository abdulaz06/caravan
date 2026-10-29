"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, FlaskConical, PencilRuler, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { computeBudget } from "@/engine/budget";
import { familyView } from "@/engine/family";
import { expandToFull, isSubmittable, makePreview, setRange, type ItineraryData, type ItineraryStatus } from "@/engine/itinerary";
import type { PopularPayload } from "@/engine/popular";
import { allowedLengths, daysNightsLabel, defaultLength, isFixed, previewAvailable, previewDays, tripDays } from "@/engine/structure";
import type { CurrencyCode } from "@/lib/currency";
import { useEngine, useTrip } from "../engine";
import { FamilyProvider } from "../family";
import { PlanOutBar } from "../plan/plan-out-bar";
import { PopularProvider } from "../popular";
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
  /** Owner + admin names for the privacy line. */
  organizers: string[];
  isOrganizer?: boolean;
  /** Unique people who peeked at this plan. */
  peekCount?: number;
  /** An unseen organizer edit or rules change to mention once. */
  stamp?: PlanStamp | null;
  /** An organizer editing someone else's plan from the console. */
  admin?: { targetId: string; targetName: string } | null;
  /** 🔥 Popular pick counts (refreshed in the background). */
  popular?: PopularPayload | null;
  /** People who can be picked as a roommate (started a plan, not this person). */
  roommateCandidates?: { id: string; name: string }[];
  /** The organizers have published the group plan. */
  planOut?: boolean;
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
  organizers,
  isOrganizer = false,
  peekCount = 0,
  stamp = null,
  admin = null,
  popular = null,
  roommateCandidates = [],
  planOut = false,
}: Props) {
  const e = useEngine();
  const trip = useTrip();
  const router = useRouter();
  const toast = useToast();
  const full = tripDays(e);
  const short = previewDays(e);
  // `data` is the real plan (autosaved). `preview` is the shorter sandbox that
  // lives only in this tab — switching back restores `data` untouched.
  const [data, setData] = useState(initialData);
  const [preview, setPreview] = useState<ItineraryData | null>(null);
  // Family-friendly mode: a view-only switch on the review page. Never saved; resets on leaving the page.
  const [family, setFamily] = useState(false);
  const view = preview ?? data;
  // Organizers editing on someone's behalf can edit even while edits are locked.
  const [locked, setLocked] = useState(editsLocked && !admin);
  const [step, setStepState] = useState<Step>(() => initialStep(initialData, initialStatus, editsLocked && !admin, requestedStep));
  const [direction, setDirection] = useState(1);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [stampNote, setStampNote] = useState(admin ? null : stamp);
  // New dates that cleared picks: said once, with an undo.
  const [reflowNote, setReflowNote] = useState<{ cleared: string[]; before: ItineraryData } | null>(null);

  const save = useAutosave(data, {
    enabled: !locked,
    url: admin ? trip.api(`/admin/participants/${admin.targetId}/itinerary`) : trip.api("/itinerary"),
    onLocked: () => {
      setLocked(true);
      toast("Edits are closed now — your last change wasn't saved.", "error");
    },
    onSignedOut: () => router.replace(trip.href(admin ? "/admin" : "/join")),
  });
  const status = save.status ?? initialStatus;
  const updatedAt = save.updatedAt ?? initialUpdatedAt;
  // Family-friendly mode shows the budget of the swapped plan (display only — exclusions can't be toggled while it's on).
  const budget = useMemo(() => computeBudget(e, family ? familyView(e, view) : view), [e, view, family]);

  const setStep = useCallback((next: Step, push = true) => {
    setFamily(false);
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
  const length = view.days.length || (previewing ? short : isFixed(e) ? full : defaultLength(e));
  const lastBase = e.catalog.bases[e.catalog.bases.length - 1];
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
        if (!previewAvailable(e) || savedShort || previewing) return;
        setPreview(makePreview(e, data));
        toast(allowedLengths(e).includes(short) ? `Trying ${daysNightsLabel(short)} — submit it if you prefer it` : `Previewing ${daysNightsLabel(short)} — nothing here is saved`);
      } else if (previewing) {
        setPreview(null);
        toast(`Back to your ${daysNightsLabel(full)} plan`);
      } else if (savedShort && !locked) {
        setData((d) => expandToFull(e, d));
        toast(`Back to ${daysNightsLabel(full)} — an empty ${lastBase.name} day is back in`);
      }
    },
    [e, data, full, lastBase.name, locked, previewing, savedShort, short, toast],
  );

  // Free dates: a new start and end re-flows the days, keeping every pick that still fits.
  const onRange = useCallback(
    (start: string, end: string) => {
      if (locked) return;
      const before = data;
      const r = setRange(e, before, start, end);
      setData(r.data);
      // A run of changes is one note: everything cleared since it appeared, and Undo goes back to before the first.
      setReflowNote((prev) => (r.lost || prev ? { cleared: [...(prev?.cleared ?? []), ...r.cleared], before: prev?.before ?? before } : null));
    },
    [e, data, locked],
  );

  // Currency is a display preference: it always sticks, even while previewing.
  const onCurrency = useCallback(
    (code: CurrencyCode) => {
      if (locked || family) return;
      const set = (d: ItineraryData) => ({ ...d, preferences: { ...d.preferences, currency: code } });
      setData(set);
      setPreview((p) => (p ? set(p) : p));
    },
    [locked, family],
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
  const toggleAccommodation = useCallback((on: boolean) => update((d) => ({ ...d, budget: { ...d.budget, accommodation: on } })), [update]);

  const canVisit = (s: Step) => s === "dates" || !!view.startDate;
  const showBudget = !!view.startDate && step !== "dates";
  const submittablePreview = previewing && allowedLengths(e).includes(short);

  function dismissStamp() {
    setStampNote(null);
    void fetch(trip.api("/itinerary/ack"), { method: "POST" });
  }

  return (
    <FamilyProvider on={family}>
      <PopularProvider initial={popular}>
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
            <div className="mx-3 mt-3 flex items-center gap-3 rounded-2xl bg-secondary-800 p-3 text-[13.5px] leading-snug text-paper shadow-card" role="status">
              <PencilRuler className="size-5 shrink-0 text-highlight-400" />
              <p className="flex-1">
                <b>Editing {admin.targetName}&apos;s plan as an organizer.</b>{" "}
                <span className="text-paper/70">Changes save as you go and are stamped with your name — even while edits are locked.</span>
              </p>
            </div>
          )}
          {!admin && (
            <>
              {/* An announcement is free text — family-friendly mode leaves it out. */}
              {!family && <AnnouncementBar />}
              {planOut && <PlanOutBar />}
              <LockCountdown onLocked={() => setLocked(true)} />
            </>
          )}
          <AnimatePresence>
            {stampNote && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div role="status" aria-label="Organizer update" className="mx-3 mt-3 flex items-start gap-3 rounded-2xl bg-paper p-3.5 text-[13.5px] leading-snug text-ink-2 shadow-card ring-1 ring-ink/5">
                  <PencilRuler className="mt-0.5 size-[18px] shrink-0 text-primary-600" />
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
                  <button onClick={dismissStamp} aria-label="Dismiss update" className="-mr-1 -mt-1 grid size-8 place-items-center rounded-full hover:bg-surface-100">
                    <X className="size-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {reflowNote && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div role="status" aria-label="Your dates changed" className="mx-3 mt-3 flex items-start gap-3 rounded-2xl bg-paper p-3.5 text-[13.5px] leading-snug text-ink-2 shadow-card ring-1 ring-ink/5">
                  <CalendarClock className="mt-0.5 size-[18px] shrink-0 text-primary-600" />
                  <p className="flex-1">
                    <b className="text-ink">New dates, same plan</b> — except {reflowNote.cleared.length === 1 ? "one pick that doesn't" : `${reflowNote.cleared.length} picks that don't`} fit any more:{" "}
                    {reflowNote.cleared.map((id) => e.catalog.byId[id]?.title ?? "Stay in").join(", ")}.
                  </p>
                  <div className="-mr-1 -mt-1 flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => {
                        setData(reflowNote.before);
                        setReflowNote(null);
                      }}
                      className="rounded-full bg-surface-200 px-3 py-1.5 text-[12.5px] font-bold text-ink hover:bg-surface-300"
                    >
                      Undo
                    </button>
                    <button onClick={() => setReflowNote(null)} aria-label="Dismiss" className="grid size-8 place-items-center rounded-full hover:bg-surface-100">
                      <X className="size-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {previewing && (
            <div className="relative z-20 mx-3 mt-3 flex items-center gap-3 rounded-2xl bg-highlight-400 p-3 text-[13.5px] leading-snug text-ink shadow-card">
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
              <button onClick={() => setLength(full)} className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-[12.5px] font-bold text-paper hover:bg-ink-2">
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
                <DatesStep data={view} update={update} onRange={onRange} locked={locked} length={length} onLength={setLength} onNext={() => setStep("build")} />
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
              {step === "prefs" && (
                <PrefsStep data={view} update={update} locked={locked} organizers={organizers} candidates={roommateCandidates} onNext={() => setStep("review")} />
              )}
              {step === "review" && (
                <ReviewStep
                  name={admin ? admin.targetName : name}
                  data={view}
                  previewing={previewing}
                  canSubmitPreview={submittablePreview}
                  onExitPreview={() => setLength(full)}
                  family={family}
                  onFamily={admin ? undefined : setFamily}
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
                    if (admin || !isSubmittable(e, target)) return false;
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
              locked={locked || family}
              onToggleLine={toggleLine}
              onToggleAccommodation={toggleAccommodation}
              onEditBudget={() => setStep("prefs")}
            />
          )}
          <BudgetSheet
            open={budgetOpen}
            onClose={() => setBudgetOpen(false)}
            budget={budget}
            locked={locked || family}
            onToggleLine={toggleLine}
            onToggleAccommodation={toggleAccommodation}
            onEditBudget={() => {
              setBudgetOpen(false);
              setStep("prefs");
            }}
          />
        </div>
      </PopularProvider>
    </FamilyProvider>
  );
}
