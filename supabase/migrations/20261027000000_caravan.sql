-- Caravan — schema
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once. Nothing is deleted.
--
-- Every trip is a row in `trips` (its preset, live rules and lock), and
-- everything else belongs to a trip: its participants, their itineraries,
-- the organizers' activity log and who peeked at whom.

create extension if not exists pgcrypto;

-- ── Trips ───────────────────────────────────────────────────────────────
create table if not exists public.trips (
  id            uuid primary key default gen_random_uuid(),
  -- The invite link: /t/<slug>
  slug          text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,63}$'),
  name          text not null check (char_length(name) between 1 and 60),
  -- A preset registered in the app (presets/<id>/preset.json)
  preset_id     text not null,
  edits_locked  boolean not null default false,
  -- The live Trip rules; {} = the preset's defaults
  rules         jsonb not null default '{}'::jsonb,
  -- live = a real trip, demo = the public demo (reset nightly)
  kind          text not null default 'live' check (kind in ('live', 'demo')),
  -- Salted hash of the creator's IP, for rate-limiting trip creation (never the IP itself)
  creator_hash  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists trips_creator_idx on public.trips (creator_hash, created_at desc);

-- ── People (per trip) ───────────────────────────────────────────────────
create table if not exists public.participants (
  id               uuid primary key default gen_random_uuid(),
  trip_id          uuid not null references public.trips(id) on delete cascade,
  display_name     text not null check (char_length(display_name) between 1 and 30),
  pin_hash         text not null,
  failed_attempts  int  not null default 0,
  locked_until     timestamptz,
  role             text not null default 'member' check (role in ('owner', 'admin', 'member')),
  -- Demo guests ("Try it as a guest"), removed when the demo resets
  guest            boolean not null default false,
  created_at       timestamptz not null default now()
);
-- Names are unique within a trip regardless of case ("Sam" and "sam" can't both join).
create unique index if not exists participants_trip_name_key on public.participants (trip_id, lower(display_name));
-- At most one owner per trip.
create unique index if not exists participants_one_owner on public.participants (trip_id) where role = 'owner';
create index if not exists participants_trip_idx on public.participants (trip_id, created_at);

-- ── Itineraries (one per person) ────────────────────────────────────────
create table if not exists public.itineraries (
  participant_id  uuid primary key references public.participants(id) on delete cascade,
  data            jsonb not null,
  status          text not null default 'draft' check (status in ('draft', 'submitted')),
  submitted_at    timestamptz,
  updated_at      timestamptz not null default now(),
  -- The last organizer edit or rules migration: { kind, by, byId, at, seen, lost?, text? }
  stamp           jsonb
);
create index if not exists itineraries_status_idx on public.itineraries (status);

-- ── Activity log (per trip) ─────────────────────────────────────────────
create table if not exists public.activity_log (
  id           uuid primary key default gen_random_uuid(),
  trip_id      uuid not null references public.trips(id) on delete cascade,
  at           timestamptz not null default now(),
  actor_id     uuid references public.participants(id) on delete set null,
  actor_name   text not null,
  action       text not null,
  target_id    uuid references public.participants(id) on delete set null,
  target_name  text,
  details      jsonb
);
create index if not exists activity_log_trip_at_idx on public.activity_log (trip_id, at desc);

-- ── Peeks (unique peekers per plan) ─────────────────────────────────────
create table if not exists public.peeks (
  peeker_id  uuid not null references public.participants(id) on delete cascade,
  target_id  uuid not null references public.participants(id) on delete cascade,
  first_at   timestamptz not null default now(),
  last_at    timestamptz not null default now(),
  count      int not null default 1,
  primary key (peeker_id, target_id)
);
create index if not exists peeks_target_idx on public.peeks (target_id);

-- ── Security ────────────────────────────────────────────────────────────
-- The app only talks to the database from the server with the secret key,
-- which bypasses RLS. RLS is on with NO policies, so the public anon key
-- (and anyone holding it) can read or write nothing.
alter table public.trips         enable row level security;
alter table public.participants  enable row level security;
alter table public.itineraries   enable row level security;
alter table public.activity_log  enable row level security;
alter table public.peeks         enable row level security;

revoke all on public.trips         from anon, authenticated;
revoke all on public.participants  from anon, authenticated;
revoke all on public.itineraries   from anon, authenticated;
revoke all on public.activity_log  from anon, authenticated;
revoke all on public.peeks         from anon, authenticated;
