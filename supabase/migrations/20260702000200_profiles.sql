-- ============================================================================
-- CVF Leagues — Phase 9 backend, migration 2/8
-- profiles — a PERSON in the league.
--
-- Locked constraint: Auth User ≠ Player. auth_user_id is NULLABLE — a profile
-- with no auth account is the normal case in Season 1 (players are records,
-- not logins). Claiming an account later sets auth_user_id; no history moves.
--
-- Deliberately absent (derived, never stored — they'd drift):
--   * claimed            -> auth_user_id IS NOT NULL (exposed on the
--                           public_profiles view, migration 7)
--   * eligibility_status -> computed from verified waivers (same view)
--
-- PII note: this table is admin-only under RLS. Public pages read the
-- public_profiles view (migration 7), which exposes no contact fields.
-- ============================================================================

create table public.profiles (
  id                       uuid primary key default gen_random_uuid(),
  auth_user_id             uuid unique references auth.users (id) on delete set null,
  first_name               text not null,
  last_name                text not null default '',   -- '' when a single-token name was split (admin-editable)
  display_name             text,
  -- seed.js stores a precomputed `name`; a generated column keeps the field
  -- with zero drift risk.
  name                     text generated always as (
                             coalesce(nullif(display_name, ''),
                                      trim(first_name || ' ' || last_name))
                           ) stored,
  email                    text,
  phone                    text,
  dob                      date,
  sports                   text[] not null default '{}',
  experience               text,
  bio                      text,
  avatar_color             text not null default '#5BB8CC',
  emergency_contact_name   text,
  emergency_contact_phone  text,
  admin_notes              jsonb not null default '[]'::jsonb,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure extensions.moddatetime (updated_at);

-- ---------------------------------------------------------------------------
-- RLS: admin-only, in full. No DELETE policy exists for ANYONE — profiles are
-- history (stats, waivers reference them). "Removing" a player is a
-- team_players.roster_status change, never a profile deletion.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy profiles_admin_select on public.profiles
  for select to authenticated using (public.is_admin());

create policy profiles_admin_insert on public.profiles
  for insert to authenticated with check (public.is_admin());

create policy profiles_admin_update on public.profiles
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Belt and suspenders on top of the missing policy:
revoke delete on table public.profiles from anon, authenticated;
