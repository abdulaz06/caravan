-- Caravan — organizers, live trip rules, activity log and peeks
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run more than once. Nothing is deleted.

-- ── Roles ───────────────────────────────────────────────────────────────
alter table public.participants
  add column if not exists role text not null default 'member';

do $$ begin
  alter table public.participants
    add constraint participants_role_check check (role in ('owner', 'admin', 'member'));
exception when duplicate_object then null;
end $$;

-- At most one owner.
create unique index if not exists participants_one_owner
  on public.participants (role) where role = 'owner';

-- Roles are never granted by name (anyone could register a name first): the
-- owner is set when a trip is created, and promotes admins from the console.

-- ── Organizer edit stamp on itineraries ─────────────────────────────────
-- { kind: 'edit' | 'rules', by, byId, at, seen, lost? } — shown to the person once.
alter table public.itineraries add column if not exists stamp jsonb;

-- ── Live trip rules ─────────────────────────────────────────────────────
-- Structure, toggles, content controls and the announcement (see src/lib/rules.ts).
-- An empty object means "all defaults".
alter table public.settings add column if not exists rules jsonb not null default '{}'::jsonb;

-- ── Activity log ────────────────────────────────────────────────────────
create table if not exists public.activity_log (
  id           uuid primary key default gen_random_uuid(),
  at           timestamptz not null default now(),
  actor_id     uuid references public.participants(id) on delete set null,
  actor_name   text not null,
  action       text not null,
  target_id    uuid references public.participants(id) on delete set null,
  target_name  text,
  details      jsonb
);
create index if not exists activity_log_at_idx on public.activity_log (at desc);

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

-- ── Security (same as the other tables) ─────────────────────────────────
-- Server-only access with the service-role key; RLS on with no policies.
alter table public.activity_log enable row level security;
alter table public.peeks        enable row level security;
revoke all on public.activity_log from anon, authenticated;
revoke all on public.peeks        from anon, authenticated;

-- Check: who's an organizer now?
select display_name, role from public.participants where role <> 'member' order by role;
