/**
 * Template: Supabase-Auth-Mails (Bestätigen, Passwort zurücksetzen, Einladung).
 *
 * Supabase füllt die Platzhalter selbst ({{ .ConfirmationURL }}, {{ .SiteURL }}).
 * Die Mails werden nicht zur Laufzeit gerendert: scripts/mail-auth-templates.ts
 * schreibt sie nach supabase/templates/*.html, von dort fügt man sie im Dashboard
 * unter Authentication > Email Templates ein.
 */

import { MAIL_MARKE } from '../tokens.ts';
import { renderShell } from '../shell.ts';
import { button, fallbackLink, fussHinweis, text } from '../sections.ts';
import type { MailErgebnis } from './typen.ts';

export type AuthArt = 'bestaetigen' | 'passwort' | 'einladung';

export const AUTH_LINK = '{{ .ConfirmationURL }}';
export const AUTH_BASIS = '{{ .SiteURL }}';

const INHALT: Record<AuthArt, {
  betreff: string; titel: string; text: string; knopf: string; ignorieren: string;
}> = {
  bestaetigen: {
    betreff: `Bitte bestätigen Sie Ihre E-Mail-Adresse`,
    titel: 'E-Mail-Adresse bestätigen',
    text: `Willkommen bei ${MAIL_MARKE.produkt}. Bestätigen Sie Ihre E-Mail-Adresse, damit wir Ihr Konto freischalten können.`,
    knopf: 'E-Mail bestätigen',
    ignorieren: 'Haben Sie kein Konto angelegt? Dann können Sie diese E-Mail ignorieren.',
  },
  passwort: {
    betreff: 'Passwort zurücksetzen',
    titel: 'Passwort zurücksetzen',
    text: 'Sie haben angefordert, Ihr Passwort zurückzusetzen. Mit dem Button legen Sie ein neues fest.',
    knopf: 'Neues Passwort festlegen',
    ignorieren: 'Haben Sie das nicht angefordert? Dann können Sie diese E-Mail ignorieren, Ihr Passwort bleibt unverändert.',
  },
  einladung: {
    betreff: `Einladung zu ${MAIL_MARKE.produkt}`,
    titel: `Einladung zu ${MAIL_MARKE.produkt}`,
    text: `Sie wurden zu ${MAIL_MARKE.produkt} eingeladen. Mit dem Button nehmen Sie die Einladung an und legen Ihr Konto an.`,
    knopf: 'Einladung annehmen',
    ignorieren: 'Kennen Sie die Einladung nicht? Dann können Sie diese E-Mail ignorieren.',
  },
};

export function authMail(art: AuthArt): MailErgebnis {
  const c = INHALT[art];
  const html = renderShell({
    betreff: c.betreff,
    titel: c.titel,
    inhalt: [
      text(c.text),
      button({ label: c.knopf, url: AUTH_LINK }),
    ].join('\n'),
    footer: [
      fallbackLink({ intro: 'Button funktioniert nicht? Kopieren Sie diesen Link in Ihren Browser:', url: AUTH_LINK }),
      fussHinweis(c.ignorieren),
    ].join('\n'),
    imAuftragVon: MAIL_MARKE.firma,
    basisUrl: AUTH_BASIS,
  });
  return { betreff: c.betreff, html };
}
