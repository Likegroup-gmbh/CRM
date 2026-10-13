/**
 * Template: Einladung (Briefing oder Produkt) mit Link und Code (ADR 0055).
 */

import { MAIL_MARKE } from '../tokens.ts';
import { renderShell } from '../shell.ts';
import {
  absender, button, codeFeld, fallbackLink, fussHinweis, nachricht, schritte, trenner, ueberschrift,
} from '../sections.ts';
import type { MailErgebnis } from './typen.ts';

/**
 * Schritte des Kundenformulars. src/__tests__/MailSystem.test.js gleicht die Liste
 * mit kundenSteps() (einladungFelder.js) ab, damit sie nicht auseinanderläuft.
 */
export const BRIEFING_SCHRITTE = ['Grundlage', 'Casting', 'Aufgabe', 'Konzepte', 'Kanäle und Nutzung'] as const;

/** Anzeigenamen der Briefing-Typen (wie fieldConfig.js). */
export const BRIEFING_TYP_LABEL: Record<string, string> = {
  paid_creator_ads: 'Paid',
  owned_social: 'Organic',
  influencer_marketing: 'Influencer',
};

const ZAHLWORT: Record<number, string> = { 2: 'zwei', 3: 'drei', 4: 'vier', 5: 'fünf', 6: 'sechs', 7: 'sieben', 8: 'acht' };

export interface EinladungMail {
  art: 'briefing' | 'produkt';
  briefingTyp?: string | null;
  /** Name der Person, die einlädt. */
  absenderName: string;
  /** Kunde, z. B. "Firma · Marke". */
  kunde?: string;
  nachricht?: string;
  code: string;
  link: string;
  basisUrl?: string;
}

export function einladungMail(p: EinladungMail): MailErgebnis {
  const briefing = p.art === 'briefing';
  const absenderName = p.absenderName.trim() || 'Ihr Ansprechpartner bei LikeGroup';
  const betreffTitel = briefing ? 'Bitte füllen Sie Ihr Briefing aus' : 'Bitte tragen Sie Ihr Produkt ein';

  const inhalt = [
    absender({
      name: absenderName,
      firma: MAIL_MARKE.firma,
      text: briefing ? 'bittet Sie, dieses Briefing auszufüllen.' : 'bittet Sie, Ihre Produkte einzutragen.',
    }),
    p.nachricht ? nachricht({ titel: `Nachricht von ${absenderName}`, text: p.nachricht }) : '',
    trenner({ oben: 24, unten: 0 }),
    ueberschrift({
      titel: 'Ihr Zugang',
      text: 'Beim Öffnen geben Sie den Code und Ihren Namen ein. Ein Account ist nicht nötig.',
      oben: 24,
    }),
    codeFeld({ label: 'Code', code: p.code }),
    button({ label: 'Formular öffnen', url: p.link }),
    briefing ? trenner({ oben: 28, unten: 0 }) : '',
    briefing
      ? schritte({
        titel: 'So ist das Formular aufgebaut',
        text: `Sie werden in ${ZAHLWORT[BRIEFING_SCHRITTE.length] ?? BRIEFING_SCHRITTE.length} Schritten durch das Briefing geführt.`,
        items: [...BRIEFING_SCHRITTE],
        oben: 24,
      })
      : '',
  ].filter(Boolean).join('\n');

  const html = renderShell({
    betreff: betreffTitel,
    preheader: `Ihr Code: ${p.code}. ${briefing ? 'Briefing' : 'Produkt'}${p.kunde ? ` für ${p.kunde}` : ''} ${briefing ? 'ausfüllen' : 'eintragen'}, ganz ohne Account.`,
    kontext: p.kunde,
    titel: briefing ? 'Briefing ausfüllen' : 'Produkt eintragen',
    badge: briefing && p.briefingTyp ? BRIEFING_TYP_LABEL[p.briefingTyp] : undefined,
    inhalt,
    footer: [
      fallbackLink({ intro: 'Button funktioniert nicht? Kopieren Sie diesen Link in Ihren Browser:', url: p.link }),
      fussHinweis(briefing ? 'Fragen zum Briefing? Antworten Sie einfach auf diese E-Mail.' : 'Fragen? Antworten Sie einfach auf diese E-Mail.'),
    ].join('\n'),
    imAuftragVon: MAIL_MARKE.firma,
    basisUrl: p.basisUrl,
  });

  return { betreff: p.kunde ? `${betreffTitel} – ${p.kunde}` : betreffTitel, html };
}
