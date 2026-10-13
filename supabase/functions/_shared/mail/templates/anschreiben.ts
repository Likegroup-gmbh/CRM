/**
 * Template: Anschreiben mit PDF-Anhang. Der Text kommt vom Mitarbeiter und ist
 * schon escaped (textToHtml in anschreiben-send.js), deshalb geht er über rohHtml.
 */

import { MAIL_MARKE } from '../tokens.ts';
import { renderShell } from '../shell.ts';
import { fussHinweis, rohHtml } from '../sections.ts';
import type { MailErgebnis } from './typen.ts';

export interface AnschreibenMail {
  betreff: string;
  /** Bereits escapter HTML-Text (Absätze als <p>). */
  textHtml: string;
  basisUrl?: string;
}

export function anschreibenMail(p: AnschreibenMail): MailErgebnis {
  const html = renderShell({
    betreff: MAIL_MARKE.firma,
    titel: MAIL_MARKE.firma,
    inhalt: rohHtml(p.textHtml, { oben: 20 }),
    footer: fussHinweis('Die Unterlagen hängen als PDF an dieser E-Mail.', { oben: 0 }),
    imAuftragVon: MAIL_MARKE.firma,
    basisUrl: p.basisUrl,
  });
  return { betreff: p.betreff, html };
}
