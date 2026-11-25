-- Feedback und Zelleinträge der anderen Seite ohne Neuladen anzeigen.
-- Kommentare aus dem Videos-Tab, Bild-Feedback, Casting-Einträge und Werte eigener
-- Spalten fehlten in der Realtime-Publikation.
-- REPLICA IDENTITY FULL: ein DELETE liefert sonst nur die ID, der Client braucht
-- aber video_id bzw. Spalte und Eintrag, um die Zelle zu finden.

do $$
declare
  t text;
begin
  foreach t in array array[
    'kooperation_video_zeitkommentar',
    'kooperation_still_comment',
    'creator_auswahl_items',
    'custom_column_values',
    'entity_custom_column_values'
  ] loop
    execute format('alter table public.%I replica identity full', t);
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
