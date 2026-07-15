-- The server-held Supabase secret is used only by the Turnstile-protected
-- intake endpoint. Keep the service_role Data API surface narrower than the
-- browser roles: it may create intake records, but it cannot read them back
-- or reach any unrelated public-schema table through PostgREST.

alter default privileges in schema public
  revoke select, insert, update, delete on tables from service_role;

alter default privileges in schema public
  revoke usage, select on sequences from service_role;

revoke select, insert, update, delete
  on all tables in schema public
  from service_role;

revoke usage, select
  on all sequences in schema public
  from service_role;

grant usage on schema public to service_role;

grant insert on table
  public.team_registrations,
  public.free_agents
to service_role;

comment on table public.team_registrations is
  'PII-bearing intake. Browser writes are closed; the protected server endpoint has service_role INSERT only.';
comment on table public.free_agents is
  'PII-bearing intake. Browser writes are closed; the protected server endpoint has service_role INSERT only.';
