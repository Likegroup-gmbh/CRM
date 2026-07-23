-- Seeds werden im Frontend (/instagram Admin-Bereich) ueber den Supabase-Client
-- verwaltet. RLS braucht daher Insert/Update/Delete fuer authenticated User.
-- Angewendet auf Prod: 2026-07-23 (via MCP apply_migration "instagram_hashtag_seeds_write_policies")

create policy "instagram_hashtag_seeds_insert" on public.instagram_hashtag_seeds
  for insert to authenticated with check (true);

create policy "instagram_hashtag_seeds_update" on public.instagram_hashtag_seeds
  for update to authenticated using (true) with check (true);

create policy "instagram_hashtag_seeds_delete" on public.instagram_hashtag_seeds
  for delete to authenticated using (true);
