-- Pool-Refresh ("Pool aktualisieren"-Button) als eigener trigger_type
-- Angewendet auf Prod: 2026-07-23 (via MCP apply_migration "harvest_runs_refresh_trigger")

alter table public.instagram_harvest_runs
  drop constraint instagram_harvest_runs_trigger_type_check;

alter table public.instagram_harvest_runs
  add constraint instagram_harvest_runs_trigger_type_check
  check (trigger_type in ('schedule','manual','backfill','refresh'));
