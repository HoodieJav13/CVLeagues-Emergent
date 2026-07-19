-- CVF local pgtest assertions.
-- Run after supabase_shim.sql and all migrations have been applied.

\set ON_ERROR_STOP on

create schema cvf_test;

create table cvf_test.results (
  n bigserial primary key,
  name text not null,
  ok boolean not null,
  detail text
);

create or replace function cvf_test.record_result(p_name text, p_ok boolean, p_detail text default null)
returns void
language plpgsql
as $$
begin
  insert into cvf_test.results (name, ok, detail)
  values (p_name, p_ok, p_detail);
end;
$$;

create or replace function cvf_test.ok(p_name text, p_condition boolean, p_detail text default null)
returns void
language plpgsql
as $$
begin
  perform cvf_test.record_result(p_name, coalesce(p_condition, false), p_detail);
end;
$$;

create or replace function cvf_test.eq_text(p_name text, p_actual text, p_expected text)
returns void
language plpgsql
as $$
begin
  perform cvf_test.record_result(
    p_name,
    p_actual is not distinct from p_expected,
    format('expected=%s actual=%s', p_expected, p_actual)
  );
end;
$$;

create or replace function cvf_test.eq_int(p_name text, p_actual int, p_expected int)
returns void
language plpgsql
as $$
begin
  perform cvf_test.record_result(
    p_name,
    p_actual is not distinct from p_expected,
    format('expected=%s actual=%s', p_expected, p_actual)
  );
end;
$$;

create or replace function cvf_test.throws_ok(p_name text, p_sql text, p_expected_like text default null)
returns void
language plpgsql
as $$
declare
  v_message text;
begin
  begin
    execute p_sql;
    perform cvf_test.record_result(p_name, false, 'expected exception, statement succeeded');
  exception when others then
    v_message := sqlerrm;
    perform cvf_test.record_result(
      p_name,
      p_expected_like is null or v_message like p_expected_like,
      v_message
    );
  end;
end;
$$;

create or replace function cvf_test.lives_ok(p_name text, p_sql text)
returns void
language plpgsql
as $$
begin
  begin
    execute p_sql;
    perform cvf_test.record_result(p_name, true, null);
  exception when others then
    perform cvf_test.record_result(p_name, false, sqlerrm);
  end;
end;
$$;

create or replace function cvf_test.row_count_is_zero(p_name text, p_sql text)
returns void
language plpgsql
as $$
declare
  v_count int;
begin
  begin
    execute p_sql;
    get diagnostics v_count = row_count;
    perform cvf_test.record_result(p_name, v_count = 0, format('affected rows=%s', v_count));
  exception when others then
    perform cvf_test.record_result(p_name, false, sqlerrm);
  end;
end;
$$;

create or replace function cvf_test.as_anon()
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claims', '{}'::text, false);
  set role anon;
end;
$$;

create or replace function cvf_test.as_user(p_user uuid)
returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', p_user::text, false);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'aal', 'aal1')::text,
    false
  );
  set role authenticated;
end;
$$;

create or replace function cvf_test.as_admin(p_user uuid)
returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', p_user::text, false);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'aal', 'aal2')::text,
    false
  );
  set role authenticated;
end;
$$;

create or replace function cvf_test.as_admin_aal1(p_user uuid)
returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', p_user::text, false);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'aal', 'aal1')::text,
    false
  );
  set role authenticated;
end;
$$;

create or replace function cvf_test.as_owner()
returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claims', '{}'::text, false);
  perform set_config('cvf.bypass_lock', '', false);
end;
$$;

grant usage on schema cvf_test to anon, authenticated;
grant insert, select on table cvf_test.results to anon, authenticated;
grant usage, select on sequence cvf_test.results_n_seq to anon, authenticated;
grant execute on all functions in schema cvf_test to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Seed a minimal league world as owner. Tests switch roles afterward.
-- ---------------------------------------------------------------------------
select cvf_test.as_owner();

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'admin@cvf.test'),
  ('00000000-0000-0000-0000-000000000002', 'user@cvf.test'),
  ('00000000-0000-0000-0000-000000000003', 'scorekeeper@cvf.test');

insert into public.admin_users (auth_user_id, label)
values ('00000000-0000-0000-0000-000000000001', 'Admin');

insert into public.waiver_versions (version, body_text, effective_at)
values ('CVF-WAIVER-TEST-v1', 'Test waiver text', now());

insert into public.profiles (id, auth_user_id, first_name, last_name, email, phone, sports, avatar_color)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Player', 'One', 'player1@cvf.test', '505-000-0001', array['kickball'], '#5BB8CC'),
  ('10000000-0000-0000-0000-000000000002', null, 'Player', 'Two', 'player2@cvf.test', '505-000-0002', array['kickball'], '#F97316'),
  ('10000000-0000-0000-0000-000000000003', null, 'Player', 'Three', 'player3@cvf.test', '505-000-0003', array['kickball'], '#A855F7'),
  ('10000000-0000-0000-0000-000000000004', null, 'Player', 'Four', 'player4@cvf.test', '505-000-0004', array['flag_football'], '#10B981');

insert into public.leagues (id, name, sport, season, description)
values
  ('20000000-0000-0000-0000-000000000001', 'Kickball League', 'kickball', 'Summer 2026', 'Test league'),
  ('20000000-0000-0000-0000-000000000002', 'Flag League', 'flag_football', 'Summer 2026', 'Test league'),
  ('20000000-0000-0000-0000-000000000003', 'Kickball Tournament', 'kickball', 'Summer 2026', 'Test tournament');

update public.leagues
   set kind = 'tournament'
 where id = '20000000-0000-0000-0000-000000000003';

insert into public.teams (id, league_id, name, sport, captain_id, logo_color)
values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Kick A', 'kickball', '10000000-0000-0000-0000-000000000001', '#5BB8CC'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Kick B', 'kickball', '10000000-0000-0000-0000-000000000002', '#F97316'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'Tournament A', 'kickball', '10000000-0000-0000-0000-000000000001', '#A855F7'),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000003', 'Tournament B', 'kickball', '10000000-0000-0000-0000-000000000002', '#10B981'),
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002', 'Flag A', 'flag_football', '10000000-0000-0000-0000-000000000004', '#3B82F6');

insert into public.team_players (id, team_id, profile_id, season, jersey_number, "position", roster_status)
values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Summer 2026', 1, 'P', 'pending_waiver'),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Summer 2026', 2, 'C', 'pending_waiver');

insert into public.games (id, league_id, sport, home_team_id, away_team_id, date, time, location, status, score_status, home_score, away_score, periods)
values
  ('50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'kickball', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '2026-06-01', '6:00 PM', 'Field 1', 'completed', 'approved', 7, 4, '{"home":[2,1,1,2,1],"away":[1,1,1,1,0]}'::jsonb),
  ('50000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'kickball', '30000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '2026-06-08', '6:00 PM', 'Field 1', 'upcoming', 'pending', null, null, '{"home":[],"away":[]}'::jsonb),
  ('50000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'kickball', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '2026-06-15', '6:00 PM', 'Field 1', 'completed', 'final', 8, 5, '{"home":[2,2,2,1,1],"away":[1,1,1,1,1]}'::jsonb);

update public.games
   set locked = true
 where id = '50000000-0000-0000-0000-000000000003';

insert into public.player_stats (id, game_id, profile_id, team_id, sport, stats)
values
  ('60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'kickball', '{"runs":2}'::jsonb);

insert into public.waivers (id, profile_id, signed_name, email, phone, waiver_version, accepted_terms, age_confirmed, media_consent, verification_status)
values
  ('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Player One', 'player1@cvf.test', '505-000-0001', 'CVF-WAIVER-TEST-v1', true, true, false, 'pending'),
  ('70000000-0000-0000-0000-000000000002', null, 'Unlinked Waiver', 'unlinked@cvf.test', '505-000-0099', 'CVF-WAIVER-TEST-v1', true, true, false, 'pending');

insert into public.team_registrations (id, captain_name, captain_phone, captain_email, sport, team_name, estimated_roster_size, preferred_season, consent_to_contact, notes)
values ('80000000-0000-0000-0000-000000000001', 'Captain Example', '505-111-1111', 'captain@cvf.test', 'kickball', 'New Team', 10, 'Summer 2026', true, 'Ready');

insert into public.free_agents (id, first_name, last_name, email, phone, sports, consent_to_contact)
values ('90000000-0000-0000-0000-000000000001', 'Free', 'Agent', 'free@cvf.test', '505-222-2222', array['kickball'], true);

-- ---------------------------------------------------------------------------
-- Existing Phase 9 invariants (35 assertions).
-- ---------------------------------------------------------------------------
select cvf_test.as_anon();
select cvf_test.eq_int('existing 01 anon reads games', (select count(*)::int from public.games), 3);
select cvf_test.eq_int('existing 02 anon reads teams', (select count(*)::int from public.teams), 5);
select cvf_test.eq_int('existing 03 anon reads public_profiles', (select count(*)::int from public.public_profiles), 4);
select cvf_test.throws_ok(
  'existing 04 anon profiles read is privilege-blocked',
  $$select count(*) from public.profiles$$,
  '%permission denied%'
);
select cvf_test.throws_ok(
  'existing 05 anon waivers read is privilege-blocked',
  $$select count(*) from public.waivers$$,
  '%permission denied%'
);
select cvf_test.throws_ok(
  'existing 06 anon team registrations read is privilege-blocked',
  $$select count(*) from public.team_registrations$$,
  '%permission denied%'
);
select cvf_test.throws_ok(
  'existing 07 anon free agents read is privilege-blocked',
  $$select count(*) from public.free_agents$$,
  '%permission denied%'
);

select cvf_test.throws_ok(
  'existing 08 anon direct clean team registration is blocked',
  $$insert into public.team_registrations
    (captain_name, captain_phone, sport, team_name, preferred_season, consent_to_contact)
    values ('Anon Captain', '505-333-3333', 'kickball', 'Anon Team', 'Summer 2026', true)$$,
  '%permission denied%'
);
select cvf_test.throws_ok(
  'existing 09 anon pre-triaged registration is blocked',
  $$insert into public.team_registrations
    (captain_name, captain_phone, sport, team_name, preferred_season, consent_to_contact, status)
    values ('Anon Captain', '505-333-3334', 'kickball', 'Bad Team', 'Summer 2026', true, 'contacted')$$,
  '%permission denied%'
);
select cvf_test.throws_ok(
  'existing 10 anon no-consent registration is blocked',
  $$insert into public.team_registrations
    (captain_name, captain_phone, sport, team_name, preferred_season, consent_to_contact)
    values ('Anon Captain', '505-333-3335', 'kickball', 'No Consent Team', 'Summer 2026', false)$$,
  '%permission denied%'
);
select cvf_test.throws_ok(
  'existing 11 anon direct clean free agent is blocked',
  $$insert into public.free_agents
    (first_name, last_name, email, sports, consent_to_contact)
    values ('Anon', 'Agent', 'anon-agent@cvf.test', array['kickball'], true)$$,
  '%permission denied%'
);
select cvf_test.throws_ok(
  'existing 12 anon pre-triaged free agent is blocked',
  $$insert into public.free_agents
    (first_name, last_name, email, sports, consent_to_contact, status)
    values ('Anon', 'Agent', 'bad-agent@cvf.test', array['kickball'], true, 'contacted')$$,
  '%permission denied%'
);
select cvf_test.throws_ok(
  'existing 13 anon no-consent free agent is blocked',
  $$insert into public.free_agents
    (first_name, last_name, email, sports, consent_to_contact)
    values ('Anon', 'Agent', 'noconsent-agent@cvf.test', array['kickball'], false)$$,
  '%permission denied%'
);

select cvf_test.as_admin('00000000-0000-0000-0000-000000000001');
select cvf_test.throws_ok(
  'existing 14 locked game score update raises',
  $$update public.games
       set home_score = 9
     where id = '50000000-0000-0000-0000-000000000003'$$,
  '%final and locked%'
);
select cvf_test.throws_ok(
  'existing 15 unlock_game requires reason',
  $$select public.unlock_game('50000000-0000-0000-0000-000000000003', '')$$,
  '%requires a reason%'
);
select cvf_test.lives_ok(
  'existing 16 unlock_game with reason succeeds',
  $$select public.unlock_game('50000000-0000-0000-0000-000000000003', 'correcting score')$$
);
select cvf_test.eq_text(
  'existing 17 unlocked game score_status approved',
  (select score_status from public.games where id = '50000000-0000-0000-0000-000000000003'),
  'approved'
);
select cvf_test.eq_int(
  'existing 18 unlock writes history row',
  (select count(*)::int from public.game_edit_history
    where game_id = '50000000-0000-0000-0000-000000000003' and action = 'Unlocked' and reason = 'correcting score'),
  1
);

select cvf_test.throws_ok(
  'existing 19 waiver signature fields immutable',
  $$update public.waivers
       set signed_name = 'Changed'
     where id = '70000000-0000-0000-0000-000000000001'$$,
  null
);
select cvf_test.lives_ok(
  'existing 20 waiver verification update succeeds',
  $$update public.waivers
       set verification_status = 'verified',
           verified_by = '00000000-0000-0000-0000-000000000001',
           verified_at = now()
     where id = '70000000-0000-0000-0000-000000000001'$$
);
select cvf_test.lives_ok(
  'existing 21 waiver profile_id can be set once from null',
  $$update public.waivers
       set profile_id = '10000000-0000-0000-0000-000000000003'
     where id = '70000000-0000-0000-0000-000000000002'$$
);
select cvf_test.throws_ok(
  'existing 22 waiver profile_id relink raises',
  $$update public.waivers
       set profile_id = '10000000-0000-0000-0000-000000000002'
     where id = '70000000-0000-0000-0000-000000000002'$$,
  '%can only be set once%'
);

select cvf_test.lives_ok(
  'existing 23 approve_registration succeeds',
  $$select public.approve_registration(
       '80000000-0000-0000-0000-000000000001',
       '20000000-0000-0000-0000-000000000001',
       true
     )$$
);
select cvf_test.eq_text(
  'existing 24 approve_registration marks approved',
  (select status from public.team_registrations where id = '80000000-0000-0000-0000-000000000001'),
  'approved'
);
select cvf_test.ok(
  'existing 25 approve_registration creates team',
  exists (select 1 from public.teams where name = 'New Team')
);
select cvf_test.ok(
  'existing 26 approve_registration creates captain profile',
  exists (select 1 from public.profiles where email = 'captain@cvf.test')
);
select cvf_test.ok(
  'existing 27 approve_registration creates captain roster row',
  exists (
    select 1
      from public.team_players tp
      join public.teams t on t.id = tp.team_id
      join public.profiles p on p.id = tp.profile_id
     where t.name = 'New Team'
       and p.email = 'captain@cvf.test'
       and tp.season = 'Summer 2026'
  )
);

select cvf_test.lives_ok(
  'existing 28 assign_free_agent succeeds',
  $$select public.assign_free_agent(
       '90000000-0000-0000-0000-000000000001',
       '30000000-0000-0000-0000-000000000001',
       12,
       'OF'
     )$$
);
select cvf_test.eq_text(
  'existing 29 assign_free_agent marks assigned',
  (select status from public.free_agents where id = '90000000-0000-0000-0000-000000000001'),
  'assigned'
);
select cvf_test.ok(
  'existing 30 assign_free_agent creates profile',
  exists (select 1 from public.profiles where email = 'free@cvf.test')
);
select cvf_test.ok(
  'existing 31 assign_free_agent creates roster row',
  exists (
    select 1
      from public.team_players tp
      join public.profiles p on p.id = tp.profile_id
     where p.email = 'free@cvf.test'
       and tp.team_id = '30000000-0000-0000-0000-000000000001'
       and tp.jersey_number = 12
       and tp."position" = 'OF'
  )
);

select cvf_test.lives_ok(
  'existing 32 verify_waiver succeeds',
  $$select public.verify_waiver('70000000-0000-0000-0000-000000000001', 'verified')$$
);
select cvf_test.eq_text(
  'existing 33 verify_waiver catches roster up',
  (select roster_status
     from public.team_players
    where team_id = '30000000-0000-0000-0000-000000000001'
      and profile_id = '10000000-0000-0000-0000-000000000001'),
  'eligible'
);
select cvf_test.throws_ok(
  'existing 34 game_edit_history update is blocked',
  $$update public.game_edit_history set action = 'Changed'$$,
  '%permission denied%'
);
select cvf_test.throws_ok(
  'existing 35 waiver delete is blocked',
  $$delete from public.waivers where id = '70000000-0000-0000-0000-000000000001'$$,
  '%permission denied%'
);

-- ---------------------------------------------------------------------------
-- Season 2 migration 20260707000900 invariants (17 assertions).
-- ---------------------------------------------------------------------------
select cvf_test.as_admin('00000000-0000-0000-0000-000000000001');
select public.lock_game('50000000-0000-0000-0000-000000000003');

select cvf_test.throws_ok(
  'season2 01 league container rejects tournament stage',
  $$insert into public.games
      (league_id, sport, home_team_id, away_team_id, date, time, location, stage)
    values
      ('20000000-0000-0000-0000-000000000001', 'kickball',
       '30000000-0000-0000-0000-000000000001',
       '30000000-0000-0000-0000-000000000002',
       '2026-07-01', '7:00 PM', 'Field 1', 'tournament')$$,
  '%reserved for standalone tournament%'
);
select cvf_test.lives_ok(
  'season2 02 tournament container accepts tournament stage',
  $$insert into public.games
      (id, league_id, sport, home_team_id, away_team_id, date, time, location, stage)
    values
      ('50000000-0000-0000-0000-000000000101',
       '20000000-0000-0000-0000-000000000003', 'kickball',
       '30000000-0000-0000-0000-000000000003',
       '30000000-0000-0000-0000-000000000004',
       '2026-07-02', '7:00 PM', 'Field 2', 'tournament')$$
);
select cvf_test.throws_ok(
  'season2 03 tournament container rejects regular stage',
  $$insert into public.games
      (league_id, sport, home_team_id, away_team_id, date, time, location, stage)
    values
      ('20000000-0000-0000-0000-000000000003', 'kickball',
       '30000000-0000-0000-0000-000000000003',
       '30000000-0000-0000-0000-000000000004',
       '2026-07-03', '7:00 PM', 'Field 2', 'regular')$$,
  '%must have stage=tournament%'
);

select cvf_test.throws_ok(
  'season2 04 locked game stage change raises',
  $$update public.games
       set stage = 'playoff'
     where id = '50000000-0000-0000-0000-000000000003'$$,
  '%final and locked%'
);
select set_config('cvf.bypass_lock', 'on', false);
select cvf_test.lives_ok(
  'season2 05 locked game stage change succeeds with bypass',
  $$update public.games
       set stage = 'playoff'
     where id = '50000000-0000-0000-0000-000000000003'$$
);
select set_config('cvf.bypass_lock', '', false);
select cvf_test.eq_text(
  'season2 06 bypass actually changed locked stage',
  (select stage from public.games where id = '50000000-0000-0000-0000-000000000003'),
  'playoff'
);
select cvf_test.lives_ok(
  'season2 07 unlocked game stage freely editable',
  $$update public.games
       set stage = 'playoff'
     where id = '50000000-0000-0000-0000-000000000002'$$
);

select cvf_test.throws_ok(
  'season2 08 charge with both profile and team raises',
  $$insert into public.charges
      (season, profile_id, team_id, amount_due_cents)
    values
      ('Summer 2026',
       '10000000-0000-0000-0000-000000000001',
       '30000000-0000-0000-0000-000000000001',
       5000)$$,
  null
);
select cvf_test.throws_ok(
  'season2 09 charge with neither profile nor team raises',
  $$insert into public.charges
      (season, amount_due_cents)
    values
      ('Summer 2026', 5000)$$,
  null
);
select cvf_test.lives_ok(
  'season2 10 player-only charge succeeds',
  $$insert into public.charges
      (id, season, profile_id, amount_due_cents)
    values
      ('a0000000-0000-0000-0000-000000000001',
       'Summer 2026',
       '10000000-0000-0000-0000-000000000001',
       5000)$$
);
select cvf_test.lives_ok(
  'season2 11 team-only charge succeeds',
  $$insert into public.charges
      (id, season, team_id, amount_due_cents)
    values
      ('a0000000-0000-0000-0000-000000000002',
       'Summer 2026',
       '30000000-0000-0000-0000-000000000001',
       10000)$$
);
select cvf_test.lives_ok(
  'season2 12 payment entry against charge succeeds',
  $$insert into public.payment_entries
      (id, charge_id, amount_cents, method)
    values
      ('b0000000-0000-0000-0000-000000000001',
       'a0000000-0000-0000-0000-000000000002',
       2500,
       'cash')$$
);
select cvf_test.throws_ok(
  'season2 13 charge delete with payment entry is restrict-blocked',
  $$delete from public.charges
     where id = 'a0000000-0000-0000-0000-000000000002'$$,
  '%payment_entries_charge_id_fkey%'
);

insert into public.hof_entries (id, entry_type, game_id, sport, season, title, blurb)
values (
  'c0000000-0000-0000-0000-000000000001',
  'game',
  '50000000-0000-0000-0000-000000000001',
  'kickball',
  'Summer 2026',
  'Opening Night Classic',
  'A test Hall of Fame row.'
);

select cvf_test.as_anon();
select cvf_test.eq_int(
  'season2 14 hof unpublished anonymous view read returns zero',
  (select count(*)::int from public.public_hof_entries),
  0
);
select cvf_test.as_user('00000000-0000-0000-0000-000000000002');
select cvf_test.eq_int(
  'season2 15 hof unpublished public-role view read returns zero',
  (select count(*)::int from public.public_hof_entries),
  0
);
select cvf_test.as_admin('00000000-0000-0000-0000-000000000001');
select cvf_test.eq_int(
  'season2 16 hof admin read returns rows while unpublished',
  (select count(*)::int from public.hof_entries),
  1
);
update public.league_settings set hof_published = true where id = 1;
select cvf_test.as_anon();
select cvf_test.eq_int(
  'season2 17 hof published public view read returns rows',
  (select count(*)::int from public.public_hof_entries),
  1
);

-- ---------------------------------------------------------------------------
-- Charge-season hardening migration invariants (11 assertions).
-- ---------------------------------------------------------------------------
select cvf_test.as_admin('00000000-0000-0000-0000-000000000001');

insert into public.seasons (name, status)
values
  ('Fall 2026', 'upcoming'),
  ('Spring 2027', 'upcoming');

insert into public.leagues (id, name, sport, season, description)
values (
  '20000000-0000-0000-0000-000000000101',
  'Fall Kickball League',
  'kickball',
  'Fall 2026',
  'Cross-season guard fixture'
);

-- Owner-only fixture setup; authenticated clients must use enrollment RPCs.
select cvf_test.as_owner();
insert into public.teams (id, league_id, name, sport, logo_color)
values (
  '30000000-0000-0000-0000-000000000101',
  '20000000-0000-0000-0000-000000000101',
  'Fall Kickball Team',
  'kickball',
  '#14B8A6'
);
select cvf_test.as_admin('00000000-0000-0000-0000-000000000001');

-- ---------------------------------------------------------------------------
-- Historical stat classification guards (3 assertions).
-- ---------------------------------------------------------------------------
select cvf_test.throws_ok(
  'historical isolation 01 a game with stats cannot move to another league',
  $$update public.games
       set league_id = '20000000-0000-0000-0000-000000000101'
     where id = '50000000-0000-0000-0000-000000000001'$$,
  '%Recorded statistics lock game%'
);
select cvf_test.throws_ok(
  'historical isolation 02 a league with stats cannot change season',
  $$update public.leagues
       set season = 'Fall 2026'
     where id = '20000000-0000-0000-0000-000000000001'$$,
  '%Recorded statistics lock league%season%'
);
select cvf_test.throws_ok(
  'historical isolation 03 a league with stats cannot change kind',
  $$update public.leagues
       set kind = 'tournament'
     where id = '20000000-0000-0000-0000-000000000001'$$,
  '%Recorded statistics lock league%kind%'
);

select cvf_test.lives_ok(
  'charge season 01 matching-season team charges succeed',
  $$insert into public.charges
      (id, season, team_id, amount_due_cents)
    values
      ('a0000000-0000-0000-0000-000000000101',
       'Summer 2026',
       '30000000-0000-0000-0000-000000000001',
       10000),
      ('a0000000-0000-0000-0000-000000000103',
       'Fall 2026',
       '30000000-0000-0000-0000-000000000101',
       10000)$$
);
select cvf_test.throws_ok(
  'charge season 02 cross-season team charge fails',
  $$insert into public.charges
      (season, team_id, amount_due_cents)
    values
      ('Fall 2026',
       '30000000-0000-0000-0000-000000000001',
       10000)$$,
  '%must match%'
);
select cvf_test.throws_ok(
  'charge season 03 changing a team charge to another season fails',
  $$update public.charges
       set season = 'Fall 2026'
     where id = 'a0000000-0000-0000-0000-000000000101'$$,
  '%must match%'
);
-- Owner-only invariant probe; client enrollment identity/container fields are immutable.
select cvf_test.as_owner();
select cvf_test.throws_ok(
  'charge season 04 charged team cannot move to another-season league',
  $$update public.teams
       set league_id = '20000000-0000-0000-0000-000000000101'
     where id = '30000000-0000-0000-0000-000000000001'$$,
  '%cannot move%'
);
select cvf_test.throws_ok(
  'charge season 05 charged league cannot be reassigned to another season',
  $$update public.leagues
       set season = 'Spring 2027'
     where id = '20000000-0000-0000-0000-000000000101'$$,
  '%cannot change%'
);
select cvf_test.lives_ok(
  'charge season 06 profile-only charge remains valid in any existing season',
  $$insert into public.charges
      (id, season, profile_id, amount_due_cents)
    values
      ('a0000000-0000-0000-0000-000000000102',
       'Fall 2026',
       '10000000-0000-0000-0000-000000000001',
       5000)$$
);
select cvf_test.ok(
  'charge season 07 upstream guard indexes exist',
  to_regclass('public.charges_team_id_idx') is not null
  and to_regclass('public.teams_league_id_idx') is not null
);
select cvf_test.lives_ok(
  'charge season 08 season rename cascades without false rejection',
  $$update public.seasons
       set name = 'Summer 2026 Renamed'
     where name = 'Summer 2026'$$
);
select cvf_test.ok(
  'charge season 09 renamed season preserves every team-charge match',
  exists (select 1 from public.seasons where name = 'Summer 2026 Renamed')
  and not exists (
    select 1
      from public.charges c
      join public.teams t on t.id = c.team_id
      join public.leagues l on l.id = t.league_id
     where c.team_id is not null
       and c.season is distinct from l.season
  )
);
select cvf_test.lives_ok(
  'charge season 10 season rename can be reversed cleanly',
  $$update public.seasons
       set name = 'Summer 2026'
     where name = 'Summer 2026 Renamed'$$
);
select cvf_test.ok(
  'charge season 11 restored season preserves every team-charge match',
  exists (select 1 from public.seasons where name = 'Summer 2026')
  and not exists (
    select 1
      from public.charges c
      join public.teams t on t.id = c.team_id
      join public.leagues l on l.id = t.league_id
     where c.team_id is not null
       and c.season is distinct from l.season
  )
);

-- ---------------------------------------------------------------------------
-- Public-profile and explicit Data API boundary invariants (33 assertions).
-- ---------------------------------------------------------------------------
select cvf_test.as_owner();

select cvf_test.eq_text(
  'data api 01 public_profiles exposes the exact safe-field allowlist',
  (
    select string_agg(column_name, ',' order by ordinal_position)
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'public_profiles'
  ),
  'id,first_name,last_name,display_name,name,sports,experience,bio,avatar_color,claimed,eligibility_status,created_at'
);
select cvf_test.ok(
  'data api 02 public_profiles remains the intentional definer-style boundary',
  exists (
    select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = 'public_profiles'
       and not ('security_invoker=true' = any(coalesce(c.reloptions, '{}'::text[])))
  )
);

select cvf_test.as_anon();
select cvf_test.throws_ok(
  'data api 03 public_profiles does not expose email',
  $$select email from public.public_profiles$$,
  '%does not exist%'
);
select cvf_test.throws_ok(
  'data api 04 public_profiles does not expose phone',
  $$select phone from public.public_profiles$$,
  '%does not exist%'
);
select cvf_test.throws_ok(
  'data api 05 public_profiles does not expose date of birth',
  $$select dob from public.public_profiles$$,
  '%does not exist%'
);
select cvf_test.throws_ok(
  'data api 06 public_profiles does not expose emergency contact name',
  $$select emergency_contact_name from public.public_profiles$$,
  '%does not exist%'
);
select cvf_test.throws_ok(
  'data api 07 public_profiles does not expose emergency contact phone',
  $$select emergency_contact_phone from public.public_profiles$$,
  '%does not exist%'
);
select cvf_test.throws_ok(
  'data api 08 public_profiles does not expose admin notes',
  $$select admin_notes from public.public_profiles$$,
  '%does not exist%'
);
select cvf_test.throws_ok(
  'data api 09 public_profiles does not expose auth user id',
  $$select auth_user_id from public.public_profiles$$,
  '%does not exist%'
);
select cvf_test.throws_ok(
  'data api 10 public_profiles does not expose waiver details',
  $$select waiver_version from public.public_profiles$$,
  '%does not exist%'
);
select cvf_test.throws_ok(
  'data api 11 anon cannot inspect admin identities',
  $$select count(*) from public.admin_users$$,
  '%permission denied%'
);
select cvf_test.throws_ok(
  'data api 12 anon cannot inspect game edit history',
  $$select count(*) from public.game_edit_history$$,
  '%permission denied%'
);
select cvf_test.throws_ok(
  'data api 13 anon cannot inspect charges',
  $$select count(*) from public.charges$$,
  '%permission denied%'
);
select cvf_test.throws_ok(
  'data api 14 anon cannot inspect payment entries',
  $$select count(*) from public.payment_entries$$,
  '%permission denied%'
);
select cvf_test.throws_ok(
  'payments auth 01 anon cannot insert charges',
  $$insert into public.charges (season, profile_id, amount_due_cents)
    values ('Summer 2026', '10000000-0000-0000-0000-000000000001', 100)$$,
  '%permission denied%'
);
select cvf_test.throws_ok(
  'payments auth 02 anon cannot update charges',
  $$update public.charges set amount_due_cents = 999
    where id = 'a0000000-0000-0000-0000-000000000001'$$,
  '%permission denied%'
);
select cvf_test.throws_ok(
  'payments auth 03 anon cannot delete charges',
  $$delete from public.charges
    where id = 'a0000000-0000-0000-0000-000000000001'$$,
  '%permission denied%'
);
select cvf_test.throws_ok(
  'payments auth 04 anon cannot insert payment entries',
  $$insert into public.payment_entries (charge_id, amount_cents, method)
    values ('a0000000-0000-0000-0000-000000000001', 100, 'cash')$$,
  '%permission denied%'
);
select cvf_test.throws_ok(
  'payments auth 05 anon cannot update payment entries',
  $$update public.payment_entries set amount_cents = 999
    where id = 'b0000000-0000-0000-0000-000000000001'$$,
  '%permission denied%'
);
select cvf_test.throws_ok(
  'payments auth 06 anon cannot delete payment entries',
  $$delete from public.payment_entries
    where id = 'b0000000-0000-0000-0000-000000000001'$$,
  '%permission denied%'
);

select cvf_test.as_user('00000000-0000-0000-0000-000000000002');
select cvf_test.eq_int('data api 15 non-admin profiles read is RLS-empty', (select count(*)::int from public.profiles), 0);
select cvf_test.eq_int('data api 16 non-admin waivers read is RLS-empty', (select count(*)::int from public.waivers), 0);
select cvf_test.eq_int('data api 17 non-admin registrations read is RLS-empty', (select count(*)::int from public.team_registrations), 0);
select cvf_test.eq_int('data api 18 non-admin free agents read is RLS-empty', (select count(*)::int from public.free_agents), 0);
select cvf_test.eq_int('data api 19 non-admin edit history read is RLS-empty', (select count(*)::int from public.game_edit_history), 0);
select cvf_test.eq_int('data api 20 non-admin charges read is RLS-empty', (select count(*)::int from public.charges), 0);
select cvf_test.eq_int('data api 21 non-admin payment entries read is RLS-empty', (select count(*)::int from public.payment_entries), 0);
select cvf_test.throws_ok(
  'data api 22 non-admin admin RPC call fails its authorization guard',
  $$select public.lock_game('50000000-0000-0000-0000-000000000001')$$,
  '%Admin only%'
);
select cvf_test.throws_ok(
  'payments auth 07 non-admin cannot insert charges',
  $$insert into public.charges (season, profile_id, amount_due_cents)
    values ('Summer 2026', '10000000-0000-0000-0000-000000000001', 100)$$,
  '%row-level security%'
);
select cvf_test.row_count_is_zero(
  'payments auth 08 non-admin cannot update charges',
  $$update public.charges set amount_due_cents = 999
     where id = 'a0000000-0000-0000-0000-000000000001'$$
);
select cvf_test.row_count_is_zero(
  'payments auth 09 non-admin cannot delete charges',
  $$delete from public.charges
     where id = 'a0000000-0000-0000-0000-000000000001'$$
);
select cvf_test.throws_ok(
  'payments auth 10 non-admin cannot insert payment entries',
  $$insert into public.payment_entries (charge_id, amount_cents, method)
    values ('a0000000-0000-0000-0000-000000000001', 100, 'cash')$$,
  '%row-level security%'
);
select cvf_test.row_count_is_zero(
  'payments auth 11 non-admin cannot update payment entries',
  $$update public.payment_entries set amount_cents = 999
     where id = 'b0000000-0000-0000-0000-000000000001'$$
);
select cvf_test.row_count_is_zero(
  'payments auth 12 non-admin cannot delete payment entries',
  $$delete from public.payment_entries
     where id = 'b0000000-0000-0000-0000-000000000001'$$
);

select cvf_test.as_admin('00000000-0000-0000-0000-000000000001');
select cvf_test.lives_ok(
  'payments auth 13 admin can insert a charge',
  $$insert into public.charges
      (id, season, profile_id, amount_due_cents, kind, notes)
    values
      ('a0000000-0000-0000-0000-000000000099', 'Summer 2026',
       '10000000-0000-0000-0000-000000000001', 2500, 'other', 'authorization test')$$
);
select cvf_test.lives_ok(
  'payments auth 14 admin can update a charge',
  $$update public.charges set amount_due_cents = 3000
     where id = 'a0000000-0000-0000-0000-000000000099'$$
);
select cvf_test.lives_ok(
  'payments auth 15 admin can insert a payment entry',
  $$insert into public.payment_entries
      (id, charge_id, amount_cents, method, note)
    values
      ('a1000000-0000-0000-0000-000000000099',
       'a0000000-0000-0000-0000-000000000099', 1000, 'cash', 'authorization test')$$
);
select cvf_test.lives_ok(
  'payments auth 16 admin can update a payment entry',
  $$update public.payment_entries set amount_cents = 1500
     where id = 'a1000000-0000-0000-0000-000000000099'$$
);
select cvf_test.lives_ok(
  'payments auth 17 admin can delete a payment entry',
  $$delete from public.payment_entries
     where id = 'a1000000-0000-0000-0000-000000000099'$$
);
select cvf_test.lives_ok(
  'payments auth 18 admin can delete a charge after its entries are removed',
  $$delete from public.charges
     where id = 'a0000000-0000-0000-0000-000000000099'$$
);

-- ---------------------------------------------------------------------------
-- Hall of Fame public-view boundary and explicit CRUD authorization.
-- ---------------------------------------------------------------------------
select cvf_test.as_owner();
select cvf_test.eq_text(
  'hof auth 01 public_hof_entries exposes the exact safe-field allowlist',
  (
    select string_agg(column_name, ',' order by ordinal_position)
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'public_hof_entries'
  ),
  'id,entry_type,game_id,profile_id,team_id,sport,season,record_scope,title,blurb,stat_key,stat_value,display_order,created_at,updated_at'
);
select cvf_test.ok(
  'hof auth 02 public_hof_entries remains the intentional definer-style boundary',
  exists (
    select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = 'public_hof_entries'
       and not ('security_invoker=true' = any(coalesce(c.reloptions, '{}'::text[])))
  )
);
select cvf_test.ok(
  'hof auth 03 anon can select public_hof_entries but not hof_entries',
  has_table_privilege('anon', 'public.public_hof_entries', 'select')
  and not has_table_privilege('anon', 'public.hof_entries', 'select')
);

select cvf_test.as_anon();
select cvf_test.throws_ok(
  'hof auth 04 public_hof_entries does not expose created_by',
  $$select created_by from public.public_hof_entries$$,
  '%does not exist%'
);
select cvf_test.throws_ok(
  'hof auth 05 anon cannot insert Hall of Fame entries',
  $$insert into public.hof_entries (entry_type, profile_id, title)
    values ('player', '10000000-0000-0000-0000-000000000001', 'Denied')$$,
  '%permission denied%'
);
select cvf_test.throws_ok(
  'hof auth 06 anon cannot update Hall of Fame entries',
  $$update public.hof_entries set title = 'Denied'
    where id = 'c0000000-0000-0000-0000-000000000001'$$,
  '%permission denied%'
);
select cvf_test.throws_ok(
  'hof auth 07 anon cannot delete Hall of Fame entries',
  $$delete from public.hof_entries
    where id = 'c0000000-0000-0000-0000-000000000001'$$,
  '%permission denied%'
);

select cvf_test.as_user('00000000-0000-0000-0000-000000000002');
select cvf_test.eq_int(
  'hof auth 08 non-admin base table read is RLS-empty',
  (select count(*)::int from public.hof_entries),
  0
);
select cvf_test.throws_ok(
  'hof auth 09 non-admin cannot insert Hall of Fame entries',
  $$insert into public.hof_entries (entry_type, profile_id, title)
    values ('player', '10000000-0000-0000-0000-000000000001', 'Denied')$$,
  '%row-level security%'
);
select cvf_test.row_count_is_zero(
  'hof auth 10 non-admin cannot update Hall of Fame entries',
  $$update public.hof_entries set title = 'Denied'
    where id = 'c0000000-0000-0000-0000-000000000001'$$
);
select cvf_test.row_count_is_zero(
  'hof auth 11 non-admin cannot delete Hall of Fame entries',
  $$delete from public.hof_entries
    where id = 'c0000000-0000-0000-0000-000000000001'$$
);

select cvf_test.as_admin('00000000-0000-0000-0000-000000000001');
select cvf_test.lives_ok(
  'hof auth 12 admin can insert a Hall of Fame entry',
  $$insert into public.hof_entries (id, entry_type, profile_id, title, blurb)
    values ('c0000000-0000-0000-0000-000000000099', 'player',
            '10000000-0000-0000-0000-000000000001',
            'Authorization test', 'Disposable Hall of Fame fixture')$$
);
select cvf_test.lives_ok(
  'hof auth 13 admin can update a Hall of Fame entry',
  $$update public.hof_entries set title = 'Authorization test updated'
    where id = 'c0000000-0000-0000-0000-000000000099'$$
);
select cvf_test.lives_ok(
  'hof auth 14 admin can delete a Hall of Fame entry',
  $$delete from public.hof_entries
    where id = 'c0000000-0000-0000-0000-000000000099'$$
);

select cvf_test.as_owner();
select cvf_test.ok(
  'data api 23 anon can select public_profiles',
  has_table_privilege('anon', 'public.public_profiles', 'select')
);
select cvf_test.ok(
  'data api 24 anon has no profiles table privilege',
  not has_table_privilege('anon', 'public.profiles', 'select')
);
select cvf_test.ok(
  'data api 25 anon cannot execute an admin RPC',
  not has_function_privilege('anon', 'public.lock_game(uuid)', 'execute')
);
select cvf_test.ok(
  'data api 26 authenticated can execute an admin RPC',
  has_function_privilege('authenticated', 'public.lock_game(uuid)', 'execute')
);
select cvf_test.ok(
  'data api 27 waiver table-wide update remains denied',
  not has_table_privilege('authenticated', 'public.waivers', 'update')
);
select cvf_test.ok(
  'data api 28 waiver verification column update is allowlisted',
  has_column_privilege('authenticated', 'public.waivers', 'verification_status', 'update')
);
select cvf_test.ok(
  'data api 29 waiver signature column update remains denied',
  not has_column_privilege('authenticated', 'public.waivers', 'signed_name', 'update')
);
select cvf_test.ok(
  'data api 30 trigger helpers are not client-executable',
  not has_function_privilege('authenticated', 'public.enforce_waiver_immutability()', 'execute')
  and not has_function_privilege('authenticated', 'public.enforce_charge_team_season()', 'execute')
);
select cvf_test.ok(
  'data api 31 every public base table has RLS enabled',
  not exists (
    select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind in ('r', 'p')
       and not c.relrowsecurity
  )
);

create table public._cvf_default_privilege_test (id int);
select cvf_test.ok(
  'data api 32 future tables are not exposed automatically',
  not has_table_privilege('anon', 'public._cvf_default_privilege_test', 'select')
  and not has_table_privilege('authenticated', 'public._cvf_default_privilege_test', 'insert')
  and not has_table_privilege('service_role', 'public._cvf_default_privilege_test', 'select')
  and not has_table_privilege('service_role', 'public._cvf_default_privilege_test', 'insert')
  and not has_table_privilege('service_role', 'public._cvf_default_privilege_test', 'update')
  and not has_table_privilege('service_role', 'public._cvf_default_privilege_test', 'delete')
  and not has_table_privilege('service_role', 'public._cvf_default_privilege_test', 'truncate')
  and not has_table_privilege('service_role', 'public._cvf_default_privilege_test', 'references')
  and not has_table_privilege('service_role', 'public._cvf_default_privilege_test', 'trigger')
);
drop table public._cvf_default_privilege_test;

create function public._cvf_default_privilege_test()
returns void language sql as $$select$$;
select cvf_test.ok(
  'data api 33 future functions are not executable automatically',
  not has_function_privilege('anon', 'public._cvf_default_privilege_test()', 'execute')
  and not has_function_privilege('authenticated', 'public._cvf_default_privilege_test()', 'execute')
  and not has_function_privilege('service_role', 'public._cvf_default_privilege_test()', 'execute')
);
drop function public._cvf_default_privilege_test();

-- ---------------------------------------------------------------------------
-- Database Advisor remediation invariants (4 assertions).
-- ---------------------------------------------------------------------------
select cvf_test.as_owner();
select cvf_test.ok(
  'advisor 01 palette helper has an immutable search path',
  exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'cvf_palette_color'
       and p.proconfig @> array['search_path=pg_catalog']
  )
);
select cvf_test.ok(
  'advisor 02 current waiver lookup uses caller privileges',
  exists (
    select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname = 'current_waiver_version'
       and not p.prosecdef
  )
);

select cvf_test.as_anon();
select cvf_test.eq_text(
  'advisor 03 anon still reads the current waiver version through RLS',
  public.current_waiver_version(),
  'CVF-WAIVER-TEST-v1'
);

select cvf_test.as_owner();
select cvf_test.ok(
  'advisor 04 every public foreign key has a covering index',
  not exists (
    select 1
      from pg_constraint fk
      join pg_class t on t.oid = fk.conrelid
      join pg_namespace n on n.oid = t.relnamespace
     where fk.contype = 'f'
       and n.nspname = 'public'
       and not exists (
         select 1
           from pg_index i
          where i.indrelid = fk.conrelid
            and i.indisvalid
            and i.indisready
            and i.indnkeyatts >= cardinality(fk.conkey)
            and not exists (
              select 1
                from generate_subscripts(fk.conkey, 1) s(position)
               where fk.conkey[s.position] <> i.indkey[s.position - 1]
            )
       )
  )
);

-- ---------------------------------------------------------------------------
-- Stage 0 launch hardening: MFA authorization and protected intake.
-- ---------------------------------------------------------------------------
select cvf_test.as_admin_aal1('00000000-0000-0000-0000-000000000001');
select cvf_test.ok(
  'launch 01 linked AAL1 administrator can resolve identity for MFA routing',
  public.is_admin_identity()
);
select cvf_test.ok(
  'launch 02 linked AAL1 administrator is not authorized as admin',
  not public.is_admin()
);
select cvf_test.throws_ok(
  'launch 03a linked AAL1 administrator cannot save a score',
  $$select public.save_score('50000000-0000-0000-0000-000000000001', 1, 0, '{}'::jsonb, '{}'::jsonb)$$,
  '%Admin only%'
);
select cvf_test.throws_ok(
  'launch 03b linked AAL1 administrator cannot lock a game',
  $$select public.lock_game('50000000-0000-0000-0000-000000000001')$$,
  '%Admin only%'
);
select cvf_test.throws_ok(
  'launch 03c linked AAL1 administrator cannot unlock a game',
  $$select public.unlock_game('50000000-0000-0000-0000-000000000001', 'MFA bypass check')$$,
  '%Admin only%'
);
select cvf_test.throws_ok(
  'launch 03d linked AAL1 administrator cannot change game status',
  $$select public.set_game_status('50000000-0000-0000-0000-000000000001', 'postponed')$$,
  '%Admin only%'
);
select cvf_test.throws_ok(
  'launch 03e linked AAL1 administrator cannot approve a registration',
  $$select public.approve_registration('60000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', true)$$,
  '%Admin only%'
);
select cvf_test.throws_ok(
  'launch 03f linked AAL1 administrator cannot assign a free agent',
  $$select public.assign_free_agent('70000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 31, 'Utility')$$,
  '%Admin only%'
);
select cvf_test.throws_ok(
  'launch 03g linked AAL1 administrator cannot verify a waiver',
  $$select public.verify_waiver('80000000-0000-0000-0000-000000000001', 'verified')$$,
  '%Admin only%'
);
select cvf_test.throws_ok(
  'launch 03h linked AAL1 administrator cannot generate a bracket',
  $$select public.generate_single_elim_bracket(
    '30000000-0000-0000-0000-000000000001',
    array[
      '40000000-0000-0000-0000-000000000001'::uuid,
      '40000000-0000-0000-0000-000000000002'::uuid,
      '40000000-0000-0000-0000-000000000003'::uuid,
      '40000000-0000-0000-0000-000000000004'::uuid
    ]
  )$$,
  '%Admin only%'
);
select cvf_test.throws_ok(
  'launch 03i linked AAL1 administrator cannot schedule a playoff match',
  $$select public.schedule_playoff_match('d0000000-0000-0000-0000-000000000001', date '2099-07-14', '7:00 PM', 'MFA bypass check')$$,
  '%Admin only%'
);
select cvf_test.throws_ok(
  'launch 03j linked AAL1 administrator cannot link a playoff game',
  $$select public.link_playoff_game('d0000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001')$$,
  '%Admin only%'
);
select cvf_test.throws_ok(
  'launch 03k linked AAL1 administrator cannot advance a playoff match',
  $$select public.advance_playoff_match('d0000000-0000-0000-0000-000000000001')$$,
  '%Admin only%'
);
select cvf_test.throws_ok(
  'launch 03l linked AAL1 administrator cannot enroll a team identity',
  $$select public.enroll_team_identity(
    'e0000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000001',
    null,
    null
  )$$,
  '%Admin only%'
);
select cvf_test.throws_ok(
  'launch 03m linked AAL1 administrator cannot create and enroll a team identity',
  $$select public.create_team_identity_and_enroll(
    'MFA bypass identity',
    '#5BB8CC',
    '2099',
    '30000000-0000-0000-0000-000000000001',
    null,
    null
  )$$,
  '%Admin only%'
);
select cvf_test.throws_ok(
  'launch 03n linked AAL1 administrator cannot update a team identity',
  $$select public.update_team_identity(
    'e0000000-0000-0000-0000-000000000001',
    '{"status":"inactive"}'::jsonb
  )$$,
  '%Admin only%'
);
select cvf_test.throws_ok(
  'launch 03o linked AAL1 administrator cannot update a team enrollment',
  $$select public.update_team_enrollment(
    '30000000-0000-0000-0000-000000000001',
    '{"status":"inactive"}'::jsonb
  )$$,
  '%Admin only%'
);

select cvf_test.as_admin('00000000-0000-0000-0000-000000000001');
select cvf_test.ok(
  'launch 04 linked AAL2 administrator is authorized as admin',
  public.is_admin()
);

select cvf_test.as_owner();
select cvf_test.ok(
  'launch 05 anonymous role has no direct intake or waiver insert grants',
  not has_table_privilege('anon', 'public.team_registrations', 'insert')
  and not has_table_privilege('anon', 'public.free_agents', 'insert')
  and not has_table_privilege('anon', 'public.waivers', 'insert')
);
select cvf_test.ok(
  'launch 06 public submission policies were removed',
  not exists (
    select 1
      from pg_policies
     where schemaname = 'public'
       and policyname in (
         'team_registrations_public_submit',
         'free_agents_public_submit',
         'waivers_public_sign'
       )
  )
);
select cvf_test.ok(
  'launch 07 MFA identity helper is callable but admin assertion remains private',
  has_function_privilege('authenticated', 'public.is_admin_identity()', 'execute')
  and not has_function_privilege('anon', 'public.assert_admin()', 'execute')
);

-- ---------------------------------------------------------------------------
-- Stage 1 per-sport current-season defaults.
-- ---------------------------------------------------------------------------
select cvf_test.as_anon();
select cvf_test.ok(
  'season isolation 01 anonymous readers receive both sport defaults',
  (select current_kickball_season = 'Summer 2026'
      and current_flag_football_season = 'Summer 2026'
     from public.league_settings where id = 1)
);

select cvf_test.as_user('00000000-0000-0000-0000-000000000002');
update public.league_settings
set current_flag_football_season = 'Fall 2026'
where id = 1;
select cvf_test.eq_text(
  'season isolation 02 non-admin cannot change a sport default',
  (select current_flag_football_season from public.league_settings where id = 1),
  'Summer 2026'
);

select cvf_test.as_admin('00000000-0000-0000-0000-000000000001');
update public.league_settings
set current_kickball_season = 'Fall 2026'
where id = 1;
select cvf_test.ok(
  'season isolation 03 admin can set different current seasons by sport',
  (select current_kickball_season = 'Fall 2026'
      and current_flag_football_season = 'Summer 2026'
     from public.league_settings where id = 1)
);
select cvf_test.throws_ok(
  'season isolation 04 sport defaults are season foreign keys',
  $$update public.league_settings
      set current_kickball_season = 'Not A Season'
    where id = 1$$,
  '%foreign key constraint%'
);
update public.league_settings
set current_kickball_season = 'Summer 2026'
where id = 1;
select cvf_test.eq_text(
  'season isolation 05 restoring one sport leaves the other default unchanged',
  (select current_flag_football_season from public.league_settings where id = 1),
  'Summer 2026'
);

-- ---------------------------------------------------------------------------
-- Stage 2 single-elimination bracket generation and advancement.
-- ---------------------------------------------------------------------------
select cvf_test.as_owner();
insert into public.teams (id, league_id, name, sport, logo_color)
values
  ('30000000-0000-0000-0000-000000000201', '20000000-0000-0000-0000-000000000001', 'Kick C', 'kickball', '#A855F7'),
  ('30000000-0000-0000-0000-000000000202', '20000000-0000-0000-0000-000000000001', 'Kick D', 'kickball', '#10B981'),
  ('30000000-0000-0000-0000-000000000203', '20000000-0000-0000-0000-000000000001', 'Kick E', 'kickball', '#EF4444');
update public.leagues set playoff_format = 'single_elim'
where id = '20000000-0000-0000-0000-000000000001';

select cvf_test.as_user('00000000-0000-0000-0000-000000000002');
select cvf_test.throws_ok(
  'bracket 01 non-admin cannot generate a bracket',
  $$select public.generate_single_elim_bracket(
      '20000000-0000-0000-0000-000000000001',
      array[
        '30000000-0000-0000-0000-000000000001',
        '30000000-0000-0000-0000-000000000002',
        '30000000-0000-0000-0000-000000000201',
        '30000000-0000-0000-0000-000000000202',
        '30000000-0000-0000-0000-000000000203'
      ]::uuid[]
    )$$,
  '%Admin only%'
);

select cvf_test.as_admin('00000000-0000-0000-0000-000000000001');
select cvf_test.lives_ok(
  'bracket 02 admin generates a variable-size bracket',
  $$select public.generate_single_elim_bracket(
      '20000000-0000-0000-0000-000000000001',
      (select array_agg(id order by id) from public.teams
        where league_id = '20000000-0000-0000-0000-000000000001'
          and status = 'active')
    )$$
);
select cvf_test.eq_int(
  'bracket 03 bracket expands to the next power of two',
  (select bracket_size from public.playoff_brackets
    where league_id = '20000000-0000-0000-0000-000000000001'),
  8
);
select cvf_test.eq_int(
  'bracket 04 all seeds are snapshotted',
  (select count(*)::int from public.playoff_seeds),
  6
);
select cvf_test.eq_int(
  'bracket 05 top seeds receive the required byes',
  (select count(*)::int from public.playoff_matches where status = 'bye'),
  2
);
select cvf_test.eq_int(
  'bracket 06 championship plus third-place paths exist',
  (select count(*)::int from public.playoff_matches where label in ('Championship', 'Third Place')),
  2
);
select cvf_test.lives_ok(
  'bracket 07 a ready first-round match can be scheduled',
  $$select public.schedule_playoff_match(
      (select id from public.playoff_matches where round_number = 1 and status = 'ready' limit 1),
      '2026-08-01', '6:00 PM', 'Championship Field'
    )$$
);
select cvf_test.throws_ok(
  'bracket 08 an unfinished game cannot advance',
  $$select public.advance_playoff_match(
      (select id from public.playoff_matches where game_id is not null limit 1)
    )$$,
  '%completed, marked final, and locked%'
);
select cvf_test.lives_ok(
  'bracket setup score and lock scheduled game',
  $$select public.save_score(
      (select game_id from public.playoff_matches where game_id is not null limit 1),
      10, 4, '{"home":[],"away":[]}'::jsonb, '{}'::jsonb
    );
    select public.lock_game(
      (select game_id from public.playoff_matches where game_id is not null limit 1)
    )$$
);
select cvf_test.lives_ok(
  'bracket 09 final locked result advances manually',
  $$select public.advance_playoff_match(
      (select id from public.playoff_matches where game_id is not null limit 1)
    )$$
);
select cvf_test.ok(
  'bracket 10 winner is placed into the next match',
  exists (
    select 1 from public.playoff_matches source
    join public.playoff_matches destination on destination.id = source.winner_to_match_id
    where source.game_id is not null
      and source.winner_team_id is not null
      and source.winner_team_id in (destination.home_team_id, destination.away_team_id)
  )
);

select cvf_test.as_anon();
select cvf_test.eq_int(
  'bracket 11 anonymous viewers can read the generated bracket',
  (select count(*)::int from public.playoff_brackets),
  1
);
select cvf_test.throws_ok(
  'bracket 12 anonymous viewers cannot mutate bracket matches',
  $$update public.playoff_matches set label = 'Tampered'$$,
  '%permission denied%'
);

select cvf_test.as_admin('00000000-0000-0000-0000-000000000001');
select cvf_test.throws_ok(
  'bracket 13 administrator cannot directly mutate bracket headers',
  $$update public.playoff_brackets set status = 'complete'$$,
  '%permission denied%'
);
select cvf_test.throws_ok(
  'bracket 14 administrator cannot directly mutate locked seeds',
  $$update public.playoff_seeds set seed = seed$$,
  '%permission denied%'
);
select cvf_test.throws_ok(
  'bracket 15 administrator cannot directly mutate match topology',
  $$update public.playoff_matches set label = 'Tampered'$$,
  '%permission denied%'
);
select cvf_test.ok(
  'bracket 16 authenticated Data API role has read-only bracket table grants',
  has_table_privilege('authenticated', 'public.playoff_brackets', 'select')
  and has_table_privilege('authenticated', 'public.playoff_seeds', 'select')
  and has_table_privilege('authenticated', 'public.playoff_matches', 'select')
  and not has_table_privilege('authenticated', 'public.playoff_brackets', 'insert,update,delete')
  and not has_table_privilege('authenticated', 'public.playoff_seeds', 'insert,update,delete')
  and not has_table_privilege('authenticated', 'public.playoff_matches', 'insert,update,delete')
);
select cvf_test.lives_ok(
  'bracket 17 unlocking retracts an advancement before downstream scheduling',
  $$select public.unlock_game(
      (select game_id from public.playoff_matches where game_id is not null limit 1),
      'Correcting a playoff score'
    )$$
);
select cvf_test.ok(
  'bracket 18 retraction clears the downstream slot and source result',
  exists (
    select 1 from public.playoff_matches source
    join public.playoff_matches destination on destination.id = source.winner_to_match_id
    where source.game_id is not null
      and source.status = 'ready'
      and source.winner_team_id is null
      and source.loser_team_id is null
      and destination.status = 'pending'
      and (
        (source.winner_to_slot = 'home' and destination.home_team_id is null and destination.home_seed is null)
        or (source.winner_to_slot = 'away' and destination.away_team_id is null and destination.away_seed is null)
      )
  )
);
select cvf_test.lives_ok(
  'bracket setup re-advances and schedules the downstream match',
  $$select public.save_score(
      (select game_id from public.playoff_matches where game_id is not null limit 1),
      11, 4, '{"home":[],"away":[]}'::jsonb, '{}'::jsonb
    );
    select public.lock_game(
      (select game_id from public.playoff_matches where game_id is not null limit 1)
    );
    select public.advance_playoff_match(
      (select id from public.playoff_matches where game_id is not null limit 1)
    );
    select public.schedule_playoff_match(
      (select destination.id
       from public.playoff_matches source
       join public.playoff_matches destination on destination.id = source.winner_to_match_id
       where source.game_id is not null limit 1),
      '2026-08-08', '6:00 PM', 'Championship Field'
    )$$
);
select cvf_test.throws_ok(
  'bracket 19 unlock is blocked after the downstream game is scheduled',
  $$select public.unlock_game(
      (select game_id from public.playoff_matches
       where status = 'completed' and game_id is not null limit 1),
      'Too late to retract safely'
    )$$,
  '%next playoff match has been scheduled%'
);
select cvf_test.ok(
  'bracket 20 blocked unlock preserves the source result and lock',
  exists (
    select 1 from public.playoff_matches match
    join public.games game on game.id = match.game_id
    where match.status = 'completed'
      and match.winner_team_id is not null
      and game.locked
  )
);

-- ---------------------------------------------------------------------------
-- Persistent team identities and explicit enrollment shells.
-- ---------------------------------------------------------------------------
select cvf_test.as_anon();
select cvf_test.ok(
  'team identity 01 anonymous viewers can read persistent team brands',
  exists (
    select 1 from public.team_identities identity
    join public.teams enrollment on enrollment.identity_id = identity.id
  )
);
select cvf_test.throws_ok(
  'team identity 02 anonymous viewers cannot create an identity',
  $$insert into public.team_identities (name, logo_color) values ('Tampered', '#000000')$$,
  '%permission denied%'
);

select cvf_test.as_user('00000000-0000-0000-0000-000000000002');
select cvf_test.throws_ok(
  'team identity 03 non-admin cannot enroll an identity',
  $$select public.enroll_team_identity(
      (select identity_id from public.teams where id = '30000000-0000-0000-0000-000000000001'),
      '20000000-0000-0000-0000-000000000002'
    )$$,
  '%Admin only%'
);

select cvf_test.as_admin('00000000-0000-0000-0000-000000000001');
select cvf_test.lives_ok(
  'team identity 04 one identity can enroll into another sport',
  $$select public.enroll_team_identity(
      (select identity_id from public.teams where id = '30000000-0000-0000-0000-000000000001'),
      '20000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000004',
      'Open'
    )$$
);
select cvf_test.ok(
  'team identity 05 cross-sport enrollment has the target sport and same brand',
  exists (
    select 1
    from public.teams source
    join public.teams enrolled on enrolled.identity_id = source.identity_id
    where source.id = '30000000-0000-0000-0000-000000000001'
      and enrolled.league_id = '20000000-0000-0000-0000-000000000002'
      and enrolled.sport = 'flag_football'
      and enrolled.name = source.name
      and enrolled.logo_color = source.logo_color
  )
);
select cvf_test.ok(
  'team identity 06 new enrollment carries no roster or payments',
  not exists (
    select 1 from public.team_players roster
    join public.teams enrolled on enrolled.id = roster.team_id
    where enrolled.identity_id = (select identity_id from public.teams where id = '30000000-0000-0000-0000-000000000001')
      and enrolled.league_id = '20000000-0000-0000-0000-000000000002'
  )
  and not exists (
    select 1 from public.charges charge
    join public.teams enrolled on enrolled.id = charge.team_id
    where enrolled.identity_id = (select identity_id from public.teams where id = '30000000-0000-0000-0000-000000000001')
      and enrolled.league_id = '20000000-0000-0000-0000-000000000002'
  )
);
select cvf_test.throws_ok(
  'team identity 07 duplicate enrollment is rejected',
  $$select public.enroll_team_identity(
      (select identity_id from public.teams where id = '30000000-0000-0000-0000-000000000001'),
      '20000000-0000-0000-0000-000000000002'
    )$$,
  '%already enrolled%'
);
select cvf_test.lives_ok(
  'team identity 08 canonical brand RPC propagates to every enrollment',
  $$select public.update_team_identity(
      (select identity_id from public.teams where id = '30000000-0000-0000-0000-000000000001'),
      '{"name":"Kick A United","logo_color":"#112233"}'::jsonb
    )$$
);
select cvf_test.ok(
  'team identity 09 every enrollment reflects the canonical brand',
  not exists (
    select 1 from public.teams
    where identity_id = (select identity_id from public.teams where id = '30000000-0000-0000-0000-000000000001')
      and (name <> 'Kick A United' or logo_color <> '#112233')
  )
);
select cvf_test.lives_ok(
  'team identity 10 enrollment RPC supports only mutable enrollment fields',
  $$select public.update_team_enrollment(
      '30000000-0000-0000-0000-000000000001',
      '{"captain_id":"10000000-0000-0000-0000-000000000001","division":"RPC Division","status":"active"}'::jsonb
    )$$
);
select cvf_test.ok(
  'team identity 11 enrollment RPC persisted captain, division, and status',
  exists (
    select 1 from public.teams
     where id = '30000000-0000-0000-0000-000000000001'
       and captain_id = '10000000-0000-0000-0000-000000000001'
       and division = 'RPC Division'
       and status = 'active'
  )
);
select cvf_test.throws_ok(
  'team identity 12 admin cannot directly insert an enrollment',
  $$insert into public.teams
      (identity_id, league_id, name, sport, logo_color, status)
    values
      ((select identity_id from public.teams where id = '30000000-0000-0000-0000-000000000001'),
       '20000000-0000-0000-0000-000000000101', 'Bypass', 'kickball', '#000000', 'active')$$,
  '%permission denied%'
);
select cvf_test.throws_ok(
  'team identity 13 admin cannot directly update an enrollment',
  $$update public.teams set division = 'Bypass'
     where id = '30000000-0000-0000-0000-000000000001'$$,
  '%permission denied%'
);
select cvf_test.throws_ok(
  'team identity 14 admin cannot directly delete an enrollment',
  $$delete from public.teams
     where id = '30000000-0000-0000-0000-000000000001'$$,
  '%permission denied%'
);
select cvf_test.throws_ok(
  'team identity 15 admin cannot directly insert a persistent identity',
  $$insert into public.team_identities (name, logo_color) values ('Bypass', '#000000')$$,
  '%permission denied%'
);
select cvf_test.throws_ok(
  'team identity 16 admin cannot directly update a persistent identity',
  $$update public.team_identities set status = 'inactive'
     where id = (select identity_id from public.teams where id = '30000000-0000-0000-0000-000000000001')$$,
  '%permission denied%'
);
select cvf_test.throws_ok(
  'team identity 17 admin cannot directly delete a persistent identity',
  $$delete from public.team_identities
     where id = (select identity_id from public.teams where id = '30000000-0000-0000-0000-000000000001')$$,
  '%permission denied%'
);
select cvf_test.ok(
  'team identity 18 authenticated Data API role has read-only identity and enrollment grants',
  has_table_privilege('authenticated', 'public.team_identities', 'select')
  and not has_table_privilege('authenticated', 'public.team_identities', 'insert')
  and not has_table_privilege('authenticated', 'public.team_identities', 'update')
  and not has_table_privilege('authenticated', 'public.team_identities', 'delete')
  and has_table_privilege('authenticated', 'public.teams', 'select')
  and not has_table_privilege('authenticated', 'public.teams', 'insert')
  and not has_table_privilege('authenticated', 'public.teams', 'update')
  and not has_table_privilege('authenticated', 'public.teams', 'delete')
);
select cvf_test.lives_ok(
  'team identity 19 identity lifecycle changes through its RPC',
  $$select public.update_team_identity(
      (select identity_id from public.teams where id = '30000000-0000-0000-0000-000000000001'),
      '{"status":"inactive"}'::jsonb
    )$$
);
select cvf_test.throws_ok(
  'team identity 20 inactive identity cannot be enrolled through its RPC',
  $$select public.enroll_team_identity(
      (select identity_id from public.teams where id = '30000000-0000-0000-0000-000000000001'),
      '20000000-0000-0000-0000-000000000101'
    )$$,
  '%Inactive team identities cannot be enrolled%'
);
select cvf_test.lives_ok(
  'team identity 21 identity can be reactivated through its RPC',
  $$select public.update_team_identity(
      (select identity_id from public.teams where id = '30000000-0000-0000-0000-000000000001'),
      '{"status":"active"}'::jsonb
    )$$
);
select cvf_test.lives_ok(
  'team identity 22 new identity and first enrollment are transactional',
  $$select public.create_team_identity_and_enroll(
      'Future Flyers', '#445566', '2026',
      '20000000-0000-0000-0000-000000000101', null, 'Recreation'
    )$$
);
select cvf_test.ok(
  'team identity 23 transactional enrollment creates only its shell',
  exists (
    select 1 from public.team_identities identity
    join public.teams enrollment on enrollment.identity_id = identity.id
    where identity.name = 'Future Flyers'
      and enrollment.league_id = '20000000-0000-0000-0000-000000000101'
  )
  and not exists (
    select 1 from public.team_players roster
    join public.teams enrollment on enrollment.id = roster.team_id
    join public.team_identities identity on identity.id = enrollment.identity_id
    where identity.name = 'Future Flyers'
  )
);
select cvf_test.ok(
  'team identity 24 approved registrations own a persistent identity',
  exists (
    select 1 from public.team_registrations registration
    join public.teams enrollment on enrollment.id = registration.approved_team_id
    join public.team_identities identity on identity.id = enrollment.identity_id
    where registration.status = 'approved' and identity.name = enrollment.name
  )
);

select cvf_test.ok(
  'service role 01 protected intake can insert team registrations',
  has_table_privilege('service_role', 'public.team_registrations', 'insert')
);
select cvf_test.ok(
  'service role 02 protected intake can insert free agents',
  has_table_privilege('service_role', 'public.free_agents', 'insert')
);
select cvf_test.ok(
  'service role 03 protected intake has no privilege beyond insert',
  not has_table_privilege('service_role', 'public.team_registrations', 'select')
  and not has_table_privilege('service_role', 'public.team_registrations', 'update')
  and not has_table_privilege('service_role', 'public.team_registrations', 'delete')
  and not has_table_privilege('service_role', 'public.team_registrations', 'truncate')
  and not has_table_privilege('service_role', 'public.team_registrations', 'references')
  and not has_table_privilege('service_role', 'public.team_registrations', 'trigger')
  and not has_table_privilege('service_role', 'public.free_agents', 'select')
  and not has_table_privilege('service_role', 'public.free_agents', 'update')
  and not has_table_privilege('service_role', 'public.free_agents', 'delete')
  and not has_table_privilege('service_role', 'public.free_agents', 'truncate')
  and not has_table_privilege('service_role', 'public.free_agents', 'references')
  and not has_table_privilege('service_role', 'public.free_agents', 'trigger')
);
select cvf_test.ok(
  'service role 04 every unrelated public table denies all table privileges',
  not exists (
    select 1
      from pg_catalog.pg_class relation
      join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
     where namespace.nspname = 'public'
       and relation.relkind in ('r', 'p', 'v', 'm', 'f')
       and relation.relname not in ('team_registrations', 'free_agents')
       and (
         has_table_privilege('service_role', relation.oid, 'select')
         or has_table_privilege('service_role', relation.oid, 'insert')
         or has_table_privilege('service_role', relation.oid, 'update')
         or has_table_privilege('service_role', relation.oid, 'delete')
         or has_table_privilege('service_role', relation.oid, 'truncate')
         or has_table_privilege('service_role', relation.oid, 'references')
         or has_table_privilege('service_role', relation.oid, 'trigger')
       )
  )
);
select cvf_test.ok(
  'service role 05 every public function denies execute',
  not exists (
    select 1
      from pg_catalog.pg_proc function
      join pg_catalog.pg_namespace namespace on namespace.oid = function.pronamespace
     where namespace.nspname = 'public'
       and has_function_privilege('service_role', function.oid, 'execute')
  )
);
select cvf_test.ok(
  'service role 06 every public sequence denies all sequence privileges',
  not exists (
    select 1
      from pg_catalog.pg_class sequence
      join pg_catalog.pg_namespace namespace on namespace.oid = sequence.relnamespace
     where namespace.nspname = 'public'
       and sequence.relkind = 'S'
       and (
         has_sequence_privilege('service_role', sequence.oid, 'usage')
         or has_sequence_privilege('service_role', sequence.oid, 'select')
         or has_sequence_privilege('service_role', sequence.oid, 'update')
       )
  )
);

select cvf_test.as_owner();

\echo ''
\echo 'pgtest results'
select
  n,
  case when ok then 'ok' else 'not ok' end as status,
  name,
  detail
from cvf_test.results
order by n;

select
  count(*)::int as total,
  count(*) filter (where ok)::int as passed,
  count(*) filter (where not ok)::int as failed
from cvf_test.results;

do $$
declare
  v_failed int;
begin
  select count(*) into v_failed from cvf_test.results where not ok;
  if v_failed <> 0 then
    raise exception '% pgtest assertion(s) failed', v_failed;
  end if;
end
$$;
