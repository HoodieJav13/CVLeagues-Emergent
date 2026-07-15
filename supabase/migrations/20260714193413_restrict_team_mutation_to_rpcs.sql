-- Persistent team brands and their season/container enrollments are mutated
-- only through the narrow admin RPCs below. This prevents authenticated Data
-- API clients from bypassing lifecycle and canonical-brand rules with direct
-- table writes while preserving public read access.

revoke insert, update, delete on table public.teams from authenticated;
revoke insert, update, delete on table public.team_identities from authenticated;

drop policy if exists teams_admin_write on public.teams;
drop policy if exists team_identities_admin_insert on public.team_identities;
drop policy if exists team_identities_admin_update on public.team_identities;
drop policy if exists team_identities_admin_delete on public.team_identities;

-- Charge writes lock their referenced team rows with FOR SHARE. PostgreSQL
-- requires UPDATE privilege for that row-locking read, so after client UPDATE
-- is revoked the non-client-executable constraint trigger must retain its
-- established concurrency check under the function owner.
alter function public.enforce_charge_team_season() security definer;

create or replace function public.update_team_identity(
  p_identity_id uuid,
  p_patch jsonb
)
returns void
language plpgsql volatile security definer
set search_path = public
as $$
begin
  perform public.assert_admin();

  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'Unsupported team identity field.';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_patch) key
    where key not in ('name', 'logo_color', 'founded', 'status')
  ) then
    raise exception 'Unsupported team identity field.';
  end if;
  if p_patch ? 'name' and length(trim(coalesce(p_patch ->> 'name', ''))) = 0 then
    raise exception 'Team identity name is required.';
  end if;
  if p_patch ? 'logo_color' and length(trim(coalesce(p_patch ->> 'logo_color', ''))) = 0 then
    raise exception 'Team color is required.';
  end if;
  if p_patch ? 'status' and p_patch ->> 'status' not in ('active', 'inactive') then
    raise exception 'Unknown team identity status %', p_patch ->> 'status';
  end if;

  update public.team_identities
     set name = case when p_patch ? 'name' then trim(p_patch ->> 'name') else name end,
         logo_color = case when p_patch ? 'logo_color' then trim(p_patch ->> 'logo_color') else logo_color end,
         founded = case when p_patch ? 'founded' then nullif(trim(coalesce(p_patch ->> 'founded', '')), '') else founded end,
         status = case when p_patch ? 'status' then p_patch ->> 'status' else status end
   where id = p_identity_id;

  if not found then
    raise exception 'Unknown team identity %', p_identity_id;
  end if;
end;
$$;

create or replace function public.update_team_enrollment(
  p_team_id uuid,
  p_patch jsonb
)
returns void
language plpgsql volatile security definer
set search_path = public
as $$
begin
  perform public.assert_admin();

  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'Unsupported team enrollment field.';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_patch) key
    where key not in ('captain_id', 'division', 'status')
  ) then
    raise exception 'Unsupported team enrollment field.';
  end if;
  if p_patch ? 'status' and p_patch ->> 'status' not in ('active', 'inactive') then
    raise exception 'Unknown team enrollment status %', p_patch ->> 'status';
  end if;

  update public.teams
     set captain_id = case
           when p_patch ? 'captain_id' then nullif(p_patch ->> 'captain_id', '')::uuid
           else captain_id
         end,
         division = case
           when p_patch ? 'division' then nullif(trim(coalesce(p_patch ->> 'division', '')), '')
           else division
         end,
         status = case when p_patch ? 'status' then p_patch ->> 'status' else status end
   where id = p_team_id;

  if not found then
    raise exception 'Unknown team enrollment %', p_team_id;
  end if;
end;
$$;

revoke execute on function public.update_team_identity(uuid, jsonb)
  from public, anon;
revoke execute on function public.update_team_enrollment(uuid, jsonb)
  from public, anon;
grant execute on function public.update_team_identity(uuid, jsonb)
  to authenticated;
grant execute on function public.update_team_enrollment(uuid, jsonb)
  to authenticated;

comment on function public.update_team_identity(uuid, jsonb) is
  'Admin-only canonical brand/lifecycle edit. Direct authenticated table writes are disabled.';
comment on function public.update_team_enrollment(uuid, jsonb) is
  'Admin-only captain/division/lifecycle edit. Identity, league, and sport cannot be reassigned.';
comment on function public.enforce_charge_team_season() is
  'Constraint trigger only; SECURITY DEFINER preserves FOR SHARE locking after direct team UPDATE is revoked.';
