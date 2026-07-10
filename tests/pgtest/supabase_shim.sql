-- Supabase environment shim for plain local Postgres pgtests.
-- This intentionally models only the pieces the migrations depend on:
-- roles, auth.uid(), auth.users, and extensions. Data API table/function
-- privileges intentionally begin denied, matching new Supabase projects; the
-- repository migration must grant every client capability explicitly.

create schema if not exists extensions;
create schema if not exists auth;

create extension if not exists pgcrypto;
create extension if not exists moddatetime schema extensions;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end
$$;

grant usage on schema public, auth to anon, authenticated;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  created_at timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant execute on function auth.uid() to anon, authenticated;
