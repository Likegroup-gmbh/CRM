/**
 * Template: Listen-Link an ein bestehendes Kundenkonto (share-list, ohne Code).
 */

import { MAIL_MARKE } from '../tokens.ts';
import { renderShell } from '../shell.ts';
import { absender, button, fallbackLink, text } from '../sections.ts';
import type { MailErgebnis } from './typen.ts';

export interface ListenLinkMail {
  /** "Kampagne", "Sourcing-Liste", "Strategie-Liste", "Skript" */
  entityLabel: string;
  entityName: string;
  sharedByName: string;
  url: string;
  basisUrl?: string;
}

export function listenLinkMail(p: ListenLinkMail): MailErgebnis {
  const von = p.sharedByName.trim() || 'Ihr Ansprechpartner';
  const betreff = `${p.entityLabel} „${p.entityName}"`;

  const inhalt = [
    absender({ name: von, firma: MAIL_MARKE.firma, text: ['hat Ihnen ', { fett: p.entityName }, ' geschickt.'] }),
    text('Sie haben bereits ein Kundenkonto. Öffnen Sie den Link und melden Sie sich an.'),
    button({ label: 'Liste öffnen', url: p.url }),
  ].join('\n');

  const html = renderShell({
    betreff,
    preheader: `${von} hat Ihnen ${p.entityLabel} „${p.entityName}" geschickt.`,
    kontext: p.entityName,
    titel: betreff,
    inhalt,
    footer: fallbackLink({ intro: 'Falls der Button nicht funktioniert, kopieren Sie diesen Link:', url: p.url }),
    imAuftragVon: MAIL_MARKE.firma,
    basisUrl: p.basisUrl,
  });
  return { betreff, html };
}
