-- Finanzbestand des Stakeholder-Dashboards in einem Call.
-- Die Tabellen-RLS (can_access_kooperation_video u. a.) laeuft pro Zeile und
-- macht aus ~2.800 Videos mehrere Sekunden. Diese Funktion prueft die Rolle
-- einmal und liefert denselben Spaltensatz, den der Client bisher ueber
-- PostgREST geladen hat. Keine bestehende Funktion oder Policy wird geaendert.
-- Aufruf nur fuer Admin und Investor — dieselben Rollen, die die Tabellen
-- heute schon vollstaendig lesen duerfen.

CREATE OR REPLACE FUNCTION public.stakeholder_finanzbestand()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT ((SELECT public.is_admin()) OR (SELECT public.is_investor())) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'auftraege', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id,
        'titel', a.titel,
        'auftragsname', a.auftragsname,
        'nettobetrag', a.nettobetrag,
        'ust_betrag', a.ust_betrag,
        'bruttobetrag', a.bruttobetrag,
        'creator_budget', a.creator_budget,
        'auftragtype', a.auftragtype,
        'start', a.start,
        'ende', a.ende,
        'created_at', a.created_at,
        'is_draft', a.is_draft,
        'unternehmen_id', a.unternehmen_id,
        'marke_id', a.marke_id,
        'agency_services_enabled', a.agency_services_enabled,
        'percentage_fee_enabled', a.percentage_fee_enabled,
        'percentage_fee_value', a.percentage_fee_value,
        'ksk_enabled', a.ksk_enabled,
        'ksk_value', a.ksk_value,
        'rechnung_gestellt_am', a.rechnung_gestellt_am,
        'ueberwiesen', a.ueberwiesen,
        'ueberwiesen_am', a.ueberwiesen_am,
        're_faelligkeit', a.re_faelligkeit,
        'marke', (
          SELECT jsonb_build_object('id', m.id, 'markenname', m.markenname)
          FROM public.marke m
          WHERE m.id = a.marke_id
        )
      ) ORDER BY a.id)
      FROM public.auftrag a
    ), '[]'::jsonb),
    'blocks', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', b.id,
        'auftrag_id', b.auftrag_id,
        'campaign_type', b.campaign_type,
        'campaign_type_label', b.campaign_type_label,
        'umsatz_netto', b.umsatz_netto,
        'sort_order', b.sort_order
      ) ORDER BY b.id)
      FROM public.auftrag_kampagnenart_blocks b
    ), '[]'::jsonb),
    'kampagnen', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', k.id,
        'kampagnenname', k.kampagnenname,
        'auftrag_id', k.auftrag_id,
        'videoanzahl', k.videoanzahl,
        'creatoranzahl', k.creatoranzahl
      ) ORDER BY k.id)
      FROM public.kampagne k
    ), '[]'::jsonb),
    'kooperationen', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', k.id,
        'kampagne_id', k.kampagne_id,
        'creator_id', k.creator_id,
        'videoanzahl', k.videoanzahl,
        'einkaufspreis_netto', k.einkaufspreis_netto,
        'verkaufspreis_netto', k.verkaufspreis_netto,
        'verkaufspreis_zusatzkosten', k.verkaufspreis_zusatzkosten,
        'ksk_selbstzahler', k.ksk_selbstzahler,
        'ksk_betrag', k.ksk_betrag
      ) ORDER BY k.id)
      FROM public.kooperationen k
    ), '[]'::jsonb),
    'videos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', v.id,
        'kooperation_id', v.kooperation_id,
        'einkaufspreis_netto', v.einkaufspreis_netto,
        'verkaufspreis_netto', v.verkaufspreis_netto,
        'kampagnenart', v.kampagnenart,
        'titel', v.titel,
        'video_name', v.video_name
      ) ORDER BY v.id)
      FROM public.kooperation_videos v
    ), '[]'::jsonb),
    'rechnungen', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id,
        'kooperation_id', r.kooperation_id,
        'auftrag_id', r.auftrag_id,
        'kampagne_id', r.kampagne_id,
        'status', r.status,
        'nettobetrag', r.nettobetrag,
        'ust_betrag', r.ust_betrag,
        'bruttobetrag', r.bruttobetrag,
        'nettobetrag_steuerfrei', r.nettobetrag_steuerfrei,
        'zusatzkosten', r.zusatzkosten,
        'gestellt_am', r.gestellt_am,
        'bezahlt_am', r.bezahlt_am,
        'zahlungsziel', r.zahlungsziel,
        'rechnungstyp', r.rechnungstyp,
        'rechnung_nr', r.rechnung_nr
      ) ORDER BY r.id)
      FROM public.rechnung r
    ), '[]'::jsonb),
    'creators', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id,
        'vorname', c.vorname,
        'nachname', c.nachname
      ) ORDER BY c.id)
      FROM public.creator c
    ), '[]'::jsonb),
    'details', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'auftrag_id', d.auftrag_id,
        'campaign_type', d.campaign_type,
        'agency_services_enabled', d.agency_services_enabled,
        'percentage_fee_enabled', d.percentage_fee_enabled,
        'percentage_fee_value', d.percentage_fee_value,
        'ksk_enabled', d.ksk_enabled,
        'ksk_value', d.ksk_value
      ) ORDER BY d.id)
      FROM public.auftrag_details d
    ), '[]'::jsonb),
    'unternehmen', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', u.id,
        'firmenname', u.firmenname,
        'ist_test', u.ist_test
      ) ORDER BY u.id)
      FROM public.unternehmen u
    ), '[]'::jsonb),
    'teilrechnungen', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', t.id,
        'auftrag_id', t.auftrag_id,
        'nettobetrag', t.nettobetrag,
        'ust_betrag', t.ust_betrag,
        'bruttobetrag', t.bruttobetrag,
        'rechnung_gestellt', t.rechnung_gestellt,
        'rechnung_gestellt_am', t.rechnung_gestellt_am,
        'ueberwiesen', t.ueberwiesen,
        'ueberwiesen_am', t.ueberwiesen_am,
        're_faelligkeit', t.re_faelligkeit
      ) ORDER BY t.id)
      FROM public.auftrag_teilrechnung t
    ), '[]'::jsonb),
    'berichtsstaende', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id,
        'created_at', s.created_at,
        'label', s.label,
        'created_by', s.created_by
      ) ORDER BY s.created_at DESC)
      FROM public.berichtsstand s
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.stakeholder_finanzbestand() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.stakeholder_finanzbestand() FROM anon;
GRANT EXECUTE ON FUNCTION public.stakeholder_finanzbestand() TO authenticated;
