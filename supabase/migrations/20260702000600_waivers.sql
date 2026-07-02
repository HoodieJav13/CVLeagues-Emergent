-- ============================================================================
-- CVF Leagues — Phase 9 backend, migration 6/8
-- waiver_versions (immutable text) + waivers (append-only signatures).
--
-- Locked constraints made real:
--   * waiver_versions stores the EXACT text per version; never mutated,
--     only superseded by inserting the next version.
--   * waivers are APPEND-ONLY: re-signing creates a new row. Three layers
--     enforce it: (1) column-level UPDATE grant limited to verification
--     fields, (2) an immutability trigger on the signature fields that also
--     permits profile_id to be set exactly once (NULL -> value: the
--     free-agent-signs-before-profile-exists case), (3) no DELETE policy or
--     grant for anyone — including the admin.
--   * Submitted waiver ≠ eligibility: verification_status is admin metadata,
--     the only mutable surface on the row.
--
-- NOTE: no waiver_versions row is seeded — the version row is created when
-- the NM-attorney-reviewed language lands (background task, pre-launch).
-- Until then current_waiver_version() returns NULL, the public waiver flow
-- has nothing to sign against, and computed eligibility is 'not_verified'
-- for everyone — which is the truthful state.
-- ============================================================================

-- ---------------------------- waiver_versions ------------------------------
create table public.waiver_versions (
  version       text primary key,            -- natural key: 'CVF-WAIVER-2026-06-04-v1'
  body_text     text not null,               -- exact attorney-reviewed language
  effective_at  timestamptz not null,
  created_at    timestamptz not null default now()
);

-- Current version = latest effective. Used by RLS, the eligibility view,
-- and the linkage RPCs.
create or replace function public.current_waiver_version()
returns text
language sql stable security definer
set search_path = public
as $$
  select version from public.waiver_versions
  order by effective_at desc
  limit 1;
$$;

revoke execute on function public.current_waiver_version() from public;
grant execute on function public.current_waiver_version() to anon, authenticated;

-- -------------------------------- waivers ----------------------------------
create table public.waivers (
  id                   uuid primary key default gen_random_uuid(),
  -- NULLABLE by design: a person can sign before any profile exists
  -- (seed's w6 case). Linked later, exactly once, by the assignment RPCs.
  profile_id           uuid references public.profiles (id) on delete restrict,
  -- signature capture — IMMUTABLE after insert
  signed_name          text not null,
  email                text not null,
  phone                text,
  signed_at            timestamptz not null default now(),
  waiver_version       text not null references public.waiver_versions (version),
  accepted_terms       boolean not null check (accepted_terms = true),
  age_confirmed        boolean not null,     -- a FALSE attestation is recorded and rejected (seed w5), not blocked
  media_consent        boolean not null default false,
  ip_address           inet,
  user_agent           text,
  -- admin verification — the only mutable surface
  verification_status  text not null default 'pending'
                       check (verification_status in ('pending', 'verified', 'rejected', 'duplicate')),
  verified_by          uuid references auth.users (id) on delete set null,
  verified_at          timestamptz,
  created_at           timestamptz not null default now()
);

-- Immutability trigger: signature fields frozen; profile_id settable once.
create or replace function public.enforce_waiver_immutability()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.signed_name    is distinct from old.signed_name)
  or (new.email          is distinct from old.email)
  or (new.phone          is distinct from old.phone)
  or (new.signed_at      is distinct from old.signed_at)
  or (new.waiver_version is distinct from old.waiver_version)
  or (new.accepted_terms is distinct from old.accepted_terms)
  or (new.age_confirmed  is distinct from old.age_confirmed)
  or (new.media_consent  is distinct from old.media_consent)
  or (new.ip_address     is distinct from old.ip_address)
  or (new.user_agent     is distinct from old.user_agent)
  or (new.created_at     is distinct from old.created_at) then
    raise exception 'Waivers are append-only: signature fields never change. Re-signing creates a new row.';
  end if;
  if new.profile_id is distinct from old.profile_id and old.profile_id is not null then
    raise exception 'Waiver profile linkage can only be set once (NULL -> profile), never relinked.';
  end if;
  return new;
end;
$$;

create trigger waivers_immutability
  before update on public.waivers
  for each row execute procedure public.enforce_waiver_immutability();

-- ---------------------------------------------------------------------------
-- RLS + column grants
-- ---------------------------------------------------------------------------
alter table public.waiver_versions enable row level security;
alter table public.waivers enable row level security;

-- waiver_versions: signers must be able to read the exact text they sign.
create policy waiver_versions_public_read on public.waiver_versions
  for select to anon, authenticated using (true);
create policy waiver_versions_admin_insert on public.waiver_versions
  for insert to authenticated with check (public.is_admin());
revoke update, delete on table public.waiver_versions from anon, authenticated;

-- waivers: public may SIGN (insert, current version only, clean pending
-- state, no profile attachment — an anon submitter must never attach a
-- signature to someone else's profile). Nobody reads waivers except admin.
create policy waivers_public_sign on public.waivers
  for insert to anon, authenticated
  with check (
    verification_status = 'pending'
    and accepted_terms = true
    and profile_id is null
    and verified_by is null
    and verified_at is null
    and waiver_version = public.current_waiver_version()
  );

-- Admin may also insert (e.g. transcribing a paper waiver) without the
-- public-flow restrictions.
create policy waivers_admin_insert on public.waivers
  for insert to authenticated with check (public.is_admin());

create policy waivers_admin_select on public.waivers
  for select to authenticated using (public.is_admin());

create policy waivers_admin_update on public.waivers
  for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Column-level ceiling on top of RLS: even the admin role can only UPDATE
-- the verification surface + one-shot linkage (trigger constrains further).
revoke update on table public.waivers from anon, authenticated;
grant update (verification_status, verified_by, verified_at, profile_id)
  on table public.waivers to authenticated;

-- Append-only: no deletes, for anyone, ever.
revoke delete on table public.waivers from anon, authenticated;
