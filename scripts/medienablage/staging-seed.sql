-- Staging-Seed für die Medienablage. Keine Echtdaten (DSGVO).
-- Aufruf (aus 3-staging-einrichten.sh):
--   psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -v admin_email="admin@firma.de" -f scripts/medienablage/staging-seed.sql
--
-- Voraussetzung: Schema aus der Produktion (supabase db dump --schema-only) plus die noch
-- nicht live angewendeten Migrationen 20261129/20261130/20261201.
-- Idempotent über feste UUIDs.

-- supabase db dump nimmt das auth-Schema nicht mit, also auch nicht den Trigger, der beim
-- Anlegen eines Logins die benutzer-Zeile erzeugt.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Admin: Login vorher im Staging-Dashboard anlegen (Authentication → Add user).
INSERT INTO public.benutzer (auth_user_id, rolle, name, email, freigeschaltet)
SELECT u.id, 'admin', 'Staging Admin', u.email, true
FROM auth.users u
WHERE lower(u.email) = lower(:'admin_email')
  AND NOT EXISTS (SELECT 1 FROM public.benutzer b WHERE b.auth_user_id = u.id);

UPDATE public.benutzer SET rolle = 'admin', freigeschaltet = true
WHERE lower(email) = lower(:'admin_email');

-- Zwei Unternehmen: eines auf SharePoint, eines auf Dropbox (prüft die Weiche).
INSERT INTO public.unternehmen (id, firmenname, ablage_ziel) VALUES
  ('5a5e0000-0000-4000-8000-000000000001', 'Staging SharePoint GmbH', 'sharepoint'),
  ('5a5e0000-0000-4000-8000-000000000002', 'Staging Dropbox AG', 'dropbox')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.marke (id, markenname, unternehmen_id) VALUES
  ('5a5e0000-0000-4000-8000-000000000011', 'Testmarke Eins', '5a5e0000-0000-4000-8000-000000000001'),
  ('5a5e0000-0000-4000-8000-000000000012', 'Testmarke Zwei', '5a5e0000-0000-4000-8000-000000000002')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.kampagne (id, kampagnenname, eigener_name, unternehmen_id, marke_id) VALUES
  ('5a5e0000-0000-4000-8000-000000000021', 'Sommer 2026', NULL,
   '5a5e0000-0000-4000-8000-000000000001', '5a5e0000-0000-4000-8000-000000000011'),
  ('5a5e0000-0000-4000-8000-000000000022', 'Winter 2026', 'Winter Launch',
   '5a5e0000-0000-4000-8000-000000000002', '5a5e0000-0000-4000-8000-000000000012')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.creator (id, vorname, nachname) VALUES
  ('5a5e0000-0000-4000-8000-000000000031', 'Test', 'Creatorin'),
  ('5a5e0000-0000-4000-8000-000000000032', 'Test', 'Creator')
ON CONFLICT (id) DO NOTHING;

-- Zwei Kooperationen mit gleichem Namen in derselben Kampagne: prüft die Endung "(2)".
INSERT INTO public.kooperationen (id, name, kampagne_id, creator_id, unternehmen_id) VALUES
  ('5a5e0000-0000-4000-8000-000000000041', 'Test Creatorin', '5a5e0000-0000-4000-8000-000000000021',
   '5a5e0000-0000-4000-8000-000000000031', '5a5e0000-0000-4000-8000-000000000001'),
  ('5a5e0000-0000-4000-8000-000000000042', 'Test Creatorin', '5a5e0000-0000-4000-8000-000000000021',
   '5a5e0000-0000-4000-8000-000000000032', '5a5e0000-0000-4000-8000-000000000001'),
  ('5a5e0000-0000-4000-8000-000000000043', 'Test Creator', '5a5e0000-0000-4000-8000-000000000022',
   '5a5e0000-0000-4000-8000-000000000032', '5a5e0000-0000-4000-8000-000000000002')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.kooperation_videos (id, kooperation_id, position, thema) VALUES
  ('5a5e0000-0000-4000-8000-000000000051', '5a5e0000-0000-4000-8000-000000000041', 1, 'Unboxing'),
  ('5a5e0000-0000-4000-8000-000000000052', '5a5e0000-0000-4000-8000-000000000041', 2, NULL),
  ('5a5e0000-0000-4000-8000-000000000053', '5a5e0000-0000-4000-8000-000000000042', 1, 'Hook'),
  ('5a5e0000-0000-4000-8000-000000000054', '5a5e0000-0000-4000-8000-000000000043', 1, NULL)
ON CONFLICT (id) DO NOTHING;
