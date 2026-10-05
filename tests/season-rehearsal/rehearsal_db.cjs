// Emits the local-database leg of the Season 1 rehearsal as SQL on stdout.
// It carries the SAME fixture (fixture.cjs) through the real RPCs of all 30
// migrations on a disposable Postgres built by run_rehearsal_db.sh, as the
// identities Supabase would present: anon, service_role (intake endpoint),
// an authenticated non-admin, an AAL1 admin, and the AAL2 admin.
//
// Coverage beyond the mock-mode spec: real authorization boundaries, RPC-level
// duplicate guards, HARD/SOFT validation as the server enforces it, the
// aggregate correction audit, and one official event-ledger game (start →
// append → idempotent replay → finalize → ledger correction), which mock mode
// cannot run.
const F = require("./fixture.cjs");

const q = (v) => (v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const ADMIN = "aaaaaaaa-0000-4000-8000-000000000001";
const USER = "aaaaaaaa-0000-4000-8000-000000000002";
const LEAGUE_ID = { kickball: "bbbbbbbb-0000-4000-8000-000000000001", flag_football: "bbbbbbbb-0000-4000-8000-000000000002" };
const VENUE_ID = "cccccccc-0000-4000-8000-000000000001";
const GAME_ID = Object.fromEntries(F.GAMES.map((g, i) => [g.id, `dddddddd-0000-4000-8000-${String(i + 1).padStart(12, "0")}`]));
const pid = (name) => `rh.pid(${q(name)})`;
const tid = (name) => `rh.tid(${q(name)})`;

const out = [];
const sql = (s) => out.push(s);

sql(String.raw`\set ON_ERROR_STOP on
create schema rh;
create table rh.results (n bigserial primary key, name text not null, ok boolean not null, detail text);
create table rh.kv (key text primary key, value jsonb);
create function rh.ok(p_name text, p_cond boolean, p_detail text default null) returns void language plpgsql as $$
begin insert into rh.results(name, ok, detail) values (p_name, coalesce(p_cond, false), p_detail); end $$;
create function rh.throws(p_name text, p_sql text, p_like text) returns void language plpgsql as $$
declare m text;
begin
  begin execute p_sql; insert into rh.results(name, ok, detail) values (p_name, false, 'statement succeeded');
  exception when others then m := sqlerrm; insert into rh.results(name, ok, detail) values (p_name, m like p_like, m); end;
end $$;
create function rh.lives(p_name text, p_sql text) returns void language plpgsql as $$
begin
  begin execute p_sql; insert into rh.results(name, ok) values (p_name, true);
  exception when others then insert into rh.results(name, ok, detail) values (p_name, false, sqlerrm); end;
end $$;
create function rh.who(p_role text, p_user uuid default null, p_aal text default null) returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), false);
  perform set_config('request.jwt.claims', case when p_user is null then '{}' else
    json_build_object('sub', p_user, 'role', 'authenticated', 'aal', p_aal)::text end, false);
  if p_role = 'anon' then set role anon;
  elsif p_role = 'authenticated' then set role authenticated;
  elsif p_role = 'service_role' then set role service_role;
  end if;
end $$;
-- Name lookups run as definer so every identity can resolve fixture rows.
create function rh.pid(p_name text) returns uuid language sql security definer stable as $$
  select id from public.profiles where name = p_name $$;
create function rh.tid(p_name text) returns uuid language sql security definer stable as $$
  select id from public.teams where name = p_name $$;
create function rh.part(p_session uuid, p_name text) returns uuid language sql security definer stable as $$
  select id from public.scorekeeping_participants where session_id = p_session and display_name = p_name $$;
grant usage on schema rh to anon, authenticated, service_role;
grant insert, select on rh.results, rh.kv to anon, authenticated, service_role;
grant usage on all sequences in schema rh to anon, authenticated, service_role;
grant execute on all functions in schema rh to anon, authenticated, service_role;

-- Owner-only bootstrap: the two auth identities and the admin link. A
-- rehearsal-only waiver version row (explicitly NOT legal text) lets the
-- append-only waiver workflow run; it never leaves this disposable database.
select rh.who('owner');
insert into auth.users (id, email) values ('${ADMIN}', 'admin@example.test'), ('${USER}', 'someone@example.test');
insert into public.admin_users (auth_user_id, label) values ('${ADMIN}', 'Rehearsal admin');
insert into public.waiver_versions (version, body_text, effective_at)
values ('REHEARSAL-PLACEHOLDER-v0', 'REHEARSAL PLACEHOLDER — not legal text; disposable local database only.', now());
`);

// ---- 1. setup as the AAL2 admin --------------------------------------------
sql(`select rh.who('authenticated', '${ADMIN}', 'aal2');
insert into public.seasons (name, status) values (${q(F.SEASON)}, 'upcoming');
${Object.values(F.LEAGUES).map((l) => `insert into public.leagues (id, name, sport, season, kind) values ('${LEAGUE_ID[l.sport]}', ${q(l.name)}, '${l.sport}', ${q(F.SEASON)}, 'league');`).join("\n")}
insert into public.venues (id, name, field_label, address) values ('${VENUE_ID}', ${q(F.VENUE.name)}, ${q(F.VENUE.field_label)}, ${q(F.VENUE.address)});
select rh.ok('setup 01 season, two leagues, venue written by the AAL2 admin',
  (select count(*) from public.leagues where season = ${q(F.SEASON)}) = 2 and exists (select 1 from public.venues where id = '${VENUE_ID}'));
`);

// ---- 2. permissions on setup and intake -------------------------------------
sql(`select rh.who('anon');
select rh.throws('perm 01 anon cannot create a league', $$insert into public.leagues (name, sport, season) values ('X', 'kickball', ${q(F.SEASON)})$$, '%permission denied%');
select rh.throws('perm 02 anon cannot insert a registration directly (Turnstile endpoint only)',
  $$insert into public.team_registrations (captain_name, sport, team_name, consent_to_contact) values ('X', 'kickball', 'X', true)$$, '%permission denied%');
select rh.who('authenticated', '${USER}', 'aal1');
select rh.throws('perm 03 authenticated non-admin cannot create a league', $$insert into public.leagues (name, sport, season) values ('X', 'kickball', ${q(F.SEASON)})$$, '%row-level security%');
select rh.who('authenticated', '${ADMIN}', 'aal1');
select rh.throws('perm 04 admin at AAL1 (no MFA) cannot create a league', $$insert into public.leagues (name, sport, season) values ('X', 'kickball', ${q(F.SEASON)})$$, '%row-level security%');

-- Intake arrives through the server endpoint's service_role (insert only).
select rh.who('service_role');
${F.REGISTRATIONS.map((r) => `insert into public.team_registrations (captain_name, captain_phone, captain_email, sport, team_name, estimated_roster_size, preferred_season, consent_to_contact)
  values (${q(r.captain_name)}, ${q(r.captain_phone)}, ${q(r.captain_email)}, '${r.sport}', ${q(r.team_name)}, ${r.roster}, ${q(F.SEASON)}, true);`).join("\n")}
${F.FREE_AGENTS.map((a) => `insert into public.free_agents (first_name, last_name, email, phone, sports, consent_to_contact)
  values (${q(a.first_name)}, ${q(a.last_name)}, ${q(a.email)}, ${q(a.phone)}, array['${a.sport}'], true);`).join("\n")}
select rh.throws('perm 05 service_role can insert intake but cannot read it back', $$select count(*) from public.team_registrations$$, '%permission denied%');
`);

// ---- 3. approvals, direct teams, players, rosters ---------------------------
const reg0 = F.REGISTRATIONS[0];
sql(`select rh.who('authenticated', '${USER}', 'aal1');
select rh.throws('perm 06 non-admin cannot approve a registration',
  $$select public.approve_registration((select id from public.team_registrations limit 1), '${LEAGUE_ID.kickball}')$$, '%Admin only%');
select rh.who('authenticated', '${ADMIN}', 'aal1');
select rh.throws('perm 07 AAL1 admin cannot approve a registration',
  $$select public.approve_registration((select id from public.team_registrations limit 1), '${LEAGUE_ID.kickball}')$$, '%Admin only%');
select rh.who('authenticated', '${ADMIN}', 'aal2');
${F.REGISTRATIONS.map((r) => `select public.approve_registration((select id from public.team_registrations where team_name = ${q(r.team_name)}), '${LEAGUE_ID[r.sport]}');`).join("\n")}
select rh.throws('dup 01 approving the same registration twice is refused',
  $$select public.approve_registration((select id from public.team_registrations where team_name = ${q(reg0.team_name)}), '${LEAGUE_ID.kickball}')$$, '%already approved%');
select rh.ok('intake 01 each approval created identity, enrollment, captain profile, and roster row',
  (select count(*) from public.teams t join public.team_players tp on tp.team_id = t.id and tp.profile_id = t.captain_id
    where t.name in (${F.REGISTRATIONS.map((r) => q(r.team_name)).join(", ")})) = 2);
${F.DIRECT_TEAMS.map((t) => `select public.create_team_identity_and_enroll(${q(t.name)}, '#3FBFB2', '2027', '${LEAGUE_ID[t.sport]}');`).join("\n")}
select rh.throws('perm 08 team rows are RPC-only even for the AAL2 admin',
  $$insert into public.teams (name, league_id) values ('Rogue', '${LEAGUE_ID.kickball}')$$, '%permission denied%');
${F.PLAYERS.map(([first, last]) => `insert into public.profiles (first_name, last_name, email, sports) values (${q(first)}, ${q(last)}, ${q(`${first}.${last}@example.test`.toLowerCase())}, array['${F.DIRECT_TEAMS.concat(F.REGISTRATIONS.map((r) => ({ name: r.team_name, sport: r.sport }))).find((t) => t.name === F.PLAYERS.find((p) => p[0] === first && p[1] === last)[2]).sport}']);`).join("\n")}
${F.PLAYERS.map(([first, last, team, jersey]) => `insert into public.team_players (team_id, profile_id, season, jersey_number) values (${tid(team)}, ${pid(`${first} ${last}`)}, ${q(F.SEASON)}, ${jersey});`).join("\n")}
${F.FREE_AGENTS.map((a) => `select public.assign_free_agent((select id from public.free_agents where email = ${q(a.email)}), ${tid(a.assign_to)});`).join("\n")}
select rh.throws('dup 02 assigning the same free agent twice is refused',
  $$select public.assign_free_agent((select id from public.free_agents where email = ${q(F.FREE_AGENTS[0].email)}), ${tid(F.FREE_AGENTS[0].assign_to)})$$, '%already assigned%');
select rh.throws('dup 03 the same player cannot be rostered twice for a season',
  $$insert into public.team_players (team_id, profile_id, season) values (${tid("Volcano Vista Kicks")}, ${pid("Vera Vantage")}, ${q(F.SEASON)})$$, '%duplicate key%');
select rh.ok('roster 01 every rehearsal team carries exactly three players for ${F.SEASON}',
  (select bool_and(n = 3) from (select count(*) n from public.team_players tp join public.teams t on t.id = tp.team_id
    join public.leagues l on l.id = t.league_id where l.season = ${q(F.SEASON)} group by tp.team_id) x)
  and (select count(distinct team_id) from public.team_players tp join public.teams t on t.id = tp.team_id join public.leagues l on l.id = t.league_id where l.season = ${q(F.SEASON)}) = 7);
`);

// ---- 4. waivers → eligibility (needed by the ledger session) -----------------
const ELIGIBLE = ["Omar Placeholder", "Uri Upland", "Tess Trailhead", "Bree Bluebird", "Felix Freeagent", "Cal Canyon"];
sql(`${ELIGIBLE.map((name) => `insert into public.waivers (profile_id, signed_name, email, waiver_version, accepted_terms, age_confirmed, verification_status)
  values (${pid(name)}, ${q(name)}, (select email from public.profiles where id = ${pid(name)}), 'REHEARSAL-PLACEHOLDER-v0', true, true, 'pending');`).join("\n")}
select public.verify_waiver(id, 'verified') from public.waivers where waiver_version = 'REHEARSAL-PLACEHOLDER-v0';
select rh.ok('waiver 01 verification flips exactly those roster rows to eligible',
  (select count(*) from public.team_players where roster_status = 'eligible' and season = ${q(F.SEASON)}) = ${ELIGIBLE.length});
select rh.throws('waiver 02 the admin has no grant to edit a signed waiver', $$update public.waivers set signed_name = 'Edited' where profile_id = ${pid("Omar Placeholder")}$$, '%permission denied%');
select rh.who('owner');
select rh.throws('waiver 03 even the table owner cannot rewrite a signature (append-only trigger)', $$update public.waivers set signed_name = 'Edited' where profile_id = ${pid("Omar Placeholder")}$$, '%append-only%');
select rh.who('authenticated', '${ADMIN}', 'aal2');
`);

// ---- 5. schedule ------------------------------------------------------------
const isoUtc = (s) => new Date(s).toISOString();
sql(`${F.GAMES.map((g) => `insert into public.games (id, league_id, sport, home_team_id, away_team_id, starts_at, venue_id, stage)
  values ('${GAME_ID[g.id]}', '${LEAGUE_ID[g.sport]}', '${g.sport}', ${tid(g.home)}, ${tid(g.away)}, '${isoUtc(g.starts_at)}', '${VENUE_ID}', 'regular');`).join("\n")}
select rh.throws('perm 09 the admin cannot write a score column directly (RPC-only)',
  $$update public.games set home_score = 9 where id = '${GAME_ID["rh-kg1"]}'$$, '%permission denied%');
select rh.ok('schedule 01 KG5 is stored as a 10:00 AM league-time day game',
  (select to_char(starts_at at time zone 'America/Denver', 'HH24:MI') from public.games where id = '${GAME_ID["rh-kg5"]}') = '10:00');
select public.set_game_status('${GAME_ID["rh-kg7"]}', 'postponed');
`);

// ---- 6. aggregate scores ----------------------------------------------------
const statsJson = (game, lines) => {
  const obj = {};
  const teamOf = (name) => {
    const p = F.PLAYERS.find(([f, l]) => `${f} ${l}` === name);
    if (p) return p[2];
    const r = F.REGISTRATIONS.find((x) => x.captain_name === name);
    if (r) return r.team_name;
    return F.FREE_AGENTS.find((a) => `${a.first_name} ${a.last_name}` === name).assign_to;
  };
  const parts = lines.map(([name, stats]) => `${pid(name)}::text, jsonb_build_object('team_id', ${tid(teamOf(name))}, 'stats', '${JSON.stringify(stats)}'::jsonb)`);
  return `jsonb_build_object(${parts.join(", ")})`;
};
const periods = (away, home) => `'${JSON.stringify({ home, away })}'::jsonb`;
const sum = (a) => a.reduce((x, y) => x + y, 0);
for (const g of F.GAMES.filter((x) => x.away_innings || x.away_quarters)) {
  const kick = g.sport === "kickball";
  const first = g.entered || g;
  const away = kick ? first.away_innings : g.away_quarters;
  const home = kick ? first.home_innings : g.home_quarters;
  const lines = kick ? F.KICKBALL_STATS[g.entered ? `${g.id}-entered` : g.id] : F.FLAG_STATS[g.id];
  const call = (override) => `public.submit_score('${GAME_ID[g.id]}', ${sum(home)}, ${sum(away)}, ${periods(away, home)}, ${statsJson(g, lines)}, ${q(override)})`;
  if (g.override_reason) {
    sql(`select rh.throws('soft 01 ${g.id} SOFT warning without a reason is refused', $$select ${call(null)}$$, '%SOFT validation requires an override reason%');`);
  }
  sql(`select ${call(g.override_reason || null)};
select public.lock_game('${GAME_ID[g.id]}');`);
}
const tie = F.GAMES.find((g) => g.tie_attempt);
sql(`select rh.throws('hard 01 a kickball tie is a HARD block', $$select public.submit_score('${GAME_ID[tie.id]}', 3, 3, ${periods(tie.tie_attempt.away_innings, tie.tie_attempt.home_innings)}, '{}')$$, '%INV-08%');
select rh.throws('hard 02 flag football needs exactly four quarters', $$select public.submit_score('${GAME_ID["rh-fg3"]}', 7, 0, '{"home":[7,0,0],"away":[0,0,0]}'::jsonb, '{}')$$, '%INV-10%');
select rh.throws('hard 03 a stat line for a player outside the game is refused',
  $$select public.submit_score('${GAME_ID["rh-kg6"]}', 2, 1, '{"home":[2],"away":[1]}'::jsonb, jsonb_build_object(${pid("Sam Sandstone")}::text, jsonb_build_object('team_id', ${tid("Sandstone Sprinters")}, 'stats', '{"runs":1}'::jsonb)))$$, '%INV-11%');
select rh.throws('lock 01 a final game cannot be re-scored through submit_score',
  $$select public.submit_score('${GAME_ID["rh-kg1"]}', 9, 0, '{"home":[9],"away":[0]}'::jsonb, '{}')$$, '%INV-24%');
select rh.ok('lock 02 every played rehearsal game is completed, final, and locked',
  (select bool_and(status = 'completed' and score_status = 'final' and locked) from public.games
    where id in (${F.GAMES.filter((x) => x.away_innings || x.away_quarters).map((x) => `'${GAME_ID[x.id]}'`).join(", ")})));
select rh.ok('soft 02 KG3 history keeps the override reason and its warning',
  exists (select 1 from public.game_edit_history where game_id = '${GAME_ID["rh-kg3"]}' and override_reason = ${q(F.GAMES[2].override_reason)}
    and jsonb_array_length(validation_warnings) > 0));
`);

// ---- 7. justified correction -----------------------------------------------
const kg2 = F.GAMES.find((g) => g.correction_reason);
const correct = (reason) => `public.correct_final_score('${GAME_ID[kg2.id]}', ${sum(kg2.home_innings)}, ${sum(kg2.away_innings)}, ${periods(kg2.away_innings, kg2.home_innings)}, ${statsJson(kg2, F.KICKBALL_STATS[kg2.id])}, ${q(reason)})`;
sql(`select rh.who('authenticated', '${ADMIN}', 'aal1');
select rh.throws('perm 10 AAL1 admin cannot correct a final score', $$select ${correct(kg2.correction_reason)}$$, '%Admin only%');
select rh.who('authenticated', '${ADMIN}', 'aal2');
select rh.throws('corr 01 a correction without a reason is refused', $$select ${correct("   ")}$$, '%reason%');
select ${correct(kg2.correction_reason)};
select rh.ok('corr 02 KG2 is 5-4 Jacks, still final and locked',
  (select away_score = 5 and home_score = 4 and locked and score_status = 'final' from public.games where id = '${GAME_ID[kg2.id]}'));
select rh.ok('corr 03 audit trail is Score saved → Marked final → Final score corrected with reason and before/after',
  (select array_agg(action order by created_at, id) = array['Score saved','Marked final','Final score corrected']
     and bool_or(reason = ${q(kg2.correction_reason)} and (before_state->>'away_score')::int = 2 and (after_state->>'away_score')::int = 5)
   from public.game_edit_history where game_id = '${GAME_ID[kg2.id]}'));
select rh.ok('corr 04 corrected stat lines replaced the originals (Juno Juniper KG2 runs = 3)',
  (select (stats->>'runs')::int from public.player_stats where game_id = '${GAME_ID[kg2.id]}' and profile_id = ${pid("Juno Juniper")}) = 3);
select rh.throws('corr 05 edit history is append-only', $$delete from public.game_edit_history where game_id = '${GAME_ID[kg2.id]}'$$, '%permission denied%');
`);

// ---- 8. standings and records as the database holds them --------------------
for (const [sport, table] of Object.entries(F.EXPECTED)) {
  for (const [team, [w, l]] of Object.entries(table)) {
    sql(`select rh.ok('record ${sport} ${team} is ${w}-${l}',
  (select count(*) filter (where (g.home_team_id = t.id and g.home_score > g.away_score) or (g.away_team_id = t.id and g.away_score > g.home_score)) = ${w}
      and count(*) filter (where (g.home_team_id = t.id and g.home_score < g.away_score) or (g.away_team_id = t.id and g.away_score < g.home_score)) = ${l}
   from public.teams t join public.games g on (g.home_team_id = t.id or g.away_team_id = t.id) and g.score_status = 'final'
   where t.id = ${tid(team)}));`);
  }
}
sql(`select rh.who('anon');
select rh.ok('public 01 anon reads the corrected scoreboard', (select away_score from public.games where id = '${GAME_ID[kg2.id]}') = 5);
select rh.throws('public 02 anon cannot read profile PII', $$select email from public.profiles limit 1$$, '%permission denied%');
select rh.ok('public 03 the public profile view exposes names without contact fields',
  (select count(*) from public.public_profiles where name = 'Rhea Testwell') = 1
  and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'public_profiles' and column_name in ('email','phone')));
`);

// ---- 9. one official event-ledger game (FG3) --------------------------------
const fg3 = GAME_ID["rh-fg3"];
const td = (key, session, team, passer, receiver) => `public.append_scorekeeping_event(
  (${session}->>'session_id')::uuid, ${session}->>'lease_token', (${session}->>'lease_version')::int, '${key}',
  'record', 'touchdown', 'regulation', 2, ${tid(team)}, 6, null, null, '{}',
  jsonb_build_array(
    jsonb_build_object('participant_id', rh.part((${session}->>'session_id')::uuid, ${q(passer)}), 'role', 'passer', 'stat_key', 'passTDs', 'stat_delta', 1),
    jsonb_build_object('participant_id', rh.part((${session}->>'session_id')::uuid, ${q(receiver)}), 'role', 'receiver', 'stat_key', 'recTDs', 'stat_delta', 1),
    jsonb_build_object('participant_id', rh.part((${session}->>'session_id')::uuid, ${q(receiver)}), 'role', 'scorer', 'stat_key', 'tds', 'stat_delta', 1)), null)`;
const S = "(select value from rh.kv where key = 'session')";
sql(`select rh.who('authenticated', '${ADMIN}', 'aal1');
select rh.throws('ledger 01 AAL1 admin cannot start a scorekeeping session',
  $$select public.start_scorekeeping_session('${fg3}', 'CVF-FF-2026.2', 4, 'one possession each', false, '{}')$$, '%Admin only%');
select rh.who('authenticated', '${ADMIN}', 'aal2');
insert into rh.kv values ('session', public.start_scorekeeping_session('${fg3}', 'CVF-FF-2026.2', 4, 'one possession each', false, '{}'));
select rh.throws('ledger 02 a second open session for the same game is refused',
  $$select public.start_scorekeeping_session('${fg3}', 'CVF-FF-2026.2', 4, 'one possession each', false, '{}')$$, '%INV-20%already has active session%');
select rh.throws('ledger 03 aggregate submit_score cannot touch a ledger game', $$select public.submit_score('${fg3}', 6, 0, '{"home":[6,0,0,0],"away":[0,0,0,0]}'::jsonb, '{}', 'probe: reason supplied so only the ledger guard can refuse')$$, '%Ledger projections may change only through ledger finalization%');
insert into rh.kv values ('td1', ${td("rh-fg3-td-1", S, "Turquoise Trail Flaggers", "Omar Placeholder", "Uri Upland")});
insert into rh.kv values ('td1-replay', ${td("rh-fg3-td-1", S, "Turquoise Trail Flaggers", "Omar Placeholder", "Uri Upland")});
select rh.ok('dup 04 an identical retried event is replayed, not duplicated',
  (select (value->>'replayed')::boolean from rh.kv where key = 'td1-replay')
  and (select count(*) from public.scorekeeping_events where game_id = '${fg3}') = 1);
insert into rh.kv values ('td2', ${td("rh-fg3-td-2", S, "Turquoise Trail Flaggers", "Omar Placeholder", "Tess Trailhead")});
insert into rh.kv values ('td3', ${td("rh-fg3-td-3", S, "Bluebird Blitz", "Bree Bluebird", "Felix Freeagent")});
insert into rh.kv values ('final', public.finalize_scorekeeping_session((${S}->>'session_id')::uuid, ${S}->>'lease_token', (${S}->>'lease_version')::int, 'rh-fg3-final', null));
select rh.ok('ledger 04 finalization projects 12-6 Flaggers, final and locked',
  (select away_score = 12 and home_score = 6 and score_status = 'final' and locked and scorekeeping_mode = 'ledger' from public.games where id = '${fg3}'));
select rh.ok('ledger 05 projected player_stats carry the attributed touchdowns',
  (select (stats->>'tds')::int from public.player_stats where game_id = '${fg3}' and profile_id = ${pid("Tess Trailhead")}) = 1);
-- Correction: the second TD was Uri's, not Tess's.
insert into rh.kv values ('corr', public.start_scorekeeping_correction('${fg3}', 'Second TD receiver was Uri Upland per both captains'));
select public.replace_scorekeeping_event(
  ((select value from rh.kv where key = 'corr')->>'session_id')::uuid, (select value from rh.kv where key = 'corr')->>'lease_token',
  ((select value from rh.kv where key = 'corr')->>'lease_version')::int, 'rh-fg3-void-2', 'rh-fg3-replace-2',
  ((select value from rh.kv where key = 'td2')->>'event_id')::uuid, 'touchdown', 'regulation', 2, ${tid("Turquoise Trail Flaggers")}, 6, '{}',
  jsonb_build_array(
    jsonb_build_object('participant_id', rh.part(((select value from rh.kv where key = 'corr')->>'session_id')::uuid, 'Omar Placeholder'), 'role', 'passer', 'stat_key', 'passTDs', 'stat_delta', 1),
    jsonb_build_object('participant_id', rh.part(((select value from rh.kv where key = 'corr')->>'session_id')::uuid, 'Uri Upland'), 'role', 'receiver', 'stat_key', 'recTDs', 'stat_delta', 1),
    jsonb_build_object('participant_id', rh.part(((select value from rh.kv where key = 'corr')->>'session_id')::uuid, 'Uri Upland'), 'role', 'scorer', 'stat_key', 'tds', 'stat_delta', 1)), null);
insert into rh.kv values ('corr-final', public.finalize_scorekeeping_correction(
  ((select value from rh.kv where key = 'corr')->>'session_id')::uuid, (select value from rh.kv where key = 'corr')->>'lease_token',
  ((select value from rh.kv where key = 'corr')->>'lease_version')::int, 'rh-fg3-correction-final', null));
select rh.ok('ledger 06 correction moves the TD to Uri: Uri 2 tds, Tess none, score unchanged and locked',
  (select (stats->>'tds')::int from public.player_stats where game_id = '${fg3}' and profile_id = ${pid("Uri Upland")}) = 2
  and coalesce((select (stats->>'tds')::int from public.player_stats where game_id = '${fg3}' and profile_id = ${pid("Tess Trailhead")}), 0) = 0
  and (select away_score = 12 and locked from public.games where id = '${fg3}'));
select rh.ok('ledger 07 history is system output: finalized then corrected',
  (select array_agg(action order by created_at, id) from public.game_edit_history where game_id = '${fg3}') = array['Ledger result finalized','Ledger final result corrected']);
select rh.throws('ledger 08 aggregate correct_final_score is refused for a ledger game', $$select public.correct_final_score('${fg3}', 6, 12, '{"home":[6,0,0,0],"away":[12,0,0,0]}'::jsonb, '{}', 'try aggregate', 'probe override')$$, '%Ledger projections may change only through ledger finalization%');
select rh.throws('ledger 09 ledger events are append-only', $$delete from public.scorekeeping_events where game_id = '${fg3}'$$, '%permission denied%');

select rh.who('owner');
select n, case when ok then 'ok' else 'FAIL' end as result, name, left(coalesce(detail, ''), 110) as detail from rh.results order by n;
select count(*) as total, count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed from rh.results;
`);

process.stdout.write(out.join("\n"));
