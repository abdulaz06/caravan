"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, LockKeyhole, Plus, Search, UserPlus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { MAX_ROOMMATES, type RoommatePick } from "@/lib/itinerary";
import { Avatar } from "../avatar";

const RANK = [
  { label: "1st", medal: "bg-saffron-400 text-ink ring-saffron-200" },
  { label: "2nd", medal: "bg-sand-300 text-ink ring-sand-200" },
  { label: "3rd", medal: "bg-sunset-300 text-ink ring-sunset-100" },
];

/**
 * "Top choices to share a room with 😄" — just for fun. Pick and order up to
 * three people from the crew (or type a name for someone who hasn't joined).
 * Private: only the organizers ever see it.
 */
export function RoommatePicker({
  value,
  onChange,
  candidates,
  disabled,
}: {
  value: RoommatePick[];
  onChange: (next: RoommatePick[]) => void;
  candidates: { id: string; name: string }[];
  disabled?: boolean;
}) {
  const [q, setQ] = useState("");
  const [typed, setTyped] = useState("");
  const full = value.length >= MAX_ROOMMATES;
  const pickedIds = value.map((v) => v.id ?? "").join(",");
  const term = q.trim().toLowerCase();
  const matches = useMemo(() => {
    const picked = new Set(pickedIds.split(","));
    return candidates.filter((c) => !picked.has(c.id) && (!term || c.name.toLowerCase().includes(term)));
  }, [candidates, term, pickedIds]);

  const add = (p: RoommatePick) => {
    if (full) return;
    const key = (x: RoommatePick) => x.id ?? `name:${x.name.trim().toLowerCase()}`;
    if (value.some((v) => key(v) === key(p))) return;
    onChange([...value, p]);
  };
  const move = (i: number, by: -1 | 1) => {
    const next = [...value];
    const [it] = next.splice(i, 1);
    next.splice(i + by, 0, it);
    onChange(next);
  };
  const addTyped = () => {
    const name = typed.trim().replace(/\s+/g, " ").slice(0, 40);
    if (!name) return;
    // Typed the name of someone who's on the list? Pick them properly.
    const known = candidates.find((c) => c.name.toLowerCase() === name.toLowerCase());
    add(known ? { id: known.id, name: known.name } : { name });
    setTyped("");
  };

  return (
    <div>
      <ol className="grid gap-2" aria-label="Your roommate picks">
        {Array.from({ length: MAX_ROOMMATES }, (_, i) => {
          const p = value[i];
          const r = RANK[i];
          return (
            <li key={p ? (p.id ?? `n:${p.name}`) : `empty-${i}`}>
              <AnimatePresence mode="popLayout" initial={false}>
                {p ? (
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    className="flex items-center gap-2.5 rounded-2xl bg-paper p-2 pr-1.5 shadow-card"
                  >
                    <span className={cn("font-display grid size-9 shrink-0 place-items-center rounded-full text-[13px] font-bold ring-4", r.medal)}>
                      {r.label}
                    </span>
                    <Avatar name={p.name} className="size-8 text-[13px]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{p.name}</span>
                      {!p.id && <span className="block text-[11.5px] font-semibold text-ink-3">Not joined yet</span>}
                    </span>
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      disabled={disabled || i === 0}
                      aria-label={`Move ${p.name} up`}
                      className="grid size-9 place-items-center rounded-full text-ink-2 transition hover:bg-sand-200 disabled:opacity-25"
                    >
                      <ArrowUp className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={disabled || i === value.length - 1}
                      aria-label={`Move ${p.name} down`}
                      className="grid size-9 place-items-center rounded-full text-ink-2 transition hover:bg-sand-200 disabled:opacity-25"
                    >
                      <ArrowDown className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange(value.filter((_, k) => k !== i))}
                      disabled={disabled}
                      aria-label={`Remove ${p.name}`}
                      className="grid size-9 place-items-center rounded-full text-ink-3 transition hover:bg-sunset-100 hover:text-sunset-600"
                    >
                      <X className="size-4" />
                    </button>
                  </motion.div>
                ) : (
                  <div className="flex h-[52px] items-center gap-2.5 rounded-2xl border-2 border-dashed border-sand-300 px-2 text-[14px] font-semibold text-ink-3">
                    <span className="font-display grid size-9 place-items-center rounded-full bg-sand-200 text-[13px] font-bold text-ink-3">{r.label}</span>
                    {i === value.length ? "Tap someone below" : "—"}
                  </div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ol>

      <div className={cn("mt-4", full && "opacity-60")}>
        {candidates.length > 6 && (
          <label className="flex h-11 items-center gap-2 rounded-2xl bg-paper px-3 shadow-card">
            <Search className="size-4 shrink-0 text-ink-3" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search the crew"
              aria-label="Search the crew"
              disabled={disabled || full}
              className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink-3/70"
            />
          </label>
        )}
        <div className="mt-2.5 flex flex-wrap gap-2" role="group" aria-label="The crew">
          {matches.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => add({ id: c.id, name: c.name })}
              disabled={disabled || full}
              aria-label={`Pick ${c.name} as a roommate`}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-paper py-1 pl-1 pr-3.5 text-[14px] font-semibold text-ink-2 shadow-card transition hover:bg-white active:scale-95 disabled:pointer-events-none"
            >
              <Avatar name={c.name} className="size-8 text-[13px] ring-0" />
              {c.name}
              <Plus className="size-3.5 text-ink-3" strokeWidth={3} />
            </button>
          ))}
          {!matches.length && (
            <p className="px-1 text-[13px] text-ink-3">
              {candidates.length ? "No one by that name — type them in below." : "Nobody else has started a plan yet — type a name below."}
            </p>
          )}
        </div>
        {full && <p className="mt-2 px-1 text-[12.5px] font-semibold text-ink-3">That&apos;s your top {MAX_ROOMMATES} — remove one to swap someone in.</p>}
      </div>

      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          addTyped();
        }}
      >
        <label className="text-[14px] font-semibold text-ink-2" htmlFor="roommate-typed">
          Someone not on the list? Type their name
        </label>
        <div className="mt-1.5 flex gap-2">
          <input
            id="roommate-typed"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            maxLength={40}
            placeholder="e.g. Sam"
            disabled={disabled || full}
            className="h-12 min-w-0 flex-1 rounded-2xl border-2 border-sand-300 bg-paper px-4 text-[16px] outline-none transition placeholder:text-ink-3/60 focus:border-ocean-600"
          />
          <button
            type="submit"
            disabled={disabled || full || !typed.trim()}
            className="inline-flex h-12 shrink-0 items-center gap-1.5 rounded-2xl bg-ink px-4 text-[14px] font-bold text-paper transition active:scale-95 disabled:opacity-35"
          >
            <UserPlus className="size-4" /> Add
          </button>
        </div>
      </form>
      <p className="mt-3 flex items-center gap-1.5 px-1 text-[12px] text-ink-3">
        <LockKeyhole className="size-3 shrink-0 text-jungle-600" /> Only the organizers see this — never the group screen, browse or peeks.
      </p>
    </div>
  );
}
