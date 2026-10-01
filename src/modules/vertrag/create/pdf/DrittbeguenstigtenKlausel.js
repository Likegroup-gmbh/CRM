// DrittbeguenstigtenKlausel.js
// § 6 Abs. 1, 4 und 5 aus dem EF-Vertrag (Drittbeguenstigung nach § 328 BGB).
// "EHG" ist der Kunden-Firmenname. Intern 1–3 nummeriert, ohne eigene §-Nummer,
// damit bestehende Paragraphen in den Standardvertraegen nicht verschoben werden.

import { ensureSpace, renderPaginatedText } from './PdfTextFlow.js';

const NAME_PLATZHALTER = '_'.repeat(20);

export function drittbeguenstigtenName(firmenname) {
  const name = firmenname == null ? '' : String(firmenname).trim();
  return name !== '' ? name : NAME_PLATZHALTER;
}

export function buildDrittbeguenstigtenKlausel(firmenname, lang = 'de') {
  const name = drittbeguenstigtenName(firmenname);
  if (lang === 'en') {
    return {
      title: `Rights of ${name} as third-party beneficiary`,
      paragraphs: [
        `1. ${name} is a third-party beneficiary within the meaning of § 328 BGB (German Civil Code) and acquires the own rights against the creator as set out below. The rights created in favour of ${name} may not be subsequently revoked or restricted in text form without the consent of ${name}.`,
        `2. Technical coordination is generally handled via the agency. ${name} may issue directly binding instructions to the creator insofar as these serve to comply with the project sheet, the briefing, technical or brand-related specifications or the avoidance of legal risks. In the event of contradictory instructions, the creator shall inform the agency and ${name} without undue delay. In case of doubt, the instruction of ${name} shall prevail.`,
        '3. The statutory objections of the creator under this contract remain unaffected.'
      ]
    };
  }
  return {
    title: `Rechte von ${name} als begünstigte Dritte`,
    paragraphs: [
      `1. ${name} ist begünstigte Dritte im Sinne von § 328 BGB und erwirbt die nachfolgend bestimmten eigenen Rechte gegen den Creator. Die zugunsten von ${name} entstandenen Rechte können ohne Zustimmung von ${name} in Textform nicht nachträglich aufgehoben oder beschränkt werden.`,
      `2. Die fachliche Abstimmung erfolgt grundsätzlich über die Agentur. ${name} darf dem Creator unmittelbar verbindliche Weisungen erteilen, soweit diese der Einhaltung des Projektblatts, des Briefings, technischer oder markenbezogener Vorgaben oder der Vermeidung rechtlicher Risiken dienen. Bei widersprechenden Weisungen informiert der Creator Agentur und ${name} unverzüglich. Im Zweifel geht die Weisung von ${name} vor.`,
      '3. Die gesetzlichen Einwendungen des Creators aus diesem Vertrag bleiben bestehen.'
    ]
  };
}

/**
 * Schreibt Titel und die drei Absaetze vor den Unterschriftenblock.
 * Liefert die Y-Position nach dem Block.
 */
export function drawDrittbeguenstigtenKlausel(doc, {
  firmenname,
  lang = 'de',
  y,
  maxContentY,
  onPageBreak,
  x = 14,
  maxWidth = 180
}) {
  const { title, paragraphs } = buildDrittbeguenstigtenKlausel(firmenname, lang);
  let cursor = ensureSpace(y + 10, 24, maxContentY, onPageBreak);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  cursor = renderPaginatedText(doc, title, {
    x, y: cursor, maxWidth, lineHeight: 6, maxContentY, onPageBreak
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  cursor += 2;
  paragraphs.forEach((paragraph) => {
    cursor = renderPaginatedText(doc, paragraph, {
      x, y: cursor, maxWidth, lineHeight: 5, maxContentY, onPageBreak
    });
    cursor += 3;
  });
  return cursor;
}
