"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMaybeEngine } from "./engine";
import { cn } from "@/lib/cn";
import { Avatar } from "./avatar";
import { Lockup } from "./brand/wordmark";
import { Button } from "./ui/button";
import { Photo } from "./ui/photo";
import { PinInput } from "./ui/pin-input";

type PersonLite = { id: string; name: string };

export function JoinFlow({ people, startReturning }: { people: PersonLite[]; startReturning: boolean }) {
  const [mode, setMode] = useState<"new" | "returning">(startReturning ? "returning" : "new");
  const [preselect, setPreselect] = useState<string | null>(null);
  const catalog = useMaybeEngine()?.catalog;
  const backdrop = catalog?.heroPhotos[1] ?? catalog?.heroPhotos[0];

  return (
    <div className="relative flex min-h-dvh flex-col bg-primary-900">
      <div className="absolute inset-x-0 top-0 h-[44dvh] overflow-hidden">
        <Photo photo={backdrop} alt={catalog?.preset.name ?? "Trip"} sizes="(min-width: 1024px) 480px, 100vw" priority />
        <div className="absolute inset-0 bg-gradient-to-b from-primary-950/50 via-primary-950/10 to-primary-900" />
      </div>
      <header className="relative z-10 flex items-center justify-between px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <Link href="/" aria-label="Back to start" className="grid size-10 place-items-center rounded-full bg-white/15 text-paper ring-1 ring-white/25 backdrop-blur-md">
          <ArrowLeft className="size-5" />
        </Link>
        <Lockup size="sm" tone="light" />
        <span className="size-10" />
      </header>

      <div className="relative z-10 mt-[22dvh] flex-1 rounded-t-[32px] bg-surface-50 px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-6 shadow-lift">
        <div className="grid grid-cols-2 rounded-full bg-surface-200/80 p-1" role="tablist">
          {(["new", "returning"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                "relative h-11 rounded-full text-[14.5px] font-semibold transition-colors",
                mode === m ? "text-ink" : "text-ink-3",
              )}
            >
              {mode === m && (
                <motion.span layoutId="join-tab" className="absolute inset-0 rounded-full bg-paper shadow-card" />
              )}
              <span className="relative">{m === "new" ? "I'm new" : "I've been here before"}</span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {mode === "new" ? (
            <motion.div key="new" initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}>
              <NewForm
                onExisting={(name) => {
                  const match = people.find((p) => p.name.toLowerCase() === name.toLowerCase());
                  setPreselect(match?.id ?? null);
                  setMode("returning");
                }}
              />
            </motion.div>
          ) : (
            <motion.div key="ret" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }}>
              <ReturningForm people={people} preselect={preselect} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function NewForm({ onExisting }: { onExisting: (name: string) => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ field?: string; message: string; taken?: boolean } | null>(null);
  const pinRef = useRef<HTMLInputElement>(null);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!name.trim()) return setErr({ field: "name", message: "Tell us your name first" });
    if (pin.length !== 4) return setErr({ field: "pin", message: "Pick a 4-digit PIN" });
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/auth/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, pin }),
      });
      const body = await res.json();
      if (res.ok) {
        router.replace("/trip");
        router.refresh();
        return;
      }
      if (body.error === "taken") {
        setErr({ field: "name", message: "", taken: true });
      } else {
        setErr({ field: body.field, message: body.error ?? "Something went wrong" });
      }
    } catch {
      setErr({ message: "Couldn't reach the server — check your connection." });
    }
    setBusy(false);
  }

  const first = name.trim().split(" ")[0] || "Sam";
  return (
    <form onSubmit={submit} className="pt-7">
      <h1 className="font-display text-[32px] font-semibold leading-[1.05] tracking-[-0.02em]">
        Welcome aboard <span className="italic text-accent-600">🌴</span>
      </h1>
      <p className="mt-2 text-[15px] text-ink-2">No email, no passwords. Just a name and a PIN.</p>

      <label htmlFor="name" className="label mt-7 block text-ink-3">
        What should we call you?
      </label>
      <input
        id="name"
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
        className={cn(
          "font-display mt-2 h-16 w-full rounded-2xl border-2 bg-paper px-4 text-[26px] font-medium outline-none transition placeholder:text-ink-3/50 focus:border-primary-600",
          err?.field === "name" ? "border-accent-500" : "border-surface-300",
        )}
      />
      <AnimatePresence>
        {err?.taken && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-2xl bg-highlight-100 p-3.5 text-[14px] leading-snug text-ink-2">
              There&apos;s already a <b className="text-ink">{name.trim()}</b> on the trip. Add your last initial —
              like{" "}
              <button
                type="button"
                className="font-semibold text-primary-700 underline decoration-2 underline-offset-2"
                onClick={() => {
                  setName(`${first} `);
                  setErr(null);
                  document.getElementById("name")?.focus();
                }}
              >
                “{first} K.”
              </button>
              {" "}— or{" "}
              <button type="button" onClick={() => onExisting(name.trim())} className="font-semibold text-primary-700 underline decoration-2 underline-offset-2">
                log in if that&apos;s you
              </button>
              .
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <label htmlFor="pin" className="label mt-7 block text-ink-3">
        Choose a 4-digit PIN
      </label>
      <div className="mt-2">
        <PinInput
          id="pin"
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
      <p className="mt-2.5 text-[13px] text-ink-3">So you can get back in from another phone. Don&apos;t lose it!</p>
      {err?.message && <p className="mt-3 text-sm font-semibold text-accent-600">{err.message}</p>}

      <Button type="submit" size="lg" block className="mt-8" disabled={busy}>
        {busy ? "Joining…" : "Let's go"} <ArrowRight className="size-5" strokeWidth={2.5} />
      </Button>
    </form>
  );
}

function ReturningForm({ people, preselect }: { people: PersonLite[]; preselect: string | null }) {
  const router = useRouter();
  const [selected, setSelected] = useState<PersonLite | null>(people.find((p) => p.id === preselect) ?? null);
  const [query, setQuery] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [lockedFor, setLockedFor] = useState(0);
  const pinRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (lockedFor <= 0) return;
    const t = setInterval(() => setLockedFor((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [lockedFor]);

  useEffect(() => {
    if (selected) setTimeout(() => pinRef.current?.focus(), 250);
  }, [selected]);

  const filtered = useMemo(
    () => people.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase())),
    [people, query],
  );

  async function login(code: string) {
    if (!selected || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id, pin: code }),
      });
      const body = await res.json();
      if (res.ok) {
        router.replace("/trip");
        router.refresh();
        return;
      }
      setPin("");
      setShake((s) => s + 1);
      if (body.error === "locked") {
        setLockedFor(body.retryAfter ?? 300);
        setMsg(null);
      } else if (body.error === "wrong_pin") {
        setMsg(`That's not it — ${body.remaining} ${body.remaining === 1 ? "try" : "tries"} left.`);
      } else {
        setMsg(body.error ?? "Something went wrong");
      }
    } catch {
      setMsg("Couldn't reach the server — check your connection.");
    }
    setBusy(false);
  }

  if (!people.length) {
    return (
      <div className="pt-10 text-center">
        <p className="font-display text-2xl font-semibold">Nobody&apos;s joined yet</p>
        <p className="mt-2 text-ink-2">Be the first — switch to “I&apos;m new”.</p>
      </div>
    );
  }

  return (
    <div className="pt-7">
      <AnimatePresence mode="wait" initial={false}>
        {!selected ? (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <h1 className="font-display text-[32px] font-semibold leading-[1.05] tracking-[-0.02em]">
              Welcome back! <span className="italic text-primary-700">Who are you?</span>
            </h1>
            {people.length > 8 && (
              <div className="relative mt-5">
                <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-3" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Find your name"
                  aria-label="Find your name"
                  className="h-12 w-full rounded-full border-2 border-surface-300 bg-paper pl-12 pr-4 outline-none focus:border-primary-600"
                />
              </div>
            )}
            <ul className="mt-5 grid grid-cols-2 gap-2.5">
              {filtered.map((p, i) => (
                <motion.li
                  key={p.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 12) * 0.03 }}
                >
                  <button
                    onClick={() => setSelected(p)}
                    className="flex w-full items-center gap-2.5 rounded-2xl bg-paper p-2.5 pr-3 text-left shadow-card transition hover:-translate-y-0.5 active:scale-[0.98]"
                  >
                    <Avatar name={p.name} />
                    <span className="truncate text-[15px] font-semibold">{p.name}</span>
                  </button>
                </motion.li>
              ))}
            </ul>
            <p className="mt-6 text-center text-[13px] text-ink-3">Not on the list? Switch to “I&apos;m new”.</p>
          </motion.div>
        ) : (
          <motion.div key="pin" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <button
              onClick={() => {
                setSelected(null);
                setPin("");
                setMsg(null);
              }}
              className="flex items-center gap-1.5 text-sm font-semibold text-ink-3"
            >
              <ArrowLeft className="size-4" /> Not you?
            </button>
            <div className="mt-4 flex items-center gap-3">
              <Avatar name={selected.name} className="size-14 text-2xl" />
              <h1 className="font-display text-[30px] font-semibold leading-tight tracking-[-0.02em]">
                Hi, {selected.name.split(" ")[0]}!
              </h1>
            </div>
            <label htmlFor="login-pin" className="label mt-7 block text-ink-3">
              Enter your PIN
            </label>
            <div className="mt-2" key={shake}>
              <PinInput
                id="login-pin"
                ref={pinRef}
                label="Enter your PIN"
                value={pin}
                onChange={setPin}
                onComplete={login}
                error={shake > 0 && !!msg}
                disabled={busy || lockedFor > 0}
              />
            </div>
            {lockedFor > 0 ? (
              <p className="mt-4 rounded-2xl bg-accent-100 p-3.5 text-sm text-accent-700">
                Too many tries. Take a breather and try again in{" "}
                <b>
                  {Math.floor(lockedFor / 60)}:{String(lockedFor % 60).padStart(2, "0")}
                </b>
                .
              </p>
            ) : (
              msg && <p className="mt-3 text-sm font-semibold text-accent-600">{msg}</p>
            )}
            <p className="mt-6 text-[13px] text-ink-3">Forgot your PIN? Ask an organizer to reset it for you.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
