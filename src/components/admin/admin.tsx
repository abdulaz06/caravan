"use client";

import { motion } from "framer-motion";
import { Database, Download, FileJson, FileSpreadsheet, KeyRound, Lock, LogOut, Trash2, Unlock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { rangeLabel } from "@/lib/dates";
import { Avatar } from "../avatar";
import { Wordmark } from "../brand/wordmark";
import { Button } from "../ui/button";
import { PinInput } from "../ui/pin-input";
import { useToast } from "../ui/toast";

type Row = {
  id: string;
  name: string;
  status: "new" | "draft" | "submitted";
  joinedAt: string;
  updatedAt: string | null;
  picks: number;
  startDate: string | null;
  endDate: string | null;
  days: number;
};

function when(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function AdminLogin() {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <div className="grain grid min-h-dvh place-items-center bg-ocean-900 px-5">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const res = await fetch("/api/admin/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password: pw }),
          });
          setBusy(false);
          if (res.ok) router.refresh();
          else setErr(true);
        }}
        className="relative z-[1] w-full max-w-sm rounded-[30px] bg-sand-50 p-6 shadow-lift"
      >
        <Wordmark />
        <h1 className="font-display mt-6 text-[30px] font-semibold leading-tight">Organizer only</h1>
        <p className="mt-1 text-[15px] text-ink-2">Lock edits, manage people and export everything.</p>
        <label htmlFor="admin-pw" className="label mt-6 block text-ink-3">
          Admin password
        </label>
        <input
          id="admin-pw"
          aria-label="Admin password"
          type="password"
          value={pw}
          onChange={(e) => {
            setPw(e.target.value);
            setErr(false);
          }}
          autoFocus
          className={cn(
            "mt-2 h-14 w-full rounded-2xl border-2 bg-paper px-4 text-[17px] outline-none focus:border-ocean-600",
            err ? "border-sunset-500 animate-shake" : "border-sand-300",
          )}
        />
        {err && <p className="mt-2 text-sm font-semibold text-sunset-600">That&apos;s not it.</p>}
        <Button type="submit" size="lg" block className="mt-6" disabled={busy || !pw}>
          {busy ? "Checking…" : "Enter"}
        </Button>
      </form>
    </div>
  );
}

export function AdminDashboard({ people, locked, localStore }: { people: Row[]; locked: boolean; localStore: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [isLocked, setIsLocked] = useState(locked);
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [newPin, setNewPin] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const submitted = people.filter((p) => p.status === "submitted").length;

  async function toggleLock() {
    const next = !isLocked;
    setIsLocked(next);
    const res = await fetch("/api/admin/lock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locked: next }),
    });
    if (!res.ok) {
      setIsLocked(!next);
      toast("Couldn't change the lock", "error");
    } else toast(next ? "Edits locked 🔒" : "Edits reopened");
  }

  async function resetPin(id: string) {
    const res = await fetch(`/api/admin/participants/${id}/pin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: newPin }),
    });
    if (res.ok) {
      toast("PIN reset — let them know the new one");
      setResetFor(null);
      setNewPin("");
    } else toast("Couldn't reset that PIN", "error");
  }

  async function remove(id: string) {
    const res = await fetch(`/api/admin/participants/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast("Deleted");
      setConfirmDelete(null);
      router.refresh();
    } else toast("Couldn't delete", "error");
  }

  return (
    <div className="grain min-h-dvh pb-16">
      <header className="sticky top-0 z-40 border-b border-ink/[0.06] bg-sand-100/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
          <Wordmark />
          <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-paper">Organizer</span>
          <button
            onClick={async () => {
              await fetch("/api/admin/logout", { method: "POST" });
              router.refresh();
            }}
            className="ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-ink-3 hover:bg-sand-200"
          >
            <LogOut className="size-4" /> Log out
          </button>
        </div>
      </header>

      <div className="relative z-[1] mx-auto max-w-3xl space-y-4 px-3 pt-5">
        {localStore && (
          <div className="flex gap-3 rounded-2xl bg-saffron-100 p-4 text-[14px] text-ink-2">
            <Database className="size-5 shrink-0 text-saffron-600" />
            <p>
              Running on the <b>local development database</b> (.data/dev-db.json) because Supabase isn&apos;t configured.
              See SETUP.md.
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <section className={cn("rounded-[26px] p-5 shadow-card", isLocked ? "bg-ocean-800 text-paper" : "bg-paper")}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={cn("label", isLocked ? "text-saffron-400" : "text-ink-3")}>Edits</p>
                <p className="font-display mt-1 text-[26px] font-semibold leading-tight">{isLocked ? "Locked" : "Open"}</p>
                <p className={cn("mt-1 text-[13.5px]", isLocked ? "text-paper/70" : "text-ink-3")}>
                  {isLocked
                    ? "Everyone sees “Edits are closed — the final plan is coming!”"
                    : "Friends can join, build and edit their trips."}
                </p>
              </div>
              <button
                role="switch"
                aria-checked={isLocked}
                aria-label="Lock edits"
                onClick={toggleLock}
                className={cn("relative h-9 w-16 shrink-0 rounded-full transition-colors", isLocked ? "bg-saffron-500" : "bg-sand-300")}
              >
                <motion.span
                  layout
                  transition={{ type: "spring", stiffness: 600, damping: 32 }}
                  className={cn(
                    "absolute top-1 grid size-7 place-items-center rounded-full bg-paper shadow",
                    isLocked ? "right-1" : "left-1",
                  )}
                >
                  {isLocked ? <Lock className="size-3.5 text-ink" /> : <Unlock className="size-3.5 text-ink-3" />}
                </motion.span>
              </button>
            </div>
          </section>

          <section className="rounded-[26px] bg-paper p-5 shadow-card">
            <p className="label text-ink-3">Responses</p>
            <p className="font-display mt-1 text-[26px] font-semibold leading-tight">
              {submitted} submitted <span className="text-ink-3">/ {people.length} joined</span>
            </p>
            <p className="mt-1 text-[13.5px] text-ink-3">
              {people.filter((p) => p.status === "draft").length} drafts in progress
            </p>
          </section>
        </div>

        <section className="rounded-[26px] bg-paper p-5 shadow-card">
          <h2 className="font-display text-[22px] font-semibold">Export for analysis</h2>
          <p className="mt-1 text-[13.5px] text-ink-3">Everything, including drafts, preferences and notes.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <ExportLink href="/api/admin/export?format=json" icon={FileJson} label="Everything (JSON)" />
            <ExportLink href="/api/admin/export?format=csv" icon={FileSpreadsheet} label="One row per person" />
            <ExportLink href="/api/admin/export?format=csv-long" icon={Download} label="One row per pick" />
          </div>
        </section>

        <section className="rounded-[26px] bg-paper p-3 shadow-card sm:p-5">
          <h2 className="font-display px-2 pt-2 text-[22px] font-semibold sm:px-0 sm:pt-0">Participants</h2>
          {!people.length && <p className="px-2 py-4 text-ink-3">Nobody has joined yet.</p>}
          <ul className="mt-3 divide-y divide-ink/5">
            {people.map((p) => (
              <li key={p.id} className="px-2 py-3 sm:px-0">
                <div className="flex items-center gap-3">
                  <Avatar name={p.name} className="ring-0" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-[15.5px] font-semibold">
                      {p.name}
                      <StatusPill status={p.status} />
                    </p>
                    <p className="truncate text-[12.5px] text-ink-3">
                      {p.startDate && p.endDate ? `${rangeLabel(p.startDate, p.endDate)} (${p.days}d)` : "No dates"} · {p.picks} picks · updated {when(p.updatedAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => {
                        setResetFor(resetFor === p.id ? null : p.id);
                        setNewPin("");
                        setConfirmDelete(null);
                      }}
                      aria-label={`Reset PIN for ${p.name}`}
                      className="grid size-9 place-items-center rounded-full text-ocean-600 hover:bg-sand-100"
                    >
                      <KeyRound className="size-[18px]" />
                    </button>
                    <button
                      onClick={() => {
                        setConfirmDelete(confirmDelete === p.id ? null : p.id);
                        setResetFor(null);
                      }}
                      aria-label={`Delete ${p.name}`}
                      className="grid size-9 place-items-center rounded-full text-sunset-600 hover:bg-sand-100"
                    >
                      <Trash2 className="size-[18px]" />
                    </button>
                  </div>
                </div>
                {resetFor === p.id && (
                  <div className="mt-3 rounded-2xl bg-sand-100 p-3">
                    <p className="mb-2 text-[13.5px] font-semibold">New 4-digit PIN for {p.name}</p>
                    <PinInput label={`New PIN for ${p.name}`} value={newPin} onChange={setNewPin} />
                    <Button size="sm" variant="ocean" className="mt-3" disabled={newPin.length !== 4} onClick={() => resetPin(p.id)}>
                      Set PIN
                    </Button>
                  </div>
                )}
                {confirmDelete === p.id && (
                  <div className="mt-3 flex items-center gap-3 rounded-2xl bg-sunset-100 p-3">
                    <p className="flex-1 text-[13.5px] text-sunset-700">
                      Delete <b>{p.name}</b> and their itinerary? This can&apos;t be undone.
                    </p>
                    <Button size="sm" onClick={() => remove(p.id)}>
                      Delete
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: Row["status"] }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide",
        status === "submitted" && "bg-jungle-100 text-jungle-700",
        status === "draft" && "bg-saffron-100 text-saffron-600",
        status === "new" && "bg-sand-200 text-ink-3",
      )}
    >
      {status === "new" ? "Joined" : status}
    </span>
  );
}

function ExportLink({ href, icon: Icon, label }: { href: string; icon: typeof Download; label: string }) {
  return (
    <a href={href} download className="flex h-14 items-center gap-3 rounded-2xl bg-sand-100 px-4 text-[14.5px] font-semibold transition hover:bg-sand-200">
      <Icon className="size-5 text-ocean-600" /> {label}
    </a>
  );
}
