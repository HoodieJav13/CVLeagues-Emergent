-- ============================================================================
-- CVF Leagues — Phase 9 backend, migration 5/8
-- team_registrations + free_agents — the public intake tables.
--
-- Shapes mirror the CURRENT intake form payloads (TeamRegistration.js /
-- FreeAgentSignup.js), not the fossil seed rows (approved: fossils dropped).
--
-- RLS pattern: the public may INSERT (submit a form) but never read back —
-- intake rows carry contact PII. Anonymous inserts are constrained so a
-- submitter cannot set triage state, linkage, or notes. Rows are never
-- deleted by anyone: 'archived' is the terminal state; intake is a paper
-- trail. The linkage columns (approved_team_id / profile_id /
-- assigned_team_id) are written only by the RPCs in migration 8.
-- ============================================================================

-- --------------------------- team_registrations ----------------------------
create table public.team_registrations (
  id                     uuid primary key default gen_random_uuid(),
  -- intake payload (form field names, snake_cased per approved sweep)
  captain_name           text not null,   -- single string as collected; split happens at approval
  captain_phone          text,
  captain_email          text,
  sport                  text not null check (sport in ('kickball', 'flag_football')),
  team_name              text not null,
  estimated_roster_size  int,
  preferred_season       text not null,   -- informational, auto-stamped by the form
  consent_to_contact     boolean not null check (consent_to_contact = true),
  notes                  text,
  -- triage
  status                 text not null default 'new'
                         check (status in ('new', 'contacted', 'approved', 'archived')),
  admin_notes            jsonb not null default '[]'::jsonb,
  -- linkage (written by approve_registration RPC only)
  approved_team_id       uuid references public.teams (id) on delete set null,
  processed_at           timestamptz,
  processed_by           uuid references auth.users (id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (captain_phone is not null or captain_email is not null)
);

create trigger team_registrations_updated_at
  before update on public.team_registrations
  for each row execute procedure extensions.moddatetime (updated_at);

-- ------------------------------ free_agents --------------------------------
create table public.free_agents (
  id                       uuid primary key default gen_random_uuid(),
  -- intake payload
  first_name               text not null,
  last_name                text not null,
  display_name             text,
  email                    text,
  phone                    text,
  sports                   text[] not null check (cardinality(sports) > 0),
  experience               text,
  preferred_position       text,
  availability             text[] not null default '{}',
  emergency_contact_name   text,
  emergency_contact_phone  text,
  consent_to_contact       boolean not null check (consent_to_contact = true),
  notes                    text,
  -- triage
  status                   text not null default 'new'
                           check (status in ('new', 'contacted', 'assigned', 'archived')),
  admin_notes              jsonb not null default '[]'::jsonb,
  -- linkage (written by assign_free_agent RPC only)
  profile_id               uuid references public.profiles (id) on delete set null,
  assigned_team_id         uuid references public.teams (id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  check (phone is not null or email is not null)
);

create trigger free_agents_updated_at
  before update on public.free_agents
  for each row execute procedure extensions.moddatetime (updated_at);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.team_registrations enable row level security;
alter table public.free_agents enable row level security;

-- Public submission: INSERT only, forced into a clean triage state.
create policy team_registrations_public_submit on public.team_registrations
  for insert to anon, authenticated
  with check (
    status = 'new'
    and consent_to_contact = true
    and admin_notes = '[]'::jsonb
    and approved_team_id is null
    and processed_at is null
    and processed_by is null
  );

create policy free_agents_public_submit on public.free_agents
  for insert to anon, authenticated
  with check (
    status = 'new'
    and consent_to_contact = true
    and admin_notes = '[]'::jsonb
    and profile_id is null
    and assigned_team_id is null
  );

-- Admin triage: read + update. No delete for anyone ('archived' is terminal).
create policy team_registrations_admin_select on public.team_registrations
  for select to authenticated using (public.is_admin());
create policy team_registrations_admin_update on public.team_registrations
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy free_agents_admin_select on public.free_agents
  for select to authenticated using (public.is_admin());
create policy free_agents_admin_update on public.free_agents
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

revoke delete on table public.team_registrations from anon, authenticated;
revoke delete on table public.free_agents from anon, authenticated;
