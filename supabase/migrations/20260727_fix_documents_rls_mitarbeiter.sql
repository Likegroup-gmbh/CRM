-- Legacy-Rolle 'user' aus den Dokumenten-Policies entfernen.
-- Die Rolle heisst seit dem Rollen-Rework 'mitarbeiter'; dadurch konnten nur noch
-- Admins Briefing-PDFs hochladen (Bucket 'documents' + Tabelle briefing_documents).
-- Angewendet auf Prod: 2026-07-27 (via MCP apply_migration "fix_documents_rls_mitarbeiter")

-- ============================================================
-- 1. storage.objects, Bucket 'documents'
-- ============================================================

drop policy if exists "User und Admin können Dokumente hochladen" on storage.objects;
create policy "documents_insert_staff" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = any (array['briefings', 'kampagnen'])
    and (select is_admin_or_mitarbeiter())
  );

drop policy if exists "User und Admin können Dokumente löschen" on storage.objects;
create policy "documents_delete_staff" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and (select is_admin_or_mitarbeiter())
  );

-- Kunden-Zweig: bisher wurde bd.file_path gegen benutzer.name verglichen (Alias u),
-- was nie matcht. Korrekt ist der Storage-Objektname.
drop policy if exists "Berechtigte können Dokumente herunterladen" on storage.objects;
create policy "documents_select_staff_kunde" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and (
      (select is_admin_or_mitarbeiter())
      or (
        (storage.foldername(name))[1] = 'briefings'
        and exists (
          select 1
          from briefing_documents bd
            join briefings b on b.id = bd.briefing_id
            join marke m on m.id = b.marke_id
            join kunde_marke km on km.marke_id = m.id
            join benutzer u on u.id = km.kunde_id
          where bd.file_path = objects.name
            and u.auth_user_id = (select auth.uid())
        )
      )
    )
  );

-- ============================================================
-- 2. public.briefing_documents
-- ============================================================

drop policy if exists "Admin und User können Dokumente hochladen" on public.briefing_documents;
create policy "briefing_documents_insert_staff" on public.briefing_documents
  for insert to authenticated
  with check ((select is_admin_or_mitarbeiter()));

drop policy if exists "Admin und User können Dokumente aktualisieren" on public.briefing_documents;
create policy "briefing_documents_update_staff" on public.briefing_documents
  for update to authenticated
  using ((select is_admin_or_mitarbeiter()))
  with check ((select is_admin_or_mitarbeiter()));

drop policy if exists "Admin und User können Dokumente löschen" on public.briefing_documents;
create policy "briefing_documents_delete_staff" on public.briefing_documents
  for delete to authenticated
  using ((select is_admin_or_mitarbeiter()));

drop policy if exists "briefing_documents_select" on public.briefing_documents;
create policy "briefing_documents_select" on public.briefing_documents
  for select to authenticated
  using (
    (select is_admin_or_mitarbeiter())
    or exists (
      select 1
      from briefings b
        join marke m on m.id = b.marke_id
        join kunde_marke km on km.marke_id = m.id
        join benutzer u on u.id = km.kunde_id
      where b.id = briefing_documents.briefing_id
        and u.auth_user_id = (select auth.uid())
    )
  );
