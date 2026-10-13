/**
 * Template: Rohmaterial-Upload für Creator. Deutsch zuerst, Englisch darunter, eine Karte.
 */

import { MAIL_MARKE } from '../tokens.ts';
import { renderShell } from '../shell.ts';
import { button, infoZeilen, text, trenner } from '../sections.ts';
import type { MailErgebnis } from './typen.ts';

export interface CreatorUploadMail {
  creatorVorname?: string;
  kampagneName?: string;
  link: string;
  /** ISO-Datum, bis wann der Link gilt. */
  expiresAt?: string;
  basisUrl?: string;
}

function formatDate(iso: string | undefined, locale: 'de' | 'en'): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(locale === 'en' ? 'en-GB' : 'de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function creatorUploadMail(p: CreatorUploadMail): MailErgebnis {
  const vorname = (p.creatorVorname ?? '').trim();
  const kampagne = (p.kampagneName ?? '').trim();

  const inhalt = [
    text(`Hallo${vorname ? ` ${vorname}` : ''},`),
    text(['für die Kampagne ', { fett: kampagne }, ' kannst du dein Rohmaterial jetzt direkt hochladen.'], { oben: 12 }),
    button({ label: 'Rohmaterial hochladen', url: p.link }),
    infoZeilen([{ label: 'Link gültig bis', wert: formatDate(p.expiresAt, 'de') }]),
    text('Du kannst alle Clips auf einmal auswählen. Den Schnitt übernehmen wir. Du kannst nichts löschen oder überschreiben.'),
    text('Bei Fragen antworte einfach auf diese E-Mail.', { leise: true, oben: 12 }),
    trenner({ oben: 28, unten: 0 }),
    text(`Hi${vorname ? ` ${vorname}` : ''},`, { oben: 24 }),
    text(['for the campaign ', { fett: kampagne }, ' you can now upload your raw footage directly.'], { oben: 12 }),
    button({ label: 'Upload raw footage', url: p.link }),
    infoZeilen([{ label: 'Link valid until', wert: formatDate(p.expiresAt, 'en') }]),
    text('You can select all your clips at once. We take care of the edit. You cannot delete or overwrite anything.'),
    text('If you have any questions, just reply to this email.', { leise: true, oben: 12 }),
  ].filter(Boolean).join('\n');

  const html = renderShell({
    betreff: `Rohmaterial-Upload / Raw footage upload`,
    preheader: `Rohmaterial für ${kampagne} hochladen / Upload raw footage for ${kampagne}`,
    kontext: kampagne,
    titel: 'Rohmaterial hochladen',
    inhalt,
    imAuftragVon: MAIL_MARKE.firma,
    zweisprachig: true,
    basisUrl: p.basisUrl,
  });

  return { betreff: `Rohmaterial-Upload für ${kampagne} / Raw footage upload for ${kampagne}`, html };
}
