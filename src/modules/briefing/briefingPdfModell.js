// briefingPdfModell.js
// Creator-PDF (Anschreiben): die drei Sektionen des Creator-Briefings als Textblöcke für
// BriefingPdf.js. Gleiches Modell wie die DocView, ohne CRM-Badges, ohne „Frühere Angaben“.

import { briefingSektionen, produktNamen } from './briefingDokument.js';

export function htmlToPlainText(html) {
  if (html == null || html === '') return '';
  const str = String(html);
  const normalized = str.replace(/<br\s*\/?>/gi, '\n');
  // Immer ueber den DOM-Parser: decodiert alle Entities (u.a. &#x2F;, &#x27;),
  // die der Validator beim Escapen erzeugt. Kein manueller Replace-Pfad.
  const node = document.createElement('div');
  node.innerHTML = normalized;
  const text = node.innerText ?? node.textContent ?? '';
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function eintragBlocks(eintrag) {
  if (eintrag.art === 'produkt') {
    return [
      { type: 'sub', text: eintrag.name },
      ...(eintrag.url && eintrag.url !== eintrag.name ? [{ type: 'prose', text: eintrag.url }] : []),
      ...eintrag.zeilen.map(z => ({ type: 'spec', label: z.label, text: z.text }))
    ];
  }
  const text = eintrag.text ?? htmlToPlainText(eintrag.html);
  return text ? [{ type: 'spec', label: eintrag.label, text }] : [];
}

/** @returns {{ title, subtitle, products, meta, sections: { title, blocks }[] }} */
export function buildBriefingPdfModel(detail) {
  const b = detail?.briefing || {};
  const sections = briefingSektionen(detail)
    .map((sektion) => {
      const blocks = sektion.eintraege.flatMap(eintragBlocks);
      if (!blocks.length) return null;
      if (sektion.hinweis) blocks.unshift({ type: 'prose', text: sektion.hinweis });
      return { title: sektion.titel, blocks };
    })
    .filter(Boolean);

  const subtitle = [b.unternehmen?.firmenname, b.marke?.markenname].filter(Boolean).join(' · ') || null;
  return {
    title: b.aktivierung_name || 'Briefing',
    subtitle,
    products: produktNamen(b).join(' · ') || null,
    meta: null,
    sections
  };
}
