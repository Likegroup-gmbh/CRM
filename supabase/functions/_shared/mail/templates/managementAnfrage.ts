/**
 * Template: Management-Anfrage. Der Text kommt vom Mitarbeiter und ist schon
 * escaped (textToHtml in management-anfrage-send.js). Die Mail hat einen Link
 * und keinen PDF-Anhang. Das Briefing liegt auf der Seite.
 */

import { MAIL_MARKE } from '../tokens.ts';
import { renderShell } from '../shell.ts';
import { button, fallbackLink, fussHinweis, rohHtml } from '../sections.ts';
import type { MailErgebnis } from './typen.ts';

export interface ManagementAnfrageMail {
  betreff: string;
  /** Bereits escapter HTML-Text (Absätze als <p>). */
  textHtml: string;
  link: string;
  basisUrl?: string;
}

export function managementAnfrageMail(p: ManagementAnfrageMail): MailErgebnis {
  const html = renderShell({
    betreff: MAIL_MARKE.firma,
    titel: MAIL_MARKE.firma,
    inhalt: [
      rohHtml(p.textHtml, { oben: 20 }),
      button({ label: 'Creator vorschlagen', url: p.link }),
    ].join('\n'),
    footer: [
      fallbackLink({ intro: 'Button funktioniert nicht? Kopieren Sie diesen Link in Ihren Browser:', url: p.link }),
      fussHinweis('Das Briefing liegt auf der Seite, nicht als Anhang.', { oben: 12 }),
    ].join(''),
    imAuftragVon: MAIL_MARKE.firma,
    basisUrl: p.basisUrl,
  });
  return { betreff: p.betreff, html };
}
