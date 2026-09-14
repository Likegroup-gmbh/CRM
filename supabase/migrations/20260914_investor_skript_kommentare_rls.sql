-- Investor darf Skript-Kommentare lesen (SELECT bleibt), aber nichts
-- schreiben. Die UI versteckt das Selektionsmenue bereits ueber das Feature
-- skriptKommentieren; die Policies sichern die DB-Seite ab.

drop policy if exists skript_kommentare_insert on public.skript_kommentare;
create policy skript_kommentare_insert on public.skript_kommentare
  for insert to authenticated
  with check (
    created_by = (select get_current_benutzer_id())
    and exists (select 1 from skripte s where s.id = skript_kommentare.skript_id)
    and not (select is_investor())
  );

drop policy if exists skript_kommentare_update on public.skript_kommentare;
create policy skript_kommentare_update on public.skript_kommentare
  for update to authenticated
  using (
    not (select is_investor())
    and (
      (select is_admin_or_mitarbeiter())
      or created_by = (select get_current_benutzer_id())
    )
  )
  with check (
    not (select is_investor())
    and (
      (select is_admin_or_mitarbeiter())
      or created_by = (select get_current_benutzer_id())
    )
  );

drop policy if exists skript_kommentare_delete on public.skript_kommentare;
create policy skript_kommentare_delete on public.skript_kommentare
  for delete to authenticated
  using (
    not (select is_investor())
    and (
      (select is_admin_or_mitarbeiter())
      or created_by = (select get_current_benutzer_id())
    )
  );
