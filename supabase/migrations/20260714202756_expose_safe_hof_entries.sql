-- Keep the Hall of Fame source table admin-only. Public readers use the
-- allowlisted view below, which deliberately omits created_by and keeps the
-- publication gate outside the privileged base table.
drop policy if exists hof_entries_public_read on public.hof_entries;
drop policy if exists hof_entries_admin_write on public.hof_entries;

create policy hof_entries_admin_all on public.hof_entries
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on table public.hof_entries from anon;
grant select, insert, update, delete on table public.hof_entries to authenticated;

-- INTENTIONAL definer-style view, matching public_profiles: it must read the
-- admin-only base table for anon callers. Safety depends on the explicit
-- display-only column list, so never add attribution or contact fields here.
create view public.public_hof_entries as
select
  h.id,
  h.entry_type,
  h.game_id,
  h.profile_id,
  h.team_id,
  h.sport,
  h.season,
  h.record_scope,
  h.title,
  h.blurb,
  h.stat_key,
  h.stat_value,
  h.display_order,
  h.created_at,
  h.updated_at
from public.hof_entries h
where exists (
  select 1
    from public.league_settings s
   where s.id = 1
     and s.hof_published
);

revoke all on table public.public_hof_entries from public, anon, authenticated;
grant select on table public.public_hof_entries to anon, authenticated;

comment on view public.public_hof_entries is
  'Published Hall of Fame display fields. Intentional definer-style allowlist over the admin-only hof_entries table.';
