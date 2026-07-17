-- Fix: multiple_permissive_policies (Performance)
-- Redundante Policies entfernen oder zu einer pro Aktion zusammenführen

-- kunde_marke, kunde_unternehmen: Doppelte INSERT-Policies
DROP POLICY IF EXISTS "Kunden können eigene Marken-Verknüpfung erstellen" ON public.kunde_marke;
DROP POLICY IF EXISTS "Kunden können eigene Unternehmen-Verknüpfung erstellen" ON public.kunde_unternehmen;

-- kunde_ansprechpartner: ALL + INSERT + SELECT → 1 pro Aktion (admin/mitarbeiter OR kunde für eigene)
DROP POLICY IF EXISTS "Admins und Mitarbeiter können Verknüpfungen verwalten" ON public.kunde_ansprechpartner;
DROP POLICY IF EXISTS "Kunden können eigene Ansprechpartner-Verknüpfung erstellen" ON public.kunde_ansprechpartner;
DROP POLICY IF EXISTS "Kunden können eigene Verknüpfungen sehen" ON public.kunde_ansprechpartner;
CREATE POLICY kunde_ansprechpartner_select ON public.kunde_ansprechpartner FOR SELECT TO public
  USING (
    (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])))
    OR (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.id = kunde_ansprechpartner.kunde_id))
  );
CREATE POLICY kunde_ansprechpartner_insert ON public.kunde_ansprechpartner FOR INSERT TO public
  WITH CHECK (
    (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])))
    OR (kunde_id = (SELECT benutzer.id FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid())))
  );
CREATE POLICY kunde_ansprechpartner_update ON public.kunde_ansprechpartner FOR UPDATE TO public
  USING (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])))
  WITH CHECK (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])));
CREATE POLICY kunde_ansprechpartner_delete ON public.kunde_ansprechpartner FOR DELETE TO public
  USING (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])));

-- ansprechpartner_unternehmen: ALL + 2× SELECT (anon magic link, mitarbeiter) → 1 pro Aktion
DROP POLICY IF EXISTS "Anon kann Ansprechpartner-Unternehmen via Magic Link lesen" ON public.ansprechpartner_unternehmen;
DROP POLICY IF EXISTS mitarbeiter_select_ansprechpartner_unternehmen ON public.ansprechpartner_unternehmen;
DROP POLICY IF EXISTS mitarbeiter_write_ansprechpartner_unternehmen ON public.ansprechpartner_unternehmen;
CREATE POLICY ansprechpartner_unternehmen_select ON public.ansprechpartner_unternehmen FOR SELECT TO public
  USING (
    (EXISTS (SELECT 1 FROM magic_links WHERE magic_links.ansprechpartner_id = ansprechpartner_unternehmen.ansprechpartner_id AND magic_links.used_at IS NULL AND magic_links.expires_at > now()))
    OR (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])))
  );
CREATE POLICY ansprechpartner_unternehmen_mitarbeiter_insert ON public.ansprechpartner_unternehmen FOR INSERT TO public
  WITH CHECK (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])));
CREATE POLICY ansprechpartner_unternehmen_mitarbeiter_update ON public.ansprechpartner_unternehmen FOR UPDATE TO public
  USING (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])))
  WITH CHECK (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])));
CREATE POLICY ansprechpartner_unternehmen_mitarbeiter_delete ON public.ansprechpartner_unternehmen FOR DELETE TO public
  USING (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])));

-- branchen: ALL + SELECT → 1x SELECT (auth), 1x pro Schreibaktion (admin)
DROP POLICY IF EXISTS admin_write_branchen ON public.branchen;
DROP POLICY IF EXISTS all_select_branchen ON public.branchen;
CREATE POLICY branchen_select ON public.branchen FOR SELECT TO authenticated USING (true);
CREATE POLICY branchen_admin_insert ON public.branchen FOR INSERT TO public
  WITH CHECK (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = 'admin'));
CREATE POLICY branchen_admin_update ON public.branchen FOR UPDATE TO public
  USING (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = 'admin'));
CREATE POLICY branchen_admin_delete ON public.branchen FOR DELETE TO public
  USING (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = 'admin'));

-- format_typen
DROP POLICY IF EXISTS admin_write_format_typen ON public.format_typen;
DROP POLICY IF EXISTS all_select_format_typen ON public.format_typen;
CREATE POLICY format_typen_select ON public.format_typen FOR SELECT TO authenticated USING (true);
CREATE POLICY format_typen_admin_insert ON public.format_typen FOR INSERT TO public
  WITH CHECK (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = 'admin'));
CREATE POLICY format_typen_admin_update ON public.format_typen FOR UPDATE TO public
  USING (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = 'admin'));
CREATE POLICY format_typen_admin_delete ON public.format_typen FOR DELETE TO public
  USING (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = 'admin'));

-- kampagne_art_typen
DROP POLICY IF EXISTS admin_write_kampagne_art_typen ON public.kampagne_art_typen;
DROP POLICY IF EXISTS all_select_kampagne_art_typen ON public.kampagne_art_typen;
CREATE POLICY kampagne_art_typen_select ON public.kampagne_art_typen FOR SELECT TO authenticated USING (true);
CREATE POLICY kampagne_art_typen_admin_insert ON public.kampagne_art_typen FOR INSERT TO public
  WITH CHECK (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = 'admin'));
CREATE POLICY kampagne_art_typen_admin_update ON public.kampagne_art_typen FOR UPDATE TO public
  USING (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = 'admin'));
CREATE POLICY kampagne_art_typen_admin_delete ON public.kampagne_art_typen FOR DELETE TO public
  USING (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = 'admin'));

-- plattform_typen, sprachen
DROP POLICY IF EXISTS admin_write_plattform_typen ON public.plattform_typen;
DROP POLICY IF EXISTS all_select_plattform_typen ON public.plattform_typen;
CREATE POLICY plattform_typen_select ON public.plattform_typen FOR SELECT TO authenticated USING (true);
CREATE POLICY plattform_typen_admin_insert ON public.plattform_typen FOR INSERT TO public
  WITH CHECK (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = 'admin'));
CREATE POLICY plattform_typen_admin_update ON public.plattform_typen FOR UPDATE TO public
  USING (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = 'admin'));
CREATE POLICY plattform_typen_admin_delete ON public.plattform_typen FOR DELETE TO public
  USING (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = 'admin'));

DROP POLICY IF EXISTS admin_write_sprachen ON public.sprachen;
DROP POLICY IF EXISTS all_select_sprachen ON public.sprachen;
CREATE POLICY sprachen_select ON public.sprachen FOR SELECT TO authenticated USING (true);
CREATE POLICY sprachen_admin_insert ON public.sprachen FOR INSERT TO public
  WITH CHECK (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = 'admin'));
CREATE POLICY sprachen_admin_update ON public.sprachen FOR UPDATE TO public
  USING (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = 'admin'));
CREATE POLICY sprachen_admin_delete ON public.sprachen FOR DELETE TO public
  USING (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = 'admin'));

-- eu_laender: andere Policy-Namen
DROP POLICY IF EXISTS "Nur Admins können EU Länder verwalten" ON public.eu_laender;
DROP POLICY IF EXISTS "Alle können EU Länder sehen" ON public.eu_laender;
CREATE POLICY eu_laender_select ON public.eu_laender FOR SELECT TO authenticated USING (true);
CREATE POLICY eu_laender_admin_insert ON public.eu_laender FOR INSERT TO public
  WITH CHECK (EXISTS (SELECT 1 FROM benutzer b WHERE b.auth_user_id = (SELECT auth.uid()) AND b.rolle = 'admin'));
CREATE POLICY eu_laender_admin_update ON public.eu_laender FOR UPDATE TO public
  USING (EXISTS (SELECT 1 FROM benutzer b WHERE b.auth_user_id = (SELECT auth.uid()) AND b.rolle = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM benutzer b WHERE b.auth_user_id = (SELECT auth.uid()) AND b.rolle = 'admin'));
CREATE POLICY eu_laender_admin_delete ON public.eu_laender FOR DELETE TO public
  USING (EXISTS (SELECT 1 FROM benutzer b WHERE b.auth_user_id = (SELECT auth.uid()) AND b.rolle = 'admin'));

-- marke_branchen, unternehmen_branchen: ALL + SELECT → 1 SELECT, 1 pro Schreibaktion (admin+mitarbeiter)
DROP POLICY IF EXISTS "Alle können Marke-Branchen Verknüpfungen sehen" ON public.marke_branchen;
DROP POLICY IF EXISTS "Nur Mitarbeiter und Admins können Marke-Branchen verwalten" ON public.marke_branchen;
CREATE POLICY marke_branchen_select ON public.marke_branchen FOR SELECT TO authenticated USING (true);
CREATE POLICY marke_branchen_mitarbeiter_modify ON public.marke_branchen FOR INSERT TO public
  WITH CHECK (EXISTS (SELECT 1 FROM benutzer b WHERE b.auth_user_id = (SELECT auth.uid()) AND b.rolle = ANY (ARRAY['admin','mitarbeiter'])));
CREATE POLICY marke_branchen_mitarbeiter_update ON public.marke_branchen FOR UPDATE TO public
  USING (EXISTS (SELECT 1 FROM benutzer b WHERE b.auth_user_id = (SELECT auth.uid()) AND b.rolle = ANY (ARRAY['admin','mitarbeiter'])))
  WITH CHECK (EXISTS (SELECT 1 FROM benutzer b WHERE b.auth_user_id = (SELECT auth.uid()) AND b.rolle = ANY (ARRAY['admin','mitarbeiter'])));
CREATE POLICY marke_branchen_mitarbeiter_delete ON public.marke_branchen FOR DELETE TO public
  USING (EXISTS (SELECT 1 FROM benutzer b WHERE b.auth_user_id = (SELECT auth.uid()) AND b.rolle = ANY (ARRAY['admin','mitarbeiter'])));

DROP POLICY IF EXISTS "Alle können Unternehmen-Branchen Verknüpfungen sehen" ON public.unternehmen_branchen;
DROP POLICY IF EXISTS "Nur Mitarbeiter und Admins können Unternehmen-Branchen verwalt" ON public.unternehmen_branchen;
CREATE POLICY unternehmen_branchen_select ON public.unternehmen_branchen FOR SELECT TO authenticated USING (true);
CREATE POLICY unternehmen_branchen_mitarbeiter_insert ON public.unternehmen_branchen FOR INSERT TO public
  WITH CHECK (EXISTS (SELECT 1 FROM benutzer b WHERE b.auth_user_id = (SELECT auth.uid()) AND b.rolle = ANY (ARRAY['admin','mitarbeiter'])));
CREATE POLICY unternehmen_branchen_mitarbeiter_update ON public.unternehmen_branchen FOR UPDATE TO public
  USING (EXISTS (SELECT 1 FROM benutzer b WHERE b.auth_user_id = (SELECT auth.uid()) AND b.rolle = ANY (ARRAY['admin','mitarbeiter'])))
  WITH CHECK (EXISTS (SELECT 1 FROM benutzer b WHERE b.auth_user_id = (SELECT auth.uid()) AND b.rolle = ANY (ARRAY['admin','mitarbeiter'])));
CREATE POLICY unternehmen_branchen_mitarbeiter_delete ON public.unternehmen_branchen FOR DELETE TO public
  USING (EXISTS (SELECT 1 FROM benutzer b WHERE b.auth_user_id = (SELECT auth.uid()) AND b.rolle = ANY (ARRAY['admin','mitarbeiter'])));

-- marke: 3 SELECT + 1 ALL → 1 SELECT (kombiniert), 1 INSERT/UPDATE/DELETE (mitarbeiter)
DROP POLICY IF EXISTS "Anon kann Marken via Magic Link lesen" ON public.marke;
DROP POLICY IF EXISTS kunden_select_own_marke ON public.marke;
DROP POLICY IF EXISTS mitarbeiter_all_marke ON public.marke;
CREATE POLICY marke_select ON public.marke FOR SELECT TO public
  USING (
    (EXISTS (SELECT 1 FROM magic_links JOIN ansprechpartner_marke am ON am.ansprechpartner_id = magic_links.ansprechpartner_id
      WHERE am.marke_id = marke.id AND magic_links.used_at IS NULL AND magic_links.expires_at > now()))
    OR (id IN (SELECT km.marke_id FROM kunde_marke km JOIN benutzer b ON b.id = km.kunde_id WHERE b.auth_user_id = (SELECT auth.uid())))
    OR (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])))
  );
CREATE POLICY marke_mitarbeiter_modify ON public.marke FOR INSERT TO public
  WITH CHECK (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])));
CREATE POLICY marke_mitarbeiter_update ON public.marke FOR UPDATE TO public
  USING (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])))
  WITH CHECK (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])));
CREATE POLICY marke_mitarbeiter_delete ON public.marke FOR DELETE TO public
  USING (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])));

-- unternehmen: gleiches Muster
DROP POLICY IF EXISTS "Anon kann Unternehmen via Magic Link lesen" ON public.unternehmen;
DROP POLICY IF EXISTS kunden_select_own_unternehmen ON public.unternehmen;
DROP POLICY IF EXISTS mitarbeiter_all_unternehmen ON public.unternehmen;
CREATE POLICY unternehmen_select ON public.unternehmen FOR SELECT TO public
  USING (
    (EXISTS (SELECT 1 FROM magic_links JOIN ansprechpartner_unternehmen au ON au.ansprechpartner_id = magic_links.ansprechpartner_id
      WHERE au.unternehmen_id = unternehmen.id AND magic_links.used_at IS NULL AND magic_links.expires_at > now()))
    OR (id IN (SELECT ku.unternehmen_id FROM kunde_unternehmen ku JOIN benutzer b ON b.id = ku.kunde_id WHERE b.auth_user_id = (SELECT auth.uid())))
    OR (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])))
  );
CREATE POLICY unternehmen_mitarbeiter_modify ON public.unternehmen FOR INSERT TO public
  WITH CHECK (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])));
CREATE POLICY unternehmen_mitarbeiter_update ON public.unternehmen FOR UPDATE TO public
  USING (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])))
  WITH CHECK (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])));
CREATE POLICY unternehmen_mitarbeiter_delete ON public.unternehmen FOR DELETE TO public
  USING (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])));

-- creator: 2 SELECT (kunde, mitarbeiter) → 1 SELECT, 1 pro Schreibaktion
DROP POLICY IF EXISTS kunden_select_creator_via_kampagne ON public.creator;
DROP POLICY IF EXISTS mitarbeiter_all_creator ON public.creator;
CREATE POLICY creator_select ON public.creator FOR SELECT TO public
  USING (
    (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])))
    OR (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = 'kunde'
      AND EXISTS (SELECT 1 FROM kooperationen k JOIN kampagne kp ON k.kampagne_id = kp.id
        JOIN kunde_unternehmen ku ON ku.unternehmen_id = kp.unternehmen_id
        WHERE k.creator_id = creator.id AND ku.kunde_id = benutzer.id)))
  );
CREATE POLICY creator_mitarbeiter_insert ON public.creator FOR INSERT TO public
  WITH CHECK (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])));
CREATE POLICY creator_mitarbeiter_update ON public.creator FOR UPDATE TO public
  USING (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])))
  WITH CHECK (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])));
CREATE POLICY creator_mitarbeiter_delete ON public.creator FOR DELETE TO public
  USING (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])));

-- benutzer: ALL + SELECT + INSERT + UPDATE überlappen
DROP POLICY IF EXISTS mitarbeiter_write_benutzer ON public.benutzer;
DROP POLICY IF EXISTS mitarbeiter_select_benutzer_simple ON public.benutzer;
DROP POLICY IF EXISTS allow_self_insert_benutzer ON public.benutzer;
DROP POLICY IF EXISTS allow_self_update_benutzer ON public.benutzer;
CREATE POLICY benutzer_select ON public.benutzer FOR SELECT TO public
  USING (
    (auth_user_id = (SELECT auth.uid()))
    OR (get_current_user_rolle() = 'admin')
    OR (get_current_user_rolle() = 'mitarbeiter')
  );
CREATE POLICY benutzer_insert ON public.benutzer FOR INSERT TO public
  WITH CHECK (auth_user_id = (SELECT auth.uid()));
CREATE POLICY benutzer_update ON public.benutzer FOR UPDATE TO public
  USING (
    (auth_user_id = (SELECT auth.uid()))
    OR ((get_current_user_rolle() = 'admin') OR ((get_current_user_rolle() = 'mitarbeiter') AND (rolle = ANY (ARRAY['admin','mitarbeiter']))))
  )
  WITH CHECK (
    (auth_user_id = (SELECT auth.uid()))
    OR ((get_current_user_rolle() = 'admin') OR ((get_current_user_rolle() = 'mitarbeiter') AND (rolle = ANY (ARRAY['admin','mitarbeiter']))))
  );
CREATE POLICY benutzer_delete ON public.benutzer FOR DELETE TO public
  USING (
    (get_current_user_rolle() = 'admin')
    OR ((get_current_user_rolle() = 'mitarbeiter') AND (rolle = ANY (ARRAY['admin','mitarbeiter'])))
  );

-- briefings: ALL + 2× SELECT
DROP POLICY IF EXISTS briefings_mitarbeiter_modify ON public.briefings;
DROP POLICY IF EXISTS briefings_mitarbeiter_select ON public.briefings;
DROP POLICY IF EXISTS "Kunden können eigene Briefings sehen" ON public.briefings;
CREATE POLICY briefings_select ON public.briefings FOR SELECT TO public
  USING (
    (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])))
    OR (EXISTS (SELECT 1 FROM kunde_unternehmen ku WHERE ku.kunde_id = (SELECT benutzer.id FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid())) AND ku.unternehmen_id = briefings.unternehmen_id))
  );
CREATE POLICY briefings_mitarbeiter_insert ON public.briefings FOR INSERT TO public
  WITH CHECK (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])));
CREATE POLICY briefings_mitarbeiter_update ON public.briefings FOR UPDATE TO public
  USING (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])))
  WITH CHECK (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])));
CREATE POLICY briefings_mitarbeiter_delete ON public.briefings FOR DELETE TO public
  USING (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])));

-- kooperation_versand
DROP POLICY IF EXISTS "Admins und Mitarbeiter haben Vollzugriff auf kooperation_versan" ON public.kooperation_versand;
DROP POLICY IF EXISTS "Kunden können eigene Versandinfos sehen" ON public.kooperation_versand;
CREATE POLICY kooperation_versand_select ON public.kooperation_versand FOR SELECT TO public
  USING (
    (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])))
    OR (EXISTS (SELECT 1 FROM kunde_unternehmen ku JOIN kooperationen k ON k.unternehmen_id = ku.unternehmen_id WHERE k.id = kooperation_versand.kooperation_id AND ku.kunde_id = (SELECT benutzer.id FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()))))
  );
CREATE POLICY kooperation_versand_mitarbeiter_insert ON public.kooperation_versand FOR INSERT TO public
  WITH CHECK (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])));
CREATE POLICY kooperation_versand_mitarbeiter_update ON public.kooperation_versand FOR UPDATE TO public
  USING (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])))
  WITH CHECK (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])));
CREATE POLICY kooperation_versand_mitarbeiter_delete ON public.kooperation_versand FOR DELETE TO public
  USING (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])));

-- kooperationen
DROP POLICY IF EXISTS "Admins haben Vollzugriff auf kooperationen" ON public.kooperationen;
DROP POLICY IF EXISTS "Kunden können eigene Kooperationen sehen" ON public.kooperationen;
CREATE POLICY kooperationen_select ON public.kooperationen FOR SELECT TO public
  USING (
    (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])))
    OR (EXISTS (SELECT 1 FROM kunde_unternehmen ku WHERE ku.kunde_id = (SELECT benutzer.id FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid())) AND ku.unternehmen_id = kooperationen.unternehmen_id))
  );
CREATE POLICY kooperationen_mitarbeiter_insert ON public.kooperationen FOR INSERT TO public
  WITH CHECK (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])));
CREATE POLICY kooperationen_mitarbeiter_update ON public.kooperationen FOR UPDATE TO public
  USING (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])))
  WITH CHECK (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])));
CREATE POLICY kooperationen_mitarbeiter_delete ON public.kooperationen FOR DELETE TO public
  USING (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])));

-- kooperation_video_asset
DROP POLICY IF EXISTS kooperation_video_asset_modify ON public.kooperation_video_asset;
DROP POLICY IF EXISTS kooperation_video_asset_select ON public.kooperation_video_asset;
CREATE POLICY kooperation_video_asset_select ON public.kooperation_video_asset FOR SELECT TO public
  USING (
    (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])))
    OR (EXISTS (SELECT 1 FROM kooperation_videos kv JOIN kooperationen k ON k.id = kv.kooperation_id JOIN kampagne ka ON ka.id = k.kampagne_id JOIN marke m ON m.id = ka.marke_id JOIN kunde_marke km ON km.marke_id = m.id JOIN benutzer b ON b.id = km.kunde_id WHERE kv.id = kooperation_video_asset.video_id AND b.auth_user_id = (SELECT auth.uid())))
    OR (EXISTS (SELECT 1 FROM kooperation_videos kv JOIN kooperationen k ON k.id = kv.kooperation_id JOIN kampagne ka ON ka.id = k.kampagne_id JOIN kunde_unternehmen ku ON ku.unternehmen_id = ka.unternehmen_id JOIN benutzer b ON b.id = ku.kunde_id WHERE kv.id = kooperation_video_asset.video_id AND b.auth_user_id = (SELECT auth.uid())))
  );
CREATE POLICY kooperation_video_asset_mitarbeiter_insert ON public.kooperation_video_asset FOR INSERT TO public
  WITH CHECK (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])));
CREATE POLICY kooperation_video_asset_mitarbeiter_update ON public.kooperation_video_asset FOR UPDATE TO public
  USING (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])))
  WITH CHECK (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])));
CREATE POLICY kooperation_video_asset_mitarbeiter_delete ON public.kooperation_video_asset FOR DELETE TO public
  USING (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])));

-- magic_links
DROP POLICY IF EXISTS "Admins und Mitarbeiter können Magic Links verwalten" ON public.magic_links;
DROP POLICY IF EXISTS "Öffentlicher Lesezugriff für Token-Validierung" ON public.magic_links;
DROP POLICY IF EXISTS "Anon kann Magic Link als verwendet markieren" ON public.magic_links;
CREATE POLICY magic_links_select ON public.magic_links FOR SELECT TO public
  USING (
    (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])))
    OR ((used_at IS NULL) AND (expires_at > now()))
  );
CREATE POLICY magic_links_mitarbeiter_insert ON public.magic_links FOR INSERT TO public
  WITH CHECK (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])));
CREATE POLICY magic_links_update ON public.magic_links FOR UPDATE TO public
  USING (
    (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])))
    OR ((used_at IS NULL) AND (expires_at > now()))
  )
  WITH CHECK (
    (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])))
    OR (used_at IS NOT NULL)
  );
CREATE POLICY magic_links_mitarbeiter_delete ON public.magic_links FOR DELETE TO public
  USING (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = ANY (ARRAY['admin','mitarbeiter'])));

-- kampagne_mitarbeiter
DROP POLICY IF EXISTS "Authenticated users full access" ON public.kampagne_mitarbeiter;
DROP POLICY IF EXISTS "Mitarbeiter können eigene Kampagnen-Zuordnungen sehen" ON public.kampagne_mitarbeiter;
CREATE POLICY kampagne_mitarbeiter_select ON public.kampagne_mitarbeiter FOR SELECT TO authenticated
  USING ((SELECT auth.role()) = 'authenticated');
CREATE POLICY kampagne_mitarbeiter_insert ON public.kampagne_mitarbeiter FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.role()) = 'authenticated');
CREATE POLICY kampagne_mitarbeiter_update ON public.kampagne_mitarbeiter FOR UPDATE TO authenticated
  USING ((SELECT auth.role()) = 'authenticated')
  WITH CHECK ((SELECT auth.role()) = 'authenticated');
CREATE POLICY kampagne_mitarbeiter_delete ON public.kampagne_mitarbeiter FOR DELETE TO authenticated
  USING ((SELECT auth.role()) = 'authenticated');

-- marke_mitarbeiter
DROP POLICY IF EXISTS "Authenticated users full access" ON public.marke_mitarbeiter;
DROP POLICY IF EXISTS "Mitarbeiter können eigene Marken-Zuordnungen sehen" ON public.marke_mitarbeiter;
CREATE POLICY marke_mitarbeiter_select ON public.marke_mitarbeiter FOR SELECT TO authenticated
  USING ((SELECT auth.role()) = 'authenticated');
CREATE POLICY marke_mitarbeiter_insert ON public.marke_mitarbeiter FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.role()) = 'authenticated');
CREATE POLICY marke_mitarbeiter_update ON public.marke_mitarbeiter FOR UPDATE TO authenticated
  USING ((SELECT auth.role()) = 'authenticated')
  WITH CHECK ((SELECT auth.role()) = 'authenticated');
CREATE POLICY marke_mitarbeiter_delete ON public.marke_mitarbeiter FOR DELETE TO authenticated
  USING ((SELECT auth.role()) = 'authenticated');

-- user_entity_assignments, user_permissions
DROP POLICY IF EXISTS "Admins can manage all assignments" ON public.user_entity_assignments;
DROP POLICY IF EXISTS "Users can view their own assignments" ON public.user_entity_assignments;
CREATE POLICY user_entity_assignments_select ON public.user_entity_assignments FOR SELECT TO public
  USING (
    (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = 'admin'))
    OR ((SELECT auth.uid()) = user_id)
  );
CREATE POLICY user_entity_assignments_admin_insert ON public.user_entity_assignments FOR INSERT TO public
  WITH CHECK (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = 'admin'));
CREATE POLICY user_entity_assignments_admin_update ON public.user_entity_assignments FOR UPDATE TO public
  USING (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = 'admin'));
CREATE POLICY user_entity_assignments_admin_delete ON public.user_entity_assignments FOR DELETE TO public
  USING (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = 'admin'));

DROP POLICY IF EXISTS "Admins can manage all permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Users can view their own permissions" ON public.user_permissions;
CREATE POLICY user_permissions_select ON public.user_permissions FOR SELECT TO public
  USING (
    (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = 'admin'))
    OR ((SELECT auth.uid()) = user_id)
  );
CREATE POLICY user_permissions_admin_insert ON public.user_permissions FOR INSERT TO public
  WITH CHECK (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = 'admin'));
CREATE POLICY user_permissions_admin_update ON public.user_permissions FOR UPDATE TO public
  USING (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = 'admin'));
CREATE POLICY user_permissions_admin_delete ON public.user_permissions FOR DELETE TO public
  USING (EXISTS (SELECT 1 FROM benutzer WHERE benutzer.auth_user_id = (SELECT auth.uid()) AND benutzer.rolle = 'admin'));
