-- ============================================================================
-- CVF Leagues — Phase 9 backend, migration 1/8
-- Extensions + admin identity (the RLS anchor).
--
-- Locked constraints honored here:
--   * Admin-only Season 1: admin_users is the single write-capability list.
--   * Auth User ≠ Player: admin identity lives on auth accounts, NOT on
--     profiles — an admin needs no player profile and vice versa.
-- ============================================================================

-- updated_at maintenance (Supabase ships moddatetime in the extensions schema)
create extension if not exists moddatetime schema extensions;

-- ---------------------------------------------------------------------------
-- admin_users — who may administer. One row for Season 1.
-- Managed ONLY via the Supabase dashboard / service role: RLS is enabled with
-- zero client policies, so anon/authenticated can never read or write it.
-- ---------------------------------------------------------------------------
create table public.admin_users (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid not null unique references auth.users (id) on delete cascade,
  label         text,
  created_at    timestamptz not null default now()
);

alter table public.admin_users enable row level security;
revoke all on table public.admin_users from anon, authenticated;

-- ---------------------------------------------------------------------------
-- is_admin() — every write policy in the schema resolves through this.
-- SECURITY DEFINER so it can read admin_users despite its deny-all RLS.
-- Swappable later for a JWT claim without touching any policy text.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users a where a.auth_user_id = auth.uid()
  );
$$;

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- assert_admin() — guard used at the top of every admin RPC (migration 8).
create or replace function public.assert_admin()
returns void
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;
end;
$$;

revoke execute on function public.assert_admin() from public;
grant execute on function public.assert_admin() to authenticated;
