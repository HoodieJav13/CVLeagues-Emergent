-- Require a verified second factor for every administrator capability, while
-- retaining a narrow identity check that lets an AAL1 administrator reach the
-- MFA enrollment/challenge screen.
create or replace function public.is_admin_identity()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.admin_users a
     where a.auth_user_id = auth.uid()
  );
$$;

revoke execute on function public.is_admin_identity() from public;
grant execute on function public.is_admin_identity() to anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select public.is_admin_identity()
     and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

comment on function public.is_admin_identity() is
  'AAL1-safe identity check used only to route a linked administrator into MFA.';
comment on function public.is_admin() is
  'Authorization anchor: linked administrator identity plus a current AAL2 session.';

-- Public form writes now cross the application server, which validates a
-- single-use Turnstile token and the complete payload before using a server-
-- only Supabase secret. Leaving these grants or policies in place would let a
-- caller bypass that verification by writing to the Data API directly.
drop policy if exists team_registrations_public_submit on public.team_registrations;
drop policy if exists free_agents_public_submit on public.free_agents;
drop policy if exists waivers_public_sign on public.waivers;

create policy team_registrations_admin_insert on public.team_registrations
  for insert to authenticated with check (public.is_admin());

create policy free_agents_admin_insert on public.free_agents
  for insert to authenticated with check (public.is_admin());

revoke insert on table
  public.team_registrations,
  public.free_agents,
  public.waivers
from anon;

-- Waiver signing remains closed until attorney-approved text and a separately
-- reviewed protected submission endpoint exist. Authenticated administrators
-- retain the existing explicit insert grant and admin-only RLS policy.
