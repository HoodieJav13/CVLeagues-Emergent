-- Bracket topology, seed snapshots, scheduling links, and advancement are one
-- consistency boundary. The security-definer playoff RPCs enforce that
-- boundary; direct authenticated DML could otherwise bypass it (including
-- changing a seed after the UI reports that seeds are locked).

revoke insert, update, delete
  on table public.playoff_brackets, public.playoff_seeds, public.playoff_matches
  from authenticated;

drop policy if exists playoff_brackets_admin_insert on public.playoff_brackets;
drop policy if exists playoff_brackets_admin_update on public.playoff_brackets;
drop policy if exists playoff_brackets_admin_delete on public.playoff_brackets;

drop policy if exists playoff_seeds_admin_insert on public.playoff_seeds;
drop policy if exists playoff_seeds_admin_update on public.playoff_seeds;
drop policy if exists playoff_seeds_admin_delete on public.playoff_seeds;

drop policy if exists playoff_matches_admin_insert on public.playoff_matches;
drop policy if exists playoff_matches_admin_update on public.playoff_matches;
drop policy if exists playoff_matches_admin_delete on public.playoff_matches;

comment on table public.playoff_brackets is
  'Publicly readable bracket header. Mutations are restricted to the verified playoff RPC workflow.';
comment on table public.playoff_seeds is
  'Publicly readable fixed seed snapshot. Mutations are restricted to bracket-generation RPCs.';
comment on table public.playoff_matches is
  'Publicly readable playoff topology and results. Mutations are restricted to verified playoff RPCs and unlock retraction.';
