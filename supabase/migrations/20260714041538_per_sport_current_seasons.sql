-- Per-sport defaults let two sports operate different active seasons without
-- changing the existing natural season key or any season-stamped records.
-- The legacy current_season remains during the compatibility window; new
-- clients read the sport-specific columns.
alter table public.league_settings
  add column current_kickball_season text,
  add column current_flag_football_season text;

update public.league_settings
set
  current_kickball_season = current_season,
  current_flag_football_season = current_season;

alter table public.league_settings
  alter column current_kickball_season set not null,
  alter column current_flag_football_season set not null,
  add constraint league_settings_current_kickball_season_fkey
    foreign key (current_kickball_season)
    references public.seasons (name)
    on update cascade,
  add constraint league_settings_current_flag_football_season_fkey
    foreign key (current_flag_football_season)
    references public.seasons (name)
    on update cascade;

create index league_settings_current_kickball_season_idx
  on public.league_settings (current_kickball_season);
create index league_settings_current_flag_football_season_idx
  on public.league_settings (current_flag_football_season);

comment on column public.league_settings.current_season is
  'Legacy compatibility default. New clients use the sport-specific current season columns.';
comment on column public.league_settings.current_kickball_season is
  'Default season for kickball views, registration, and new league setup.';
comment on column public.league_settings.current_flag_football_season is
  'Default season for flag-football views, registration, and new league setup.';
