"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Activity as ActivityIcon,
  AlertTriangle,
  Ban,
  CalendarClock,
  Eye,
  FileJson,
  FileSpreadsheet,
  KeyRound,
  Lock,
  LogOut,
  Megaphone,
  PencilRuler,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldOff,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { activities, regions, type Activity } from "@/content";
import { cn } from "@/lib/cn";
import { CURRENCIES, type CurrencyCode } from "@/lib/currency";
import { dayLabel } from "@/lib/dates";
import { daysNightsLabel } from "@/lib/itinerary";
import { NIGHTS_LIMITS, type RulesPatch, type TripRules } from "@/lib/rules";
import type { RoommateBoard } from "@/lib/roommates";
import { Avatar } from "../avatar";
import { Lockup } from "../brand/wordmark";
import { Button } from "../ui/button";
import { ChipScroller } from "../ui/chip-scroller";
import { PinInput } from "../ui/pin-input";
import { LocalTime } from "../ui/local-time";
import { Sheet } from "../ui/sheet";
import { useToast } from "../ui/toast";

export type ConsolePerson = {
  id: string;
  name: string;
  role: "owner" | "admin" | "member";
  status: "new" | "draft" | "submitted";
  joinedAt: string;
  updatedAt: string | null;
  picks: number;
  startDate: string | null;
  endDate: string | null;
  days: number;
  pickedIds: string[];
  stamp: { kind: "edit" | "rules"; by: string; at: string } | null;
  peekers: number;
  /** A "zz-test-…" user: listed (so it can be deleted) but never counted. */
  test?: boolean;
};

export type ConsoleLog = {
  id: string;
  at: string;
  actor_name: string;
  action: string;
  target_name: string | null;
  details: Record<string, unknown> | null;
};

type Impact = { plans: number; needRepicks: number; lostPicks: number; people: { name: string; lost: number }[] };

type Props = {
  actor: { name: string; role: "owner" | "admin"; breakGlass: boolean; id: string | null };
  people: ConsolePerson[];
  rules: TripRules;
  editsLocked: boolean;
  log: ConsoleLog[];
  localStore: boolean;
  roommates: RoommateBoard;
};

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "people", label: "People" },
  { id: "roommates", label: "Roommates" },
  { id: "rules", label: "Trip rules" },
  { id: "content", label: "Content" },
  { id: "announce", label: "Announcement" },
  { id: "data", label: "Data" },
  { id: "activity", label: "Activity" },
] as const;
type Tab = (typeof TABS)[number]["id"];

/** A time in the organizer's own timezone (rendered in the browser, so server and client never disagree). */
const When = ({ iso }: { iso: string | null | undefined }) => <LocalTime iso={iso} />;

async function call(url: string, init: RequestInit = {}) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

export function Console({ actor, people, rules: initialRules, editsLocked, log, localStore, roommates }: Props) {
  // Test users ("zz-test-…") are listed under People but never counted.
  const real = useMemo(() => people.filter((p) => !p.test), [people]);
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("overview");
  const [rules, setRules] = useState(initialRules);
  const [locked, setLocked] = useState(editsLocked);
  // Fresh server data (after router.refresh()) replaces local state.
  const [seen, setSeen] = useState({ initialRules, editsLocked });
  if (seen.initialRules !== initialRules || seen.editsLocked !== editsLocked) {
    setSeen({ initialRules, editsLocked });
    setRules(initialRules);
    setLocked(editsLocked);
  }

  useEffect(() => {
    const fromHash = () => {
      const h = window.location.hash.slice(1) as Tab;
      if (TABS.some((t) => t.id === h)) setTab(h);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);
  const go = (t: Tab) => {
    setTab(t);
    history.replaceState(null, "", `#${t}`);
  };

  /** Save a non-structural rules change right away. */
  async function patchRules(patch: RulesPatch, done?: string) {
    const r = await call("/api/admin/rules", { method: "POST", body: JSON.stringify({ patch }) });
    if (r.ok) {
      setRules(r.body.rules);
      if (done) toast(done);
      router.refresh();
    } else toast(r.body.error ?? "Couldn't save that", "error");
    return r;
  }

  async function setLock(next: boolean) {
    const r = await call("/api/admin/lock", { method: "POST", body: JSON.stringify({ locked: next }) });
    if (r.ok) {
      setLocked(next);
      toast(next ? "Edits locked for everyone" : "Edits are open again");
      router.refresh();
    } else toast("Couldn't change the lock", "error");
  }

  return (
    <div className="grain min-h-dvh bg-sand-100 pb-24">
      <header className="sticky top-0 z-40 border-b border-ink/[0.06] bg-sand-100/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-2.5 px-4">
          <Lockup size="sm" />
          <span className="flex-1" />
          <span className="hidden items-center gap-1.5 rounded-full bg-jungle-800 px-2.5 py-1 text-[11.5px] font-bold text-paper sm:inline-flex">
            <ShieldCheck className="size-3.5 text-saffron-400" /> {actor.role === "owner" ? "Owner" : "Admin"} · {actor.name}
          </span>
          {!actor.breakGlass && (
            <Link href="/trip" className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-ink-2 hover:bg-sand-200">
              My trip
            </Link>
          )}
          <button
            onClick={async () => {
              await fetch("/api/admin/logout", { method: "POST" });
              router.push(actor.breakGlass ? "/" : "/trip");
              router.refresh();
            }}
            aria-label="Close the console"
            className="grid size-9 place-items-center rounded-full text-ink-3 hover:bg-sand-200"
          >
            <LogOut className="size-[18px]" />
          </button>
        </div>
        <div className="mx-auto max-w-3xl">
          <ChipScroller label="Console sections" activeKey={tab} tone="light" className="pb-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => go(t.id)}
                data-active={tab === t.id}
                aria-pressed={tab === t.id}
                className={cn(
                  "h-8 shrink-0 rounded-full px-3.5 text-[13px] font-semibold transition",
                  tab === t.id ? "bg-ink text-paper" : "bg-paper text-ink-2 shadow-card hover:text-ink",
                )}
              >
                {t.label}
              </button>
            ))}
          </ChipScroller>
        </div>
      </header>

      <main className="relative z-[1] mx-auto max-w-3xl px-4 pt-5">
        <h1 className="font-display text-[34px] font-semibold leading-none tracking-[-0.02em]">
          Organizer <span className="italic text-ocean-700">console</span>
        </h1>
        {localStore && (
          <p className="mt-2 text-[12.5px] text-ink-3">Local development store — data lives in .data/dev-db.json.</p>
        )}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-5 space-y-4">
            {tab === "overview" && <Overview people={real} locked={locked} rules={rules} log={log} onLock={setLock} go={go} />}
            {tab === "people" && <People actor={actor} people={people} />}
            {tab === "roommates" && <RoommatesTab board={roommates} />}
            {tab === "rules" && <RulesTab rules={rules} locked={locked} onLock={setLock} onPatch={patchRules} onRules={setRules} />}
            {tab === "content" && <ContentTab rules={rules} people={real} onPatch={patchRules} />}
            {tab === "announce" && <AnnounceTab rules={rules} onPatch={patchRules} />}
            {tab === "data" && <DataTab />}
            {tab === "activity" && <ActivityTab log={log} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

// ── Bits ──────────────────────────────────────────────────────────────

function Card({ title, sub, children, className, icon: Icon }: { title?: string; sub?: React.ReactNode; children: React.ReactNode; className?: string; icon?: typeof Users }) {
  return (
    <section className={cn("rounded-[24px] bg-paper p-4 shadow-card", className)}>
      {title && (
        <h2 className="flex items-center gap-2 text-[17px] font-bold">
          {Icon && <Icon className="size-[18px] text-ocean-600" />}
          {title}
        </h2>
      )}
      {sub && <p className="mt-0.5 text-[13px] text-ink-3">{sub}</p>}
      <div className={cn(title || sub ? "mt-3" : "")}>{children}</div>
    </section>
  );
}

export function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40", on ? "bg-jungle-600" : "bg-sand-300")}
    >
      <span className={cn("absolute top-1 size-5 rounded-full bg-paper shadow transition-all", on ? "left-6" : "left-1")} />
    </button>
  );
}

function Row({ title, hint, children }: { title: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-t border-ink/5 py-3 first:border-t-0 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="text-[14.5px] font-semibold leading-tight">{title}</p>
        {hint && <p className="mt-0.5 text-[12.5px] leading-snug text-ink-3">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

const STATUS: Record<ConsolePerson["status"], { label: string; cls: string }> = {
  submitted: { label: "Submitted", cls: "bg-jungle-100 text-jungle-700" },
  draft: { label: "Drafting", cls: "bg-saffron-200 text-ink" },
  new: { label: "Not started", cls: "bg-sand-200 text-ink-3" },
};

export function RoleBadge({ role }: { role: ConsolePerson["role"] }) {
  if (role === "member") return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-jungle-800 px-2 py-0.5 text-[10.5px] font-bold text-paper">
      <ShieldCheck className="size-3 text-saffron-400" /> {role === "owner" ? "Owner" : "Organizer"}
    </span>
  );
}

// ── Overview ──────────────────────────────────────────────────────────

function Overview({
  people,
  locked,
  rules,
  log,
  onLock,
  go,
}: {
  people: ConsolePerson[];
  locked: boolean;
  rules: TripRules;
  log: ConsoleLog[];
  onLock: (v: boolean) => void;
  go: (t: Tab) => void;
}) {
  const submitted = people.filter((p) => p.status === "submitted");
  const drafting = people.filter((p) => p.status === "draft");
  const fresh = people.filter((p) => p.status === "new");
  const last = [...people].sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))[0];
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { n: people.length, l: "Joined" },
          { n: submitted.length, l: "Submitted" },
          { n: drafting.length, l: "Drafting" },
          { n: fresh.length, l: "Not started" },
        ].map((s) => (
          <div key={s.l} className="rounded-[22px] bg-ocean-800 p-4 text-paper shadow-card">
            <p className="font-display text-[36px] font-semibold leading-none">{s.n}</p>
            <p className="mt-1 text-[12px] font-bold uppercase tracking-wide text-paper/60">{s.l}</p>
          </div>
        ))}
      </div>
      <Card title="Quick controls" icon={Lock}>
        <Row title={locked ? "Edits are locked" : "Edits are open"} hint="Everyone sees a read-only banner while locked.">
          <Switch on={locked} onChange={onLock} label="Lock edits" />
        </Row>
        <Row
          title="Auto-lock"
          hint={
            rules.autoLockAt ? (
              <>
                Locks <When iso={rules.autoLockAt} /> — everyone sees a countdown.
              </>
            ) : (
              "No auto-lock scheduled."
            )
          }
        >
          <Button size="md" variant="light" onClick={() => go("rules")}>
            <CalendarClock className="size-4" /> Set
          </Button>
        </Row>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/group" className="rounded-full bg-sand-200 px-3 py-1.5 text-[13px] font-semibold hover:bg-sand-300">
            Group overview
          </Link>
          <a href="/api/admin/export?format=json" className="rounded-full bg-sand-200 px-3 py-1.5 text-[13px] font-semibold hover:bg-sand-300">
            Export JSON
          </a>
          <button onClick={() => go("announce")} className="rounded-full bg-sand-200 px-3 py-1.5 text-[13px] font-semibold hover:bg-sand-300">
            Announcement {rules.announcement.on ? "· on" : ""}
          </button>
        </div>
      </Card>
      <Card
        title="Who still needs a nudge"
        icon={Users}
        sub={
          last?.updatedAt ? (
            <>
              Last activity: {last.name}, <When iso={last.updatedAt} />
            </>
          ) : undefined
        }
      >
        {fresh.length + drafting.length === 0 ? (
          <p className="text-[14px] text-ink-2">Everyone has submitted 🎉</p>
        ) : (
          <ul className="space-y-2">
            {[...fresh, ...drafting].map((p) => (
              <li key={p.id} className="flex items-center gap-3">
                <Avatar name={p.name} className="size-8 text-[13px]" />
                <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold">{p.name}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", STATUS[p.status].cls)}>{STATUS[p.status].label}</span>
                <span className="hidden w-28 text-right text-[12px] text-ink-3 sm:block"><When iso={p.updatedAt ?? p.joinedAt} /></span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Latest activity" icon={ActivityIcon}>
        <LogList log={log.slice(0, 5)} />
        <button onClick={() => go("activity")} className="mt-3 text-[13px] font-semibold text-ocean-700">
          See everything →
        </button>
      </Card>
    </>
  );
}

// ── People ────────────────────────────────────────────────────────────

/** Mirrors the server's rules (src/lib/server/powers.ts) so buttons only show what will work. */
function can(actor: Props["actor"], target: ConsolePerson, power: "delete" | "reset_pin" | "set_role") {
  const owner = actor.role === "owner";
  if (power === "set_role") return owner && target.role !== "owner";
  if (power === "delete") return target.role !== "owner" && (target.role === "member" || owner);
  return target.role === "member" || owner;
}

function People({ actor, people }: { actor: Props["actor"]; people: ConsolePerson[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pinFor, setPinFor] = useState<ConsolePerson | null>(null);
  const [pin, setPin] = useState("");
  const [delFor, setDelFor] = useState<ConsolePerson | null>(null);
  const [q, setQ] = useState("");
  const list = people.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()));

  async function setRole(p: ConsolePerson, role: "admin" | "member") {
    const r = await call(`/api/admin/participants/${p.id}/role`, { method: "PUT", body: JSON.stringify({ role }) });
    if (r.ok) {
      toast(role === "admin" ? `${p.name} is now an organizer` : `${p.name} is a member again`);
      router.refresh();
    } else toast(r.body.error ?? "Couldn't change that", "error");
  }

  return (
    <>
      <label className="flex h-11 items-center gap-2 rounded-2xl bg-paper px-3 shadow-card">
        <Search className="size-4 text-ink-3" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${people.length} people…`} aria-label="Search people" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none" />
      </label>
      <ul className="space-y-2.5" aria-label="People">
        {list.map((p) => (
          <li key={p.id} className="rounded-[22px] bg-paper p-3.5 shadow-card" aria-label={p.name}>
            <div className="flex items-start gap-3">
              <Avatar name={p.name} className="size-10 text-[15px]" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[16px] font-bold">{p.name}</span>
                  <RoleBadge role={p.role} />
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", STATUS[p.status].cls)}>{STATUS[p.status].label}</span>
                  {p.test && <span className="rounded-full bg-sand-300 px-2 py-0.5 text-[11px] font-bold text-ink-2">Test user · not counted</span>}
                </p>
                <p className="mt-0.5 text-[12.5px] text-ink-3">
                  {p.startDate && p.endDate ? `${dayLabel(p.startDate)} → ${dayLabel(p.endDate)} · ${daysNightsLabel(p.days)} · ` : ""}
                  {p.picks} picks · updated <When iso={p.updatedAt} />
                  {p.peekers ? ` · 👀 ${p.peekers}` : ""}
                </p>
                {p.stamp?.kind === "edit" && (
                  <p className="mt-1 text-[12px] font-semibold text-ocean-700">
                    Edited by {p.stamp.by} · <When iso={p.stamp.at} />
                  </p>
                )}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Link href={`/admin/view/${p.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-sand-200 px-3 text-[13px] font-semibold hover:bg-sand-300">
                <Eye className="size-4" /> View plan
              </Link>
              <Link href={`/admin/edit/${p.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ocean-700 px-3 text-[13px] font-semibold text-paper hover:bg-ocean-800">
                <PencilRuler className="size-4" /> Edit plan
              </Link>
              {can(actor, p, "reset_pin") && (
                <button onClick={() => (setPinFor(p), setPin(""))} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-sand-200 px-3 text-[13px] font-semibold hover:bg-sand-300">
                  <KeyRound className="size-4" /> Reset PIN
                </button>
              )}
              {can(actor, p, "set_role") &&
                (p.role === "admin" ? (
                  <button onClick={() => setRole(p, "member")} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-sand-200 px-3 text-[13px] font-semibold hover:bg-sand-300">
                    <ShieldOff className="size-4" /> Remove admin
                  </button>
                ) : (
                  <button onClick={() => setRole(p, "admin")} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-jungle-100 px-3 text-[13px] font-semibold text-jungle-800 hover:bg-jungle-100/70">
                    <ShieldCheck className="size-4" /> Make admin
                  </button>
                ))}
              {can(actor, p, "delete") && (
                <button onClick={() => setDelFor(p)} aria-label={`Delete ${p.name}`} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-sunset-600 hover:bg-sunset-100">
                  <Trash2 className="size-4" /> Delete
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <Sheet open={!!pinFor} onClose={() => setPinFor(null)} size="auto" eyebrow="Reset PIN" title={pinFor ? `A new PIN for ${pinFor.name}` : ""}>
        <div className="px-5 pb-8">
          <p className="mb-4 text-[14px] text-ink-2">Pick 4 digits and tell them in person or in the chat. Any lockout is cleared too.</p>
          <PinInput label="New PIN" value={pin} onChange={setPin} autoFocus />
          <Button
            size="lg"
            block
            className="mt-5"
            disabled={pin.length !== 4}
            onClick={async () => {
              if (!pinFor) return;
              const r = await call(`/api/admin/participants/${pinFor.id}/pin`, { method: "POST", body: JSON.stringify({ pin }) });
              if (r.ok) toast(`${pinFor.name}'s PIN is reset`);
              else toast(r.body.error ?? "Couldn't reset it", "error");
              setPinFor(null);
              router.refresh();
            }}
          >
            Set PIN
          </Button>
        </div>
      </Sheet>
      <Sheet open={!!delFor} onClose={() => setDelFor(null)} size="auto" eyebrow="Delete" title={delFor ? `Delete ${delFor.name}?` : ""}>
        <div className="grid gap-2.5 px-5 pb-8">
          <p className="text-[14.5px] text-ink-2">Their plan and answers go too. This can&apos;t be undone.</p>
          <Button
            size="lg"
            className="bg-sunset-600 text-white hover:bg-sunset-700"
            onClick={async () => {
              if (!delFor) return;
              const r = await call(`/api/admin/participants/${delFor.id}`, { method: "DELETE" });
              if (r.ok) toast(`${delFor.name} deleted`);
              else toast(r.body.error ?? "Couldn't delete", "error");
              setDelFor(null);
              router.refresh();
            }}
          >
            <Trash2 className="size-5" /> Delete for good
          </Button>
          <Button size="lg" variant="light" onClick={() => setDelFor(null)}>
            Keep them
          </Button>
        </div>
      </Sheet>
    </>
  );
}

// ── Trip rules ────────────────────────────────────────────────────────

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="flex items-center gap-1.5" role="group" aria-label={label}>
      <button aria-label={`Fewer ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)} className="grid size-9 place-items-center rounded-full bg-sand-200 text-[18px] font-bold disabled:opacity-40">
        −
      </button>
      <span className="font-display w-7 text-center text-[22px] font-semibold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button aria-label={`More ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)} className="grid size-9 place-items-center rounded-full bg-sand-200 text-[18px] font-bold disabled:opacity-40">
        +
      </button>
    </div>
  );
}

function RulesTab({
  rules,
  locked,
  onLock,
  onPatch,
  onRules,
}: {
  rules: TripRules;
  locked: boolean;
  onLock: (v: boolean) => void;
  onPatch: (p: RulesPatch, done?: string) => Promise<unknown>;
  onRules: (r: TripRules) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  // Structural rules are edited here, previewed, then applied together.
  const [draft, setDraft] = useState({ colomboNights: rules.colomboNights, galleNights: rules.galleNights, window: rules.window, requireFullTrip: rules.requireFullTrip });
  const [auto, setAuto] = useState(toLocalInput(rules.autoLockAt));
  const [impact, setImpact] = useState<Impact | null>(null);
  const [busy, setBusy] = useState(false);
  const [seenRules, setSeenRules] = useState(rules);
  if (seenRules !== rules) {
    setSeenRules(rules);
    setDraft({ colomboNights: rules.colomboNights, galleNights: rules.galleNights, window: rules.window, requireFullTrip: rules.requireFullTrip });
  }
  const dirty =
    draft.colomboNights !== rules.colomboNights ||
    draft.galleNights !== rules.galleNights ||
    draft.window.start !== rules.window.start ||
    draft.window.end !== rules.window.end ||
    draft.requireFullTrip !== rules.requireFullTrip;
  const len = draft.colomboNights + draft.galleNights + 1;

  async function apply(confirm: boolean) {
    setBusy(true);
    const r = await call("/api/admin/rules", { method: "POST", body: JSON.stringify({ patch: draft, confirm }) });
    setBusy(false);
    if (r.status === 409) {
      setImpact(r.body.impact);
      return;
    }
    if (!r.ok) {
      toast(r.body.error ?? "Couldn't apply that", "error");
      return;
    }
    setImpact(null);
    onRules(r.body.rules);
    toast(r.body.impact?.plans ? `Applied — ${r.body.impact.plans} plans moved over` : "Trip rules updated");
    router.refresh();
  }

  return (
    <>
      <Card title="Editing" icon={Lock}>
        <Row title="Lock edits now" hint="Everyone sees “Edits are closed — the final plan is coming!”">
          <Switch on={locked} onChange={onLock} label="Lock edits" />
        </Row>
        <div className="border-t border-ink/5 pt-3">
          <p className="text-[14.5px] font-semibold">Auto-lock</p>
          <p className="mt-0.5 text-[12.5px] text-ink-3">Edits close by themselves at this time; everyone sees a countdown.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              type="datetime-local"
              aria-label="Auto-lock at"
              value={auto}
              onChange={(e) => setAuto(e.target.value)}
              className="h-11 rounded-2xl border-2 border-sand-300 bg-paper px-3 text-[15px] outline-none focus:border-ocean-600"
            />
            <Button size="md" disabled={!auto} onClick={() => onPatch({ autoLockAt: new Date(auto).toISOString() }, "Auto-lock scheduled")}>
              Schedule
            </Button>
            {rules.autoLockAt && (
              <Button
                size="md"
                variant="light"
                onClick={() => {
                  setAuto("");
                  void onPatch({ autoLockAt: null }, "Auto-lock cleared");
                }}
              >
                Clear
              </Button>
            )}
          </div>
          {rules.autoLockAt && <p className="mt-1.5 text-[12.5px] font-semibold text-sunset-600">Scheduled: <When iso={rules.autoLockAt} /></p>}
        </div>
      </Card>

      <Card title="Trip structure" icon={CalendarClock} sub={`Now: ${daysNightsLabel(rules.colomboNights + rules.galleNights + 1)} · Colombo ${rules.colomboNights} → Galle ${rules.galleNights}`}>
        <Row title="Colombo nights" hint="Day 1 lands in Colombo.">
          <Stepper label="Colombo nights" value={draft.colomboNights} min={NIGHTS_LIMITS.colombo[0]} max={NIGHTS_LIMITS.colombo[1]} onChange={(v) => setDraft({ ...draft, colomboNights: v })} />
        </Row>
        <Row title="Galle nights" hint="Including the road-trip day's night.">
          <Stepper label="Galle nights" value={draft.galleNights} min={NIGHTS_LIMITS.galle[0]} max={NIGHTS_LIMITS.galle[1]} onChange={(v) => setDraft({ ...draft, galleNights: v })} />
        </Row>
        <Row title="Require the full trip to submit" hint={`Off: ${daysNightsLabel(len - 1)} plans can be submitted too.`}>
          <Switch on={draft.requireFullTrip} onChange={(v) => setDraft({ ...draft, requireFullTrip: v })} label="Require full trip" />
        </Row>
        <div className="border-t border-ink/5 pt-3">
          <p className="text-[14.5px] font-semibold">Date window</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="text-[12px] font-semibold text-ink-3">
              Earliest start
              <input type="date" aria-label="Earliest start" value={draft.window.start} onChange={(e) => setDraft({ ...draft, window: { ...draft.window, start: e.target.value } })} className="mt-1 h-11 w-full rounded-2xl border-2 border-sand-300 bg-paper px-3 text-[15px] text-ink outline-none focus:border-ocean-600" />
            </label>
            <label className="text-[12px] font-semibold text-ink-3">
              Latest end
              <input type="date" aria-label="Latest end" value={draft.window.end} onChange={(e) => setDraft({ ...draft, window: { ...draft.window, end: e.target.value } })} className="mt-1 h-11 w-full rounded-2xl border-2 border-sand-300 bg-paper px-3 text-[15px] text-ink outline-none focus:border-ocean-600" />
            </label>
          </div>
        </div>
        {dirty && (
          <p className="mt-4 rounded-2xl bg-saffron-100 px-3 py-2 text-[13px] font-semibold text-ink ring-1 ring-saffron-200">
            New: {daysNightsLabel(len)} · Colombo {draft.colomboNights} → Galle {draft.galleNights}
          </p>
        )}
        <div className="mt-3 flex items-center gap-2">
          <Button size="md" disabled={!dirty || busy} onClick={() => apply(false)} aria-label={`Review & apply · ${daysNightsLabel(len)}`}>
            Review & apply
          </Button>
          {dirty && (
            <Button size="md" variant="light" onClick={() => setDraft({ colomboNights: rules.colomboNights, galleNights: rules.galleNights, window: rules.window, requireFullTrip: rules.requireFullTrip })}>
              Undo
            </Button>
          )}
        </div>
      </Card>

      <Card title="Who sees what" icon={Eye}>
        <Row title="5-day preview" hint="The shorter “try it” length on the dates step.">
          <Switch on={rules.previewEnabled} onChange={(v) => onPatch({ previewEnabled: v }, v ? "Preview on" : "Preview off")} label="Preview available" />
        </Row>
        <Row title="Base-area filtering" hint="Each slot only offers its own area's options.">
          <Switch on={rules.baseFiltering} onChange={(v) => onPatch({ baseFiltering: v }, v ? "Area filtering on" : "Area filtering off")} label="Base-area filtering" />
        </Row>
        <div className="border-t border-ink/5 py-3">
          <p className="text-[14.5px] font-semibold">Browse others&apos; plans</p>
          <div className="mt-2 grid grid-cols-3 gap-1.5 rounded-2xl bg-sand-200 p-1" role="radiogroup" aria-label="Browse others">
            {(["after_submit", "always", "off"] as const).map((m) => (
              <button
                key={m}
                role="radio"
                aria-checked={rules.browse === m}
                onClick={() => onPatch({ browse: m }, "Browsing updated")}
                className={cn("h-9 rounded-xl text-[12.5px] font-semibold", rules.browse === m ? "bg-paper shadow-card" : "text-ink-2")}
              >
                {m === "after_submit" ? "After submitting" : m === "always" ? "Always" : "Off"}
              </button>
            ))}
          </div>
        </div>
        <Row title="👀 Peek" hint="Anyone's full plan, read-only, drafts included (no notes or private answers).">
          <Switch on={rules.peek} onChange={(v) => onPatch({ peek: v }, v ? "Peek on" : "Peek off")} label="Peek" />
        </Row>
        <Row title="Group spectrum" hint="Everyone on one Nature ↔ Nightlife line.">
          <Switch on={rules.spectrum} onChange={(v) => onPatch({ spectrum: v }, v ? "Spectrum on" : "Spectrum off")} label="Group spectrum" />
        </Row>
        <Row title="🔥 Popular badges" hint="“Popular · 7 picked” on the most-picked options (counts only, never who).">
          <Switch on={rules.popularBadges} onChange={(v) => onPatch({ popularBadges: v }, v ? "Popular badges on" : "Popular badges off")} label="Popular badges" />
        </Row>
        <Row title="Halal button" hint="The crescent-moon easter egg on the review page.">
          <Switch on={rules.halalButton} onChange={(v) => onPatch({ halalButton: v }, v ? "Halal button on" : "Halal button off")} label="Halal button" />
        </Row>
        <Row title="Default currency" hint="For people who haven't picked one.">
          <select
            aria-label="Default currency"
            value={rules.defaultCurrency}
            onChange={(e) => onPatch({ defaultCurrency: e.target.value as CurrencyCode }, "Default currency saved")}
            className="h-10 rounded-xl border-2 border-sand-300 bg-paper px-2 text-[14px] font-semibold"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}
              </option>
            ))}
          </select>
        </Row>
      </Card>

      <Sheet open={!!impact} onClose={() => setImpact(null)} size="auto" eyebrow="Before you apply" title={impact ? `${impact.plans} ${impact.plans === 1 ? "plan" : "plans"} will move over` : ""}>
        {impact && (
          <div className="px-5 pb-8">
            <p className="flex gap-2 rounded-2xl bg-sunset-100 p-3 text-[14px] leading-snug text-sunset-700">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                <b>
                  {impact.needRepicks} {impact.needRepicks === 1 ? "itinerary needs" : "itineraries will need"} re-picks
                </b>{" "}
                ({impact.lostPicks} {impact.lostPicks === 1 ? "pick" : "picks"} cleared). Picks are kept by day and order where they still fit; everyone affected sees a one-time note.
              </span>
            </p>
            <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto">
              {impact.people.map((p) => (
                <li key={p.name} className="flex justify-between text-[14px]">
                  <span>{p.name}</span>
                  <span className="text-ink-3">{p.lost ? `${p.lost} cleared` : "moved, nothing lost"}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 grid gap-2">
              <Button size="lg" disabled={busy} onClick={() => apply(true)}>
                Apply and move the plans
              </Button>
              <Button size="lg" variant="light" onClick={() => setImpact(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </>
  );
}

// ── Content ───────────────────────────────────────────────────────────

function ContentTab({ rules, people, onPatch }: { rules: TripRules; people: ConsolePerson[]; onPatch: (p: RulesPatch, done?: string) => Promise<unknown> }) {
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<"all" | "flagged">("all");
  const picked = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of people) for (const id of new Set(p.pickedIds)) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  }, [people]);
  const list = activities
    .filter((a) => a.kind === "option" || a.kind === "extra")
    .filter((a) => !q.trim() || a.title.toLowerCase().includes(q.trim().toLowerCase()))
    .filter((a) => only === "all" || rules.hidden.includes(a.id) || rules.recheck.includes(a.id) || rules.featured.includes(a.id));
  const toggle = (key: "hidden" | "recheck" | "featured", a: Activity) => {
    const on = rules[key].includes(a.id);
    const next = on ? rules[key].filter((x) => x !== a.id) : [...rules[key], a.id];
    const msg = {
      hidden: on ? `${a.title} is back` : `${a.title} hidden${picked.get(a.id) ? ` — ${picked.get(a.id)} plans show “No longer available”` : ""}`,
      recheck: on ? "Re-check flag cleared" : "Flagged to re-check",
      featured: on ? "No longer featured" : `${a.title} featured`,
    }[key];
    void onPatch({ [key]: next }, msg);
  };
  return (
    <>
      <div className="flex gap-2">
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-2xl bg-paper px-3 shadow-card">
          <Search className="size-4 text-ink-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search options & extras…" aria-label="Search content" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none" />
        </label>
        <button onClick={() => setOnly(only === "all" ? "flagged" : "all")} aria-pressed={only === "flagged"} className={cn("h-11 shrink-0 rounded-2xl px-3.5 text-[13px] font-semibold shadow-card", only === "flagged" ? "bg-ink text-paper" : "bg-paper")}>
          Flagged
        </button>
      </div>
      <ul className="space-y-2" aria-label="Content">
        {list.map((a) => {
          const hidden = rules.hidden.includes(a.id);
          return (
            <li key={a.id} className={cn("rounded-[20px] bg-paper p-3 shadow-card", hidden && "opacity-75")} aria-label={a.title}>
              <p className="text-[14.5px] font-semibold leading-tight">{a.title}</p>
              <p className="mt-0.5 text-[12px] text-ink-3">
                {a.kind === "extra" ? "Quick extra" : a.slots[0] === "day" ? "Daytime option" : "Evening option"} · {regions[a.region].short}
                {picked.get(a.id) ? ` · picked by ${picked.get(a.id)}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button onClick={() => toggle("hidden", a)} aria-pressed={hidden} aria-label={`${hidden ? "Unhide" : "Hide"} ${a.title}`} className={cn("inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[12px] font-bold", hidden ? "bg-sunset-600 text-white" : "bg-sand-200 text-ink-2")}>
                  <Ban className="size-3.5" /> {hidden ? "Hidden" : "Hide"}
                </button>
                <button onClick={() => toggle("recheck", a)} aria-pressed={rules.recheck.includes(a.id)} aria-label={`Re-check ${a.title}`} className={cn("inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[12px] font-bold", rules.recheck.includes(a.id) ? "bg-saffron-400 text-ink" : "bg-sand-200 text-ink-2")}>
                  <RefreshCw className="size-3.5" /> Re-check
                </button>
                <button onClick={() => toggle("featured", a)} aria-pressed={rules.featured.includes(a.id)} aria-label={`Feature ${a.title}`} className={cn("inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-[12px] font-bold", rules.featured.includes(a.id) ? "bg-ocean-700 text-paper" : "bg-sand-200 text-ink-2")}>
                  <Star className="size-3.5" /> Feature
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

// ── Announcement ──────────────────────────────────────────────────────

function AnnounceTab({ rules, onPatch }: { rules: TripRules; onPatch: (p: RulesPatch, done?: string) => Promise<unknown> }) {
  const [text, setText] = useState(rules.announcement.text);
  return (
    <Card title="Announcement" icon={Megaphone} sub="A banner at the top of everyone's trip and group pages.">
      <textarea
        value={text}
        maxLength={280}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        aria-label="Announcement text"
        placeholder="e.g. Flights: aim to land before noon on Day 1 ✈️"
        className="w-full resize-none rounded-2xl border-2 border-sand-300 bg-paper p-3.5 text-[15px] outline-none focus:border-ocean-600"
      />
      <div className="mt-2 flex items-center gap-3">
        <span className="flex-1 text-[12px] text-ink-3">{text.length}/280</span>
        <span className="text-[13px] font-semibold">{rules.announcement.on ? "Showing" : "Off"}</span>
        <Switch on={rules.announcement.on} onChange={(on) => onPatch({ announcement: { on, text } }, on ? "Announcement is live" : "Announcement off")} label="Show announcement" />
      </div>
      <Button size="md" className="mt-3" disabled={text === rules.announcement.text} onClick={() => onPatch({ announcement: { on: rules.announcement.on, text } }, "Saved")}>
        Save text
      </Button>
    </Card>
  );
}

// ── Data ──────────────────────────────────────────────────────────────

function DataTab() {
  return (
    <Card title="Exports" icon={FileJson} sub="Everything for AI analysis — budget totals, roles and edit stamps included.">
      <div className="grid gap-2 sm:grid-cols-3">
        <a href="/api/admin/export?format=json" className="flex h-14 items-center gap-2.5 rounded-2xl bg-ocean-700 px-4 text-[14.5px] font-semibold text-paper">
          <FileJson className="size-5" /> JSON
        </a>
        <a href="/api/admin/export?format=csv" className="flex h-14 items-center gap-2.5 rounded-2xl bg-sand-200 px-4 text-[14.5px] font-semibold">
          <FileSpreadsheet className="size-5 text-jungle-600" /> CSV · per person
        </a>
        <a href="/api/admin/export?format=csv-long" className="flex h-14 items-center gap-2.5 rounded-2xl bg-sand-200 px-4 text-[14.5px] font-semibold">
          <FileSpreadsheet className="size-5 text-jungle-600" /> CSV · every pick
        </a>
      </div>
    </Card>
  );
}

// ── Activity ──────────────────────────────────────────────────────────

const RULE_LABELS: Record<string, string> = {
  autoLockAt: "auto-lock",
  requireFullTrip: "full-length rule",
  previewEnabled: "preview",
  window: "date window",
  colomboNights: "Colombo nights",
  galleNights: "Galle nights",
  baseFiltering: "area filtering",
  browse: "browsing",
  peek: "peek",
  spectrum: "spectrum",
  halalButton: "Halal button",
  defaultCurrency: "default currency",
  announcement: "announcement",
  hidden: "hidden options",
  recheck: "re-check flags",
  featured: "featured options",
};

export function describe(e: ConsoleLog): string {
  const t = e.target_name ?? "someone";
  switch (e.action) {
    case "console_open":
      return "opened the console";
    case "lock_edits":
      return "locked edits";
    case "unlock_edits":
      return "unlocked edits";
    case "update_rules": {
      const keys = Object.keys((e.details?.changes as Record<string, unknown>) ?? {}).map((k) => RULE_LABELS[k] ?? k);
      const moved = typeof e.details?.migrated === "number" && e.details.migrated ? ` (${e.details.migrated} plans moved)` : "";
      return `changed ${keys.join(", ") || "the trip rules"}${moved}`;
    }
    case "delete_participant":
      return `deleted ${t}`;
    case "reset_pin":
      return `reset ${t}'s PIN`;
    case "make_admin":
      return `made ${t} an organizer`;
    case "remove_admin":
      return `removed ${t} as an organizer`;
    case "edit_plan":
      return `edited ${t}'s plan`;
    case "export":
      return `exported the ${String(e.details?.format ?? "json").toUpperCase()}`;
    case "peek":
      return `👀 peeked at ${t}'s plan`;
    default:
      return e.action;
  }
}

function LogList({ log }: { log: ConsoleLog[] }) {
  if (!log.length) return <p className="text-[14px] text-ink-3">Nothing yet.</p>;
  return (
    <ul className="space-y-2.5" aria-label="Activity log">
      {log.map((e) => (
        <li key={e.id} className="flex gap-3 text-[14px] leading-snug">
          <Avatar name={e.actor_name} className="size-7 text-[11px]" />
          <span className="min-w-0 flex-1">
            <b>{e.actor_name}</b> {describe(e)}
            <span className="block text-[12px] text-ink-3">
              <When iso={e.at} />
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function ActivityTab({ log }: { log: ConsoleLog[] }) {
  const [filter, setFilter] = useState<"all" | "admin" | "peek">("all");
  const list = log.filter((e) => filter === "all" || (filter === "peek" ? e.action === "peek" : e.action !== "peek"));
  return (
    <Card title="Activity log" icon={ActivityIcon} sub="Every organizer action, and who peeked at whom.">
      <div className="mb-3 flex gap-1.5">
        {(["all", "admin", "peek"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f} className={cn("h-8 rounded-full px-3 text-[12.5px] font-semibold", filter === f ? "bg-ink text-paper" : "bg-sand-200 text-ink-2")}>
            {f === "all" ? "All" : f === "admin" ? "Organizers" : "👀 Peeks"}
          </button>
        ))}
      </div>
      <LogList log={list} />
    </Card>
  );
}

// ── Roommates (just for fun) ──────────────────────────────────────────

const RANKS = ["1st", "2nd", "3rd"];

function RoommatesTab({ board }: { board: RoommateBoard }) {
  return (
    <>
      <p className="inline-flex -rotate-1 items-center rounded-full bg-saffron-200 px-3 py-1 text-[12px] font-bold text-ink ring-1 ring-saffron-400/40">
        Just for fun · not binding · organizers only
      </p>
      <Card title="Mutual matches 🤝" sub="They picked each other.">
        {board.mutual.length ? (
          <ul className="grid gap-2" aria-label="Mutual matches">
            {board.mutual.map((m) => (
              <li key={`${m.a.id}-${m.b.id}`} className="flex items-center gap-3 rounded-2xl bg-saffron-100/70 p-2.5 ring-1 ring-saffron-200">
                <span className="flex -space-x-2">
                  <Avatar name={m.a.name} />
                  <Avatar name={m.b.name} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold">
                    {m.a.name} <span aria-hidden="true">🤝</span> {m.b.name}
                  </span>
                  <span className="block text-[12px] text-ink-3">
                    {m.a.name}&apos;s {RANKS[m.a.rank - 1]} · {m.b.name}&apos;s {RANKS[m.b.rank - 1]}
                  </span>
                </span>
                {m.a.rank === 1 && m.b.rank === 1 && <span className="shrink-0 rounded-full bg-hibiscus-500 px-2 py-0.5 text-[11px] font-bold text-white">Both #1</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[14px] text-ink-3">No mutual picks yet.</p>
        )}
      </Card>
      {board.wanted.length > 0 && (
        <Card title="Most wanted" sub="How many people picked them.">
          <div className="flex flex-wrap gap-2">
            {board.wanted.slice(0, 8).map((w) => (
              <span key={w.id ?? w.name} className="inline-flex items-center gap-2 rounded-full bg-sand-100 py-1 pl-1 pr-3 text-[13.5px] font-semibold">
                <Avatar name={w.name} className="size-7 text-[12px] ring-0" />
                {w.name}
                <span className="rounded-full bg-ink px-1.5 text-[11px] font-bold text-paper tabular-nums">{w.count}</span>
                {!w.id && <span className="text-[11px] font-semibold text-ink-3">not joined</span>}
              </span>
            ))}
          </div>
        </Card>
      )}
      <Card title="Who picked whom" sub={`${board.rows.length} ${board.rows.length === 1 ? "person has" : "people have"} picked.`}>
        {board.rows.length ? (
          <ul className="divide-y divide-ink/5" aria-label="Who picked whom">
            {board.rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5">
                <span className="flex w-36 shrink-0 items-center gap-2 text-[14px] font-bold">
                  <Avatar name={r.name} className="size-7 text-[12px]" />
                  <span className="truncate">{r.name}</span>
                </span>
                <span className="flex flex-wrap gap-1.5">
                  {r.picks.map((k) => (
                    <span key={k.rank} className="inline-flex items-center gap-1 rounded-full bg-sand-100 px-2.5 py-1 text-[12.5px] font-semibold">
                      <span className="text-ink-3">{RANKS[k.rank - 1]}</span> {k.name}
                      {!k.joined && <span className="text-[11px] text-ink-3">· not joined</span>}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[14px] text-ink-3">Nobody has picked roommates yet.</p>
        )}
      </Card>
    </>
  );
}
