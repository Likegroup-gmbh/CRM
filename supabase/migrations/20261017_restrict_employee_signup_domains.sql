-- Mitarbeiter-Registrierung nur mit Firmen-E-Mail.
--
-- Die oeffentliche Registrierung (Login -> "Registrierung") setzt in den User-Metadaten
-- role = 'mitarbeiter'. Mehrere Kunden haben sich dort faelschlich angemeldet und sind als
-- rolle = 'pending' in der Mitarbeiterliste gelandet (siehe 20260908_ / 20261016_ Cleanups).
--
-- Dieser Trigger erzwingt die Domain-Whitelist serverseitig (Frontend-Check allein ist per
-- direktem API-Aufruf umgehbar). Gleiche Liste wie src/modules/auth/AllowedEmailDomains.js.
--
-- Erlaubt: exakte Domains likegroup.de und creatorjobs.com (keine Subdomains).
-- Kunden-Flows (role = 'kunde', z.B. Magic Link / kunden-register) bleiben unberuehrt.

CREATE OR REPLACE FUNCTION public.enforce_employee_signup_domain()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_domain text;
BEGIN
  IF lower(coalesce(NEW.raw_user_meta_data ->> 'role', '')) = 'mitarbeiter' THEN
    v_domain := lower(split_part(trim(coalesce(NEW.email, '')), '@', 2));

    IF v_domain NOT IN ('likegroup.de', 'creatorjobs.com') THEN
      RAISE EXCEPTION 'EMPLOYEE_DOMAIN_NOT_ALLOWED'
        USING ERRCODE = 'check_violation',
              HINT = 'Mitarbeiter-Registrierung nur mit @likegroup.de oder @creatorjobs.com';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_employee_signup_domain ON auth.users;

CREATE TRIGGER trg_enforce_employee_signup_domain
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_employee_signup_domain();
