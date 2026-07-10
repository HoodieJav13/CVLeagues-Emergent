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

create or replace function cvf_test.as_anon()
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  set role anon;
end;
$$;

create or replace function cvf_test.as_user(p_user uuid)
returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', p_user::text, false);
  set role authenticated;
end;
$$;

create or replace function cvf_test.as_admin(p_user uuid)
returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', p_user::text, false);
  set role authenticated;
end;
$$;

create or replace function cvf_test.as_owner()
returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', '', false);
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

select cvf_test.lives_ok(
  'existing 08 anon can submit clean team registration',
  $$insert into public.team_registrations
    (captain_name, captain_phone, sport, team_name, preferred_season, consent_to_contact)
    values ('Anon Captain', '505-333-3333', 'kickball', 'Anon Team', 'Summer 2026', true)$$
);
select cvf_test.throws_ok(
  'existing 09 anon registration status must stay new',
  $$insert into public.team_registrations
    (captain_name, captain_phone, sport, team_name, preferred_season, consent_to_contact, status)
    values ('Anon Captain', '505-333-3334', 'kickball', 'Bad Team', 'Summer 2026', true, 'contacted')$$,
  '%violates row-level security%'
);
select cvf_test.throws_ok(
  'existing 10 anon registration consent required',
  $$insert into public.team_registrations
    (captain_name, captain_phone, sport, team_name, preferred_season, consent_to_contact)
    values ('Anon Captain', '505-333-3335', 'kickball', 'No Consent Team', 'Summer 2026', false)$$,
  null
);
select cvf_test.lives_ok(
  'existing 11 anon can submit clean free agent',
  $$insert into public.free_agents
    (first_name, last_name, email, sports, consent_to_contact)
    values ('Anon', 'Agent', 'anon-agent@cvf.test', array['kickball'], true)$$
);
select cvf_test.throws_ok(
  'existing 12 anon free agent status must stay new',
  $$insert into public.free_agents
    (first_name, last_name, email, sports, consent_to_contact, status)
    values ('Anon', 'Agent', 'bad-agent@cvf.test', array['kickball'], true, 'contacted')$$,
  '%violates row-level security%'
);
select cvf_test.throws_ok(
  'existing 13 anon free agent consent required',
  $$insert into public.free_agents
    (first_name, last_name, email, sports, consent_to_contact)
    values ('Anon', 'Agent', 'noconsent-agent@cvf.test', array['kickball'], false)$$,
  null
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
  'season2 14 hof unpublished anonymous read returns zero',
  (select count(*)::int from public.hof_entries),
  0
);
select cvf_test.as_user('00000000-0000-0000-0000-000000000002');
select cvf_test.eq_int(
  'season2 15 hof unpublished public-role read returns zero',
  (select count(*)::int from public.hof_entries),
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
  'season2 17 hof published public read returns rows',
  (select count(*)::int from public.hof_entries),
  1
);

-- ---------------------------------------------------------------------------
-- Charge-season hardening migration invariants (11 assertions).
-- ---------------------------------------------------------------------------
select cvf_test.as_admin('00000000-0000-0000-0000-000000000001');

insert into public.seasons (name, status)
values ('Fall 2026', 'upcoming');

insert into public.leagues (id, name, sport, season, description)
values (
  '20000000-0000-0000-0000-000000000101',
  'Fall Kickball League',
  'kickball',
  'Fall 2026',
  'Cross-season guard fixture'
);

insert into public.teams (id, league_id, name, sport, logo_color)
values (
  '30000000-0000-0000-0000-000000000101',
  '20000000-0000-0000-0000-000000000101',
  'Fall Kickball Team',
  'kickball',
  '#14B8A6'
);

select cvf_test.lives_ok(
  'charge season 01 matching-season team charge succeeds',
  $$insert into public.charges
      (id, season, team_id, amount_due_cents)
    values
      ('a0000000-0000-0000-0000-000000000101',
       'Summer 2026',
       '30000000-0000-0000-0000-000000000001',
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
       set season = 'Fall 2026'
     where id = '20000000-0000-0000-0000-000000000001'$$,
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
);
drop table public._cvf_default_privilege_test;

create function public._cvf_default_privilege_test()
returns void language sql as $$select$$;
select cvf_test.ok(
  'data api 33 future functions are not executable automatically',
  not has_function_privilege('anon', 'public._cvf_default_privilege_test()', 'execute')
  and not has_function_privilege('authenticated', 'public._cvf_default_privilege_test()', 'execute')
);
drop function public._cvf_default_privilege_test();

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
