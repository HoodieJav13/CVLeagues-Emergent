-- Complete the service-role least-privilege boundary. The protected intake
-- server needs only INSERT on the two PII-bearing intake tables; it does not
-- call public RPCs or administer public relations.

-- Reset every current public relation before restoring the narrow allowlist.
-- ALL includes SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER,
-- and any table privilege added by the running PostgreSQL version.
revoke all privileges
  on all tables in schema public
  from service_role;

revoke all privileges
  on all sequences in schema public
  from service_role;

revoke execute
  on all functions in schema public
  from service_role;

-- Supabase's supported customer-controlled default-ACL boundary is the
-- repository migration owner (`postgres`). Platform-owned `supabase_admin`
-- defaults cannot be changed by customer migrations and are intentionally
-- outside this boundary; every current object is still reset above.
alter default privileges for role postgres in schema public
  revoke all privileges on tables from service_role;

alter default privileges for role postgres in schema public
  revoke all privileges on sequences from service_role;

alter default privileges for role postgres in schema public
  revoke all privileges on functions from service_role;

-- PostgreSQL grants function EXECUTE to PUBLIC by default. Reassert the global
-- default revoke so service_role cannot inherit execution through PUBLIC on a
-- future function created by the migration owner.
alter default privileges for role postgres
  revoke execute on functions from public;

grant usage on schema public to service_role;

grant insert on table
  public.team_registrations,
  public.free_agents
to service_role;
