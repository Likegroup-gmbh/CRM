/**
 * Template: Neue Einreichung. Geht an die Person, die eingeladen hat (intern, Du-Form).
 */

import { renderShell } from '../shell.ts';
import { button, infoZeilen, text } from '../sections.ts';
import type { MailErgebnis } from './typen.ts';

export interface EinreichungMail {
  art: 'briefing' | 'produkt' | 'konzept';
  /** Name aus der Sitzung des Kunden. */
  einreicherName: string;
  einladungLabel: string;
  kunde?: string;
  /** Ziel in der Plattform, z. B. Briefing-Tab der Produktion. */
  link: string;
  basisUrl?: string;
}

export function einreichungMail(p: EinreichungMail): MailErgebnis {
  const briefing = p.art === 'briefing';
  const konzept = p.art === 'konzept';
  const was = konzept ? 'eine Videoidee' : briefing ? 'ein Briefing' : 'ein Produkt';
  const titel = konzept ? 'Neue Videoidee eingereicht' : briefing ? 'Neues Briefing eingereicht' : 'Neues Produkt eingereicht';

  const inhalt = [
    text([
      { fett: p.einreicherName || 'Jemand' },
      ` hat über die Einladung „${p.einladungLabel}“ ${was} eingereicht.`,
    ]),
    infoZeilen([
      { label: konzept ? 'Marke' : 'Kunde', wert: p.kunde ?? '' },
      { label: 'Einladung', wert: p.einladungLabel },
    ]),
    text(
      konzept
        ? 'Die Einreichung wartet auf deine Prüfung. Erst „Anlegen“ erstellt die Videoidee im Konzept.'
        : 'Die Einreichung wartet auf deine Prüfung. Erst „Anlegen“ erstellt das Produkt bzw. Briefing.',
      { leise: true },
    ),
    button({ label: 'Einreichung prüfen', url: p.link }),
  ].filter(Boolean).join('\n');

  const html = renderShell({
    betreff: titel,
    preheader: `${p.einreicherName || 'Jemand'} hat ${was} eingereicht. Wartet auf deine Prüfung.`,
    kontext: p.kunde,
    titel,
    inhalt,
    basisUrl: p.basisUrl,
  });

  return { betreff: `${titel}: ${p.einladungLabel}`, html };
}
