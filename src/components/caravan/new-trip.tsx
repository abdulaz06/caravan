"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Copy, Share2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { Destination } from "@/lib/server/destinations";
import { CaravanMark, Lockup } from "../brand/wordmark";
import { Button, ButtonLink } from "../ui/button";
import { Photo } from "../ui/photo";
import { PinInput } from "../ui/pin-input";
import { useToast } from "../ui/toast";
import { CaseStudyLink } from "./case-study-link";

type Created = { slug: string; name: string; url: string; presetId: string };
type Err = { field?: string; message: string } | null;

/** Start a trip: pick a destination, name it, become its owner, get the invite link. */
export function NewTrip({ destinations, initial }: { destinations: Destination[]; initial: string | null }) {
  const [created, setCreated] = useState<Created | null>(null);
  return (
    <div className="min-h-dvh bg-surface-100">
      <div className="mx-auto max-w-[560px] px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))]">
        <header className="flex h-14 items-center justify-between">
          <Link href="/" aria-label="Caravan home" className="-ml-1 flex items-center gap-1 rounded-full px-1 py-1 text-ink-2 hover:text-ink">
            <ArrowLeft className="size-4" />
            <Lockup size="sm" />
          </Link>
          <CaseStudyLink />
        </header>
        <AnimatePresence mode="wait" initial={false}>
          {created ? (
            <motion.div key="done" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <TripReady trip={created} destination={destinations.find((d) => d.id === created.presetId) ?? null} />
            </motion.div>
          ) : (
            <motion.div key="form" exit={{ opacity: 0, y: -16 }}>
              <NewTripForm destinations={destinations} initial={initial} onCreated={setCreated} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function NewTripForm({
  destinations,
  initial,
  onCreated,
}: {
  destinations: Destination[];
  initial: string | null;
  onCreated: (t: Created) => void;
}) {
  const [presetId, setPresetId] = useState<string | null>(initial);
  const chosen = destinations.find((d) => d.id === presetId) ?? null;
  const [tripName, setTripName] = useState(chosen?.suggestedName ?? "");
  const [named, setNamed] = useState(false);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Err>(null);
  const pinRef = useRef<HTMLInputElement>(null);

  function choose(d: Destination) {
    setPresetId(d.id);
    if (!named) setTripName(d.suggestedName);
    if (err?.field === "preset") setErr(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!presetId) return setErr({ field: "preset", message: "Pick a destination first" });
    if (tripName.trim().length < 2) return setErr({ field: "tripName", message: "Give the trip a name" });
    if (!name.trim()) return setErr({ field: "name", message: "Tell us your name" });
    if (pin.length !== 4) return setErr({ field: "pin", message: "Pick a 4-digit PIN" });
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presetId, tripName, name, pin, website }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        window.scrollTo({ top: 0 });
        return onCreated(body as Created);
      }
      setErr({ field: body.field, message: body.error ?? "Something went wrong — try again." });
    } catch {
      setErr({ message: "Couldn't reach the server — check your connection." });
    }
    setBusy(false);
  }

  const input = (bad: boolean) =>
    cn(
      "mt-2 h-14 w-full rounded-2xl border-2 bg-paper px-4 text-[18px] font-medium outline-none transition placeholder:text-ink-3/50 focus:border-primary-600",
      bad ? "border-accent-500" : "border-surface-300",
    );

  return (
    <form onSubmit={submit} noValidate>
      <h1 className="font-display mt-4 text-[40px] font-semibold leading-[1] tracking-[-0.03em]">
        Start a <span className="italic text-accent-600">trip</span>
      </h1>
      <p className="mt-3 max-w-md text-[15.5px] leading-relaxed text-ink-2">
        Pick where you&apos;re going. You&apos;ll get one link for the group chat; everyone builds their own version of the trip, and
        you see where it overlaps.
      </p>

      <h2 className="label mt-8 text-ink-3">1 · Destination</h2>
      <div role="radiogroup" aria-label="Destination" className="mt-3 grid gap-3">
        {destinations.map((d) => (
          <DestinationCard key={d.id} d={d} selected={d.id === presetId} onSelect={() => choose(d)} />
        ))}
        <p className="rounded-2xl border-2 border-dashed border-surface-300 px-4 py-3 text-[13px] leading-snug text-ink-3">
          More destinations are on the way. Each one is a typed JSON preset: options, day structure, drive times, map and theme.
        </p>
      </div>
      {err?.field === "preset" && <p className="mt-2 text-sm font-semibold text-accent-600">{err.message}</p>}

      <AnimatePresence initial={false}>
        {chosen && (
          <motion.div
            key="details"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <h2 className="label mt-9 text-ink-3">2 · The trip</h2>
            <label htmlFor="trip-name" className="mt-3 block text-[14px] font-semibold text-ink-2">
              Trip name
            </label>
            <input
              id="trip-name"
              value={tripName}
              onChange={(e) => {
                setTripName(e.target.value);
                setNamed(true);
                if (err?.field === "tripName") setErr(null);
              }}
              placeholder={chosen.suggestedName}
              maxLength={60}
              className={cn(input(err?.field === "tripName"), "font-display text-[22px]")}
            />
            <p className="mt-1.5 text-[12.5px] text-ink-3">Shown on the invite and at the top of everyone&apos;s plan.</p>

            <h2 className="label mt-9 text-ink-3">3 · You</h2>
            <label htmlFor="owner-name" className="mt-3 block text-[14px] font-semibold text-ink-2">
              Your name
            </label>
            <input
              id="owner-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (err?.field === "name") setErr(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), pinRef.current?.focus())}
              placeholder="Your name"
              autoComplete="given-name"
              autoCapitalize="words"
              maxLength={30}
              className={input(err?.field === "name")}
            />
            <label htmlFor="owner-pin" className="mt-5 block text-[14px] font-semibold text-ink-2">
              Choose a 4-digit PIN
            </label>
            <div className="mt-2">
              <PinInput
                id="owner-pin"
                ref={pinRef}
                label="Choose a 4-digit PIN"
                value={pin}
                onChange={(v) => {
                  setPin(v);
                  if (err?.field === "pin") setErr(null);
                }}
                error={err?.field === "pin"}
              />
            </div>
            <p className="mt-2 text-[12.5px] text-ink-3">No email, no password: your name and PIN get you back in from any phone.</p>
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="absolute left-[-9999px] size-px opacity-0"
            />

            <div className="mt-7 flex gap-3 rounded-2xl bg-paper p-4 text-[13.5px] leading-snug text-ink-2 shadow-card">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-secondary-700" />
              <p>
                You&apos;ll be the trip&apos;s <b className="text-ink">owner</b>: set the dates and rules, make co-organizers, and see
                everyone&apos;s picks (and the private answers) in the organizer console.
              </p>
            </div>
            {err?.message && !["preset"].includes(err.field ?? "") && (
              <p role="alert" className="mt-4 text-sm font-semibold text-accent-600">
                {err.message}
              </p>
            )}
            <Button type="submit" size="lg" block className="mt-6" disabled={busy}>
              {busy ? "Starting…" : "Start the trip"} <ArrowRight className="size-5" strokeWidth={2.5} />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}

function DestinationCard({ d, selected, onSelect }: { d: Destination; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "group relative block aspect-[4/3] w-full overflow-hidden rounded-[22px] text-left shadow-card outline-none transition sm:aspect-[16/10]",
        "focus-visible:ring-4 focus-visible:ring-primary-500/40",
        selected ? "ring-4 ring-offset-2 ring-offset-surface-100" : "hover:-translate-y-0.5",
      )}
      style={{ ["--tw-ring-color" as string]: selected ? d.colors.glow : undefined, background: d.colors.deep }}
    >
      <Photo photo={d.photo ?? undefined} alt={d.name} sizes="(min-width: 600px) 560px, 100vw" className="transition duration-500 group-hover:scale-[1.03]" />
      <span className="absolute inset-0" style={{ background: `linear-gradient(to top, ${d.colors.deep} 10%, ${d.colors.deep}e0 40%, ${d.colors.deep}70 64%, transparent 90%)` }} />
      <span className="absolute inset-x-0 bottom-0 p-4 text-white">
        <span className="label block" style={{ color: d.colors.glow }}>
          {d.season}
        </span>
        <span className="font-display mt-1 block text-[30px] font-semibold leading-none tracking-[-0.02em]">{d.name}</span>
        <span className="mt-1.5 block text-[13px] font-medium text-white/85">
          {d.length} · {d.shape}
        </span>
        <span className="mt-0.5 block text-[12.5px] text-white/65">
          {d.tagline} · {d.options} things to do
        </span>
      </span>
      <span
        className={cn(
          "absolute right-3 top-3 grid size-8 place-items-center rounded-full transition",
          selected ? "scale-100 text-ink" : "scale-90 bg-black/25 text-transparent ring-2 ring-white/70 backdrop-blur",
        )}
        style={selected ? { background: d.colors.glow } : undefined}
        aria-hidden="true"
      >
        <Check className="size-4.5" strokeWidth={3} />
      </span>
    </button>
  );
}

function TripReady({ trip, destination }: { trip: Created; destination: Destination | null }) {
  const router = useRouter();
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const link = typeof window === "undefined" ? trip.url : `${window.location.origin}${trip.url}`;
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Couldn't copy — press and hold the link instead", "error");
    }
  }

  async function share() {
    try {
      await navigator.share({ title: trip.name, text: `Help plan ${trip.name}: build your version of the trip.`, url: link });
    } catch {
      /* closed the share sheet */
    }
  }

  return (
    <div className="pt-6">
      <motion.div
        initial={{ scale: 0.4, rotate: -30, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 14 }}
        className="grid size-16 place-items-center rounded-[20px] bg-primary-900 shadow-card"
      >
        <CaravanMark tone="light" className="size-10" />
      </motion.div>
      <h1 className="font-display mt-6 text-[38px] font-semibold leading-[1.02] tracking-[-0.03em]">
        {trip.name} <span className="italic text-accent-600">is live</span>
      </h1>
      <p className="mt-3 text-[15.5px] leading-relaxed text-ink-2">
        Drop this link in the group chat. Friends join with a name and a 4-digit PIN, then build their own version of the trip.
      </p>

      <div className="mt-6 rounded-[22px] bg-paper p-4 shadow-card">
        <p className="label text-ink-3">Invite link</p>
        <p className="mt-2 select-all break-all font-mono text-[15px] font-semibold text-ink" data-testid="invite-link">
          {link}
        </p>
        <div className="mt-4 flex gap-2">
          <Button variant="ocean" size="md" onClick={copy} className="flex-1">
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Copied" : "Copy link"}
          </Button>
          {canShare && (
            <Button variant="outline" size="md" onClick={share} className="flex-1">
              <Share2 className="size-4" /> Share
            </Button>
          )}
        </div>
      </div>

      <Button
        size="lg"
        block
        className="mt-6"
        onClick={() => {
          router.push(`${trip.url}/trip`);
        }}
      >
        Build my version <ArrowRight className="size-5" strokeWidth={2.5} />
      </Button>
      <ButtonLink href={`${trip.url}/admin`} variant="ghost" size="md" block className="mt-2">
        <ShieldCheck className="size-4" /> Open the organizer console
      </ButtonLink>
      {destination && (
        <p className="mt-6 text-center text-[12.5px] text-ink-3">
          {destination.name} · {destination.length} · you can change the dates and nights in the console
        </p>
      )}
    </div>
  );
}
