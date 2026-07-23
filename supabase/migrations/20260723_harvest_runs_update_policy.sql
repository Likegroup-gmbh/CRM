-- Laeufe sollen aus der UI abbrechbar sein (Abbrechen-Button auf /instagram)
-- Angewendet auf Prod: 2026-07-23 (via MCP apply_migration "harvest_runs_update_policy")

create policy "instagram_harvest_runs_update" on public.instagram_harvest_runs
  for update to authenticated using (true) with check (true);
