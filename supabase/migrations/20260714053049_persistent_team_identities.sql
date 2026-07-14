-- A team identity is the durable club/brand. public.teams remains the
-- season/sport/container enrollment used by schedules, rosters, charges, and
-- stats. Enrolling an identity creates only a new team shell: it deliberately
-- carries no roster, payment, game, or stat rows.

create table public.team_identities (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  logo_color  text not null,
  founded     text,
  status      text not null default 'active' check (status in ('active', 'inactive')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger team_identities_updated_at
  before update on public.team_identities
  for each row execute procedure extensions.moddatetime (updated_at);

alter table public.team_identities enable row level security;
create policy team_identities_public_read on public.team_identities
  for select to anon, authenticated using (true);
create policy team_identities_admin_insert on public.team_identities
  for insert to authenticated with check (public.is_admin());
create policy team_identities_admin_update on public.team_identities
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy team_identities_admin_delete on public.team_identities
  for delete to authenticated using (public.is_admin());

grant select on table public.team_identities to anon;
grant select, insert, update, delete on table public.team_identities to authenticated;

alter table public.teams add column identity_id uuid;

-- Existing rows cannot be safely merged by name alone, so each becomes one
-- identity. Administrators can deliberately reuse those identities for every
-- later season, sport, or standalone tournament enrollment.
insert into public.team_identities (id, name, logo_color, founded, status, created_at, updated_at)
select id, name, logo_color, founded,
       case when status = 'inactive' then 'inactive' else 'active' end,
       created_at, updated_at
from public.teams;

update public.teams set identity_id = id;

alter table public.teams
  alter column identity_id set not null,
  add constraint teams_identity_id_fkey
    foreign key (identity_id) references public.team_identities (id) on delete restrict,
  add constraint teams_identity_league_key unique (identity_id, league_id);

-- Legacy name/color/founded columns stay as read-compatible snapshots, but
-- the identity is authoritative and every write is synchronized.
create or replace function public.sync_team_identity_fields()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_identity public.team_identities%rowtype;
begin
  if new.identity_id is null then
    insert into public.team_identities (name, logo_color, founded)
    values (new.name, new.logo_color, new.founded)
    returning * into v_identity;
    new.identity_id := v_identity.id;
  end if;
  select * into v_identity from public.team_identities where id = new.identity_id;
  if not found then raise exception 'Unknown team identity %', new.identity_id; end if;
  new.name := v_identity.name;
  new.logo_color := v_identity.logo_color;
  new.founded := v_identity.founded;
  return new;
end;
$$;

create trigger teams_sync_identity_fields
  before insert or update of identity_id, name, logo_color, founded on public.teams
  for each row execute procedure public.sync_team_identity_fields();

create or replace function public.propagate_team_identity_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.teams
     set name = new.name, logo_color = new.logo_color, founded = new.founded
   where identity_id = new.id;
  return new;
end;
$$;

create trigger team_identities_propagate_fields
  after update of name, logo_color, founded on public.team_identities
  for each row execute procedure public.propagate_team_identity_fields();

revoke execute on function public.sync_team_identity_fields() from public, anon, authenticated;
revoke execute on function public.propagate_team_identity_fields() from public, anon, authenticated;

create or replace function public.enroll_team_identity(
  p_identity_id uuid,
  p_league_id uuid,
  p_captain_id uuid default null,
  p_division text default null
)
returns uuid
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_identity public.team_identities%rowtype;
  v_league public.leagues%rowtype;
  v_team_id uuid;
begin
  perform public.assert_admin();
  select * into v_identity from public.team_identities where id = p_identity_id for update;
  if not found then raise exception 'Unknown team identity %', p_identity_id; end if;
  if v_identity.status <> 'active' then raise exception 'Inactive team identities cannot be enrolled.'; end if;
  select * into v_league from public.leagues where id = p_league_id;
  if not found then raise exception 'Unknown league or tournament %', p_league_id; end if;
  if exists (select 1 from public.teams where identity_id = p_identity_id and league_id = p_league_id) then
    raise exception 'This team identity is already enrolled in the selected league or tournament.';
  end if;

  insert into public.teams
    (identity_id, league_id, name, sport, captain_id, logo_color, founded, division, status)
  values
    (v_identity.id, v_league.id, v_identity.name, v_league.sport, p_captain_id,
     v_identity.logo_color, v_identity.founded, nullif(trim(coalesce(p_division, '')), ''), 'active')
  returning id into v_team_id;
  return v_team_id;
end;
$$;

create or replace function public.create_team_identity_and_enroll(
  p_name text,
  p_logo_color text,
  p_founded text,
  p_league_id uuid,
  p_captain_id uuid default null,
  p_division text default null
)
returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_identity_id uuid;
  v_team_id uuid;
begin
  perform public.assert_admin();
  if length(trim(coalesce(p_name, ''))) = 0 then raise exception 'Team identity name is required.'; end if;
  if length(trim(coalesce(p_logo_color, ''))) = 0 then raise exception 'Team color is required.'; end if;
  insert into public.team_identities (name, logo_color, founded)
  values (trim(p_name), trim(p_logo_color), nullif(trim(coalesce(p_founded, '')), ''))
  returning id into v_identity_id;
  v_team_id := public.enroll_team_identity(v_identity_id, p_league_id, p_captain_id, p_division);
  return jsonb_build_object('identity_id', v_identity_id, 'team_id', v_team_id);
end;
$$;

revoke execute on function public.enroll_team_identity(uuid, uuid, uuid, text) from public, anon;
revoke execute on function public.create_team_identity_and_enroll(text, text, text, uuid, uuid, text) from public, anon;
grant execute on function public.enroll_team_identity(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.create_team_identity_and_enroll(text, text, text, uuid, uuid, text) to authenticated;

-- Registration approval now creates the durable identity and its first
-- enrollment atomically. The established captain/waiver/roster chain stays
-- unchanged and nothing is copied into later enrollments.
create or replace function public.approve_registration(
  p_registration_id uuid,
  p_league_id uuid,
  p_create_captain_profile boolean default true
)
returns jsonb
language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_reg public.team_registrations%rowtype;
  v_league public.leagues%rowtype;
  v_identity_id uuid;
  v_team_id uuid;
  v_captain_id uuid;
  v_first text;
  v_last text;
  v_color text;
  v_eligible boolean := false;
begin
  perform public.assert_admin();
  select * into v_reg from public.team_registrations where id = p_registration_id for update;
  if not found then raise exception 'Unknown registration %', p_registration_id; end if;
  if v_reg.status not in ('new', 'contacted') then
    raise exception 'Registration is already % — only new/contacted submissions can be approved.', v_reg.status;
  end if;
  select * into v_league from public.leagues where id = p_league_id;
  if not found then raise exception 'Unknown league %', p_league_id; end if;
  if v_league.kind <> 'league' then raise exception 'Team registrations must be approved into a league, not a standalone tournament.'; end if;
  if v_league.sport <> v_reg.sport then
    raise exception 'League sport (%) does not match registration sport (%).', v_league.sport, v_reg.sport;
  end if;
  if v_reg.preferred_season is not null and v_league.season <> v_reg.preferred_season then
    raise exception 'League season (%) does not match registration season (%).', v_league.season, v_reg.preferred_season;
  end if;

  v_color := public.cvf_palette_color((select count(*)::int from public.team_identities));
  insert into public.team_identities (name, logo_color)
  values (v_reg.team_name, v_color)
  returning id into v_identity_id;
  v_team_id := public.enroll_team_identity(v_identity_id, v_league.id);

  if p_create_captain_profile then
    if position(' ' in trim(v_reg.captain_name)) > 0 then
      v_first := trim(regexp_replace(trim(v_reg.captain_name), '\s+\S+$', ''));
      v_last := regexp_replace(trim(v_reg.captain_name), '^.*\s', '');
    else
      v_first := trim(v_reg.captain_name);
      v_last := '';
    end if;
    insert into public.profiles
      (first_name, last_name, email, phone, sports, avatar_color)
    values
      (v_first, v_last,
       nullif(trim(coalesce(v_reg.captain_email, '')), ''),
       nullif(trim(coalesce(v_reg.captain_phone, '')), ''),
       array[v_reg.sport],
       public.cvf_palette_color((select count(*)::int from public.profiles)))
    returning id into v_captain_id;
    update public.teams set captain_id = v_captain_id where id = v_team_id;
    if v_reg.captain_email is not null then
      update public.waivers set profile_id = v_captain_id
       where profile_id is null and lower(email) = lower(v_reg.captain_email);
    end if;
    v_eligible := exists (
      select 1 from public.waivers w
      where w.profile_id = v_captain_id
        and w.verification_status = 'verified'
        and w.waiver_version = public.current_waiver_version()
    );
    insert into public.team_players (team_id, profile_id, season, roster_status)
    values (v_team_id, v_captain_id, v_league.season,
            case when v_eligible then 'eligible' else 'pending_waiver' end);
  end if;

  update public.team_registrations
     set status = 'approved', approved_team_id = v_team_id,
         processed_at = now(), processed_by = auth.uid()
   where id = p_registration_id;
  return jsonb_build_object(
    'identity_id', v_identity_id,
    'team_id', v_team_id,
    'captain_profile_id', v_captain_id
  );
end;
$$;

comment on table public.team_identities is
  'Persistent team brands. public.teams rows are explicit season/sport/container enrollments.';
comment on function public.enroll_team_identity(uuid, uuid, uuid, text) is
  'Creates one enrollment shell only; never copies roster, payment, game, or stat rows.';
