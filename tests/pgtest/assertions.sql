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

-- Venue fixtures. Games carry a venue foreign key and a real start timestamp
-- since migration 29; the free-text date/time/location columns are gone.
insert into public.venues (id, name)
values
  ('60000000-0000-0000-0000-000000000001', 'Field 1'),
  ('60000000-0000-0000-0000-000000000002', 'Field 2'),
  ('60000000-0000-0000-0000-000000000003', 'Runtime Field'),
  ('60000000-0000-0000-0000-000000000004', 'Failure Field'),
  ('60000000-0000-0000-0000-000000000005', 'Race Field'),
  ('60000000-0000-0000-0000-000000000006', 'Championship Field'),
  ('60000000-0000-0000-0000-000000000007', 'Forfeit Field'),
  ('60000000-0000-0000-0000-000000000008', 'MFA bypass check'),
  ('60000000-0000-0000-0000-000000000009', 'Flag Test Field'),
  ('60000000-0000-0000-0000-000000000010', 'Ledger Test Field'),
  -- Sequence 5A's overtime fixtures arrived after this branch was written and
  -- named their own fields as free text. Migration 29 dropped that column, so
  -- each keeps a distinct venue rather than being collapsed onto a shared one.
  ('60000000-0000-0000-0000-000000000011', 'Kick OT Field'),
  ('60000000-0000-0000-0000-000000000012', 'Flag Pair Field'),
  ('60000000-0000-0000-0000-000000000013', 'Flag OT Field'),
  ('60000000-0000-0000-0000-000000000014', 'Flag Invalid OT Field');

insert into public.games (id, league_id, sport, home_team_id, away_team_id, starts_at, venue_id, status, score_status, home_score, away_score, periods)
values
  ('50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'kickball', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '2026-06-01 18:00:00-06'::timestamptz, '60000000-0000-0000-0000-000000000001', 'completed', 'approved', 7, 4, '{"home":[2,1,1,2,1],"away":[1,1,1,1,0]}'::jsonb),
  ('50000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'kickball', '30000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '2026-06-08 18:00:00-06'::timestamptz, '60000000-0000-0000-0000-000000000001', 'upcoming', 'pending', null, null, '{"home":[],"away":[]}'::jsonb),
  ('50000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'kickball', '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '2026-06-15 18:00:00-06'::timestamptz, '60000000-0000-0000-0000-000000000001', 'completed', 'final', 8, 5, '{"home":[2,2,2,1,1],"away":[1,1,1,1,1]}'::jsonb);

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
  'existing 14 [INV-04] direct game score update is privilege-blocked',
  $$update public.games
       set home_score = 9
     where id = '50000000-0000-0000-0000-000000000003'$$,
  '%permission denied%'
);
select cvf_test.throws_ok(
  'existing 15 [INV-30] legacy unlock RPC is retired',
  $$select public.unlock_game('50000000-0000-0000-0000-000000000003', '')$$,
  '%permission denied%'
);
select cvf_test.throws_ok(
  'existing 16 [INV-24] final correction requires a reason',
  $$select public.correct_final_score(
       '50000000-0000-0000-0000-000000000003',
       9, 5,
       '{"home":[3,2,2,1,1],"away":[1,1,1,1,1]}'::jsonb,
       '{
         "10000000-0000-0000-0000-000000000001":{"team_id":"30000000-0000-0000-0000-000000000001","stats":{"runs":9}},
         "10000000-0000-0000-0000-000000000002":{"team_id":"30000000-0000-0000-0000-000000000002","stats":{"runs":5}}
       }'::jsonb,
       '')$$,
  '%requires a reason%'
);
select cvf_test.lives_ok(
  'existing 17 [INV-24][INV-32] reasoned correction preserves final lock',
  $$select public.correct_final_score(
       '50000000-0000-0000-0000-000000000003',
       9, 5,
       '{"home":[3,2,2,1,1],"away":[1,1,1,1,1]}'::jsonb,
       '{
         "10000000-0000-0000-0000-000000000001":{"team_id":"30000000-0000-0000-0000-000000000001","stats":{"runs":9}},
         "10000000-0000-0000-0000-000000000002":{"team_id":"30000000-0000-0000-0000-000000000002","stats":{"runs":5}}
       }'::jsonb,
       'Correcting the official final')$$
);
select cvf_test.ok(
  'existing 18 [INV-32][INV-39] correction writes before/after audit and stays final',
  (select locked and score_status = 'final' and home_score = 9
     from public.games where id = '50000000-0000-0000-0000-000000000003')
  and exists (
    select 1 from public.game_edit_history
    where game_id = '50000000-0000-0000-0000-000000000003'
      and action = 'Final score corrected'
      and reason = 'Correcting the official final'
      and before_state ->> 'home_score' = '8'
      and after_state ->> 'home_score' = '9'
  )
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
      (league_id, sport, home_team_id, away_team_id, starts_at, venue_id, stage)
    values
      ('20000000-0000-0000-0000-000000000001', 'kickball',
       '30000000-0000-0000-0000-000000000001',
       '30000000-0000-0000-0000-000000000002',
       '2026-07-01 19:00:00-06'::timestamptz, '60000000-0000-0000-0000-000000000001', 'tournament')$$,
  '%reserved for standalone tournament%'
);
select cvf_test.lives_ok(
  'season2 02 tournament container accepts tournament stage',
  $$insert into public.games
      (id, league_id, sport, home_team_id, away_team_id, starts_at, venue_id, stage)
    values
      ('50000000-0000-0000-0000-000000000101',
       '20000000-0000-0000-0000-000000000003', 'kickball',
       '30000000-0000-0000-0000-000000000003',
       '30000000-0000-0000-0000-000000000004',
       '2026-07-02 19:00:00-06'::timestamptz, '60000000-0000-0000-0000-000000000002', 'tournament')$$
);
select cvf_test.throws_ok(
  'season2 03 tournament container rejects regular stage',
  $$insert into public.games
      (league_id, sport, home_team_id, away_team_id, starts_at, venue_id, stage)
    values
      ('20000000-0000-0000-0000-000000000003', 'kickball',
       '30000000-0000-0000-0000-000000000003',
       '30000000-0000-0000-0000-000000000004',
       '2026-07-03 19:00:00-06'::timestamptz, '60000000-0000-0000-0000-000000000002', 'regular')$$,
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
  $$select public.submit_score(
       '50000000-0000-0000-0000-000000000001', 1, 0,
       '{"home":[1],"away":[0]}'::jsonb, '{}'::jsonb, 'AAL1 bypass check')$$,
  '%Admin only%'
);
select cvf_test.throws_ok(
  'launch 03b linked AAL1 administrator cannot lock a game',
  $$select public.lock_game('50000000-0000-0000-0000-000000000001')$$,
  '%Admin only%'
);
select cvf_test.throws_ok(
  'launch 03c linked AAL1 administrator cannot correct a final score',
  $$select public.correct_final_score(
       '50000000-0000-0000-0000-000000000003', 9, 5,
       '{"home":[3,2,2,1,1],"away":[1,1,1,1,1]}'::jsonb,
       '{}'::jsonb, 'MFA bypass check', 'AAL1 bypass check')$$,
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
  $$select public.schedule_playoff_match('d0000000-0000-0000-0000-000000000001', '2099-07-14 19:00:00-06'::timestamptz, '60000000-0000-0000-0000-000000000008')$$,
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
      '2026-08-01 18:00:00-06'::timestamptz, '60000000-0000-0000-0000-000000000006'
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
  $$select public.submit_score(
      (select game_id from public.playoff_matches where game_id is not null limit 1),
      10, 4, '{"home":[10],"away":[4]}'::jsonb, '{}'::jsonb,
      'Bracket fixture records team totals only'
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
  'bracket 17 [INV-32] winner correction retracts and reapplies before downstream scheduling',
  $$select public.correct_final_score(
      (select game_id from public.playoff_matches where game_id is not null limit 1),
      4, 10, '{"home":[4],"away":[10]}'::jsonb, '{}'::jsonb,
      'Correcting the playoff winner', 'Bracket fixture records team totals only'
    )$$
);
select cvf_test.ok(
  'bracket 18 [INV-32] correction replaces downstream slot and source result atomically',
  exists (
    select 1 from public.playoff_matches source
    join public.playoff_matches destination on destination.id = source.winner_to_match_id
    where source.game_id is not null
      and source.status = 'completed'
      and source.winner_team_id is not null
      and source.loser_team_id is not null
      and (
        (source.winner_to_slot = 'home' and destination.home_team_id = source.winner_team_id and destination.home_seed is not null)
        or (source.winner_to_slot = 'away' and destination.away_team_id = source.winner_team_id and destination.away_seed is not null)
      )
  )
);
select cvf_test.lives_ok(
  'bracket setup schedules the corrected downstream match',
  $$select public.schedule_playoff_match(
      (select destination.id
       from public.playoff_matches source
       join public.playoff_matches destination on destination.id = source.winner_to_match_id
       where source.game_id is not null limit 1),
      '2026-08-08 18:00:00-06'::timestamptz, '60000000-0000-0000-0000-000000000006'
    )$$
);
select cvf_test.throws_ok(
  'bracket 19 [INV-32] winner-changing correction is blocked after downstream scheduling',
  $$select public.correct_final_score(
      (select game_id from public.playoff_matches
       where status = 'completed' and game_id is not null limit 1),
      11, 4, '{"home":[11],"away":[4]}'::jsonb, '{}'::jsonb,
      'Too late to retract safely', 'Bracket fixture records team totals only'
    )$$,
  '%[INV-32]%next playoff game is scheduled or completed%'
);
select cvf_test.ok(
  'bracket 20 [INV-32] blocked correction preserves the source result and lock',
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

-- ---------------------------------------------------------------------------
-- Sequence 2 aggregate scoring hardening and correction contract.
-- ---------------------------------------------------------------------------
select cvf_test.as_admin('00000000-0000-0000-0000-000000000001');
select cvf_test.ok(
  'aggregate 01 [INV-04][INV-38] authenticated grants expose schedule columns but no score/stat/history mutation',
  has_column_privilege('authenticated', 'public.games', 'starts_at', 'update')
  and has_column_privilege('authenticated', 'public.games', 'venue_id', 'update')
  and not has_column_privilege('authenticated', 'public.games', 'home_score', 'update')
  and not has_column_privilege('authenticated', 'public.games', 'periods', 'update')
  and not has_table_privilege('authenticated', 'public.player_stats', 'insert')
  and not has_table_privilege('authenticated', 'public.player_stats', 'update')
  and not has_table_privilege('authenticated', 'public.player_stats', 'delete')
  and not has_table_privilege('authenticated', 'public.game_edit_history', 'insert')
);
select cvf_test.throws_ok(
  'aggregate 02 [INV-04] AAL2 admin direct player-stat insert is denied',
  $$insert into public.player_stats (game_id, profile_id, team_id, sport, stats)
    values (
      '50000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000001',
      'kickball', '{"runs":1}'::jsonb
    )$$,
  '%permission denied%'
);
select cvf_test.throws_ok(
  'aggregate 03 [INV-38] AAL2 admin direct history insert is denied',
  $$insert into public.game_edit_history (game_id, action)
    values ('50000000-0000-0000-0000-000000000002', 'Bypass')$$,
  '%permission denied%'
);
select cvf_test.ok(
  'aggregate 04 [INV-19][INV-30] only hardened scoring RPCs remain client-executable',
  has_function_privilege('authenticated', 'public.submit_score(uuid,integer,integer,jsonb,jsonb,text)', 'execute')
  and has_function_privilege('authenticated', 'public.correct_final_score(uuid,integer,integer,jsonb,jsonb,text,text)', 'execute')
  and not has_function_privilege('authenticated', 'public.save_score(uuid,integer,integer,jsonb,jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.unlock_game(uuid,text)', 'execute')
);

select cvf_test.as_user('00000000-0000-0000-0000-000000000002');
select cvf_test.throws_ok(
  'aggregate 05 [INV-19] authenticated non-admin cannot submit score',
  $$select public.submit_score(
      '50000000-0000-0000-0000-000000000002', 2, 1,
      '{"home":[2],"away":[1]}'::jsonb, '{}'::jsonb, 'not authorized')$$,
  '%Admin only%'
);
select cvf_test.as_anon();
select cvf_test.throws_ok(
  'aggregate 06 [INV-19] anonymous caller cannot execute submit score',
  $$select public.submit_score(
      '50000000-0000-0000-0000-000000000002', 2, 1,
      '{"home":[2],"away":[1]}'::jsonb, '{}'::jsonb, 'not authorized')$$,
  '%permission denied%'
);

select cvf_test.as_admin('00000000-0000-0000-0000-000000000001');
select cvf_test.throws_ok(
  'aggregate 07 [INV-01][INV-03] HARD kickball period mismatch names values',
  $$select public.submit_score(
      '50000000-0000-0000-0000-000000000002', 2, 1,
      '{"home":[1],"away":[1]}'::jsonb, '{}'::jsonb, 'not reached')$$,
  '%[INV-01]%period sum 1 does not equal entered score 2%'
);
select cvf_test.throws_ok(
  'aggregate 08 [INV-08] HARD regular-season kickball tie is rejected',
  $$select public.submit_score(
      '50000000-0000-0000-0000-000000000002', 3, 3,
      '{"home":[1,2],"away":[2,1]}'::jsonb,
      '{
        "10000000-0000-0000-0000-000000000002":{"team_id":"30000000-0000-0000-0000-000000000002","stats":{"runs":3}},
        "10000000-0000-0000-0000-000000000001":{"team_id":"30000000-0000-0000-0000-000000000001","stats":{"runs":3}}
      }'::jsonb)$$,
  '%[INV-08]%Season 1 final scores cannot be tied%3-3%'
);
select cvf_test.throws_ok(
  'aggregate 09 [INV-05] SOFT kickball mismatch requires override reason',
  $$select public.submit_score(
      '50000000-0000-0000-0000-000000000002', 2, 1,
      '{"home":[2],"away":[1]}'::jsonb,
      '{
        "10000000-0000-0000-0000-000000000002":{"team_id":"30000000-0000-0000-0000-000000000002","stats":{"runs":1}},
        "10000000-0000-0000-0000-000000000001":{"team_id":"30000000-0000-0000-0000-000000000001","stats":{"runs":1}}
      }'::jsonb)$$,
  '%SOFT validation requires an override reason%'
);
select cvf_test.lives_ok(
  'aggregate 10 [INV-05] SOFT kickball mismatch saves with recorded override',
  $$select public.submit_score(
      '50000000-0000-0000-0000-000000000002', 2, 1,
      '{"home":[2],"away":[1]}'::jsonb,
      '{
        "10000000-0000-0000-0000-000000000002":{"team_id":"30000000-0000-0000-0000-000000000002","stats":{"runs":1}},
        "10000000-0000-0000-0000-000000000001":{"team_id":"30000000-0000-0000-0000-000000000001","stats":{"runs":1}}
      }'::jsonb,
      'Official book includes one unassigned home run')$$
);
select cvf_test.ok(
  'aggregate 11 [INV-05][INV-37] override reason and warning are audit output',
  exists (
    select 1 from public.game_edit_history
    where game_id = '50000000-0000-0000-0000-000000000002'
      and override_reason = 'Official book includes one unassigned home run'
      and jsonb_array_length(validation_warnings) > 0
      and validation_warnings -> 0 ->> 'invId' = 'INV-05'
  )
);
select public.lock_game('50000000-0000-0000-0000-000000000002');
select cvf_test.throws_ok(
  'aggregate 12 [INV-24] correction RPC rejects a blank reason',
  $$select public.correct_final_score(
      '50000000-0000-0000-0000-000000000002', 3, 1,
      '{"home":[3],"away":[1]}'::jsonb,
      '{
        "10000000-0000-0000-0000-000000000002":{"team_id":"30000000-0000-0000-0000-000000000002","stats":{"runs":3}},
        "10000000-0000-0000-0000-000000000001":{"team_id":"30000000-0000-0000-0000-000000000001","stats":{"runs":1}}
      }'::jsonb,
      '   ')$$,
  '%requires a reason%'
);
select cvf_test.lives_ok(
  'aggregate 13 [INV-24][INV-32] correction commits score stats history and lock atomically',
  $$select public.correct_final_score(
      '50000000-0000-0000-0000-000000000002', 3, 1,
      '{"home":[3],"away":[1]}'::jsonb,
      '{
        "10000000-0000-0000-0000-000000000002":{"team_id":"30000000-0000-0000-0000-000000000002","stats":{"runs":3}},
        "10000000-0000-0000-0000-000000000001":{"team_id":"30000000-0000-0000-0000-000000000001","stats":{"runs":1}}
      }'::jsonb,
      'Official correction after review')$$
);
select cvf_test.ok(
  'aggregate 14 [INV-32][INV-37] completed correction exposes immutable before and after audit',
  (select locked and score_status = 'final' and home_score = 3 and away_score = 1
     from public.games where id = '50000000-0000-0000-0000-000000000002')
  and exists (
    select 1 from public.game_edit_history
    where game_id = '50000000-0000-0000-0000-000000000002'
      and action = 'Final score corrected'
      and reason = 'Official correction after review'
      and before_state ->> 'home_score' = '2'
      and after_state ->> 'home_score' = '3'
  )
);

select cvf_test.as_owner();
insert into public.team_players (team_id, profile_id, season, roster_status)
values
  ('30000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000004', 'Summer 2026', 'eligible'),
  ((select id from public.teams
     where league_id = '20000000-0000-0000-0000-000000000002'
       and id <> '30000000-0000-0000-0000-000000000005'
     order by created_at limit 1),
   '10000000-0000-0000-0000-000000000001', 'Summer 2026', 'eligible');
insert into public.games
  (id, league_id, sport, home_team_id, away_team_id, starts_at, venue_id)
values
  ('50000000-0000-0000-0000-000000000501',
   '20000000-0000-0000-0000-000000000002', 'flag_football',
   '30000000-0000-0000-0000-000000000005',
   (select id from public.teams
    where league_id = '20000000-0000-0000-0000-000000000002'
      and id <> '30000000-0000-0000-0000-000000000005'
    order by created_at limit 1),
   '2026-09-01 19:00:00-06'::timestamptz, '60000000-0000-0000-0000-000000000009');

select cvf_test.as_admin('00000000-0000-0000-0000-000000000001');
select cvf_test.throws_ok(
  'aggregate 15 [INV-10] HARD flag period structure rejects a non-four-quarter final',
  $$select public.submit_score(
      '50000000-0000-0000-0000-000000000501', 8, 0,
      '{"home":[8],"away":[0]}'::jsonb, '{}'::jsonb, 'not reached')$$,
  '%[INV-10]%four quarters%'
);
select cvf_test.throws_ok(
  'aggregate 16 [INV-06] SOFT flag point mismatch requires override reason',
  $$select public.submit_score(
      '50000000-0000-0000-0000-000000000501', 8, 0,
      '{"home":[8,0,0,0],"away":[0,0,0,0]}'::jsonb,
      jsonb_build_object(
        '10000000-0000-0000-0000-000000000004', jsonb_build_object(
          'team_id', '30000000-0000-0000-0000-000000000005',
          'stats', jsonb_build_object('tds', 1)
        )
      ))$$,
  '%SOFT validation requires an override reason%'
);
select cvf_test.lives_ok(
  'aggregate 17 [INV-06] SOFT flag mismatch saves with recorded override',
  $$select public.submit_score(
      '50000000-0000-0000-0000-000000000501', 8, 0,
      '{"home":[8,0,0,0],"away":[0,0,0,0]}'::jsonb,
      jsonb_build_object(
        '10000000-0000-0000-0000-000000000004', jsonb_build_object(
          'team_id', '30000000-0000-0000-0000-000000000005',
          'stats', jsonb_build_object('tds', 1)
        )
      ),
      'Official sheet includes an unattributed conversion')$$
);
select cvf_test.lives_ok(
  'aggregate 18 [INV-03][INV-13] signed yardage and player safety pass HARD validation',
  $$select public.submit_score(
      '50000000-0000-0000-0000-000000000501', 2, 0,
      '{"home":[0,2,0,0],"away":[0,0,0,0]}'::jsonb,
      jsonb_build_object(
        '10000000-0000-0000-0000-000000000004', jsonb_build_object(
          'team_id', '30000000-0000-0000-0000-000000000005',
          'stats', jsonb_build_object('passYards', -4, 'recYards', -4, 'safeties', 1)
        )
      ))$$
);

-- ---------------------------------------------------------------------------
-- Sequence 3 Event Ledger Lite: dormant schema and authority boundaries.
-- ---------------------------------------------------------------------------
select cvf_test.as_owner();
select cvf_test.ok(
  'ledger schema 01 [INV-28] existing games backfill to aggregate mode',
  not exists (select 1 from public.games where scorekeeping_mode <> 'aggregate')
);
select cvf_test.ok(
  'ledger schema 02 [INV-04] authenticated clients have no ledger table writes',
  not exists (
    select 1
      from unnest(array[
        'public.scorekeeping_sessions',
        'public.scorekeeping_participants',
        'public.scorekeeping_events',
        'public.scorekeeping_event_attributions'
      ]) relation(name)
     where has_table_privilege('authenticated', relation.name, 'insert')
        or has_table_privilege('authenticated', relation.name, 'update')
        or has_table_privilege('authenticated', relation.name, 'delete')
        or has_table_privilege('authenticated', relation.name, 'truncate')
        or has_table_privilege('authenticated', relation.name, 'references')
        or has_table_privilege('authenticated', relation.name, 'trigger')
  )
  and not has_column_privilege(
    'authenticated', 'public.games', 'scorekeeping_mode', 'update'
  )
);
select cvf_test.ok(
  'ledger schema 03 [INV-04] ledger trigger helpers are not client executable',
  not exists (
    select 1
      from pg_proc procedure
      join pg_namespace namespace on namespace.oid = procedure.pronamespace
     where namespace.nspname = 'public'
       and procedure.proname like 'cvf_%scorekeeping%'
       and (
         has_function_privilege('anon', procedure.oid, 'execute')
         or has_function_privilege('authenticated', procedure.oid, 'execute')
         or has_function_privilege('service_role', procedure.oid, 'execute')
       )
  )
);

select cvf_test.as_anon();
select cvf_test.throws_ok(
  'ledger schema 04 [INV-27] anonymous sessions read is privilege-blocked',
  $$select count(*) from public.scorekeeping_sessions$$,
  '%permission denied%'
);
select cvf_test.throws_ok(
  'ledger schema 05 [INV-27] anonymous events read is privilege-blocked',
  $$select count(*) from public.scorekeeping_events$$,
  '%permission denied%'
);

select cvf_test.as_user('00000000-0000-0000-0000-000000000002');
select cvf_test.eq_int(
  'ledger schema 06 [INV-19][INV-27] non-admin ledger reads are RLS-empty',
  (select count(*)::int from public.scorekeeping_sessions),
  0
);

select cvf_test.as_owner();
insert into public.games
  (id, league_id, sport, home_team_id, away_team_id, starts_at, venue_id)
values
  ('50000000-0000-0000-0000-000000000900',
   '20000000-0000-0000-0000-000000000001', 'kickball',
   '30000000-0000-0000-0000-000000000001',
   '30000000-0000-0000-0000-000000000002',
   '2026-10-01 18:00:00-06'::timestamptz, '60000000-0000-0000-0000-000000000010');

select cvf_test.throws_ok(
  'ledger schema 07 [INV-29] owner cannot bypass the controlled mode flag',
  $$update public.games set scorekeeping_mode = 'ledger'
    where id = '50000000-0000-0000-0000-000000000900'$$,
  '%controlled server path%'
);
select set_config('cvf.ledger_transition', 'on', false);
select cvf_test.throws_ok(
  'ledger schema 08 [INV-29] scored aggregate game cannot convert',
  $$update public.games set scorekeeping_mode = 'ledger'
    where id = '50000000-0000-0000-0000-000000000001'$$,
  '%unscored, pending, unlocked%'
);
select cvf_test.lives_ok(
  'ledger schema 09 [INV-29] clean game converts aggregate to ledger once',
  $$update public.games set scorekeeping_mode = 'ledger'
    where id = '50000000-0000-0000-0000-000000000900'$$
);
select cvf_test.ok(
  'ledger schema 10 [INV-28][INV-29] conversion records mode and timestamp',
  (select scorekeeping_mode = 'ledger' and ledger_enabled_at is not null
     from public.games where id = '50000000-0000-0000-0000-000000000900')
);
select cvf_test.throws_ok(
  'ledger schema 11 [INV-29] ledger game cannot return to aggregate',
  $$update public.games set scorekeeping_mode = 'aggregate'
    where id = '50000000-0000-0000-0000-000000000900'$$,
  '%aggregate-to-ledger only%'
);
select set_config('cvf.ledger_transition', '', false);

select cvf_test.as_admin('00000000-0000-0000-0000-000000000001');
select cvf_test.throws_ok(
  'ledger schema 12 [INV-30][INV-39] aggregate submit RPC cannot mutate a ledger game',
  $$select public.submit_score(
      '50000000-0000-0000-0000-000000000900', 1, 0,
      '{"home":[1],"away":[0]}'::jsonb, '{}'::jsonb,
      'Test-only unattributed run')$$,
  '%Ledger projections may change only through ledger finalization%'
);
select cvf_test.ok(
  'ledger schema 13 [INV-30] rejected aggregate RPC leaves ledger game unscored',
  (select status = 'upcoming' and score_status = 'pending'
          and home_score is null and away_score is null and not locked
     from public.games where id = '50000000-0000-0000-0000-000000000900')
);

select cvf_test.as_owner();
select cvf_test.throws_ok(
  'ledger schema 14 [INV-04] owner session insert requires controlled flag',
  $$insert into public.scorekeeping_sessions (
      id, game_id, session_kind, status, opened_by,
      lease_token_hash, lease_expires_at, sport, league_id, season, stage,
      home_team_id, away_team_id, rule_version, regulation_period_count,
      overtime_start_setting, allow_ties, rules_snapshot
    ) values (
      'a0000000-0000-0000-0000-000000000900',
      '50000000-0000-0000-0000-000000000900', 'ordinary', 'open',
      '00000000-0000-0000-0000-000000000003', 'hash-ordinary', now() + interval '5 minutes',
      'kickball', '20000000-0000-0000-0000-000000000001', 'Summer 2026', 'regular',
      '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002',
      'CVF-KB-2026.1', 7, null, false, '{"mercy":false}'::jsonb
    )$$,
  '%controlled server path%'
);

select set_config('cvf.ledger_session_mutation', 'on', false);
select cvf_test.lives_ok(
  'ledger schema 15 [INV-10][INV-18] controlled ordinary session snapshots game rules',
  $$insert into public.scorekeeping_sessions (
      id, game_id, session_kind, status, opened_by,
      lease_token_hash, lease_expires_at, sport, league_id, season, stage,
      home_team_id, away_team_id, rule_version, regulation_period_count,
      overtime_start_setting, allow_ties, rules_snapshot
    ) values (
      'a0000000-0000-0000-0000-000000000900',
      '50000000-0000-0000-0000-000000000900', 'ordinary', 'open',
      '00000000-0000-0000-0000-000000000003', 'hash-ordinary', now() + interval '5 minutes',
      'kickball', '20000000-0000-0000-0000-000000000001', 'Summer 2026', 'regular',
      '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002',
      'CVF-KB-2026.1', 7, null, false, '{"mercy":false}'::jsonb
    )$$
);
select cvf_test.throws_ok(
  'ledger schema 16 [INV-18] a game cannot have two active sessions',
  $$insert into public.scorekeeping_sessions (
      game_id, session_kind, status, opened_by,
      lease_token_hash, lease_expires_at, sport, league_id, season, stage,
      home_team_id, away_team_id, rule_version, regulation_period_count,
      allow_ties, rules_snapshot
    ) values (
      '50000000-0000-0000-0000-000000000900', 'ordinary', 'open',
      '00000000-0000-0000-0000-000000000003', 'hash-duplicate', now() + interval '5 minutes',
      'kickball', '20000000-0000-0000-0000-000000000001', 'Summer 2026', 'regular',
      '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002',
      'CVF-KB-2026.1', 7, false, '{"mercy":false}'::jsonb
    )$$,
  '%duplicate key%'
);

update public.team_players
   set roster_status = 'eligible'
 where id in (
   '40000000-0000-0000-0000-000000000001',
   '40000000-0000-0000-0000-000000000002'
 );
select cvf_test.lives_ok(
  'ledger schema 17 [INV-11] ordinary session snapshots both eligible rosters',
  $$insert into public.scorekeeping_participants (session_id, source_team_player_id)
    values
      ('a0000000-0000-0000-0000-000000000900', '40000000-0000-0000-0000-000000000001'),
      ('a0000000-0000-0000-0000-000000000900', '40000000-0000-0000-0000-000000000002')$$
);
select cvf_test.ok(
  'ledger schema 18 [INV-11] participant identity is server-copied from roster and profile',
  (select count(*) = 2
          and min(roster_status) = 'eligible'
          and bool_and(length(display_name) > 0)
     from public.scorekeeping_participants
    where session_id = 'a0000000-0000-0000-0000-000000000900')
);
select cvf_test.throws_ok(
  'ledger schema 19 [INV-10] session rule snapshots cannot be rewritten',
  $$update public.scorekeeping_sessions
       set regulation_period_count = 5, lease_version = 2
     where id = 'a0000000-0000-0000-0000-000000000900'$$,
  '%snapshots are immutable%'
);
select cvf_test.throws_ok(
  'ledger schema 20 [INV-12] participant snapshots are append-only',
  $$update public.scorekeeping_participants set jersey_number = 99
    where session_id = 'a0000000-0000-0000-0000-000000000900'$$,
  '%append-only%'
);
select set_config('cvf.ledger_session_mutation', '', false);

select cvf_test.throws_ok(
  'ledger schema 21 [INV-04] event insert requires controlled flag',
  $$insert into public.scorekeeping_events (
      session_id, idempotency_key, command_hash, action, event_type,
      period_type, period_number, credited_team_id, points, created_by
    ) values (
      'a0000000-0000-0000-0000-000000000900', 'evt-1', 'hash-1', 'record', 'run',
      'regulation', 1, '30000000-0000-0000-0000-000000000001', 1,
      '00000000-0000-0000-0000-000000000003'
    )$$,
  '%controlled server path%'
);
select set_config('cvf.ledger_event_write', 'on', false);
select cvf_test.throws_ok(
  'ledger schema 22 [INV-14] clients of the server path cannot select a sequence',
  $$insert into public.scorekeeping_events (
      session_id, sequence_number, idempotency_key, command_hash, action, event_type,
      period_type, period_number, credited_team_id, points, created_by
    ) values (
      'a0000000-0000-0000-0000-000000000900', 9, 'evt-manual', 'hash-manual', 'record', 'run',
      'regulation', 1, '30000000-0000-0000-0000-000000000001', 1,
      '00000000-0000-0000-0000-000000000003'
    )$$,
  '%assigned by the server%'
);
select cvf_test.lives_ok(
  'ledger schema 23 [INV-14][INV-15] first event receives server sequence one',
  $$insert into public.scorekeeping_events (
      id, session_id, idempotency_key, command_hash, action, event_type,
      period_type, period_number, credited_team_id, points, created_by
    ) values (
      'b0000000-0000-0000-0000-000000000901',
      'a0000000-0000-0000-0000-000000000900', 'evt-1', 'hash-1', 'record', 'run',
      'regulation', 1, '30000000-0000-0000-0000-000000000001', 1,
      '00000000-0000-0000-0000-000000000003'
    )$$
);
select cvf_test.lives_ok(
  'ledger schema 24 [INV-14] second event receives the next game sequence',
  $$insert into public.scorekeeping_events (
      id, session_id, idempotency_key, command_hash, action, event_type,
      period_type, period_number, credited_team_id, points, created_by
    ) values (
      'b0000000-0000-0000-0000-000000000902',
      'a0000000-0000-0000-0000-000000000900', 'evt-2', 'hash-2', 'record', 'run',
      'regulation', 1, '30000000-0000-0000-0000-000000000002', 1,
      '00000000-0000-0000-0000-000000000003'
    )$$
);
select cvf_test.ok(
  'ledger schema 25 [INV-14] ordinary event sequence is gapless',
  (select array_agg(sequence_number order by sequence_number) = array[1,2]
     from public.scorekeeping_events
    where game_id = '50000000-0000-0000-0000-000000000900')
);
select cvf_test.throws_ok(
  'ledger schema 26 [INV-15] idempotency keys are unique across the game',
  $$insert into public.scorekeeping_events (
      session_id, idempotency_key, command_hash, action, event_type,
      period_type, period_number, credited_team_id, points, created_by
    ) values (
      'a0000000-0000-0000-0000-000000000900', 'evt-1', 'changed-hash', 'record', 'run',
      'regulation', 2, '30000000-0000-0000-0000-000000000001', 1,
      '00000000-0000-0000-0000-000000000003'
    )$$,
  '%duplicate key%'
);
select cvf_test.throws_ok(
  'ledger schema 27 [INV-02][INV-10] event cannot exceed snapshotted regulation count',
  $$insert into public.scorekeeping_events (
      session_id, idempotency_key, command_hash, action, event_type,
      period_type, period_number, credited_team_id, points, created_by
    ) values (
      'a0000000-0000-0000-0000-000000000900', 'evt-period-8', 'hash-period-8', 'record', 'run',
      'regulation', 8, '30000000-0000-0000-0000-000000000001', 1,
      '00000000-0000-0000-0000-000000000003'
    )$$,
  '%exceeds the snapshotted count%'
);
select cvf_test.throws_ok(
  'ledger schema 28 [INV-16] ordinary sessions cannot void events',
  $$insert into public.scorekeeping_events (
      session_id, idempotency_key, command_hash, action, event_type,
      points, voids_event_id, created_by
    ) values (
      'a0000000-0000-0000-0000-000000000900', 'evt-void-ordinary', 'hash-void-ordinary',
      'void', 'void', 0, 'b0000000-0000-0000-0000-000000000901',
      '00000000-0000-0000-0000-000000000003'
    )$$,
  '%require a correction session%'
);
select cvf_test.lives_ok(
  'ledger schema 29 [INV-11][INV-13] event attribution uses a snapshotted participant',
  $$insert into public.scorekeeping_event_attributions (
      event_id, participant_id, role, stat_key, stat_delta, created_by
    ) values (
      'b0000000-0000-0000-0000-000000000901',
      (select id from public.scorekeeping_participants
        where session_id = 'a0000000-0000-0000-0000-000000000900'
          and profile_id = '10000000-0000-0000-0000-000000000001'),
      'scorer', 'runs', 1, '00000000-0000-0000-0000-000000000003'
    )$$
);
select cvf_test.throws_ok(
  'ledger schema 30 [INV-11] event attribution rejects a non-snapshot participant',
  $$insert into public.scorekeeping_event_attributions (
      event_id, participant_id, role, stat_key, stat_delta, created_by
    ) values (
      'b0000000-0000-0000-0000-000000000901', gen_random_uuid(),
      'scorer', 'runs', 1, '00000000-0000-0000-0000-000000000003'
    )$$,
  '%outside the event session snapshot%'
);
select cvf_test.throws_ok(
  'ledger schema 31 [INV-36] original events cannot be rewritten',
  $$update public.scorekeeping_events set points = 2
    where id = 'b0000000-0000-0000-0000-000000000901'$$,
  '%append-only%'
);
select cvf_test.throws_ok(
  'ledger schema 32 [INV-36] original events cannot be deleted',
  $$delete from public.scorekeeping_events
    where id = 'b0000000-0000-0000-0000-000000000901'$$,
  '%append-only%'
);
select set_config('cvf.ledger_event_write', '', false);

select set_config('cvf.ledger_session_mutation', 'on', false);
select cvf_test.throws_ok(
  'ledger schema 33 [INV-12] participants cannot be appended after the first event',
  $$insert into public.scorekeeping_participants (session_id, source_team_player_id)
    values ('a0000000-0000-0000-0000-000000000900', '40000000-0000-0000-0000-000000000001')$$,
  '%cannot grow after the first event%'
);
select cvf_test.lives_ok(
  'ledger schema 34 [INV-20] controlled session finalization advances version and closes',
  $$update public.scorekeeping_sessions
       set status = 'finalized', lease_version = 2,
           closed_by = '00000000-0000-0000-0000-000000000003', closed_at = now()
     where id = 'a0000000-0000-0000-0000-000000000900'$$
);
select set_config('cvf.ledger_session_mutation', '', false);
select set_config('cvf.ledger_event_write', 'on', false);
select cvf_test.throws_ok(
  'ledger schema 35 [INV-20] finalized session rejects new events',
  $$insert into public.scorekeeping_events (
      session_id, idempotency_key, command_hash, action, event_type,
      period_type, period_number, credited_team_id, points, created_by
    ) values (
      'a0000000-0000-0000-0000-000000000900', 'evt-closed', 'hash-closed', 'record', 'run',
      'regulation', 2, '30000000-0000-0000-0000-000000000001', 1,
      '00000000-0000-0000-0000-000000000003'
    )$$,
  '%active ledger session%'
);
select set_config('cvf.ledger_event_write', '', false);

-- Test-only projection advances the dormant ledger fixture to the exact state
-- a future Sequence 4 finalizer must produce; no client-facing path is added.
select set_config('cvf.ledger_projection', 'on', false);
update public.games
   set status = 'completed', score_status = 'final', locked = true,
       home_score = 1, away_score = 1,
       periods = '{"home":[1,0,0,0,0,0,0],"away":[1,0,0,0,0,0,0]}'::jsonb
 where id = '50000000-0000-0000-0000-000000000900';
select set_config('cvf.ledger_projection', '', false);

select cvf_test.as_admin('00000000-0000-0000-0000-000000000001');
select cvf_test.throws_ok(
  'ledger schema 36 [INV-30] aggregate correction cannot govern a ledger final',
  $$select public.correct_final_score(
      '50000000-0000-0000-0000-000000000900', 2, 1,
      '{"home":[2],"away":[1]}'::jsonb, '{}'::jsonb,
      'Wrong authority', 'Test-only unattributed runs')$$,
  '%Ledger projections may change only through ledger finalization%'
);

select cvf_test.as_owner();
select set_config('cvf.ledger_session_mutation', 'on', false);
select cvf_test.lives_ok(
  'ledger schema 37 [INV-10][INV-18][INV-24] correction session preserves base snapshot',
  $$insert into public.scorekeeping_sessions (
      id, game_id, session_kind, status, base_session_id, correction_reason,
      opened_by, lease_token_hash, lease_expires_at, sport, league_id, season, stage,
      home_team_id, away_team_id, rule_version, regulation_period_count,
      overtime_start_setting, allow_ties, rules_snapshot
    ) values (
      'a0000000-0000-0000-0000-000000000901',
      '50000000-0000-0000-0000-000000000900', 'correction', 'drafting',
      'a0000000-0000-0000-0000-000000000900', 'Official scorer correction',
      '00000000-0000-0000-0000-000000000003', 'hash-correction', now() + interval '5 minutes',
      'kickball', '20000000-0000-0000-0000-000000000001', 'Summer 2026', 'regular',
      '30000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002',
      'CVF-KB-2026.1', 7, null, false, '{"mercy":false}'::jsonb
    )$$
);
update public.team_players
   set jersey_number = 77, roster_status = 'inactive'
 where id = '40000000-0000-0000-0000-000000000001';
select cvf_test.lives_ok(
  'ledger schema 38 [INV-12] correction participants clone the original snapshot',
  $$insert into public.scorekeeping_participants (session_id, source_participant_id)
    select 'a0000000-0000-0000-0000-000000000901', participant.id
      from public.scorekeeping_participants participant
     where participant.session_id = 'a0000000-0000-0000-0000-000000000900'$$
);
select cvf_test.ok(
  'ledger schema 39 [INV-12] later roster changes do not rewrite correction eligibility',
  (select jersey_number = 1 and roster_status = 'eligible'
     from public.scorekeeping_participants
    where session_id = 'a0000000-0000-0000-0000-000000000901'
      and profile_id = '10000000-0000-0000-0000-000000000001')
);
select set_config('cvf.ledger_session_mutation', '', false);

select set_config('cvf.ledger_event_write', 'on', false);
select cvf_test.lives_ok(
  'ledger schema 40 [INV-16] correction appends a void of an ordinary event',
  $$insert into public.scorekeeping_events (
      id, session_id, idempotency_key, command_hash, action, event_type,
      points, voids_event_id, created_by
    ) values (
      'b0000000-0000-0000-0000-000000000903',
      'a0000000-0000-0000-0000-000000000901', 'evt-void-1', 'hash-void-1',
      'void', 'void', 0, 'b0000000-0000-0000-0000-000000000901',
      '00000000-0000-0000-0000-000000000003'
    )$$
);
select cvf_test.lives_ok(
  'ledger schema 41 [INV-17] replacement follows this session void',
  $$insert into public.scorekeeping_events (
      id, session_id, idempotency_key, command_hash, action, event_type,
      period_type, period_number, credited_team_id, points,
      replaces_event_id, created_by
    ) values (
      'b0000000-0000-0000-0000-000000000904',
      'a0000000-0000-0000-0000-000000000901', 'evt-replace-1', 'hash-replace-1',
      'replace', 'run', 'regulation', 1,
      '30000000-0000-0000-0000-000000000001', 2,
      'b0000000-0000-0000-0000-000000000901',
      '00000000-0000-0000-0000-000000000003'
    )$$
);
select cvf_test.throws_ok(
  'ledger schema 42 [INV-16] an original event cannot be voided twice',
  $$insert into public.scorekeeping_events (
      session_id, idempotency_key, command_hash, action, event_type,
      points, voids_event_id, created_by
    ) values (
      'a0000000-0000-0000-0000-000000000901', 'evt-void-fork', 'hash-void-fork',
      'void', 'void', 0, 'b0000000-0000-0000-0000-000000000901',
      '00000000-0000-0000-0000-000000000003'
    )$$,
  '%duplicate key%'
);
select cvf_test.throws_ok(
  'ledger schema 43 [INV-17] replacement cannot precede its matching void',
  $$insert into public.scorekeeping_events (
      session_id, idempotency_key, command_hash, action, event_type,
      period_type, period_number, credited_team_id, points,
      replaces_event_id, created_by
    ) values (
      'a0000000-0000-0000-0000-000000000901', 'evt-replace-no-void', 'hash-no-void',
      'replace', 'run', 'regulation', 1,
      '30000000-0000-0000-0000-000000000002', 2,
      'b0000000-0000-0000-0000-000000000902',
      '00000000-0000-0000-0000-000000000003'
    )$$,
  '%must follow this correction session%'
);
select cvf_test.ok(
  'ledger schema 44 [INV-14][INV-16][INV-17] correction rows preserve one gapless game sequence',
  (select array_agg(sequence_number order by sequence_number) = array[1,2,3,4]
     from public.scorekeeping_events
    where game_id = '50000000-0000-0000-0000-000000000900')
);
select set_config('cvf.ledger_event_write', '', false);

delete from auth.users where id = '00000000-0000-0000-0000-000000000003';
select cvf_test.ok(
  'ledger schema 45 actor deletion nulls attribution without rewriting evidence',
  exists (
    select 1 from public.scorekeeping_sessions
     where id = 'a0000000-0000-0000-0000-000000000900'
       and opened_by is null and closed_by is null
  )
  and exists (
    select 1 from public.scorekeeping_events
     where id = 'b0000000-0000-0000-0000-000000000901'
       and created_by is null and points = 1
  )
  and exists (
    select 1 from public.scorekeeping_event_attributions
     where event_id = 'b0000000-0000-0000-0000-000000000901'
       and created_by is null and stat_key = 'runs' and stat_delta = 1
  )
);

select cvf_test.as_admin('00000000-0000-0000-0000-000000000001');
select cvf_test.eq_int(
  'ledger schema 46 [INV-19][INV-27] AAL2 admin can inspect private sessions',
  (select count(*)::int from public.scorekeeping_sessions
    where game_id = '50000000-0000-0000-0000-000000000900'),
  2
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

-- ---------------------------------------------------------------------------
-- Sequence 4A-4C controlled runtime, projection, and correction authority.
-- ---------------------------------------------------------------------------
select cvf_test.as_owner();
update public.team_players set roster_status = 'eligible'
 where id in ('40000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002');
insert into public.games (id, league_id, sport, home_team_id, away_team_id, starts_at, venue_id)
values
 ('50000000-0000-0000-0000-000000000950','20000000-0000-0000-0000-000000000001','kickball',
  '30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','2026-10-08 18:00:00-06'::timestamptz, '60000000-0000-0000-0000-000000000003'),
 ('50000000-0000-0000-0000-000000000951','20000000-0000-0000-0000-000000000001','kickball',
  '30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','2026-10-15 18:00:00-06'::timestamptz, '60000000-0000-0000-0000-000000000007');
create table cvf_test.ledger_runtime_state (key text primary key, value jsonb not null);
grant select, insert, update on cvf_test.ledger_runtime_state to authenticated;

select cvf_test.as_admin_aal1('00000000-0000-0000-0000-000000000001');
select cvf_test.throws_ok(
  'ledger runtime 01 [INV-19] AAL1 admin cannot start a session',
  $$select public.start_scorekeeping_session('50000000-0000-0000-0000-000000000950','CVF-KB-2026.1',5,null,false,'{}')$$,
  '%Admin only%'
);
select cvf_test.as_user('00000000-0000-0000-0000-000000000002');
select cvf_test.throws_ok(
  'ledger runtime 02 [INV-19] non-admin cannot start a session',
  $$select public.start_scorekeeping_session('50000000-0000-0000-0000-000000000950','CVF-KB-2026.1',5,null,false,'{}')$$,
  '%Admin only%'
);

select cvf_test.as_admin('00000000-0000-0000-0000-000000000001');
insert into cvf_test.ledger_runtime_state values ('session', public.start_scorekeeping_session(
  '50000000-0000-0000-0000-000000000950','CVF-KB-2026.1',5,null,false,'{"mercy":false}'::jsonb));
select cvf_test.ok(
  'ledger runtime 03 [INV-10][INV-18][INV-20][INV-29] start converts, snapshots, and leases',
  (select game.scorekeeping_mode = 'ledger' and game.status = 'live'
     and (select count(*) = 2 from public.scorekeeping_participants participant
           where participant.session_id = (state.value ->> 'session_id')::uuid)
     and length(state.value ->> 'lease_token') > 20 and (state.value ->> 'lease_version')::int = 1
   from public.games game cross join cvf_test.ledger_runtime_state state
   where game.id = '50000000-0000-0000-0000-000000000950' and state.key = 'session')
);

insert into cvf_test.ledger_runtime_state
select 'event-home-1', public.append_scorekeeping_event(
  (s.value->>'session_id')::uuid,s.value->>'lease_token',(s.value->>'lease_version')::int,'runtime-home-1',
  'record','run','regulation',1,'30000000-0000-0000-0000-000000000001',1,null,null,'{}'::jsonb,
  jsonb_build_array(jsonb_build_object('participant_id',(select id from public.scorekeeping_participants
    where session_id=(s.value->>'session_id')::uuid and team_id='30000000-0000-0000-0000-000000000001' limit 1),
    'role','scorer','stat_key','runs','stat_delta',1)))
from cvf_test.ledger_runtime_state s where s.key='session';
insert into cvf_test.ledger_runtime_state
select 'event-home-2', public.append_scorekeeping_event(
  (s.value->>'session_id')::uuid,s.value->>'lease_token',(s.value->>'lease_version')::int,'runtime-home-2',
  'record','run','regulation',2,'30000000-0000-0000-0000-000000000001',1,null,null,'{}'::jsonb,
  jsonb_build_array(jsonb_build_object('participant_id',(select id from public.scorekeeping_participants
    where session_id=(s.value->>'session_id')::uuid and team_id='30000000-0000-0000-0000-000000000001' limit 1),
    'role','scorer','stat_key','runs','stat_delta',1)))
from cvf_test.ledger_runtime_state s where s.key='session';
insert into cvf_test.ledger_runtime_state
select 'event-away-1', public.append_scorekeeping_event(
  (s.value->>'session_id')::uuid,s.value->>'lease_token',(s.value->>'lease_version')::int,'runtime-away-1',
  'record','run','regulation',1,'30000000-0000-0000-0000-000000000002',1,null,null,'{}'::jsonb,
  jsonb_build_array(jsonb_build_object('participant_id',(select id from public.scorekeeping_participants
    where session_id=(s.value->>'session_id')::uuid and team_id='30000000-0000-0000-0000-000000000002' limit 1),
    'role','scorer','stat_key','runs','stat_delta',1)))
from cvf_test.ledger_runtime_state s where s.key='session';

select cvf_test.ok(
  'ledger runtime 04 [INV-14][INV-15] event commands are gapless and game-idempotent',
  (select array_agg(sequence_number order by sequence_number)=array[1,2,3]
    from public.scorekeeping_events where game_id='50000000-0000-0000-0000-000000000950')
);
select cvf_test.ok(
  'ledger runtime 05 [INV-15] same command replay returns the original event',
  (select (public.append_scorekeeping_event(
    (s.value->>'session_id')::uuid,s.value->>'lease_token',(s.value->>'lease_version')::int,'runtime-home-1',
    'record','run','regulation',1,'30000000-0000-0000-0000-000000000001',1,null,null,'{}'::jsonb,
    jsonb_build_array(jsonb_build_object('participant_id',(select id from public.scorekeeping_participants
      where session_id=(s.value->>'session_id')::uuid and team_id='30000000-0000-0000-0000-000000000001' limit 1),
      'role','scorer','stat_key','runs','stat_delta',1))) ->> 'replayed')::boolean
   from cvf_test.ledger_runtime_state s where s.key='session')
);
select cvf_test.throws_ok(
  'ledger runtime 06 [INV-15] changed command cannot reuse an event key',
  $$select public.append_scorekeeping_event((value->>'session_id')::uuid,value->>'lease_token',(value->>'lease_version')::int,
    'runtime-home-1','record','run','regulation',1,'30000000-0000-0000-0000-000000000001',1,null,null,'{"changed":true}'::jsonb,'[]'::jsonb)
    from cvf_test.ledger_runtime_state where key='session'$$,
  '%different command%'
);

insert into cvf_test.ledger_runtime_state
select 'renewed', public.renew_scorekeeping_session((value->>'session_id')::uuid,value->>'lease_token',(value->>'lease_version')::int)
from cvf_test.ledger_runtime_state where key='session';
select cvf_test.throws_ok(
  'ledger runtime 07 [INV-20] lease renewal invalidates the old token/version',
  $$select public.renew_scorekeeping_session((value->>'session_id')::uuid,value->>'lease_token',(value->>'lease_version')::int)
    from cvf_test.ledger_runtime_state where key='session'$$,
  '%stale or invalid%'
);
insert into cvf_test.ledger_runtime_state
select 'final', public.finalize_scorekeeping_session((session.value->>'session_id')::uuid,
  renewed.value->>'lease_token',(renewed.value->>'lease_version')::int,'runtime-final-1',null)
from cvf_test.ledger_runtime_state session cross join cvf_test.ledger_runtime_state renewed
where session.key='session' and renewed.key='renewed';
select cvf_test.ok(
  'ledger projection 01 [INV-01][INV-22][INV-23][INV-27] finalization publishes deterministic score/stats once',
  (select game.status='completed' and game.score_status='final' and game.locked and game.outcome_type='played'
      and game.home_score=2 and game.away_score=1 and game.periods='{"home":[1,1,0,0,0],"away":[1,0,0,0,0]}'::jsonb
      and (select count(*)=2 from public.player_stats stat where stat.game_id=game.id)
    from public.games game where game.id='50000000-0000-0000-0000-000000000950')
);
select cvf_test.ok(
  'ledger projection 02 [INV-15] ambiguous finalization retry is stable',
  (select public.finalize_scorekeeping_session((session.value->>'session_id')::uuid,
    renewed.value->>'lease_token',(renewed.value->>'lease_version')::int,'runtime-final-1',null)=final.value
   from cvf_test.ledger_runtime_state session cross join cvf_test.ledger_runtime_state renewed
   cross join cvf_test.ledger_runtime_state final
   where session.key='session' and renewed.key='renewed' and final.key='final')
);

insert into cvf_test.ledger_runtime_state
select 'correction', public.start_scorekeeping_correction('50000000-0000-0000-0000-000000000950','Move miscredited run') ;
insert into cvf_test.ledger_runtime_state
select 'replace', public.replace_scorekeeping_event((c.value->>'session_id')::uuid,c.value->>'lease_token',(c.value->>'lease_version')::int,
  'runtime-void-1','runtime-replace-1',(e.value->>'event_id')::uuid,'run','regulation',2,
  '30000000-0000-0000-0000-000000000002',1,'{}',
  jsonb_build_array(jsonb_build_object('participant_id',(select id from public.scorekeeping_participants
    where session_id=(c.value->>'session_id')::uuid and team_id='30000000-0000-0000-0000-000000000002' limit 1),
    'role','scorer','stat_key','runs','stat_delta',1)))
from cvf_test.ledger_runtime_state c cross join cvf_test.ledger_runtime_state e
where c.key='correction' and e.key='event-home-2';
insert into cvf_test.ledger_runtime_state
select 'corrected', public.finalize_scorekeeping_correction((c.value->>'session_id')::uuid,c.value->>'lease_token',
  (c.value->>'lease_version')::int,'runtime-correction-final-1',null)
from cvf_test.ledger_runtime_state c where c.key='correction';
select cvf_test.ok(
  'ledger correction 01 [INV-16][INV-17][INV-24][INV-37] void/replace refinalizes with one audited authority',
  (select game.home_score=1 and game.away_score=2 and game.winner_team_id='30000000-0000-0000-0000-000000000002'
     and (corrected.value->>'ok')::boolean
     and exists (select 1 from public.game_edit_history history where history.game_id=game.id
       and history.action='Ledger final result corrected' and history.scorekeeping_session_id=(corrected.value->>'session_id')::uuid)
   from public.games game cross join cvf_test.ledger_runtime_state corrected
   where game.id='50000000-0000-0000-0000-000000000950' and corrected.key='corrected')
);

insert into cvf_test.ledger_runtime_state
select 'cancel-correction', public.start_scorekeeping_correction('50000000-0000-0000-0000-000000000950','No-op review');
select public.cancel_scorekeeping_session((value->>'session_id')::uuid,value->>'lease_token',(value->>'lease_version')::int,'No change needed')
from cvf_test.ledger_runtime_state where key='cancel-correction';
select cvf_test.ok(
  'ledger correction 02 [INV-25] cancel leaves the published projection byte-for-byte unchanged',
  (select home_score=1 and away_score=2 and status='completed' and score_status='final' and locked
   from public.games where id='50000000-0000-0000-0000-000000000950')
);

insert into cvf_test.ledger_runtime_state
values ('forfeit', public.declare_ledger_forfeit('50000000-0000-0000-0000-000000000951',
  '30000000-0000-0000-0000-000000000001','Away team did not appear','runtime-forfeit-1'));
select cvf_test.ok(
  'ledger forfeit 01 [INV-09][INV-26] forfeit is final W/L-only with null score and no stats',
  (select game.status='canceled' and game.score_status='final' and game.locked and game.outcome_type='forfeit'
      and game.home_score is null and game.away_score is null and game.periods='{"home":[],"away":[]}'::jsonb
      and game.winner_team_id='30000000-0000-0000-0000-000000000001'
      and not exists (select 1 from public.player_stats stat where stat.game_id=game.id)
   from public.games game where game.id='50000000-0000-0000-0000-000000000951')
);
select cvf_test.ok(
  'ledger forfeit 02 [INV-15] same-key ambiguous retry returns the stored outcome',
  (select (public.declare_ledger_forfeit('50000000-0000-0000-0000-000000000951',
    '30000000-0000-0000-0000-000000000001','Away team did not appear','runtime-forfeit-1')->>'replayed')::boolean)
);
select cvf_test.throws_ok(
  'ledger forfeit 03 [INV-15] a different key cannot replay the finalized outcome',
  $$select public.declare_ledger_forfeit('50000000-0000-0000-0000-000000000951',
    '30000000-0000-0000-0000-000000000001','Away team did not appear','runtime-forfeit-2')$$,
  '%replay differs%'
);
insert into cvf_test.ledger_runtime_state
select 'playoff-forfeit-game', jsonb_build_object('game_id', public.schedule_playoff_match(
  (select id from public.playoff_matches where round_number=1 and status='ready' and game_id is null limit 1),
  '2026-08-02 19:00:00-06'::timestamptz, '60000000-0000-0000-0000-000000000007'));
insert into cvf_test.ledger_runtime_state
select 'playoff-forfeit', public.declare_ledger_forfeit(
  (fixture.value->>'game_id')::uuid, game.home_team_id, 'Opponent did not appear', 'playoff-forfeit-1')
from cvf_test.ledger_runtime_state fixture
join public.games game on game.id=(fixture.value->>'game_id')::uuid
where fixture.key='playoff-forfeit-game';
select cvf_test.ok(
  'ledger forfeit 04 [INV-09][INV-32] scoreless playoff forfeit advances through the single bracket authority',
  exists (
    select 1 from cvf_test.ledger_runtime_state fixture
    join public.playoff_matches source on source.game_id=(fixture.value->>'game_id')::uuid
    left join public.playoff_matches destination on destination.id=source.winner_to_match_id
    where fixture.key='playoff-forfeit-game' and source.status='completed'
      and source.winner_team_id is not null and source.loser_team_id is not null
      and (destination.id is null or source.winner_team_id in (destination.home_team_id,destination.away_team_id))
  )
);
select cvf_test.throws_ok(
  'ledger boundary 01 [INV-04] AAL2 admin still cannot directly update outcome fields',
  $$update public.games set winner_team_id='30000000-0000-0000-0000-000000000002'
    where id='50000000-0000-0000-0000-000000000951'$$,
  '%permission denied%'
);

select cvf_test.as_owner();
insert into public.games (id, league_id, sport, home_team_id, away_team_id, starts_at, venue_id)
values ('50000000-0000-0000-0000-000000000953','20000000-0000-0000-0000-000000000001','kickball',
  '30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','2026-10-29 18:00:00-06'::timestamptz, '60000000-0000-0000-0000-000000000004');
select cvf_test.as_admin('00000000-0000-0000-0000-000000000001');
insert into cvf_test.ledger_runtime_state values ('failure-session', public.start_scorekeeping_session(
  '50000000-0000-0000-0000-000000000953','CVF-KB-2026.1',5,null,false,'{}'::jsonb));
select public.append_scorekeeping_event((value->>'session_id')::uuid,value->>'lease_token',(value->>'lease_version')::int,
  'failure-home','record','run','regulation',1,'30000000-0000-0000-0000-000000000001',1,null,null,'{}','[]')
from cvf_test.ledger_runtime_state where key='failure-session';
select public.append_scorekeeping_event((value->>'session_id')::uuid,value->>'lease_token',(value->>'lease_version')::int,
  'failure-away','record','run','regulation',1,'30000000-0000-0000-0000-000000000002',1,null,null,'{}','[]')
from cvf_test.ledger_runtime_state where key='failure-session';
insert into cvf_test.ledger_runtime_state
select 'failure-result', public.finalize_scorekeeping_session((value->>'session_id')::uuid,value->>'lease_token',
  (value->>'lease_version')::int,'failure-final',null)
from cvf_test.ledger_runtime_state where key='failure-session';
select cvf_test.ok(
  'ledger overtime 01 [INV-08][INV-35] tied regulation continues without mutation or failure audit',
  (select (result.value->>'ok')::boolean and result.value->>'status'='continue_overtime'
      and (result.value->>'next_overtime_period')::int=1
      and game.status='live' and game.home_score is null and game.away_score is null
      and not exists (select 1 from public.game_edit_history history where history.game_id=game.id
        and history.action='Ledger finalization failed')
   from cvf_test.ledger_runtime_state result cross join public.games game
   where result.key='failure-result' and game.id='50000000-0000-0000-0000-000000000953')
);

-- ---------------------------------------------------------------------------
-- Sequence 5A overtime and paired-stat completion.
-- ---------------------------------------------------------------------------
select cvf_test.ok(
  'sequence5a 00 [INV-19] new paired-stat surface preserves the function privilege boundary',
  has_function_privilege(
    'authenticated',
    'public.append_scorekeeping_event(uuid,text,integer,text,text,text,text,integer,uuid,integer,uuid,uuid,jsonb,jsonb,text)',
    'execute'
  )
  and not has_function_privilege(
    'anon',
    'public.append_scorekeeping_event(uuid,text,integer,text,text,text,text,integer,uuid,integer,uuid,uuid,jsonb,jsonb,text)',
    'execute'
  )
  and not has_function_privilege(
    'service_role',
    'public.append_scorekeeping_event(uuid,text,integer,text,text,text,text,integer,uuid,integer,uuid,uuid,jsonb,jsonb,text)',
    'execute'
  )
  and not has_function_privilege(
    'authenticated',
    'public.cvf_flag_pairing_mismatches(public.scorekeeping_sessions,uuid,jsonb)',
    'execute'
  )
  and (
    select function.provolatile = 'v'
      from pg_catalog.pg_proc function
      join pg_catalog.pg_namespace namespace on namespace.oid = function.pronamespace
     where namespace.nspname = 'public'
       and function.proname = 'cvf_assert_ledger_lease'
  )
);
select cvf_test.as_admin_aal1('00000000-0000-0000-0000-000000000001');
select cvf_test.throws_ok(
  'sequence5a 00a [INV-19] AAL1 admin cannot call the new append signature',
  $$select public.append_scorekeeping_event(
    '00000000-0000-0000-0000-000000000000','invalid',1,'denied',
    'record','run','regulation',1,null,0,null,null,'{}','[]',null)$$,
  '%Admin only%'
);
select cvf_test.as_user('00000000-0000-0000-0000-000000000002');
select cvf_test.throws_ok(
  'sequence5a 00b [INV-19] non-admin cannot call the new append signature',
  $$select public.append_scorekeeping_event(
    '00000000-0000-0000-0000-000000000000','invalid',1,'denied',
    'record','run','regulation',1,null,0,null,null,'{}','[]',null)$$,
  '%Admin only%'
);
select cvf_test.as_owner();
insert into public.team_players (team_id, profile_id, season, roster_status)
values
  ('30000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000003', 'Summer 2026', 'eligible'),
  ((select id from public.teams
     where league_id='20000000-0000-0000-0000-000000000002'
       and id<>'30000000-0000-0000-0000-000000000005'
     order by created_at limit 1),
   '10000000-0000-0000-0000-000000000002', 'Summer 2026', 'eligible');

-- Re-applied onto the Migration 29 game shape. These fixtures were authored on
-- the pre-cutover branch; a textual merge keeps their old column list and the
-- harness then fails on columns that no longer exist. The November 6:00 PM
-- kickoffs are written as MST (-07): DST ends 2026-11-01, so an evening game on
-- these dates is unambiguously standard time.
insert into public.games (id, league_id, sport, home_team_id, away_team_id, starts_at, venue_id)
values
  ('50000000-0000-0000-0000-000000000954','20000000-0000-0000-0000-000000000001','kickball',
   '30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002',
   '2026-11-01 18:00:00-07'::timestamptz,'60000000-0000-0000-0000-000000000011'),
  ('50000000-0000-0000-0000-000000000955','20000000-0000-0000-0000-000000000002','flag_football',
   '30000000-0000-0000-0000-000000000005',
   (select id from public.teams where league_id='20000000-0000-0000-0000-000000000002'
     and id<>'30000000-0000-0000-0000-000000000005' order by created_at limit 1),
   '2026-11-02 18:00:00-07'::timestamptz,'60000000-0000-0000-0000-000000000012'),
  ('50000000-0000-0000-0000-000000000956','20000000-0000-0000-0000-000000000002','flag_football',
   '30000000-0000-0000-0000-000000000005',
   (select id from public.teams where league_id='20000000-0000-0000-0000-000000000002'
     and id<>'30000000-0000-0000-0000-000000000005' order by created_at limit 1),
   '2026-11-03 18:00:00-07'::timestamptz,'60000000-0000-0000-0000-000000000013'),
  ('50000000-0000-0000-0000-000000000957','20000000-0000-0000-0000-000000000002','flag_football',
   '30000000-0000-0000-0000-000000000005',
   (select id from public.teams where league_id='20000000-0000-0000-0000-000000000002'
     and id<>'30000000-0000-0000-0000-000000000005' order by created_at limit 1),
   '2026-11-04 18:00:00-07'::timestamptz,'60000000-0000-0000-0000-000000000014');

select cvf_test.as_admin('00000000-0000-0000-0000-000000000001');
insert into cvf_test.ledger_runtime_state
values ('kick-ot-session', public.start_scorekeeping_session(
  '50000000-0000-0000-0000-000000000954','CVF-KB-2026.2',5,'one complete inning',false,'{}'));

insert into cvf_test.ledger_runtime_state
select 'kick-ot-reg-home', public.append_scorekeeping_event(
  (s.value->>'session_id')::uuid,s.value->>'lease_token',(s.value->>'lease_version')::int,'kick-ot-reg-home',
  'record','run','regulation',5,'30000000-0000-0000-0000-000000000001',1,null,null,'{}',
  jsonb_build_array(jsonb_build_object(
    'participant_id',(select id from public.scorekeeping_participants where session_id=(s.value->>'session_id')::uuid
      and team_id='30000000-0000-0000-0000-000000000001' limit 1),
    'role','scorer','stat_key','runs','stat_delta',1)),null)
from cvf_test.ledger_runtime_state s where s.key='kick-ot-session';
insert into cvf_test.ledger_runtime_state
select 'kick-ot-reg-away', public.append_scorekeeping_event(
  (s.value->>'session_id')::uuid,s.value->>'lease_token',(s.value->>'lease_version')::int,'kick-ot-reg-away',
  'record','run','regulation',5,'30000000-0000-0000-0000-000000000002',1,null,null,'{}',
  jsonb_build_array(jsonb_build_object(
    'participant_id',(select id from public.scorekeeping_participants where session_id=(s.value->>'session_id')::uuid
      and team_id='30000000-0000-0000-0000-000000000002' limit 1),
    'role','scorer','stat_key','runs','stat_delta',1)),null)
from cvf_test.ledger_runtime_state s where s.key='kick-ot-session';

insert into cvf_test.ledger_runtime_state
select 'kick-ot-reg-result', public.finalize_scorekeeping_session(
  (s.value->>'session_id')::uuid,s.value->>'lease_token',(s.value->>'lease_version')::int,'kick-ot-reg-eval',null)
from cvf_test.ledger_runtime_state s where s.key='kick-ot-session';
select cvf_test.ok(
  'sequence5a 01 [INV-08] tied regulation requests OT1 and leaves the game live',
  (select result.value->>'status'='continue_overtime'
      and (result.value->>'next_overtime_period')::int=1
      and game.status='live' and not game.locked and game.home_score is null
   from cvf_test.ledger_runtime_state result
   join public.games game on game.id='50000000-0000-0000-0000-000000000954'
   where result.key='kick-ot-reg-result')
);

insert into cvf_test.ledger_runtime_state
select 'kick-ot1-home', public.append_scorekeeping_event(
  (s.value->>'session_id')::uuid,s.value->>'lease_token',(s.value->>'lease_version')::int,'kick-ot1-home',
  'record','run','overtime',1,'30000000-0000-0000-0000-000000000001',1,null,null,'{}',
  jsonb_build_array(jsonb_build_object(
    'participant_id',(select id from public.scorekeeping_participants where session_id=(s.value->>'session_id')::uuid
      and team_id='30000000-0000-0000-0000-000000000001' limit 1),
    'role','scorer','stat_key','runs','stat_delta',1)),null)
from cvf_test.ledger_runtime_state s where s.key='kick-ot-session';
insert into cvf_test.ledger_runtime_state
select 'kick-ot1-away', public.append_scorekeeping_event(
  (s.value->>'session_id')::uuid,s.value->>'lease_token',(s.value->>'lease_version')::int,'kick-ot1-away',
  'record','run','overtime',1,'30000000-0000-0000-0000-000000000002',1,null,null,'{}',
  jsonb_build_array(jsonb_build_object(
    'participant_id',(select id from public.scorekeeping_participants where session_id=(s.value->>'session_id')::uuid
      and team_id='30000000-0000-0000-0000-000000000002' limit 1),
    'role','scorer','stat_key','runs','stat_delta',1)),null)
from cvf_test.ledger_runtime_state s where s.key='kick-ot-session';
insert into cvf_test.ledger_runtime_state
select 'kick-ot1-close', public.append_scorekeeping_event(
  (s.value->>'session_id')::uuid,s.value->>'lease_token',(s.value->>'lease_version')::int,'kick-ot1-close',
  'record','period_close','overtime',1,null,0,null,null,'{}','[]',null)
from cvf_test.ledger_runtime_state s where s.key='kick-ot-session';
select cvf_test.ok(
  'sequence5a 02 [INV-08][INV-15] period close is append-only evidence with stable replay',
  (select (public.append_scorekeeping_event(
    (s.value->>'session_id')::uuid,s.value->>'lease_token',(s.value->>'lease_version')::int,'kick-ot1-close',
    'record','period_close','overtime',1,null,0,null,null,'{}','[]',null)->>'replayed')::boolean
    and exists (select 1 from public.scorekeeping_events event
      where event.id=(close.value->>'event_id')::uuid and event.event_type='period_close'
        and event.credited_team_id is null and event.points=0 and event.created_by is not null)
   from cvf_test.ledger_runtime_state s cross join cvf_test.ledger_runtime_state close
   where s.key='kick-ot-session' and close.key='kick-ot1-close')
);
insert into cvf_test.ledger_runtime_state
select 'kick-ot1-result', public.finalize_scorekeeping_session(
  (s.value->>'session_id')::uuid,s.value->>'lease_token',(s.value->>'lease_version')::int,'kick-ot1-eval',null)
from cvf_test.ledger_runtime_state s where s.key='kick-ot-session';
select cvf_test.ok(
  'sequence5a 03 [INV-08] a complete tied extra inning requests another complete inning',
  (select result.value->>'status'='continue_overtime'
      and (result.value->>'next_overtime_period')::int=2
      and game.status='live' and not game.locked and game.home_score is null
   from cvf_test.ledger_runtime_state result
   join public.games game on game.id='50000000-0000-0000-0000-000000000954'
   where result.key='kick-ot1-result')
);
select cvf_test.throws_ok(
  'sequence5a 04 [INV-08] a closed overtime period rejects later scoring in that period',
  $$select public.append_scorekeeping_event(
    (value->>'session_id')::uuid,value->>'lease_token',(value->>'lease_version')::int,'kick-ot1-late',
    'record','run','overtime',1,'30000000-0000-0000-0000-000000000001',1,null,null,'{}','[]',null)
    from cvf_test.ledger_runtime_state where key='kick-ot-session'$$,
  '%not the current open period 2%'
);
insert into cvf_test.ledger_runtime_state
select 'kick-ot2-home', public.append_scorekeeping_event(
  (s.value->>'session_id')::uuid,s.value->>'lease_token',(s.value->>'lease_version')::int,'kick-ot2-home',
  'record','run','overtime',2,'30000000-0000-0000-0000-000000000001',1,null,null,'{}',
  jsonb_build_array(jsonb_build_object(
    'participant_id',(select id from public.scorekeeping_participants where session_id=(s.value->>'session_id')::uuid
      and team_id='30000000-0000-0000-0000-000000000001' limit 1),
    'role','scorer','stat_key','runs','stat_delta',1)),null)
from cvf_test.ledger_runtime_state s where s.key='kick-ot-session';
insert into cvf_test.ledger_runtime_state
select 'kick-ot2-open-result', public.finalize_scorekeeping_session(
  (s.value->>'session_id')::uuid,s.value->>'lease_token',(s.value->>'lease_version')::int,'kick-ot2-open-eval',null)
from cvf_test.ledger_runtime_state s where s.key='kick-ot-session';
select cvf_test.ok(
  'sequence5a 05 [INV-08] an unequal mid-inning score cannot finalize before admin close',
  (select result.value->>'status'='overtime_period_open' and game.status='live' and not game.locked
   from cvf_test.ledger_runtime_state result
   join public.games game on game.id='50000000-0000-0000-0000-000000000954'
   where result.key='kick-ot2-open-result')
);
insert into cvf_test.ledger_runtime_state
select 'kick-ot2-close', public.append_scorekeeping_event(
  (s.value->>'session_id')::uuid,s.value->>'lease_token',(s.value->>'lease_version')::int,'kick-ot2-close',
  'record','period_close','overtime',2,null,0,null,null,'{}','[]',null)
from cvf_test.ledger_runtime_state s where s.key='kick-ot-session';
insert into cvf_test.ledger_runtime_state
select 'kick-ot-final', public.finalize_scorekeeping_session(
  (s.value->>'session_id')::uuid,s.value->>'lease_token',(s.value->>'lease_version')::int,'kick-ot-final',null)
from cvf_test.ledger_runtime_state s where s.key='kick-ot-session';
select cvf_test.ok(
  'sequence5a 06 [INV-01][INV-08][INV-22] closed unequal OT finalizes atomically with both extra innings',
  (select result.value->>'status'='finalized' and game.status='completed' and game.locked
      and game.home_score=3 and game.away_score=2
      and game.periods='{"home":[0,0,0,0,1,1,1],"away":[0,0,0,0,1,1,0]}'::jsonb
   from cvf_test.ledger_runtime_state result
   join public.games game on game.id='50000000-0000-0000-0000-000000000954'
   where result.key='kick-ot-final')
);

insert into cvf_test.ledger_runtime_state
select 'kick-ot-correction', public.start_scorekeeping_correction(
  '50000000-0000-0000-0000-000000000954','Reconfirm the official OT close');
insert into cvf_test.ledger_runtime_state
select 'kick-ot-close-replacement', public.replace_scorekeeping_event(
  (c.value->>'session_id')::uuid,c.value->>'lease_token',(c.value->>'lease_version')::int,
  'kick-ot-close-void','kick-ot-close-replace',(target.value->>'event_id')::uuid,
  'period_close','overtime',2,null,0,'{}','[]',null)
from cvf_test.ledger_runtime_state c cross join cvf_test.ledger_runtime_state target
where c.key='kick-ot-correction' and target.key='kick-ot2-close';
insert into cvf_test.ledger_runtime_state
select 'kick-ot-corrected', public.finalize_scorekeeping_correction(
  (c.value->>'session_id')::uuid,c.value->>'lease_token',(c.value->>'lease_version')::int,
  'kick-ot-correction-final',null)
from cvf_test.ledger_runtime_state c where c.key='kick-ot-correction';
select cvf_test.ok(
  'sequence5a 07 [INV-16][INV-17][INV-24] period close uses the existing void-replace correction chain',
  (select (corrected.value->>'ok')::boolean and game.home_score=3 and game.away_score=2
      and exists (select 1 from public.scorekeeping_events event
        where event.id=(replacement.value#>>'{replacement,event_id}')::uuid
          and event.event_type='period_close' and event.action='replace')
   from cvf_test.ledger_runtime_state corrected
   cross join cvf_test.ledger_runtime_state replacement
   join public.games game on game.id='50000000-0000-0000-0000-000000000954'
   where corrected.key='kick-ot-corrected' and replacement.key='kick-ot-close-replacement')
);
insert into cvf_test.ledger_runtime_state
select 'kick-ot-open-correction', public.start_scorekeeping_correction(
  '50000000-0000-0000-0000-000000000954','Test removal of the official OT close');
select public.append_scorekeeping_event(
  (c.value->>'session_id')::uuid,c.value->>'lease_token',(c.value->>'lease_version')::int,
  'kick-ot-open-correction-void','void','void',null,null,null,0,
  (replacement.value#>>'{replacement,event_id}')::uuid,null,'{}','[]',null)
from cvf_test.ledger_runtime_state c
cross join cvf_test.ledger_runtime_state replacement
where c.key='kick-ot-open-correction' and replacement.key='kick-ot-close-replacement';
insert into cvf_test.ledger_runtime_state
select 'kick-ot-open-correction-result', public.finalize_scorekeeping_correction(
  (c.value->>'session_id')::uuid,c.value->>'lease_token',(c.value->>'lease_version')::int,
  'kick-ot-open-correction-final',null)
from cvf_test.ledger_runtime_state c where c.key='kick-ot-open-correction';
select cvf_test.ok(
  'sequence5a 07a [INV-01][INV-08][INV-24] correction cannot publish an unequal but open OT period',
  (select not (result.value->>'ok')::boolean
      and result.value->>'message' like
        '%[INV-08][INV-24]%cannot publish while the latest overtime period is open%'
      and game.home_score=3 and game.away_score=2
      and game.status='completed' and game.locked
   from cvf_test.ledger_runtime_state result
   join public.games game on game.id='50000000-0000-0000-0000-000000000954'
   where result.key='kick-ot-open-correction-result')
);

insert into cvf_test.ledger_runtime_state
values ('flag-pair-session', public.start_scorekeeping_session(
  '50000000-0000-0000-0000-000000000955','CVF-FF-2026.2',4,'one possession each',false,'{}'));
select cvf_test.throws_ok(
  'sequence5a 08 [INV-07] an unexplained one-sided paired stat is rejected at entry',
  $$select public.append_scorekeeping_event(
    (value->>'session_id')::uuid,value->>'lease_token',(value->>'lease_version')::int,'flag-unpaired-denied',
    'record','completion','regulation',1,'30000000-0000-0000-0000-000000000005',0,null,null,'{}',
    jsonb_build_array(jsonb_build_object(
      'participant_id',(select id from public.scorekeeping_participants where session_id=(value->>'session_id')::uuid
        and team_id='30000000-0000-0000-0000-000000000005' limit 1),
      'role','passer','stat_key','completions','stat_delta',1)),null)
    from cvf_test.ledger_runtime_state where key='flag-pair-session'$$,
  '%[INV-07]%within the same event%'
);
select cvf_test.throws_ok(
  'sequence5a 09 [INV-07] blank text is not a pairing override',
  $$select public.append_scorekeeping_event(
    (value->>'session_id')::uuid,value->>'lease_token',(value->>'lease_version')::int,'flag-unpaired-blank',
    'record','completion','regulation',1,'30000000-0000-0000-0000-000000000005',0,null,null,'{}',
    jsonb_build_array(jsonb_build_object(
      'participant_id',(select id from public.scorekeeping_participants where session_id=(value->>'session_id')::uuid
        and team_id='30000000-0000-0000-0000-000000000005' limit 1),
      'role','passer','stat_key','completions','stat_delta',1)),'   ')
    from cvf_test.ledger_runtime_state where key='flag-pair-session'$$,
  '%[INV-07]%within the same event%'
);
select cvf_test.throws_ok(
  'sequence5a 09a [INV-07] zero-delta one-sided attribution still requires counterpart presence',
  $$select public.append_scorekeeping_event(
    (value->>'session_id')::uuid,value->>'lease_token',(value->>'lease_version')::int,'flag-zero-unpaired-denied',
    'record','completion','regulation',1,'30000000-0000-0000-0000-000000000005',0,null,null,'{}',
    jsonb_build_array(jsonb_build_object(
      'participant_id',(select id from public.scorekeeping_participants where session_id=(value->>'session_id')::uuid
        and team_id='30000000-0000-0000-0000-000000000005' limit 1),
      'role','passer','stat_key','passYards','stat_delta',0)),null)
    from cvf_test.ledger_runtime_state where key='flag-pair-session'$$,
  '%[INV-07]%within the same event%'
);
insert into cvf_test.ledger_runtime_state
select 'flag-unpaired-override', public.append_scorekeeping_event(
  (s.value->>'session_id')::uuid,s.value->>'lease_token',(s.value->>'lease_version')::int,'flag-unpaired-override',
  'record','completion','regulation',1,'30000000-0000-0000-0000-000000000005',0,null,null,'{}',
  jsonb_build_array(jsonb_build_object(
    'participant_id',(select id from public.scorekeeping_participants where session_id=(s.value->>'session_id')::uuid
      and team_id='30000000-0000-0000-0000-000000000005' limit 1),
    'role','passer','stat_key','completions','stat_delta',1)),
  'Receiver identity missing from official sheet')
from cvf_test.ledger_runtime_state s where s.key='flag-pair-session';
select cvf_test.ok(
  'sequence5a 10 [INV-07][INV-19][INV-36] event-specific override stores immutable actor-time evidence',
  exists (
    select 1 from cvf_test.ledger_runtime_state state
    join public.scorekeeping_events event on event.id=(state.value->>'event_id')::uuid
    where state.key='flag-unpaired-override'
      and event.pairing_override_reason='Receiver identity missing from official sheet'
      and event.created_by='00000000-0000-0000-0000-000000000001'
      and event.created_at is not null
  )
);
select cvf_test.as_owner();
select cvf_test.throws_ok(
  'sequence5a 11 [INV-07][INV-36] pairing override evidence cannot be rewritten by the owner',
  $$update public.scorekeeping_events set pairing_override_reason='Changed'
    where id=(select (value->>'event_id')::uuid from cvf_test.ledger_runtime_state where key='flag-unpaired-override')$$,
  '%append-only%'
);
select cvf_test.as_admin('00000000-0000-0000-0000-000000000001');

insert into cvf_test.ledger_runtime_state
select 'flag-paired-completion', public.append_scorekeeping_event(
  (s.value->>'session_id')::uuid,s.value->>'lease_token',(s.value->>'lease_version')::int,'flag-paired-completion',
  'record','completion','regulation',2,'30000000-0000-0000-0000-000000000005',0,null,null,'{}',
  jsonb_build_array(
    jsonb_build_object('participant_id',(select id from public.scorekeeping_participants
      where session_id=(s.value->>'session_id')::uuid and team_id='30000000-0000-0000-0000-000000000005'
      order by display_name limit 1),'role','passer','stat_key','completions','stat_delta',1),
    jsonb_build_object('participant_id',(select id from public.scorekeeping_participants
      where session_id=(s.value->>'session_id')::uuid and team_id='30000000-0000-0000-0000-000000000005'
      order by display_name desc limit 1),'role','receiver','stat_key','catches','stat_delta',1),
    jsonb_build_object('participant_id',(select id from public.scorekeeping_participants
      where session_id=(s.value->>'session_id')::uuid and team_id='30000000-0000-0000-0000-000000000005'
      order by display_name limit 1),'role','passer','stat_key','passYards','stat_delta',-4),
    jsonb_build_object('participant_id',(select id from public.scorekeeping_participants
      where session_id=(s.value->>'session_id')::uuid and team_id='30000000-0000-0000-0000-000000000005'
      order by display_name desc limit 1),'role','receiver','stat_key','recYards','stat_delta',-4)),null)
from cvf_test.ledger_runtime_state s where s.key='flag-pair-session';
insert into cvf_test.ledger_runtime_state
select 'flag-paired-td', public.append_scorekeeping_event(
  (s.value->>'session_id')::uuid,s.value->>'lease_token',(s.value->>'lease_version')::int,'flag-paired-td',
  'record','touchdown','regulation',3,'30000000-0000-0000-0000-000000000005',6,null,null,'{}',
  jsonb_build_array(
    jsonb_build_object('participant_id',(select id from public.scorekeeping_participants
      where session_id=(s.value->>'session_id')::uuid and team_id='30000000-0000-0000-0000-000000000005'
      order by display_name limit 1),'role','passer','stat_key','passTDs','stat_delta',1),
    jsonb_build_object('participant_id',(select id from public.scorekeeping_participants
      where session_id=(s.value->>'session_id')::uuid and team_id='30000000-0000-0000-0000-000000000005'
      order by display_name desc limit 1),'role','receiver','stat_key','recTDs','stat_delta',1),
    jsonb_build_object('participant_id',(select id from public.scorekeeping_participants
      where session_id=(s.value->>'session_id')::uuid and team_id='30000000-0000-0000-0000-000000000005'
      order by display_name desc limit 1),'role','scorer','stat_key','tds','stat_delta',1)),null)
from cvf_test.ledger_runtime_state s where s.key='flag-pair-session';
insert into cvf_test.ledger_runtime_state
select 'flag-paired-int', public.append_scorekeeping_event(
  (s.value->>'session_id')::uuid,s.value->>'lease_token',(s.value->>'lease_version')::int,'flag-paired-int',
  'record','interception','regulation',4,'30000000-0000-0000-0000-000000000005',0,null,null,'{}',
  jsonb_build_array(
    jsonb_build_object('participant_id',(select id from public.scorekeeping_participants
      where session_id=(s.value->>'session_id')::uuid and team_id='30000000-0000-0000-0000-000000000005' limit 1),
      'role','interceptor','stat_key','defInts','stat_delta',1),
    jsonb_build_object('participant_id',(select id from public.scorekeeping_participants
      where session_id=(s.value->>'session_id')::uuid and team_id<>'30000000-0000-0000-0000-000000000005' limit 1),
      'role','passer','stat_key','ints','stat_delta',1)),null)
from cvf_test.ledger_runtime_state s where s.key='flag-pair-session';
select cvf_test.ok(
  'sequence5a 12 [INV-07] all four paired-stat classes enter without override when exact',
  (select count(*)=3 and bool_and(not (value->>'pairing_overridden')::boolean)
   from cvf_test.ledger_runtime_state
   where key in ('flag-paired-completion','flag-paired-td','flag-paired-int'))
);
insert into cvf_test.ledger_runtime_state
select 'flag-pair-no-final-override', public.finalize_scorekeeping_session(
  (s.value->>'session_id')::uuid,s.value->>'lease_token',(s.value->>'lease_version')::int,'flag-pair-final-no-override',null)
from cvf_test.ledger_runtime_state s where s.key='flag-pair-session';
select cvf_test.ok(
  'sequence5a 13 [INV-07][INV-35] residual event override warns and blocks unexplained finalization',
  (select not (value->>'ok')::boolean and value->>'message' like '%SOFT validation requires an override reason%'
   from cvf_test.ledger_runtime_state where key='flag-pair-no-final-override')
);
insert into cvf_test.ledger_runtime_state
select 'flag-pair-final', public.finalize_scorekeeping_session(
  (s.value->>'session_id')::uuid,s.value->>'lease_token',(s.value->>'lease_version')::int,
  'flag-pair-final','Official book accepts the identified missing receiver')
from cvf_test.ledger_runtime_state s where s.key='flag-pair-session';
select cvf_test.ok(
  'sequence5a 14 [INV-07][INV-37] final audit preserves event warning and final override reason',
  (select result.value->>'status'='finalized' and session.override_reason='Official book accepts the identified missing receiver'
      and session.validation_warnings @> '[{"code":"ledger_pairing_override"}]'::jsonb
      and exists (select 1 from public.game_edit_history history
        where history.scorekeeping_session_id=session.id
          and history.override_reason='Official book accepts the identified missing receiver'
          and history.validation_warnings @> '[{"code":"ledger_pairing_override"}]'::jsonb)
   from cvf_test.ledger_runtime_state result
   join public.scorekeeping_sessions session on session.id=(result.value->>'session_id')::uuid
   where result.key='flag-pair-final')
);

insert into cvf_test.ledger_runtime_state
values ('flag-ot-session', public.start_scorekeeping_session(
  '50000000-0000-0000-0000-000000000956','CVF-FF-2026.2',4,'one possession each',false,'{}'));
insert into cvf_test.ledger_runtime_state
select 'flag-ot-reg-result', public.finalize_scorekeeping_session(
  (s.value->>'session_id')::uuid,s.value->>'lease_token',(s.value->>'lease_version')::int,'flag-ot-reg-eval',null)
from cvf_test.ledger_runtime_state s where s.key='flag-ot-session';
select cvf_test.ok(
  'sequence5a 15 [INV-08] tied flag regulation opens round one without locking',
  (select value->>'status'='continue_overtime' and (value->>'next_overtime_period')::int=1
   from cvf_test.ledger_runtime_state where key='flag-ot-reg-result')
);
insert into cvf_test.ledger_runtime_state
select 'flag-ot1-home', public.append_scorekeeping_event(
  (s.value->>'session_id')::uuid,s.value->>'lease_token',(s.value->>'lease_version')::int,'flag-ot1-home',
  'record','touchdown','overtime',1,'30000000-0000-0000-0000-000000000005',6,null,null,'{}',
  jsonb_build_array(jsonb_build_object(
    'participant_id',(select id from public.scorekeeping_participants where session_id=(s.value->>'session_id')::uuid
      and team_id='30000000-0000-0000-0000-000000000005' limit 1),
    'role','scorer','stat_key','tds','stat_delta',1)),null)
from cvf_test.ledger_runtime_state s where s.key='flag-ot-session';
insert into cvf_test.ledger_runtime_state
select 'flag-ot1-open', public.finalize_scorekeeping_session(
  (s.value->>'session_id')::uuid,s.value->>'lease_token',(s.value->>'lease_version')::int,'flag-ot1-open-eval',null)
from cvf_test.ledger_runtime_state s where s.key='flag-ot-session';
select cvf_test.ok(
  'sequence5a 16 [INV-08] a defensive-score-shaped lead cannot end flag OT mid-round',
  (select result.value->>'status'='overtime_period_open' and game.status='live' and not game.locked
   from cvf_test.ledger_runtime_state result
   join public.games game on game.id='50000000-0000-0000-0000-000000000956'
   where result.key='flag-ot1-open')
);
insert into cvf_test.ledger_runtime_state
select 'flag-ot1-away', public.append_scorekeeping_event(
  (s.value->>'session_id')::uuid,s.value->>'lease_token',(s.value->>'lease_version')::int,'flag-ot1-away',
  'record','touchdown','overtime',1,
  (select away_team_id from public.scorekeeping_sessions where id=(s.value->>'session_id')::uuid),6,null,null,'{}',
  jsonb_build_array(jsonb_build_object(
    'participant_id',(select id from public.scorekeeping_participants where session_id=(s.value->>'session_id')::uuid
      and team_id=(select away_team_id from public.scorekeeping_sessions where id=(s.value->>'session_id')::uuid) limit 1),
    'role','scorer','stat_key','tds','stat_delta',1)),null)
from cvf_test.ledger_runtime_state s where s.key='flag-ot-session';
select public.append_scorekeeping_event(
  (s.value->>'session_id')::uuid,s.value->>'lease_token',(s.value->>'lease_version')::int,'flag-ot1-close',
  'record','period_close','overtime',1,null,0,null,null,'{}','[]',null)
from cvf_test.ledger_runtime_state s where s.key='flag-ot-session';
insert into cvf_test.ledger_runtime_state
select 'flag-ot1-result', public.finalize_scorekeeping_session(
  (s.value->>'session_id')::uuid,s.value->>'lease_token',(s.value->>'lease_version')::int,'flag-ot1-eval',null)
from cvf_test.ledger_runtime_state s where s.key='flag-ot-session';
select cvf_test.ok(
  'sequence5a 17 [INV-08] equal completed flag possessions open another identical round',
  (select value->>'status'='continue_overtime' and (value->>'next_overtime_period')::int=2
   from cvf_test.ledger_runtime_state where key='flag-ot1-result')
);
select public.append_scorekeeping_event(
  (s.value->>'session_id')::uuid,s.value->>'lease_token',(s.value->>'lease_version')::int,'flag-ot2-home',
  'record','touchdown','overtime',2,'30000000-0000-0000-0000-000000000005',6,null,null,'{}',
  jsonb_build_array(jsonb_build_object(
    'participant_id',(select id from public.scorekeeping_participants where session_id=(s.value->>'session_id')::uuid
      and team_id='30000000-0000-0000-0000-000000000005' limit 1),
    'role','scorer','stat_key','tds','stat_delta',1)),null)
from cvf_test.ledger_runtime_state s where s.key='flag-ot-session';
select public.append_scorekeeping_event(
  (s.value->>'session_id')::uuid,s.value->>'lease_token',(s.value->>'lease_version')::int,'flag-ot2-close',
  'record','period_close','overtime',2,null,0,null,null,'{}','[]',null)
from cvf_test.ledger_runtime_state s where s.key='flag-ot-session';
insert into cvf_test.ledger_runtime_state
select 'flag-ot-final', public.finalize_scorekeeping_session(
  (s.value->>'session_id')::uuid,s.value->>'lease_token',(s.value->>'lease_version')::int,'flag-ot-final',null)
from cvf_test.ledger_runtime_state s where s.key='flag-ot-session';
select cvf_test.ok(
  'sequence5a 18 [INV-08][INV-22] flag OT finalizes only after the admin closes the unequal round',
  (select result.value->>'status'='finalized' and game.home_score=12 and game.away_score=6
      and game.periods='{"home":[0,0,0,0,6,6],"away":[0,0,0,0,6,0]}'::jsonb
      and game.status='completed' and game.locked
   from cvf_test.ledger_runtime_state result
   join public.games game on game.id='50000000-0000-0000-0000-000000000956'
   where result.key='flag-ot-final')
);

insert into cvf_test.ledger_runtime_state
values ('flag-invalid-ot-session', public.start_scorekeeping_session(
  '50000000-0000-0000-0000-000000000957','CVF-FF-2026.2',4,'one possession each',false,'{}'));
select public.append_scorekeeping_event(
  (s.value->>'session_id')::uuid,s.value->>'lease_token',(s.value->>'lease_version')::int,'flag-invalid-reg-score',
  'record','touchdown','regulation',4,'30000000-0000-0000-0000-000000000005',6,null,null,'{}',
  jsonb_build_array(jsonb_build_object(
    'participant_id',(select id from public.scorekeeping_participants where session_id=(s.value->>'session_id')::uuid
      and team_id='30000000-0000-0000-0000-000000000005' limit 1),
    'role','scorer','stat_key','tds','stat_delta',1)),null)
from cvf_test.ledger_runtime_state s where s.key='flag-invalid-ot-session';
select cvf_test.throws_ok(
  'sequence5a 19 [INV-08] overtime cannot begin when regulation is not tied',
  $$select public.append_scorekeeping_event(
    (value->>'session_id')::uuid,value->>'lease_token',(value->>'lease_version')::int,'flag-invalid-ot-event',
    'record','touchdown','overtime',1,'30000000-0000-0000-0000-000000000005',6,null,null,'{}',
    jsonb_build_array(jsonb_build_object(
      'participant_id',(select id from public.scorekeeping_participants where session_id=(value->>'session_id')::uuid
        and team_id='30000000-0000-0000-0000-000000000005' limit 1),
      'role','scorer','stat_key','tds','stat_delta',1)),null)
    from cvf_test.ledger_runtime_state where key='flag-invalid-ot-session'$$,
  '%[INV-08]%only after tied regulation%'
);

-- Leave one active, isolated fixture for the runner's two-real-connection
-- idempotency race. The runner verifies exactly one event survives.
select cvf_test.as_owner();
insert into public.games (id, league_id, sport, home_team_id, away_team_id, starts_at, venue_id)
values ('50000000-0000-0000-0000-000000000952','20000000-0000-0000-0000-000000000001','kickball',
  '30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','2026-10-22 18:00:00-06'::timestamptz, '60000000-0000-0000-0000-000000000005');
select cvf_test.as_admin('00000000-0000-0000-0000-000000000001');
insert into cvf_test.ledger_runtime_state values ('concurrency', public.start_scorekeeping_session(
  '50000000-0000-0000-0000-000000000952','CVF-KB-2026.1',5,null,false,'{}'::jsonb));

-- ---------------------------------------------------------------------------
-- Migration 29 — venues, authoritative start times, and participation.
-- ---------------------------------------------------------------------------
select cvf_test.as_owner();

-- The cutover is complete: no legacy schedule columns survive.
select cvf_test.ok(
  'migration29 01 legacy game date/time/location columns are gone',
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'games'
      and column_name in ('date', 'time', 'location')
  )
);
select cvf_test.ok(
  'migration29 02 starts_at is a required timestamptz and venue_id is required',
  (select data_type = 'timestamp with time zone' and is_nullable = 'NO'
     from information_schema.columns
    where table_schema = 'public' and table_name = 'games' and column_name = 'starts_at')
  and (select is_nullable = 'NO'
         from information_schema.columns
        where table_schema = 'public' and table_name = 'games' and column_name = 'venue_id')
);
select cvf_test.ok(
  'migration29 03 backfilled start times preserve the original local kickoff',
  (select starts_at at time zone 'America/Denver'
     from public.games where id = '50000000-0000-0000-0000-000000000001')
  = timestamp '2026-06-01 18:00:00'
);

-- Venue authorization. Where a game is played is public; changing it is not.
select cvf_test.as_anon();
select cvf_test.ok(
  'migration29 04 anonymous readers can see venues',
  (select count(*) from public.venues) > 0
);
select cvf_test.throws_ok(
  'migration29 05 anonymous venue insert is denied',
  $$insert into public.venues (name) values ('Anon Field')$$,
  '%denied%'
);
select cvf_test.as_user('00000000-0000-0000-0000-000000000002');
select cvf_test.throws_ok(
  'migration29 06 authenticated non-admin venue insert is denied',
  $$insert into public.venues (name) values ('Non Admin Field')$$,
  '%row-level security%'
);
select cvf_test.as_admin_aal1('00000000-0000-0000-0000-000000000001');
select cvf_test.throws_ok(
  'migration29 07 password-only admin venue insert is denied without AAL2',
  $$insert into public.venues (name) values ('AAL1 Field')$$,
  '%row-level security%'
);
select cvf_test.as_admin('00000000-0000-0000-0000-000000000001');
select cvf_test.lives_ok(
  'migration29 08 AAL2 admin can create a venue',
  $$insert into public.venues (name) values ('Admin Created Field')$$
);
select cvf_test.ok(
  'migration29 09 no client role holds delete on venues',
  not has_table_privilege('authenticated', 'public.venues', 'delete')
  and not has_table_privilege('anon', 'public.venues', 'delete')
);

-- Participation authorization.
select cvf_test.as_anon();
select cvf_test.throws_ok(
  'migration29 10 anonymous participation insert is denied',
  $$insert into public.game_participation (game_id, profile_id, team_id)
    values ('50000000-0000-0000-0000-000000000001',
            '10000000-0000-0000-0000-000000000001',
            '30000000-0000-0000-0000-000000000001')$$,
  '%denied%'
);
select cvf_test.throws_ok(
  'migration29 11 anonymous cannot execute set_game_participation',
  $$select public.set_game_participation('50000000-0000-0000-0000-000000000001', '[]'::jsonb)$$,
  '%denied%'
);
select cvf_test.as_user('00000000-0000-0000-0000-000000000002');
select cvf_test.throws_ok(
  'migration29 12 authenticated non-admin cannot set participation',
  $$select public.set_game_participation('50000000-0000-0000-0000-000000000001', '[]'::jsonb)$$,
  '%Admin only%'
);

-- Participation integrity.
select cvf_test.as_admin('00000000-0000-0000-0000-000000000001');
select cvf_test.throws_ok(
  'migration29 13 participation naming a team outside the game is rejected',
  $$insert into public.game_participation (game_id, profile_id, team_id)
    values ('50000000-0000-0000-0000-000000000001',
            '10000000-0000-0000-0000-000000000001',
            '30000000-0000-0000-0000-000000000005')$$,
  '%is not playing in game%'
);
select cvf_test.lives_ok(
  'migration29 14 AAL2 admin can record participation',
  $$select public.set_game_participation(
      '50000000-0000-0000-0000-000000000001',
      '[{"profile_id":"10000000-0000-0000-0000-000000000001",
         "team_id":"30000000-0000-0000-0000-000000000001",
         "status":"played"}]'::jsonb)$$
);
select cvf_test.throws_ok(
  'migration29 15 a player cannot be recorded twice for one game',
  $$insert into public.game_participation (game_id, profile_id, team_id)
    values ('50000000-0000-0000-0000-000000000001',
            '10000000-0000-0000-0000-000000000001',
            '30000000-0000-0000-0000-000000000001')$$,
  '%duplicate key%'
);

-- THE BOUNDARY: attendance is not part of the score lifecycle. Game
-- 50000000-...0003 is final and locked, so this is the assertion that proves
-- participation is independent of the lock without weakening it.
--
-- The published result is snapshotted first and compared afterwards, rather
-- than asserted against a literal score — earlier correction tests legitimately
-- change this game's score, and what matters here is that the participation
-- write changes nothing about it.
select cvf_test.as_owner();
create table cvf_test.m28_locked_game_snapshot as
select home_score, away_score, locked, score_status,
       (select count(*) from public.game_edit_history
         where game_id = '50000000-0000-0000-0000-000000000003') as history_rows
from public.games where id = '50000000-0000-0000-0000-000000000003';
grant select on cvf_test.m28_locked_game_snapshot to public;

select cvf_test.as_admin('00000000-0000-0000-0000-000000000001');
select cvf_test.lives_ok(
  'migration29 16 participation is recordable on a final locked game',
  $$select public.set_game_participation(
      '50000000-0000-0000-0000-000000000003',
      '[{"profile_id":"10000000-0000-0000-0000-000000000001",
         "team_id":"30000000-0000-0000-0000-000000000001",
         "status":"played"}]'::jsonb)$$
);
select cvf_test.ok(
  'migration29 17 recording participation leaves the locked result byte-for-byte unchanged',
  exists (
    select 1
    from public.games g, cvf_test.m28_locked_game_snapshot s
    where g.id = '50000000-0000-0000-0000-000000000003'
      and g.home_score is not distinct from s.home_score
      and g.away_score is not distinct from s.away_score
      and g.locked = s.locked
      and g.score_status = s.score_status
      and (select count(*) from public.game_edit_history
            where game_id = '50000000-0000-0000-0000-000000000003') = s.history_rows
  )
);
-- ---------------------------------------------------------------------------
-- Participation against a LEDGER-mode game.
--
-- The checks above prove participation is writable on a final locked AGGREGATE
-- game. That is not the risky case. INV-30/35/39 make effective ledger events
-- the SOLE correction authority for a ledger-mode game, so the real question is
-- whether a participation write can become a second one. Game ...950 is
-- ledger-mode, finalized, and has already been through a void/replace
-- correction, which makes it the strongest available target.
-- ---------------------------------------------------------------------------
select cvf_test.as_owner();
create table cvf_test.m29_ledger_game_snapshot as
select home_score, away_score, locked, score_status, status, periods, outcome_type,
       (select count(*) from public.player_stats
         where game_id = '50000000-0000-0000-0000-000000000950') as stat_rows,
       (select count(*) from public.game_edit_history
         where game_id = '50000000-0000-0000-0000-000000000950') as history_rows,
       (select count(*) from public.scorekeeping_events
         where game_id = '50000000-0000-0000-0000-000000000950') as event_rows
  from public.games where id = '50000000-0000-0000-0000-000000000950';
grant select on cvf_test.m29_ledger_game_snapshot to public;

select cvf_test.as_admin('00000000-0000-0000-0000-000000000001');
select cvf_test.lives_ok(
  'migration29 21 [INV-30] participation is recordable on a final locked LEDGER game',
  $$select public.set_game_participation(
      '50000000-0000-0000-0000-000000000950',
      '[{"profile_id":"10000000-0000-0000-0000-000000000001",
         "team_id":"30000000-0000-0000-0000-000000000001",
         "status":"played"}]'::jsonb)$$
);
select cvf_test.ok(
  'migration29 22 [INV-35][INV-39] it changes no ledger projection, no event, and no audit row',
  exists (
    select 1
    from public.games g, cvf_test.m29_ledger_game_snapshot s
    where g.id = '50000000-0000-0000-0000-000000000950'
      and g.home_score is not distinct from s.home_score
      and g.away_score is not distinct from s.away_score
      and g.periods is not distinct from s.periods
      and g.outcome_type is not distinct from s.outcome_type
      and g.locked = s.locked
      and g.status = s.status
      and g.score_status = s.score_status
      and (select count(*) from public.player_stats
            where game_id = '50000000-0000-0000-0000-000000000950') = s.stat_rows
      and (select count(*) from public.game_edit_history
            where game_id = '50000000-0000-0000-0000-000000000950') = s.history_rows
      and (select count(*) from public.scorekeeping_events
            where game_id = '50000000-0000-0000-0000-000000000950') = s.event_rows
  )
);

-- The games column allowlist is a NAMED COLUMN LIST, which means it goes stale
-- silently: dropping a listed column narrows the grant with no error, and
-- adding a column leaves it unwritable with no error. Migration 29 hit exactly
-- that. Pinning the exact expected set converts a silent drift into a loud
-- failure the next time anyone changes the games table.
select cvf_test.as_owner();
select cvf_test.eq_text(
  'migration29 19 the games update allowlist is exactly the schedule columns',
  (select string_agg(column_name, ',' order by column_name)
     from information_schema.column_privileges
    where grantee = 'authenticated'
      and table_schema = 'public' and table_name = 'games'
      and privilege_type = 'UPDATE'),
  'away_team_id,home_team_id,league_id,sport,stage,starts_at,temp_admin_id,venue_id'
);
select cvf_test.eq_text(
  'migration29 20 the games insert allowlist is exactly the schedule columns plus id',
  (select string_agg(column_name, ',' order by column_name)
     from information_schema.column_privileges
    where grantee = 'authenticated'
      and table_schema = 'public' and table_name = 'games'
      and privilege_type = 'INSERT'),
  'away_team_id,home_team_id,id,league_id,sport,stage,starts_at,temp_admin_id,venue_id'
);
select cvf_test.as_admin('00000000-0000-0000-0000-000000000001');

select cvf_test.ok(
  'migration29 18 replacing a participation set does not accumulate rows',
  (select public.set_game_participation(
     '50000000-0000-0000-0000-000000000003',
     '[{"profile_id":"10000000-0000-0000-0000-000000000001",
        "team_id":"30000000-0000-0000-0000-000000000001",
        "status":"absent"}]'::jsonb)) = 1
  and (select count(*) from public.game_participation
        where game_id = '50000000-0000-0000-0000-000000000003') = 1
);

-- ---------------------------------------------------------------------------
-- Migration 30 — practice mode: sessions without games (Option B).
--
-- Practice evidence lives only in the four private scorekeeping tables. Every
-- assertion that says "writes nothing official" compares row counts AND
-- order-independent row hashes of games / player_stats / game_edit_history /
-- playoff_matches against this owner-captured baseline.
--
-- Not separately asserted because they are game-keyed by signature and cannot
-- name a practice session at all: declare_ledger_forfeit(p_game_id, ...) and
-- start_scorekeeping_correction(p_game_id, ...) take a game id, and a
-- practice session has none.
-- ---------------------------------------------------------------------------
select cvf_test.as_owner();
create table cvf_test.practice_official_baseline as
select
  (select count(*) from public.games) as games_count,
  (select coalesce(sum(hashtextextended(g::text, 0)), 0) from public.games g) as games_hash,
  (select count(*) from public.player_stats) as stats_count,
  (select coalesce(sum(hashtextextended(s::text, 0)), 0) from public.player_stats s) as stats_hash,
  (select count(*) from public.game_edit_history) as history_count,
  (select coalesce(sum(hashtextextended(h::text, 0)), 0) from public.game_edit_history h) as history_hash,
  (select count(*) from public.playoff_matches) as matches_count,
  (select coalesce(sum(hashtextextended(m::text, 0)), 0) from public.playoff_matches m) as matches_hash;
grant select on cvf_test.practice_official_baseline to public;

select cvf_test.ok(
  'practice 01 [INV-19] practice RPC privilege boundary matches the official pattern',
  has_function_privilege('authenticated', 'public.start_practice_session(uuid,uuid,text,integer,text,jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.start_practice_session(uuid,uuid,text,integer,text,jsonb)', 'execute')
  and not has_function_privilege('service_role', 'public.start_practice_session(uuid,uuid,text,integer,text,jsonb)', 'execute')
  and has_function_privilege('authenticated', 'public.append_practice_event(uuid,text,integer,text,text,text,text,integer,uuid,integer,uuid,uuid,jsonb,jsonb,text)', 'execute')
  and not has_function_privilege('anon', 'public.append_practice_event(uuid,text,integer,text,text,text,text,integer,uuid,integer,uuid,uuid,jsonb,jsonb,text)', 'execute')
  and not has_function_privilege('service_role', 'public.append_practice_event(uuid,text,integer,text,text,text,text,integer,uuid,integer,uuid,uuid,jsonb,jsonb,text)', 'execute')
  and has_function_privilege('authenticated', 'public.finalize_practice_session(uuid,text,integer,text,text)', 'execute')
  and not has_function_privilege('anon', 'public.finalize_practice_session(uuid,text,integer,text,text)', 'execute')
  and not has_function_privilege('service_role', 'public.finalize_practice_session(uuid,text,integer,text,text)', 'execute')
  and not has_function_privilege('anon', 'public.start_practice_correction(uuid,text)', 'execute')
  and not has_function_privilege('service_role', 'public.start_practice_correction(uuid,text)', 'execute')
  and has_function_privilege('authenticated', 'public.start_practice_correction(uuid,text)', 'execute')
  -- The remaining three of the seven. The grant/revoke lines are copy-paste
  -- identical, which is exactly why a single omitted one would not be noticed.
  and has_function_privilege('authenticated', 'public.renew_practice_session(uuid,text,integer)', 'execute')
  and not has_function_privilege('anon', 'public.renew_practice_session(uuid,text,integer)', 'execute')
  and not has_function_privilege('service_role', 'public.renew_practice_session(uuid,text,integer)', 'execute')
  and has_function_privilege('authenticated', 'public.resume_practice_session(uuid,text)', 'execute')
  and not has_function_privilege('anon', 'public.resume_practice_session(uuid,text)', 'execute')
  and not has_function_privilege('service_role', 'public.resume_practice_session(uuid,text)', 'execute')
  and has_function_privilege('authenticated', 'public.cancel_practice_session(uuid,text,integer,text)', 'execute')
  and not has_function_privilege('anon', 'public.cancel_practice_session(uuid,text,integer,text)', 'execute')
  and not has_function_privilege('service_role', 'public.cancel_practice_session(uuid,text,integer,text)', 'execute')
);

select cvf_test.as_admin_aal1('00000000-0000-0000-0000-000000000001');
select cvf_test.throws_ok(
  'practice 02 [INV-19] AAL1 admin cannot start a practice session',
  $$select public.start_practice_session('30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','CVF-KB-PRAC-2026.1',5)$$,
  '%Admin only%'
);
select cvf_test.as_user('00000000-0000-0000-0000-000000000002');
select cvf_test.throws_ok(
  'practice 03 [INV-19] non-admin cannot start a practice session',
  $$select public.start_practice_session('30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','CVF-KB-PRAC-2026.1',5)$$,
  '%Admin only%'
);
select cvf_test.throws_ok(
  'practice 04 [INV-19] non-admin cannot finalize a practice session',
  $$select public.finalize_practice_session('00000000-0000-0000-0000-000000000000','invalid',1,'denied')$$,
  '%Admin only%'
);

select cvf_test.as_admin('00000000-0000-0000-0000-000000000001');
select cvf_test.throws_ok(
  'practice 05 [INV-10] practice teams must share one sport and league season',
  $$select public.start_practice_session('30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000005','CVF-PRAC-2026.1',5)$$,
  '%one sport and league season%'
);

insert into cvf_test.ledger_runtime_state values ('practice-flag', public.start_practice_session(
  '30000000-0000-0000-0000-000000000005',
  (select id from public.teams where league_id='20000000-0000-0000-0000-000000000002'
    and id<>'30000000-0000-0000-0000-000000000005' order by created_at limit 1),
  'CVF-FF-PRAC-2026.1', 4, 'one possession each', '{"practice":true}'::jsonb));
select cvf_test.ok(
  'practice 06 [INV-10][INV-11][INV-27] practice start snapshots both rosters with no game and stage=practice',
  (select session.session_kind='practice' and session.game_id is null and session.stage='practice'
      and session.status='open' and session.allow_ties=false
      and (state.value->>'lease_version')::int=1 and length(state.value->>'lease_token')>20
      and exists (select 1 from public.scorekeeping_participants participant
            where participant.session_id=session.id and participant.team_id=session.home_team_id and participant.game_id is null)
      and exists (select 1 from public.scorekeeping_participants participant
            where participant.session_id=session.id and participant.team_id=session.away_team_id and participant.game_id is null)
      and (select count(*) from public.games) = (select games_count from cvf_test.practice_official_baseline)
   from cvf_test.ledger_runtime_state state
   join public.scorekeeping_sessions session on session.id=(state.value->>'session_id')::uuid
   where state.key='practice-flag')
);

insert into cvf_test.ledger_runtime_state
select 'practice-td-home', public.append_practice_event(
  (s.value->>'session_id')::uuid,s.value->>'lease_token',(s.value->>'lease_version')::int,'practice-td-home',
  'record','touchdown','regulation',1,'30000000-0000-0000-0000-000000000005',6,null,null,'{}',
  jsonb_build_array(jsonb_build_object(
    'participant_id',(select id from public.scorekeeping_participants where session_id=(s.value->>'session_id')::uuid
      and team_id='30000000-0000-0000-0000-000000000005' order by id limit 1),
    'role','scorer','stat_key','tds','stat_delta',1)),null)
from cvf_test.ledger_runtime_state s where s.key='practice-flag';
insert into cvf_test.ledger_runtime_state
select 'practice-carry', public.append_practice_event(
  (s.value->>'session_id')::uuid,s.value->>'lease_token',(s.value->>'lease_version')::int,'practice-carry',
  'record','carry','regulation',2,'30000000-0000-0000-0000-000000000005',0,null,null,'{}',
  jsonb_build_array(
    jsonb_build_object('participant_id',(select id from public.scorekeeping_participants
      where session_id=(s.value->>'session_id')::uuid and team_id='30000000-0000-0000-0000-000000000005' order by id limit 1),
      'role','rusher','stat_key','carries','stat_delta',1),
    jsonb_build_object('participant_id',(select id from public.scorekeeping_participants
      where session_id=(s.value->>'session_id')::uuid and team_id='30000000-0000-0000-0000-000000000005' order by id limit 1),
      'role','rusher','stat_key','rushYards','stat_delta',-3)),null)
from cvf_test.ledger_runtime_state s where s.key='practice-flag';
insert into cvf_test.ledger_runtime_state
select 'practice-td-away', public.append_practice_event(
  (s.value->>'session_id')::uuid,s.value->>'lease_token',(s.value->>'lease_version')::int,'practice-td-away',
  'record','touchdown','regulation',3,
  (select away_team_id from public.scorekeeping_sessions where id=(s.value->>'session_id')::uuid),6,null,null,'{}',
  jsonb_build_array(jsonb_build_object(
    'participant_id',(select id from public.scorekeeping_participants where session_id=(s.value->>'session_id')::uuid
      and team_id=(select away_team_id from public.scorekeeping_sessions where id=(s.value->>'session_id')::uuid) order by id limit 1),
    'role','scorer','stat_key','tds','stat_delta',1)),null)
from cvf_test.ledger_runtime_state s where s.key='practice-flag';

select cvf_test.ok(
  'practice 07 [INV-03][INV-14] practice events sequence densely from 1 and accept signed rushing yardage',
  (select array_agg(event.sequence_number order by event.sequence_number)=array[1,2,3]
     from public.scorekeeping_events event
     join cvf_test.ledger_runtime_state s on s.key='practice-flag'
    where event.session_id=(s.value->>'session_id')::uuid)
  and exists (
    select 1 from cvf_test.ledger_runtime_state carry
    join public.scorekeeping_event_attributions attr on attr.event_id=(carry.value->>'event_id')::uuid
    where carry.key='practice-carry' and attr.stat_key='rushYards' and attr.stat_delta=-3 and attr.game_id is null)
);
select cvf_test.ok(
  'practice 08 [INV-15] same practice command replay returns the original event with no duplicate row',
  (select (public.append_practice_event(
    (s.value->>'session_id')::uuid,s.value->>'lease_token',(s.value->>'lease_version')::int,'practice-carry',
    'record','carry','regulation',2,'30000000-0000-0000-0000-000000000005',0,null,null,'{}',
    jsonb_build_array(
      jsonb_build_object('participant_id',(select id from public.scorekeeping_participants
        where session_id=(s.value->>'session_id')::uuid and team_id='30000000-0000-0000-0000-000000000005' order by id limit 1),
        'role','rusher','stat_key','carries','stat_delta',1),
      jsonb_build_object('participant_id',(select id from public.scorekeeping_participants
        where session_id=(s.value->>'session_id')::uuid and team_id='30000000-0000-0000-0000-000000000005' order by id limit 1),
        'role','rusher','stat_key','rushYards','stat_delta',-3)),null) ->> 'replayed')::boolean
   from cvf_test.ledger_runtime_state s where s.key='practice-flag')
  and (select count(*)=3 from public.scorekeeping_events event
        join cvf_test.ledger_runtime_state s on s.key='practice-flag'
       where event.session_id=(s.value->>'session_id')::uuid)
);
select cvf_test.throws_ok(
  'practice 09 [INV-15] changed command cannot reuse a practice event key',
  $$select public.append_practice_event((value->>'session_id')::uuid,value->>'lease_token',(value->>'lease_version')::int,
    'practice-carry','record','carry','regulation',2,'30000000-0000-0000-0000-000000000005',0,null,null,'{"changed":true}'::jsonb,'[]'::jsonb,null)
    from cvf_test.ledger_runtime_state where key='practice-flag'$$,
  '%different command%'
);
select cvf_test.throws_ok(
  'practice 10 [INV-04][INV-40] append_practice_event rejects an ordinary game session',
  $$select public.append_practice_event((value->>'session_id')::uuid,value->>'lease_token',(value->>'lease_version')::int,
    'practice-cross-key','record','run','regulation',1,'30000000-0000-0000-0000-000000000001',1,null,null,'{}','[]',null)
    from cvf_test.ledger_runtime_state where key='concurrency'$$,
  '%only a practice session%'
);
select cvf_test.throws_ok(
  'practice 11 [INV-04][INV-40] the official append path rejects a practice session',
  $$select public.append_scorekeeping_event((value->>'session_id')::uuid,value->>'lease_token',(value->>'lease_version')::int,
    'practice-cross-official','record','touchdown','regulation',1,'30000000-0000-0000-0000-000000000005',6,null,null,'{}','[]',null)
    from cvf_test.ledger_runtime_state where key='practice-flag'$$,
  '%Unknown scorekeeping session%'
);
select cvf_test.throws_ok(
  'practice 12 [INV-04][INV-40] the official finalize path rejects a practice session',
  $$select public.finalize_scorekeeping_session((value->>'session_id')::uuid,value->>'lease_token',(value->>'lease_version')::int,
    'practice-cross-final',null)
    from cvf_test.ledger_runtime_state where key='practice-flag'$$,
  '%Unknown scorekeeping session%'
);

insert into cvf_test.ledger_runtime_state
select 'practice-reg-eval', public.finalize_practice_session(
  (s.value->>'session_id')::uuid,s.value->>'lease_token',(s.value->>'lease_version')::int,'practice-reg-eval',null)
from cvf_test.ledger_runtime_state s where s.key='practice-flag';
select cvf_test.ok(
  'practice 13 [INV-08] tied practice regulation returns continue_overtime without closing the session',
  (select (result.value->>'ok')::boolean and result.value->>'status'='continue_overtime'
      and (result.value->>'next_overtime_period')::int=1
      and session.status='open'
   from cvf_test.ledger_runtime_state result
   join cvf_test.ledger_runtime_state s on s.key='practice-flag'
   join public.scorekeeping_sessions session on session.id=(s.value->>'session_id')::uuid
   where result.key='practice-reg-eval')
);
select cvf_test.throws_ok(
  'practice 14 [INV-08] practice overtime enforces the current open period',
  $$select public.append_practice_event((value->>'session_id')::uuid,value->>'lease_token',(value->>'lease_version')::int,
    'practice-ot2-early','record','touchdown','overtime',2,'30000000-0000-0000-0000-000000000005',6,null,null,'{}',
    jsonb_build_array(jsonb_build_object(
      'participant_id',(select id from public.scorekeeping_participants where session_id=(value->>'session_id')::uuid
        and team_id='30000000-0000-0000-0000-000000000005' order by id limit 1),
      'role','scorer','stat_key','tds','stat_delta',1)),null)
    from cvf_test.ledger_runtime_state where key='practice-flag'$$,
  '%not the current open period 1%'
);
insert into cvf_test.ledger_runtime_state
select 'practice-ot1-home', public.append_practice_event(
  (s.value->>'session_id')::uuid,s.value->>'lease_token',(s.value->>'lease_version')::int,'practice-ot1-home',
  'record','touchdown','overtime',1,'30000000-0000-0000-0000-000000000005',6,null,null,'{}',
  jsonb_build_array(jsonb_build_object(
    'participant_id',(select id from public.scorekeeping_participants where session_id=(s.value->>'session_id')::uuid
      and team_id='30000000-0000-0000-0000-000000000005' order by id limit 1),
    'role','scorer','stat_key','tds','stat_delta',1)),null)
from cvf_test.ledger_runtime_state s where s.key='practice-flag';
insert into cvf_test.ledger_runtime_state
select 'practice-ot1-open-eval', public.finalize_practice_session(
  (s.value->>'session_id')::uuid,s.value->>'lease_token',(s.value->>'lease_version')::int,'practice-ot1-open-eval',null)
from cvf_test.ledger_runtime_state s where s.key='practice-flag';
select cvf_test.ok(
  'practice 15 [INV-08] an open practice overtime period cannot finalize before the admin close',
  (select result.value->>'status'='overtime_period_open' and session.status='open'
   from cvf_test.ledger_runtime_state result
   join cvf_test.ledger_runtime_state s on s.key='practice-flag'
   join public.scorekeeping_sessions session on session.id=(s.value->>'session_id')::uuid
   where result.key='practice-ot1-open-eval')
);
insert into cvf_test.ledger_runtime_state
select 'practice-ot1-close', public.append_practice_event(
  (s.value->>'session_id')::uuid,s.value->>'lease_token',(s.value->>'lease_version')::int,'practice-ot1-close',
  'record','period_close','overtime',1,null,0,null,null,'{}','[]',null)
from cvf_test.ledger_runtime_state s where s.key='practice-flag';
insert into cvf_test.ledger_runtime_state
select 'practice-final', public.finalize_practice_session(
  (s.value->>'session_id')::uuid,s.value->>'lease_token',(s.value->>'lease_version')::int,'practice-final',null)
from cvf_test.ledger_runtime_state s where s.key='practice-flag';
select cvf_test.ok(
  'practice 16 [INV-01][INV-08] practice finalization returns the projection preview and closes only the private session',
  (select result.value->>'status'='practice_finalized'
      and (result.value#>>'{projection,home_score}')::int=12
      and (result.value#>>'{projection,away_score}')::int=6
      and result.value#>'{projection,periods}'='{"home":[6,0,0,0,6],"away":[0,0,6,0,0]}'::jsonb
      and result.value#>>'{projection,winner_team_id}'='30000000-0000-0000-0000-000000000005'
      and session.status='finalized' and session.closed_at is not null
   from cvf_test.ledger_runtime_state result
   join cvf_test.ledger_runtime_state s on s.key='practice-flag'
   join public.scorekeeping_sessions session on session.id=(s.value->>'session_id')::uuid
   where result.key='practice-final')
);
select cvf_test.as_owner();
select cvf_test.ok(
  'practice 17 [INV-25][INV-35][INV-39] practice finalization writes nothing official',
  (select (select count(*) from public.games)=b.games_count
      and (select coalesce(sum(hashtextextended(g::text,0)),0) from public.games g)=b.games_hash
      and (select count(*) from public.player_stats)=b.stats_count
      and (select coalesce(sum(hashtextextended(s::text,0)),0) from public.player_stats s)=b.stats_hash
      and (select count(*) from public.game_edit_history)=b.history_count
      and (select coalesce(sum(hashtextextended(h::text,0)),0) from public.game_edit_history h)=b.history_hash
      and (select count(*) from public.playoff_matches)=b.matches_count
      and (select coalesce(sum(hashtextextended(m::text,0)),0) from public.playoff_matches m)=b.matches_hash
   from cvf_test.practice_official_baseline b)
);
select cvf_test.as_admin('00000000-0000-0000-0000-000000000001');
select cvf_test.ok(
  'practice 18 [INV-15] practice finalization replay is stable',
  (select public.finalize_practice_session(
    (s.value->>'session_id')::uuid,s.value->>'lease_token',(s.value->>'lease_version')::int,'practice-final',null)=final.value
   from cvf_test.ledger_runtime_state s cross join cvf_test.ledger_runtime_state final
   where s.key='practice-flag' and final.key='practice-final')
);
select cvf_test.throws_ok(
  'practice 19 [INV-15] a different key cannot replay the finalized practice result',
  $$select public.finalize_practice_session((value->>'session_id')::uuid,value->>'lease_token',(value->>'lease_version')::int,
    'practice-final-different',null)
    from cvf_test.ledger_runtime_state where key='practice-flag'$$,
  '%different command%'
);

insert into cvf_test.ledger_runtime_state
select 'practice-correction', public.start_practice_correction(
  (s.value->>'session_id')::uuid, 'Rehearse a yardage correction')
from cvf_test.ledger_runtime_state s where s.key='practice-flag';
select cvf_test.throws_ok(
  'practice 20 [INV-16][INV-17] a practice correction rejects new record events',
  $$select public.append_practice_event((value->>'session_id')::uuid,value->>'lease_token',(value->>'lease_version')::int,
    'practice-correction-record','record','touchdown','regulation',1,'30000000-0000-0000-0000-000000000005',6,null,null,'{}',
    jsonb_build_array(jsonb_build_object(
      'participant_id',(select id from public.scorekeeping_participants where session_id=(value->>'session_id')::uuid
        and team_id='30000000-0000-0000-0000-000000000005' order by id limit 1),
      'role','scorer','stat_key','tds','stat_delta',1)),null)
    from cvf_test.ledger_runtime_state where key='practice-correction'$$,
  '%only void or replace%'
);
insert into cvf_test.ledger_runtime_state
select 'practice-void', public.append_practice_event(
  (c.value->>'session_id')::uuid,c.value->>'lease_token',(c.value->>'lease_version')::int,'practice-void',
  'void','void',null,null,null,0,(carry.value->>'event_id')::uuid,null,'{}','[]',null)
from cvf_test.ledger_runtime_state c cross join cvf_test.ledger_runtime_state carry
where c.key='practice-correction' and carry.key='practice-carry';
insert into cvf_test.ledger_runtime_state
select 'practice-replace', public.append_practice_event(
  (c.value->>'session_id')::uuid,c.value->>'lease_token',(c.value->>'lease_version')::int,'practice-replace',
  'replace','carry','regulation',2,'30000000-0000-0000-0000-000000000005',0,null,(carry.value->>'event_id')::uuid,'{}',
  jsonb_build_array(
    jsonb_build_object('participant_id',(select id from public.scorekeeping_participants
      where session_id=(c.value->>'session_id')::uuid and team_id='30000000-0000-0000-0000-000000000005' order by id limit 1),
      'role','rusher','stat_key','carries','stat_delta',1),
    jsonb_build_object('participant_id',(select id from public.scorekeeping_participants
      where session_id=(c.value->>'session_id')::uuid and team_id='30000000-0000-0000-0000-000000000005' order by id limit 1),
      'role','rusher','stat_key','rushYards','stat_delta',7)),null)
from cvf_test.ledger_runtime_state c cross join cvf_test.ledger_runtime_state carry
where c.key='practice-correction' and carry.key='practice-carry';
insert into cvf_test.ledger_runtime_state
select 'practice-correction-final', public.finalize_practice_session(
  (c.value->>'session_id')::uuid,c.value->>'lease_token',(c.value->>'lease_version')::int,'practice-correction-final',null)
from cvf_test.ledger_runtime_state c where c.key='practice-correction';
select cvf_test.ok(
  'practice 21 [INV-16][INV-17][INV-36] practice correction voids and replaces inside the private chain',
  (select result.value->>'status'='practice_finalized'
      and (result.value#>>'{projection,home_score}')::int=12
      and (result.value#>>'{projection,away_score}')::int=6
      and exists (select 1 from jsonb_each(result.value#>'{projection,player_stats}') player
            where (player.value#>>'{stats,rushYards}')::int=7)
      and (select array_agg(event.sequence_number order by event.sequence_number)=array[1,2]
             from public.scorekeeping_events event
             join cvf_test.ledger_runtime_state c on c.key='practice-correction'
            where event.session_id=(c.value->>'session_id')::uuid)
   from cvf_test.ledger_runtime_state result
   where result.key='practice-correction-final')
);
select cvf_test.as_owner();
select cvf_test.ok(
  'practice 22 [INV-25][INV-35][INV-39] practice correction finalization also writes nothing official',
  (select (select count(*) from public.games)=b.games_count
      and (select coalesce(sum(hashtextextended(g::text,0)),0) from public.games g)=b.games_hash
      and (select count(*) from public.player_stats)=b.stats_count
      and (select coalesce(sum(hashtextextended(s::text,0)),0) from public.player_stats s)=b.stats_hash
      and (select count(*) from public.game_edit_history)=b.history_count
      and (select coalesce(sum(hashtextextended(h::text,0)),0) from public.game_edit_history h)=b.history_hash
   from cvf_test.practice_official_baseline b)
);

select cvf_test.as_admin('00000000-0000-0000-0000-000000000001');
insert into cvf_test.ledger_runtime_state values ('practice-kb', public.start_practice_session(
  '30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','CVF-KB-PRAC-2026.1',5,null,'{}'::jsonb));
insert into cvf_test.ledger_runtime_state
select 'practice-kb-renewed', public.renew_practice_session(
  (value->>'session_id')::uuid,value->>'lease_token',(value->>'lease_version')::int)
from cvf_test.ledger_runtime_state where key='practice-kb';
select cvf_test.throws_ok(
  'practice 23 [INV-20] practice lease renewal invalidates the old token and version',
  $$select public.renew_practice_session((value->>'session_id')::uuid,value->>'lease_token',(value->>'lease_version')::int)
    from cvf_test.ledger_runtime_state where key='practice-kb'$$,
  '%stale or invalid%'
);
insert into cvf_test.ledger_runtime_state
select 'practice-kb-resumed', public.resume_practice_session((value->>'session_id')::uuid, null)
from cvf_test.ledger_runtime_state where key='practice-kb';
select cvf_test.ok(
  'practice 24 [INV-20] practice resume rotates the lease',
  (select (resumed.value->>'lease_version')::int=3
      and resumed.value->>'session_id'=started.value->>'session_id'
   from cvf_test.ledger_runtime_state resumed cross join cvf_test.ledger_runtime_state started
   where resumed.key='practice-kb-resumed' and started.key='practice-kb')
);
select cvf_test.throws_ok(
  'practice 25 [INV-25] canceling a practice session requires a reason',
  $$select public.cancel_practice_session((value->>'session_id')::uuid,value->>'lease_token',(value->>'lease_version')::int,'   ')
    from cvf_test.ledger_runtime_state where key='practice-kb-resumed'$$,
  '%requires a reason%'
);
select public.cancel_practice_session(
  (value->>'session_id')::uuid,value->>'lease_token',(value->>'lease_version')::int,'Rehearsal complete')
from cvf_test.ledger_runtime_state where key='practice-kb-resumed';
select cvf_test.as_owner();
select cvf_test.ok(
  'practice 26 [INV-25] practice cancel closes the private session and writes no official audit',
  (select session.status='canceled' and session.closed_at is not null
      and (select count(*) from public.game_edit_history)=(select history_count from cvf_test.practice_official_baseline)
   from cvf_test.ledger_runtime_state state
   join public.scorekeeping_sessions session on session.id=(state.value->>'session_id')::uuid
   where state.key='practice-kb')
);

-- Structural impossibilities, attempted through the controlled path itself.
select set_config('cvf.ledger_session_mutation', 'on', false);
select cvf_test.throws_ok(
  'practice 27 [INV-28] an ordinary session can never have a NULL game',
  $$insert into public.scorekeeping_sessions
      (game_id, session_kind, status, opened_by, lease_token_hash, lease_expires_at,
       sport, league_id, season, stage, home_team_id, away_team_id, rule_version,
       regulation_period_count, allow_ties, rules_snapshot)
    values (null,'ordinary','open','00000000-0000-0000-0000-000000000001','deadbeef',now()+interval '10 minutes',
       'kickball','20000000-0000-0000-0000-000000000001','Summer 2026','regular',
       '30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','CVF-KB-2026.1',5,false,'{}')$$,
  '%ledger-mode game%'
);
select cvf_test.throws_ok(
  'practice 28 [INV-28] a practice session can never reference a game',
  $$insert into public.scorekeeping_sessions
      (game_id, session_kind, status, opened_by, lease_token_hash, lease_expires_at,
       sport, league_id, season, stage, home_team_id, away_team_id, rule_version,
       regulation_period_count, allow_ties, rules_snapshot)
    values ('50000000-0000-0000-0000-000000000950','practice','open','00000000-0000-0000-0000-000000000001','deadbeef',now()+interval '10 minutes',
       'kickball','20000000-0000-0000-0000-000000000001','Summer 2026','practice',
       '30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','CVF-KB-2026.1',5,false,'{}')$$,
  '%practice_game%'
);
select set_config('cvf.ledger_session_mutation', '', false);

-- A live practice session between two teams must not consume any real game's
-- one-active-session slot.
insert into public.games (id, league_id, sport, home_team_id, away_team_id, starts_at, venue_id)
values ('50000000-0000-0000-0000-000000000958','20000000-0000-0000-0000-000000000001','kickball',
  '30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002',
  '2026-11-12 18:00:00-07'::timestamptz,'60000000-0000-0000-0000-000000000003');
select cvf_test.as_admin('00000000-0000-0000-0000-000000000001');
insert into cvf_test.ledger_runtime_state values ('practice-kb2', public.start_practice_session(
  '30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','CVF-KB-PRAC-2026.2',5,null,'{}'::jsonb));
insert into cvf_test.ledger_runtime_state values ('practice-real-game', public.start_scorekeeping_session(
  '50000000-0000-0000-0000-000000000958','CVF-KB-2026.1',5,null,false,'{}'::jsonb));
select cvf_test.ok(
  'practice 29 [INV-18] an open practice session never blocks a real game''s ordinary session',
  (select length(realgame.value->>'session_id')=36
      and (select status='live' from public.games where id='50000000-0000-0000-0000-000000000958')
      and (select status='open' from public.scorekeeping_sessions where id=(kb2.value->>'session_id')::uuid)
   from cvf_test.ledger_runtime_state realgame cross join cvf_test.ledger_runtime_state kb2
   where realgame.key='practice-real-game' and kb2.key='practice-kb2')
);

select cvf_test.as_user('00000000-0000-0000-0000-000000000002');
select cvf_test.ok(
  'practice 30 [INV-27] practice evidence is invisible to non-admin clients',
  (select count(*)=0 from public.scorekeeping_sessions where session_kind='practice')
  and (select count(*)=0 from public.scorekeeping_events where game_id is null)
);
select cvf_test.as_admin('00000000-0000-0000-0000-000000000001');
select cvf_test.ok(
  'practice 31 [INV-27] the administrator can read practice evidence',
  (select count(*)>0 from public.scorekeeping_sessions where session_kind='practice')
  and (select count(*)>0 from public.scorekeeping_events where game_id is null)
);

-- Making game_id nullable stopped the composite (id, game_id) foreign keys from
-- enforcing on practice rows, because a composite FK with any NULL column is
-- never checked. Migration 30 replaces that with plain FKs plus these two
-- procedural guards, so the guards themselves need direct proof: nothing else
-- now stops a practice session from reaching into an unrelated one.
insert into cvf_test.ledger_runtime_state
select 'practice-chain-fork', public.start_practice_correction(
  (s.value->>'session_id')::uuid, 'Rehearsal: prove chain isolation')
from cvf_test.ledger_runtime_state s where s.key='practice-flag';

select cvf_test.throws_ok(
  'practice 32 [INV-11][INV-36] a practice event cannot attribute a participant from an unrelated practice session',
  $$select public.append_practice_event((kb2.value->>'session_id')::uuid,kb2.value->>'lease_token',
    (kb2.value->>'lease_version')::int,'practice-cross-participant','record','run','regulation',1,
    '30000000-0000-0000-0000-000000000001',1,null,null,'{}'::jsonb,
    jsonb_build_array(jsonb_build_object(
      'participant_id',(select participant.id from public.scorekeeping_participants participant
         join cvf_test.ledger_runtime_state flag on flag.key='practice-flag'
        where participant.session_id=(flag.value->>'session_id')::uuid order by participant.id limit 1),
      'role','scorer','stat_key','runs','stat_delta',1)),null)
    from cvf_test.ledger_runtime_state kb2 where kb2.key='practice-kb2'$$,
  '%outside the event session snapshot%'
);

-- A real event in an unrelated practice chain, so the next assertion fails for
-- the intended reason rather than on a NULL target.
insert into cvf_test.ledger_runtime_state
select 'practice-kb2-run', public.append_practice_event(
  (kb2.value->>'session_id')::uuid,kb2.value->>'lease_token',(kb2.value->>'lease_version')::int,
  'practice-kb2-run','record','run','regulation',1,'30000000-0000-0000-0000-000000000001',1,null,null,'{}',
  jsonb_build_array(jsonb_build_object(
    'participant_id',(select participant.id from public.scorekeeping_participants participant
      where participant.session_id=(kb2.value->>'session_id')::uuid
        and participant.team_id='30000000-0000-0000-0000-000000000001' order by participant.id limit 1),
    'role','scorer','stat_key','runs','stat_delta',1)),null)
from cvf_test.ledger_runtime_state kb2 where kb2.key='practice-kb2';

select cvf_test.throws_ok(
  'practice 33 [INV-16][INV-36] a practice correction cannot void an event from an unrelated practice chain',
  $$select public.append_practice_event((fork.value->>'session_id')::uuid,fork.value->>'lease_token',
    (fork.value->>'lease_version')::int,'practice-cross-void','void','void',null,null,null,0,
    (select (kbrun.value->>'event_id')::uuid from cvf_test.ledger_runtime_state kbrun
      where kbrun.key='practice-kb2-run'),
    null,'{}'::jsonb,'[]'::jsonb,null)
    from cvf_test.ledger_runtime_state fork where fork.key='practice-chain-fork'$$,
  '%same practice chain%'
);

-- INV-40 was proven for only three of the eleven RPC/direction pairs, and the
-- migration's rationale is that most of the official-side rejection is
-- INCIDENTAL — it falls out of an existing game_id lookup rather than being
-- engineered per RPC. That is exactly the kind of property a later unrelated
-- edit to one of these RPCs breaks silently, so each direction is pinned.
-- The kind guard fires before the lease check in every practice RPC, so these
-- cannot pass on a stale-lease error instead.
select cvf_test.throws_ok(
  'practice 34 [INV-04][INV-40] renew_practice_session rejects an ordinary game session',
  $$select public.renew_practice_session((value->>'session_id')::uuid,value->>'lease_token',(value->>'lease_version')::int)
    from cvf_test.ledger_runtime_state where key='concurrency'$$,
  '%renew_practice_session may target only a practice session%'
);
select cvf_test.throws_ok(
  'practice 35 [INV-04][INV-40] resume_practice_session rejects an ordinary game session',
  $$select public.resume_practice_session((value->>'session_id')::uuid, null)
    from cvf_test.ledger_runtime_state where key='concurrency'$$,
  '%resume_practice_session may target only a practice session%'
);
select cvf_test.throws_ok(
  'practice 36 [INV-04][INV-40] cancel_practice_session rejects an ordinary game session',
  $$select public.cancel_practice_session((value->>'session_id')::uuid,value->>'lease_token',(value->>'lease_version')::int,'Wrong kind')
    from cvf_test.ledger_runtime_state where key='concurrency'$$,
  '%cancel_practice_session may target only a practice session%'
);
select cvf_test.throws_ok(
  'practice 37 [INV-04][INV-40] start_practice_correction rejects an ordinary game session',
  $$select public.start_practice_correction((value->>'session_id')::uuid,'Wrong kind')
    from cvf_test.ledger_runtime_state where key='concurrency'$$,
  '%start_practice_correction may target only a practice session%'
);

select cvf_test.throws_ok(
  'practice 38 [INV-04][INV-40] the official renew path rejects a practice session',
  $$select public.renew_scorekeeping_session((value->>'session_id')::uuid,value->>'lease_token',(value->>'lease_version')::int)
    from cvf_test.ledger_runtime_state where key='practice-flag'$$,
  '%Unknown scorekeeping session%'
);
select cvf_test.throws_ok(
  'practice 39 [INV-04][INV-40] the official resume path rejects a practice session',
  $$select public.resume_scorekeeping_session((value->>'session_id')::uuid, null)
    from cvf_test.ledger_runtime_state where key='practice-flag'$$,
  '%Unknown scorekeeping session%'
);
select cvf_test.throws_ok(
  'practice 40 [INV-04][INV-40] the official cancel path rejects a practice session',
  $$select public.cancel_scorekeeping_session((value->>'session_id')::uuid,value->>'lease_token',(value->>'lease_version')::int,'Wrong kind')
    from cvf_test.ledger_runtime_state where key='practice-flag'$$,
  '%Unknown scorekeeping session%'
);
select cvf_test.throws_ok(
  'practice 41 [INV-04][INV-40] the official replace path rejects a practice session',
  $$select public.replace_scorekeeping_event((state.value->>'session_id')::uuid,state.value->>'lease_token',
    (state.value->>'lease_version')::int,'cross-void','cross-replace',(td.value->>'event_id')::uuid,
    'touchdown','regulation',1,'30000000-0000-0000-0000-000000000005',6,'{}'::jsonb,'[]'::jsonb)
    from cvf_test.ledger_runtime_state state cross join cvf_test.ledger_runtime_state td
   where state.key='practice-flag' and td.key='practice-td-home'$$,
  '%Unknown scorekeeping session%'
);

-- start_scorekeeping_correction is keyed by GAME, not session, so a practice
-- row is unreachable through it by construction: practice has no game to name.
select cvf_test.ok(
  'practice 42 [INV-40] the official correction entry point is game-keyed, so practice is unreachable through it',
  -- Compare catalog types rather than a rendered signature string, whose exact
  -- formatting is a Postgres implementation detail and not the thing under test.
  (select count(*)>0 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='start_scorekeeping_correction'
      and p.pronargs=2 and p.proargtypes[0]='uuid'::regtype)
  and (select count(*)=0 from public.scorekeeping_sessions
        where session_kind='practice' and game_id is not null)
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
