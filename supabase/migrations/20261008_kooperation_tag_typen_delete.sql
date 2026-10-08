-- Katalog-Tags dürfen dieselben Personen löschen, die sie anlegen.
-- Zuordnungen an Kooperationen fallen über ON DELETE CASCADE weg.

begin;

drop policy if exists kooperation_tag_typen_delete on public.kooperation_tag_typen;
create policy kooperation_tag_typen_delete on public.kooperation_tag_typen
  for delete using ((select is_admin_or_mitarbeiter()));

commit;
