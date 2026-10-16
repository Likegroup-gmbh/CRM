/**
 * Template: Liste, Skript oder Kampagne teilen (share-list).
 */

import { MAIL_MARKE } from '../tokens.ts';
import { esc } from '../html.ts';
import { renderShell } from '../shell.ts';
import {
  absender, button, codeFeld, fallbackLink, nachricht, text, trenner, ueberschrift,
} from '../sections.ts';
import type { MailErgebnis } from './typen.ts';

export interface TeilenMail {
  /** "Kampagne", "Sourcing-Liste", "Strategie-Liste", "Skript" */
  entityLabel: string;
  /** "die" oder "das" */
  entityArticle: string;
  entityName: string;
  sharedByName: string;
  rechte: 'ansehen' | 'feedback' | string;
  link: string;
  code: string;
  message?: string;
  /** Skript-Zugang für alle Skripte einer Kampagne. */
  allScripts?: boolean;
  /** Titel, die im Link liegen. Stehen in der Mail unter dem Einleitungssatz. */
  titles?: string[];
  basisUrl?: string;
}

function rechteText(p: TeilenMail): string {
  const article = p.entityArticle || 'die';
  const isSkript = p.entityLabel === 'Skript';
  if (p.allScripts) {
    return p.rechte === 'feedback'
      ? 'Sie können die Skripte ansehen, kommentieren und Änderungen vornehmen.'
      : 'Sie können die Skripte ansehen.';
  }
  if (p.rechte === 'feedback') {
    return isSkript
      ? `Sie können ${article} ${p.entityLabel} ansehen, kommentieren und Änderungen vornehmen.`
      : `Sie können ${article} ${p.entityLabel} ansehen und Feedback geben.`;
  }
  return `Sie können ${article} ${p.entityLabel} ansehen.`;
}

export function teilenMail(p: TeilenMail): MailErgebnis {
  const article = p.entityArticle || 'die';
  const artikelGross = article === 'das' ? 'Ein' : 'Eine';
  const von = p.sharedByName.trim() || 'Ihr Ansprechpartner';

  const titel = p.allScripts
    ? 'Skripte geteilt'
    : `${p.entityLabel} geteilt`;
  const ueberschriftText = p.allScripts
    ? 'Die Skripte einer Kampagne wurden mit Ihnen geteilt'
    : `${artikelGross} ${p.entityLabel} wurde mit Ihnen geteilt`;
  const satz = p.allScripts
    ? ['hat die Skripte der Kampagne ', { fett: p.entityName }, ' mit Ihnen geteilt.']
    : [`hat ${article} ${p.entityLabel} `, { fett: p.entityName }, ' mit Ihnen geteilt.'];

  const inhalt = [
    absender({ name: von, firma: MAIL_MARKE.firma, text: satz }),
    text(`${rechteText(p)} Leiten Sie diese Mail gerne an Kolleginnen und Kollegen weiter.`),
    p.message ? nachricht({ titel: `Nachricht von ${von}`, text: p.message }) : '',
    (p.titles || []).length
      ? `<tr><td style="padding-top:16px;"><ul style="margin:0;padding-left:18px;">${
        (p.titles || []).map((titel) => `<li style="margin:0 0 6px 0;">${esc(titel)}</li>`).join('')
      }</ul></td></tr>`
      : '',
    trenner({ oben: 24, unten: 0 }),
    ueberschrift({
      titel: 'Ihr Zugang',
      text: 'Beim Öffnen geben Sie den Code und Ihren Namen ein. Ein Account ist nicht nötig.',
      oben: 24,
    }),
    codeFeld({ label: 'Code', code: p.code }),
    button({ label: p.allScripts ? 'Skripte öffnen' : `${p.entityLabel} öffnen`, url: p.link }),
  ].filter(Boolean).join('\n');

  const html = renderShell({
    betreff: titel,
    preheader: `Ihr Code: ${p.code}. ${von} hat ${p.allScripts ? 'Skripte' : `${article} ${p.entityLabel}`} mit Ihnen geteilt, ganz ohne Account.`,
    kontext: p.entityName,
    titel: ueberschriftText,
    inhalt,
    footer: fallbackLink({ intro: 'Button funktioniert nicht? Kopieren Sie diesen Link in Ihren Browser:', url: p.link }),
    imAuftragVon: MAIL_MARKE.firma,
    basisUrl: p.basisUrl,
  });

  const betreff = p.titles?.length
    ? `Skripte der Kampagne ${p.entityName}`
    : p.allScripts
      ? `Skripte der Kampagne „${p.entityName}" wurden mit Ihnen geteilt`
      : `${p.entityLabel} „${p.entityName}" wurde mit Ihnen geteilt`;
  return { betreff, html };
}
