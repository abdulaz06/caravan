"use client";

import { ArrowRight, BedDouble, Building2, Check, Home, LockKeyhole, Shuffle } from "lucide-react";
import {
  budgets,
  dietary,
  earlyMornings,
  interests,
  sharedRooms,
  stays,
  transport,
} from "@/content/preferences";
import { BUDGET_BOUNDS } from "@/content/costs";
import { cn } from "@/lib/cn";
import { useCurrency } from "../currency";
import type { ItineraryData, Preferences } from "@/lib/itinerary";
import { TukTuk, Van, Train, SunMark, Palm } from "../brand/illustrations";
import { RoommatePicker } from "./roommate-picker";
import { Button } from "../ui/button";

type Props = {
  data: ItineraryData;
  update: (fn: (d: ItineraryData) => ItineraryData) => void;
  locked: boolean;
  /** Owner + admin names — the only people who see these answers. */
  organizers: string[];
  /** People who can be picked as a roommate. */
  candidates: { id: string; name: string }[];
  onNext: () => void;
};

/** "Abdul", "Abdul & Aadil", "Abdul, Aadil & Sam". */
export function namesList(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "the organizers";
  return `${names.slice(0, -1).join(", ")} & ${names.at(-1)}`;
}

const STAY_ICONS = { hostel: BedDouble, boutique: Building2, villa: Home, mix: Shuffle } as const;

export function PrefsStep({ data, update, locked, organizers, candidates, onNext }: Props) {
  const p = data.preferences;
  const { money, code } = useCurrency();
  const tierLabel = (id: string) => {
    const [lo, hi] = BUDGET_BOUNDS[id];
    if (lo === 0) return `Under ${money(hi)}`;
    if (!Number.isFinite(hi)) return `${money(lo)}+`;
    return `${money(lo)} – ${money(hi)}`;
  };
  const set = <K extends keyof Preferences>(key: K, value: Preferences[K]) =>
    update((d) => {
      const preferences = { ...d.preferences, [key]: value };
      if (value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) delete preferences[key];
      return { ...d, preferences };
    });
  const toggleIn = (key: "interests" | "dietary", id: string) => {
    const cur = p[key] ?? [];
    set(key, cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  };
  const single = <K extends "budget" | "stay" | "sharedRooms" | "earlyMornings" | "transport">(key: K, id: string) =>
    set(key, p[key] === id ? undefined : id);

  return (
    <div className="grain pb-36">
      <section className="relative z-[1] px-5 pt-7">
        <div className="flex items-start justify-between gap-3">
          <p className="label text-sunset-600">Step 3 · Extras</p>
          <button onClick={onNext} className="-mt-1 rounded-full px-3 py-1 text-sm font-semibold text-ink-3 hover:bg-sand-200">
            Skip →
          </button>
        </div>
        <h1 className="font-display mt-2 text-[38px] font-semibold leading-[1] tracking-[-0.025em]">
          A few <span className="italic text-ocean-700">extras</span>
        </h1>
        <p className="mt-3 text-[15px] text-ink-2">All optional. Tap what&apos;s true, skip the rest — it all helps plan.</p>
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-paper px-3 py-1.5 text-[12.5px] font-semibold text-ink-2 shadow-card">
          <LockKeyhole className="size-3.5 text-jungle-600" />
          {organizers.length ? `Only the organizers (${namesList(organizers)}) see these answers` : "Only the organizers see these answers"}, roommate picks included
        </p>
      </section>

      <fieldset disabled={locked} className="relative z-[1] mt-7 space-y-5 px-3">
        <Card title="Budget" sub={`Per person for the whole trip, not counting flights · shown in ${code}`}>
          <div className="grid gap-2">
            {budgets.map((b, i) => (
              <Choice key={b.id} on={p.budget === b.id} onClick={() => single("budget", b.id)} className="flex items-center gap-3 px-3.5 py-3">
                <span className="font-display w-9 text-[18px] font-semibold text-saffron-600">{"●".repeat(i + 1)}</span>
                <span className="flex-1">
                  <span className="block text-[15px] font-semibold tabular-nums">{tierLabel(b.id)}</span>
                  <span className="text-[12.5px] text-ink-3">{b.hint}</span>
                </span>
                <Tick on={p.budget === b.id} />
              </Choice>
            ))}
          </div>
        </Card>

        <Card title="Where to sleep">
          <div className="grid grid-cols-2 gap-2">
            {stays.map((s) => {
              const Icon = STAY_ICONS[s.id];
              return (
                <Choice key={s.id} on={p.stay === s.id} onClick={() => single("stay", s.id)} className="p-3.5">
                  <Icon className="size-6 text-ocean-600" />
                  <span className="mt-2 block text-[15px] font-semibold">{s.label}</span>
                  <span className="text-[12.5px] text-ink-3">{s.hint}</span>
                </Choice>
              );
            })}
          </div>
          <p className="mb-2 mt-5 text-[14px] font-semibold text-ink-2">Sharing a room?</p>
          <Segmented options={sharedRooms} value={p.sharedRooms} onChange={(id) => single("sharedRooms", id)} />
        </Card>

        <Card
          title="Top choices to share a room with 😄"
          sub="Up to 3, in order. Pick from the crew or type a name."
          badge="Just for fun · not binding"
        >
          <RoommatePicker
            value={p.roommates ?? []}
            // An empty list is kept (not deleted) so the server knows it was cleared.
            onChange={(next) => update((d) => ({ ...d, preferences: { ...d.preferences, roommates: next } }))}
            candidates={candidates}
            disabled={locked}
          />
        </Card>

        <Card title="What are you into?" sub="Pick as many as you like">
          <div className="flex flex-wrap gap-2">
            {interests.map((it) => (
              <Chip key={it.id} on={!!p.interests?.includes(it.id)} onClick={() => toggleIn("interests", it.id)}>
                {it.label}
              </Chip>
            ))}
          </div>
        </Card>

        <Card title="Early mornings?" sub="Sunrise hikes start around 4:30–5 am">
          <div className="grid grid-cols-3 gap-2">
            {earlyMornings.map((e, i) => (
              <Choice key={e.id} on={p.earlyMornings === e.id} onClick={() => single("earlyMornings", e.id)} className="p-3 text-center">
                <SunMark className={cn("mx-auto size-7", ["text-saffron-500", "text-saffron-400", "text-ink-3/50"][i])} />
                <span className="mt-1.5 block text-[13.5px] font-semibold leading-tight">{e.label}</span>
              </Choice>
            ))}
          </div>
        </Card>

        <Card title="Getting around">
          <div className="grid grid-cols-2 gap-2">
            {transport.map((t) => (
              <Choice key={t.id} on={p.transport === t.id} onClick={() => single("transport", t.id)} className="p-3.5">
                <span className="flex h-7 items-center">
                  {t.id === "van" && <Van className="h-6 text-ocean-600" />}
                  {t.id === "train" && <Train className="h-5" />}
                  {t.id === "tuktuk" && <TukTuk className="h-7" />}
                  {t.id === "any" && <Palm className="h-7 text-jungle-600" />}
                </span>
                <span className="mt-2 block text-[15px] font-semibold">{t.label}</span>
                <span className="text-[12.5px] text-ink-3">{t.hint}</span>
              </Choice>
            ))}
          </div>
        </Card>

        <Card title="Dietary needs">
          <div className="flex flex-wrap gap-2">
            {dietary.map((d) => (
              <Chip key={d.id} on={!!p.dietary?.includes(d.id)} onClick={() => toggleIn("dietary", d.id)}>
                {d.label}
              </Chip>
            ))}
          </div>
          <TextField
            className="mt-3"
            label="Anything else?"
            value={p.dietaryOther}
            onChange={(v) => set("dietaryOther", v)}
            placeholder="Allergies, can't do spicy…"
            max={200}
          />
        </Card>

        <Card title="In your own words">
          <div className="space-y-4">
            <TextField label="Flying in from" value={p.flyingFrom} onChange={(v) => set("flyingFrom", v)} placeholder="e.g. London, Dubai, Toronto" max={120} />
            <TextField label="Must-do" value={p.mustDo} onChange={(v) => set("mustDo", v)} placeholder="The one thing you'd hate to miss" area max={1000} />
            <TextField label="Hard no" value={p.hardNo} onChange={(v) => set("hardNo", v)} placeholder="Anything you really don't want to do" area max={1000} />
            <TextField
              label="Ideas we missed"
              value={p.suggestions}
              onChange={(v) => set("suggestions", v)}
              placeholder="Places or activities that aren't in the list"
              area
              max={1000}
            />
            <TextField label={`Anything else for ${namesList(organizers)}?`} value={p.notes} onChange={(v) => set("notes", v)} placeholder="Say hi 👋" area max={2000} />
          </div>
        </Card>
      </fieldset>

      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-sand-100 via-sand-100/90 to-transparent px-4 pt-6 lg:left-auto lg:w-[480px]">
        <Button size="lg" block onClick={onNext}>
          Review my trip <ArrowRight className="size-5" strokeWidth={2.5} />
        </Button>
      </div>
    </div>
  );
}

function Card({ title, sub, badge, children }: { title: string; sub?: string; badge?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[26px] bg-paper/70 p-4 shadow-card ring-1 ring-ink/[0.03]">
      {badge && (
        <span className="mb-2 inline-flex -rotate-1 items-center rounded-full bg-saffron-200 px-2.5 py-1 text-[11.5px] font-bold text-ink ring-1 ring-saffron-400/40">
          {badge}
        </span>
      )}
      <h2 className="font-display text-[22px] font-semibold leading-tight">{title}</h2>
      {sub && <p className="mt-0.5 text-[13px] text-ink-3">{sub}</p>}
      <div className="mt-3.5">{children}</div>
    </section>
  );
}

function Choice({ on, onClick, className, children }: { on: boolean; onClick: () => void; className?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "rounded-2xl border-2 text-left transition active:scale-[0.98]",
        on ? "border-ocean-600 bg-ocean-100/70" : "border-transparent bg-paper shadow-card hover:border-sand-300",
        className,
      )}
    >
      {children}
    </button>
  );
}

function Tick({ on }: { on: boolean }) {
  return (
    <span className={cn("grid size-6 place-items-center rounded-full border-2 transition", on ? "border-ocean-600 bg-ocean-600 text-white" : "border-sand-300")}>
      {on && <Check className="size-3.5" strokeWidth={3.5} />}
    </span>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold transition active:scale-95",
        on ? "bg-ink text-paper" : "bg-paper text-ink-2 shadow-card hover:bg-white",
      )}
    >
      {on && <Check className="size-3.5" strokeWidth={3.5} />}
      {children}
    </button>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: readonly { id: string; label: string }[];
  value?: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-2xl bg-sand-200/70 p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          className={cn(
            "min-h-11 rounded-xl px-2 py-1.5 text-[13px] font-semibold leading-tight transition",
            value === o.id ? "bg-paper text-ink shadow-card" : "text-ink-3",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  area,
  max,
  className,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
  area?: boolean;
  max: number;
  className?: string;
}) {
  const cls =
    "mt-1.5 w-full rounded-2xl border-2 border-sand-300 bg-paper px-4 py-3 text-[16px] outline-none transition placeholder:text-ink-3/60 focus:border-ocean-600";
  return (
    <label className={cn("block", className)}>
      <span className="text-[14px] font-semibold text-ink-2">{label}</span>
      {area ? (
        <textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={max} rows={2} className={cn(cls, "resize-none")} />
      ) : (
        <input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={max} className={cn(cls, "h-12 py-0")} />
      )}
    </label>
  );
}
