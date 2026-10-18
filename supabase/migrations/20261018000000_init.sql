-- Lanks — initial schema
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once.

create extension if not exists pgcrypto;

-- ── People ──────────────────────────────────────────────────────────────
create table if not exists public.participants (
  id               uuid primary key default gen_random_uuid(),
  display_name     text not null check (char_length(display_name) between 1 and 30),
  pin_hash         text not null,
  failed_attempts  int  not null default 0,
  locked_until     timestamptz,
  created_at       timestamptz not null default now()
);

-- Names are unique regardless of case ("Sam" and "sam" can't both join).
create unique index if not exists participants_display_name_lower_key
  on public.participants (lower(display_name));

-- ── Itineraries (one per person) ────────────────────────────────────────
create table if not exists public.itineraries (
  participant_id  uuid primary key references public.participants(id) on delete cascade,
  data            jsonb not null,
  status          text not null default 'draft' check (status in ('draft', 'submitted')),
  submitted_at    timestamptz,
  updated_at      timestamptz not null default now()
);

create index if not exists itineraries_status_idx on public.itineraries (status);

-- ── Settings (exactly one row) ──────────────────────────────────────────
create table if not exists public.settings (
  id            int primary key default 1 check (id = 1),
  edits_locked  boolean not null default false,
  updated_at    timestamptz not null default now()
);

insert into public.settings (id) values (1) on conflict (id) do nothing;

-- ── Security ────────────────────────────────────────────────────────────
-- The app only talks to the database from the server using the service-role
-- key, which bypasses RLS. RLS is enabled with NO policies, so the public
-- anon key (and anyone holding it) can read or write nothing.
alter table public.participants enable row level security;
alter table public.itineraries  enable row level security;
alter table public.settings     enable row level security;

revoke all on public.participants from anon, authenticated;
revoke all on public.itineraries  from anon, authenticated;
revoke all on public.settings     from anon, authenticated;
