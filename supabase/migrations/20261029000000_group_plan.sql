-- Caravan — the group plan (consensus itinerary)
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once. Nothing is deleted. Run it after
-- 20261027000000_caravan.sql.
--
-- Organizers generate a group plan from everyone's itineraries, save
-- versions of it and publish one; travellers answer "I'm in" / "I'll skip"
-- on each item of the published plan.

-- ── Plan versions (per trip) ────────────────────────────────────────────
create table if not exists public.plan_versions (
  id               uuid primary key default gen_random_uuid(),
  trip_id          uuid not null references public.trips(id) on delete cascade,
  -- 1, 2, 3… per trip
  version          int  not null check (version > 0),
  -- The generated plan: dates, slots, reasons, satisfaction (engine/consensus/types.ts)
  data             jsonb not null,
  -- The organizers' knobs that made it (decision mode, locks, splits…)
  settings         jsonb not null default '{}'::jsonb,
  created_by       uuid references public.participants(id) on delete set null,
  created_by_name  text not null default '',
  created_at       timestamptz not null default now(),
  -- Set when published; travellers see the latest published version
  published_at     timestamptz,
  unique (trip_id, version)
);
create index if not exists plan_versions_trip_idx on public.plan_versions (trip_id, version desc);
create index if not exists plan_versions_published_idx on public.plan_versions (trip_id, published_at desc) where published_at is not null;

-- ── RSVPs on the published plan ─────────────────────────────────────────
-- Keyed by the plan item's stable key, so answers survive a new version
-- wherever the same thing stays on the same date and slot.
create table if not exists public.plan_rsvps (
  trip_id         uuid not null references public.trips(id) on delete cascade,
  item_key        text not null check (char_length(item_key) between 1 and 64),
  participant_id  uuid not null references public.participants(id) on delete cascade,
  status          text not null check (status in ('in', 'skip')),
  -- A split slot: which side they're down for (an activity id)
  choice          text check (choice is null or char_length(choice) <= 64),
  updated_at      timestamptz not null default now(),
  primary key (participant_id, item_key)
);
create index if not exists plan_rsvps_trip_idx on public.plan_rsvps (trip_id);

-- ── Security ────────────────────────────────────────────────────────────
-- Server-only, like every other table: RLS on with no policies.
alter table public.plan_versions enable row level security;
alter table public.plan_rsvps    enable row level security;

revoke all on public.plan_versions from anon, authenticated;
revoke all on public.plan_rsvps    from anon, authenticated;
