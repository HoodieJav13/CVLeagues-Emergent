-- ============================================================================
-- CVF Leagues — Phase 9 backend, migration 7/8
-- league_settings (singleton) + public_profiles view (the PII boundary).
-- ============================================================================

-- ---------------------------- league_settings ------------------------------
-- Single row (id constrained to 1), shaped exactly like the frontend's
-- settings object. Season strings everywhere else stamp from current_season.
create table public.league_settings (
  id                 int primary key default 1 check (id = 1),
  current_season     text not null,
  registration_open  jsonb not null default '{"kickball": false, "flag_football": false}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger league_settings_updated_at
  before update on public.league_settings
  for each row execute procedure extensions.moddatetime (updated_at);

alter table public.league_settings enable row level security;

-- Public read: registration_open drives the public form states.
create policy league_settings_public_read on public.league_settings
  for select to anon, authenticated using (true);
create policy league_settings_admin_update on public.league_settings
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- No insert/delete policies: the singleton below is the only row, forever.
revoke insert, delete on table public.league_settings from anon, authenticated;

-- The one row. Values match the current app state (seed.js settings).
insert into public.league_settings (id, current_season, registration_open)
values (1, 'Summer 2026', '{"kickball": true, "flag_football": false}'::jsonb);

-- ----------------------------- public_profiles -----------------------------
-- The PII boundary. profiles itself is admin-only under RLS; this view is
-- what public pages read. It exposes ONLY scoreboard-safe columns plus two
-- derived fields the frontend previously stored:
--   claimed            -> auth_user_id is not null
--   eligibility_status -> a verified waiver on the current version exists
--                         ('verified' / 'not_verified' — the exact strings
--                         <EligibilityIndicator> consumes)
--
-- INTENTIONAL definer-style view (security_invoker = off, the default):
-- it must bypass profiles' admin-only RLS to serve anon readers. That is
-- safe precisely because the column list is a hand-picked safe subset —
-- never add a contact/PII column here.
create view public.public_profiles as
select
  p.id,
  p.first_name,
  p.last_name,
  p.display_name,
  p.name,
  p.sports,
  p.experience,
  p.bio,
  p.avatar_color,
  (p.auth_user_id is not null) as claimed,
  case when exists (
    select 1 from public.waivers w
    where w.profile_id = p.id
      and w.verification_status = 'verified'
      and w.waiver_version = public.current_waiver_version()
  ) then 'verified' else 'not_verified' end as eligibility_status,
  p.created_at
from public.profiles p;

grant select on public.public_profiles to anon, authenticated;
