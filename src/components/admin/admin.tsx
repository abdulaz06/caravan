"use client";

import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Avatar } from "../avatar";
import { Lockup } from "../brand/wordmark";
import { Button } from "../ui/button";
import { PinInput } from "../ui/pin-input";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grain grid min-h-dvh place-items-center bg-primary-900 px-5 py-10">
      <div className="relative z-[1] w-full max-w-sm rounded-[30px] bg-surface-50 p-6 shadow-lift">{children}</div>
    </div>
  );
}

/** An organizer opening the console re-confirms their PIN (a ~12 hour console session). */
export function ConfirmPin({ name }: { name: string }) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(value: string) {
    setBusy(true);
    const res = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: value }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) return router.refresh();
    setPin("");
    setErr(
      body.error === "locked"
        ? `Too many tries — wait ${Math.ceil((body.retryAfter ?? 300) / 60)} min.`
        : body.error === "wrong_pin"
          ? `That's not it — ${body.remaining} ${body.remaining === 1 ? "try" : "tries"} left.`
          : (body.error ?? "Something went wrong"),
    );
  }
  return (
    <Shell>
      <Lockup size="md" />
      <div className="mt-6 flex items-center gap-3">
        <Avatar name={name} className="size-11 text-[17px]" />
        <div>
          <p className="label text-secondary-600">
            <ShieldCheck className="mr-1 inline size-3.5" /> Organizer
          </p>
          <p className="font-display text-[22px] font-semibold leading-tight">Hi {name}</p>
        </div>
      </div>
      <h1 className="font-display mt-5 text-[28px] font-semibold leading-tight">Confirm your PIN</h1>
      <p className="mt-1 text-[14.5px] text-ink-2">The console can see everyone&apos;s answers, so it asks once more. You stay in for 12 hours.</p>
      <div className="mt-5">
        <PinInput
          label="Your PIN"
          id="console-pin"
          value={pin}
          error={!!err}
          disabled={busy}
          autoFocus
          onChange={(v) => {
            setPin(v);
            setErr(null);
          }}
          onComplete={submit}
        />
      </div>
      {err && <p className="mt-3 text-sm font-semibold text-accent-600">{err}</p>}
      <Button size="lg" block className="mt-5" disabled={busy || pin.length !== 4} onClick={() => submit(pin)}>
        {busy ? "Checking…" : "Open the console"}
      </Button>
      <Link href="/trip" className="mt-4 block text-center text-[13.5px] font-semibold text-ink-3 hover:text-ink">
        Back to my trip
      </Link>
    </Shell>
  );
}

/** The owner's break-glass login (ADMIN_PASSWORD). Organizers normally use their name + PIN. */
export function AdminLogin() {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Shell>
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
      >
        <Lockup size="md" />
        <h1 className="font-display mt-6 text-[30px] font-semibold leading-tight">Organizers only</h1>
        <p className="mt-1 text-[15px] text-ink-2">
          Organizers: <Link href="/join?returning=1" className="font-semibold text-primary-700 underline-offset-2 hover:underline">sign in with your name &amp; PIN</Link>, then tap
          the Organizer button.
        </p>
        <label htmlFor="admin-pw" className="label mt-6 block text-ink-3">
          Owner&apos;s emergency password
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
          className={cn(
            "mt-2 h-14 w-full rounded-2xl border-2 bg-paper px-4 text-[17px] outline-none focus:border-primary-600",
            err ? "animate-shake border-accent-500" : "border-surface-300",
          )}
        />
        {err && <p className="mt-2 text-sm font-semibold text-accent-600">That&apos;s not it.</p>}
        <Button type="submit" size="lg" block className="mt-6" disabled={busy || !pw}>
          {busy ? "Checking…" : "Enter"}
        </Button>
      </form>
    </Shell>
  );
}
