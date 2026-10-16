// Download eines oder mehrerer Skripte als das bestehende Anschreiben-PDF.

import { createSkriptAnhang, creatorFuerAnschreiben, sanitizeSkriptFilename } from './SkriptPdf.js';

export { sanitizeSkriptFilename };

/** Eine Zeile aus dem Skript-Loader in das Anschreiben-PDF-Format. */
export function pdfItemAusSkript(skript, verknuepfungen = []) {
  const creator = creatorFuerAnschreiben(skript, verknuepfungen);
  const customerName = skript?.marke?.markenname
    || skript?.unternehmen?.firmenname
    || skript?.kampagne?.kampagnenname
    || skript?.kampagne?.eigener_name
    || '';
  return {
    titel: skript?.titel || 'Skript',
    hook: skript?.hook || '',
    hauptteil: skript?.hauptteil || '',
    cta: skript?.cta || '',
    hook_visuell: skript?.hook_visuell || '',
    hauptteil_visuell: skript?.hauptteil_visuell || '',
    cta_visuell: skript?.cta_visuell || '',
    rezept: skript?.rezept || '',
    caption: skript?.caption || '',
    text_hook: skript?.text_hook || '',
    creator,
    instagram: creator?.instagram || '',
    produktName: skript?.produkt?.name || '',
    videoUrl: skript?.strategie_item?.video_link || '',
    customerLogoUrl: skript?.marke?.logo_url || skript?.unternehmen?.logo_url || '',
    customerName
  };
}

export async function downloadSkriptePdf(skripte, { dateiname, verknuepfungenNachId } = {}) {
  const items = (skripte || []).map((skript) => pdfItemAusSkript(
    skript,
    verknuepfungenNachId?.get?.(skript.id) || []
  ));
  const result = await createSkriptAnhang(items, {
    dateiname: dateiname || sanitizeSkriptFilename(items[0]?.titel)
  });
  const url = URL.createObjectURL(result.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = result.dateiname;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
