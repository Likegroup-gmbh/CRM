/**
 * Template: Liste an ein bestehendes Konto teilen (share-list, ohne Code).
 * Gleicher Aufbau wie teilen.ts, statt Code und Rechten der Weg über das eigene Login.
 */

import { MAIL_MARKE } from '../tokens.ts';
import { renderShell } from '../shell.ts';
import {
  absender, button, fallbackLink, fussHinweis, infoZeilen, nachricht, text, trenner, ueberschrift,
} from '../sections.ts';
import type { MailErgebnis } from './typen.ts';

export interface ListenLinkMail {
  /** "Kampagne", "Sourcing-Liste", "Strategie-Liste", "Skript" */
  entityLabel: string;
  /** "die" oder "das" */
  entityArticle?: string;
  entityName: string;
  sharedByName: string;
  url: string;
  /** Adresse des Kontos, mit der sich der Empfänger anmeldet. */
  email?: string;
  message?: string;
  basisUrl?: string;
}

export function listenLinkMail(p: ListenLinkMail): MailErgebnis {
  const article = p.entityArticle || 'die';
  const artikelGross = article === 'das' ? 'Ein' : 'Eine';
  const inDer = article === 'das' ? 'im' : 'in der';
  const liste = `${article} ${p.entityLabel}`;
  const von = p.sharedByName.trim() || 'Ihr Ansprechpartner';

  const inhalt = [
    absender({ name: von, firma: MAIL_MARKE.firma, text: [`hat ${liste} `, { fett: p.entityName }, ' mit Ihnen geteilt.'] }),
    text(`Sie finden ${liste} direkt in Ihrem Konto.`),
    p.message ? nachricht({ titel: `Nachricht von ${von}`, text: p.message }) : '',
    trenner({ oben: 24, unten: 0 }),
    ueberschrift({
      titel: 'Einfach öffnen',
      text: `Sie haben bereits ein Konto, einen Code brauchen Sie nicht. Sind Sie angemeldet, öffnet sich ${liste} sofort. `
        + `Sonst melden Sie sich wie gewohnt an und landen danach direkt ${inDer} ${p.entityLabel}.`,
      oben: 24,
    }),
    p.email ? infoZeilen([{ label: 'Ihr Konto', wert: p.email }]) : '',
    button({ label: `${p.entityLabel} öffnen`, url: p.url }),
  ].filter(Boolean).join('\n');

  const html = renderShell({
    betreff: `${p.entityLabel} geteilt`,
    preheader: `${von} hat ${liste} mit Ihnen geteilt. Sie haben schon ein Konto, ein Code ist nicht nötig.`,
    kontext: p.entityName,
    titel: `${artikelGross} ${p.entityLabel} wurde mit Ihnen geteilt`,
    inhalt,
    footer: [
      fallbackLink({ intro: 'Button funktioniert nicht? Kopieren Sie diesen Link in Ihren Browser:', url: p.url }),
      fussHinweis('Passwort vergessen? Auf der Anmeldeseite können Sie ein neues anfordern.'),
      fussHinweis('Kolleginnen und Kollegen ohne eigenes Konto bekommen einen eigenen Zugang. Antworten Sie dafür einfach auf diese Mail.', { oben: 8 }),
    ].join('\n'),
    imAuftragVon: MAIL_MARKE.firma,
    basisUrl: p.basisUrl,
  });

  return { betreff: `${p.entityLabel} „${p.entityName}" wurde mit Ihnen geteilt`, html };
}
