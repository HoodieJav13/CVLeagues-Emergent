-- Literal service_role privilege check for local and hosted Supabase.
-- Read-only: this script inspects current effective privileges and default ACLs.

\set ON_ERROR_STOP on

\echo 'Effective public table privileges (expected: two INSERT rows)'
with public_relations as (
  select relation.oid, relation.relname
    from pg_catalog.pg_class relation
    join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
   where namespace.nspname = 'public'
     and relation.relkind in ('r', 'p', 'v', 'm', 'f')
), table_privileges(privilege_name) as (
  values
    ('select'), ('insert'), ('update'), ('delete'),
    ('truncate'), ('references'), ('trigger'), ('maintain')
)
select relation.relname, privilege.privilege_name
  from public_relations relation
  cross join table_privileges privilege
 where has_table_privilege('service_role', relation.oid, privilege.privilege_name)
 order by relation.relname, privilege.privilege_name;

\echo 'Effective public sequence privileges (expected: zero rows)'
with public_sequences as (
  select sequence.oid, sequence.relname
    from pg_catalog.pg_class sequence
    join pg_catalog.pg_namespace namespace on namespace.oid = sequence.relnamespace
   where namespace.nspname = 'public'
     and sequence.relkind = 'S'
), sequence_privileges(privilege_name) as (
  values ('usage'), ('select'), ('update')
)
select sequence.relname, privilege.privilege_name
  from public_sequences sequence
  cross join sequence_privileges privilege
 where has_sequence_privilege('service_role', sequence.oid, privilege.privilege_name)
 order by sequence.relname, privilege.privilege_name;

\echo 'Effective public function EXECUTE privileges (expected: zero rows)'
select pg_catalog.pg_get_function_identity_arguments(function.oid) as arguments,
       function.proname
  from pg_catalog.pg_proc function
  join pg_catalog.pg_namespace namespace on namespace.oid = function.pronamespace
 where namespace.nspname = 'public'
   and has_function_privilege('service_role', function.oid, 'execute')
 order by function.proname, arguments;

\echo 'Customer-controlled postgres default-ACL leaks (expected: zero rows)'
select owner.rolname as owner,
       default_acl.defaclobjtype as object_type,
       coalesce(namespace.nspname, '<global>') as schema_name,
       case when exploded.grantee = 0 then 'PUBLIC' else grantee.rolname end as grantee,
       exploded.privilege_type
  from pg_catalog.pg_default_acl default_acl
  join pg_catalog.pg_roles owner on owner.oid = default_acl.defaclrole
  left join pg_catalog.pg_namespace namespace on namespace.oid = default_acl.defaclnamespace
  cross join lateral pg_catalog.aclexplode(default_acl.defaclacl) exploded
  left join pg_catalog.pg_roles grantee on grantee.oid = exploded.grantee
 where owner.rolname = 'postgres'
   and (default_acl.defaclnamespace = 0 or namespace.nspname = 'public')
   and (
     grantee.rolname = 'service_role'
     or (
       exploded.grantee = 0
       and default_acl.defaclobjtype = 'f'
       and exploded.privilege_type = 'EXECUTE'
     )
   )
 order by object_type, schema_name, grantee, exploded.privilege_type;

\echo 'Accepted platform-owned supabase_admin defaults (informational only)'
select owner.rolname as owner,
       default_acl.defaclobjtype as object_type,
       coalesce(namespace.nspname, '<global>') as schema_name,
       case when exploded.grantee = 0 then 'PUBLIC' else grantee.rolname end as grantee,
       exploded.privilege_type
  from pg_catalog.pg_default_acl default_acl
  join pg_catalog.pg_roles owner on owner.oid = default_acl.defaclrole
  left join pg_catalog.pg_namespace namespace on namespace.oid = default_acl.defaclnamespace
  cross join lateral pg_catalog.aclexplode(default_acl.defaclacl) exploded
  left join pg_catalog.pg_roles grantee on grantee.oid = exploded.grantee
 where owner.rolname = 'supabase_admin'
   and (default_acl.defaclnamespace = 0 or namespace.nspname = 'public')
   and (
     grantee.rolname = 'service_role'
     or (
       exploded.grantee = 0
       and default_acl.defaclobjtype = 'f'
       and exploded.privilege_type = 'EXECUTE'
     )
   )
 order by object_type, schema_name, grantee, exploded.privilege_type;

do $$
declare
  v_table_privilege_count integer;
  v_sequence_privilege_count integer;
  v_function_privilege_count integer;
  v_default_acl_leak_count integer;
begin
  with public_relations as (
    select relation.oid, relation.relname
      from pg_catalog.pg_class relation
      join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
     where namespace.nspname = 'public'
       and relation.relkind in ('r', 'p', 'v', 'm', 'f')
  ), table_privileges(privilege_name) as (
    values
      ('select'), ('insert'), ('update'), ('delete'),
      ('truncate'), ('references'), ('trigger'), ('maintain')
  )
  select count(*)
    into v_table_privilege_count
    from public_relations relation
    cross join table_privileges privilege
   where has_table_privilege('service_role', relation.oid, privilege.privilege_name)
     and not (
       relation.relname in ('team_registrations', 'free_agents')
       and privilege.privilege_name = 'insert'
     );

  if v_table_privilege_count <> 0
     or not has_table_privilege('service_role', 'public.team_registrations', 'insert')
     or not has_table_privilege('service_role', 'public.free_agents', 'insert') then
    raise exception 'service_role table privilege boundary failed';
  end if;

  with public_sequences as (
    select sequence.oid
      from pg_catalog.pg_class sequence
      join pg_catalog.pg_namespace namespace on namespace.oid = sequence.relnamespace
     where namespace.nspname = 'public'
       and sequence.relkind = 'S'
  ), sequence_privileges(privilege_name) as (
    values ('usage'), ('select'), ('update')
  )
  select count(*)
    into v_sequence_privilege_count
    from public_sequences sequence
    cross join sequence_privileges privilege
   where has_sequence_privilege('service_role', sequence.oid, privilege.privilege_name);

  if v_sequence_privilege_count <> 0 then
    raise exception 'service_role sequence privilege boundary failed';
  end if;

  select count(*)
    into v_function_privilege_count
    from pg_catalog.pg_proc function
    join pg_catalog.pg_namespace namespace on namespace.oid = function.pronamespace
   where namespace.nspname = 'public'
     and has_function_privilege('service_role', function.oid, 'execute');

  if v_function_privilege_count <> 0 then
    raise exception 'service_role function privilege boundary failed';
  end if;

  select count(*)
    into v_default_acl_leak_count
    from pg_catalog.pg_default_acl default_acl
    join pg_catalog.pg_roles owner on owner.oid = default_acl.defaclrole
    left join pg_catalog.pg_namespace namespace on namespace.oid = default_acl.defaclnamespace
    cross join lateral pg_catalog.aclexplode(default_acl.defaclacl) exploded
    left join pg_catalog.pg_roles grantee on grantee.oid = exploded.grantee
   where owner.rolname = 'postgres'
     and (default_acl.defaclnamespace = 0 or namespace.nspname = 'public')
     and (
       grantee.rolname = 'service_role'
       or (
         exploded.grantee = 0
         and default_acl.defaclobjtype = 'f'
         and exploded.privilege_type = 'EXECUTE'
       )
     );

  if v_default_acl_leak_count <> 0 then
    raise exception 'postgres-owned default ACL boundary failed';
  end if;
end
$$;

\echo 'service_role catalog check: PASS'
