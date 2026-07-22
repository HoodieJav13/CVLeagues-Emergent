with ledger_tables(name) as (
  values
    ('scorekeeping_sessions'),
    ('scorekeeping_participants'),
    ('scorekeeping_events'),
    ('scorekeeping_event_attributions')
), ledger_relations as (
  select relation.oid, relation.relname, relation.relrowsecurity
    from pg_catalog.pg_class relation
    join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
    join ledger_tables expected on expected.name = relation.relname
   where namespace.nspname = 'public'
     and relation.relkind in ('r', 'p')
), table_privileges(privilege_name) as (
  values
    ('select'), ('insert'), ('update'), ('delete'),
    ('truncate'), ('references'), ('trigger'), ('maintain')
), write_privileges(privilege_name) as (
  values ('insert'), ('update'), ('delete'), ('truncate'), ('references'), ('trigger'), ('maintain')
), ledger_helpers(name) as (
  values
    ('cvf_guard_scorekeeping_session'),
    ('cvf_prepare_scorekeeping_participant'),
    ('cvf_reject_scorekeeping_evidence_rewrite'),
    ('cvf_prepare_scorekeeping_event'),
    ('cvf_prepare_scorekeeping_attribution'),
    ('cvf_guard_scorekeeping_mode'),
    ('cvf_guard_ledger_game_identity')
), helper_functions as (
  select procedure.oid, procedure.proname
    from pg_catalog.pg_proc procedure
    join pg_catalog.pg_namespace namespace on namespace.oid = procedure.pronamespace
    join ledger_helpers expected on expected.name = procedure.proname
   where namespace.nspname = 'public'
)
select json_build_object(
  'tables_present', (select count(*) = 4 from ledger_relations),
  'rls_enabled', (select count(*) = 4 and bool_and(relrowsecurity) from ledger_relations),
  'admin_read_policies', (
    select count(*) = 4
       and bool_and(
         policy.cmd = 'SELECT'
         and policy.roles @> array['authenticated']::name[]
         and policy.qual ilike '%is_admin%'
       )
      from pg_catalog.pg_policies policy
     where policy.schemaname = 'public'
       and policy.tablename in (select name from ledger_tables)
  ),
  'anon_no_privileges', not exists (
    select 1 from ledger_relations relation cross join table_privileges privilege
     where has_table_privilege('anon', relation.oid, privilege.privilege_name)
  ),
  'authenticated_select_only', (
    (select count(*) = 4 from ledger_relations relation
      where has_table_privilege('authenticated', relation.oid, 'select'))
    and not exists (
      select 1 from ledger_relations relation cross join write_privileges privilege
       where has_table_privilege('authenticated', relation.oid, privilege.privilege_name)
    )
  ),
  'service_role_no_privileges', not exists (
    select 1 from ledger_relations relation cross join table_privileges privilege
     where has_table_privilege('service_role', relation.oid, privilege.privilege_name)
  ),
  'helpers_not_client_executable', (
    (select count(distinct proname) = 7 from helper_functions)
    and not exists (
      select 1 from helper_functions helper
       where has_function_privilege('anon', helper.oid, 'execute')
          or has_function_privilege('authenticated', helper.oid, 'execute')
          or has_function_privilege('service_role', helper.oid, 'execute')
    )
  )
) as ledger_catalog;
