-- Investor: SELECT wie Admin/Mitarbeiter auf der operativen Plattform und
-- der Finanzuebersicht. INSERT/UPDATE/DELETE bleiben unveraendert.
-- Mitarbeiter-Stammdaten, Rechte, Shares und KI bleiben admin-only.

create or replace function public.is_investor()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from benutzer
    where auth_user_id = (select auth.uid())
      and rolle = 'investor'
  );
$$;

revoke all on function public.is_investor() from public;
grant execute on function public.is_investor() to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'ansprechpartner_unternehmen',
    'auftrag',
    'auftrag_copywriter',
    'auftrag_cutter',
    'auftrag_details',
    'auftrag_dokumente',
    'auftrag_mitarbeiter',
    'berichtsstand',
    'briefing_chat_messages',
    'campaign_briefing_produkt',
    'campaign_briefings',
    'creator',
    'creator_adressen',
    'creator_auswahl',
    'creator_auswahl_items',
    'creator_list',
    'creator_list_member',
    'entity_dokumente',
    'kampagne',
    'kampagne_organic_ziele',
    'kampagne_paid_ziele',
    'kooperation_bilder_asset',
    'kooperation_rohmaterial_asset',
    'kooperation_story',
    'kooperation_tasks',
    'kooperation_versand',
    'kooperation_videos',
    'kooperationen',
    'kunde_ansprechpartner',
    'kunde_marke',
    'kunde_unternehmen',
    'kundenbriefings',
    'marke',
    'marke_kickoff',
    'neuigkeit',
    'personas',
    'po_counter',
    'produkt',
    'rechnung',
    'rechnung_belege',
    'rechnung_notizen',
    'rechnung_pdfs',
    'skript_dna',
    'skript_master',
    'skript_modi',
    'skripte',
    'sourcing_creator',
    'strategie',
    'strategie_items',
    'transcription_jobs',
    'unternehmen'
  ]
  loop
    execute format('drop policy if exists investor_select on public.%I', t);
    execute format(
      'create policy investor_select on public.%I for select to authenticated using ((select is_investor()))',
      t
    );
  end loop;
end $$;
